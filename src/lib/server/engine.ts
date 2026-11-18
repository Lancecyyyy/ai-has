import "server-only";
import { randomUUID } from "node:crypto";
import { q, one } from "./db";
import type { SessionUser } from "./auth";
import { runGuardrails, rateLimit } from "../ai/guardrails";
import { classifyIntent, extractSoftware, inferPriority, type Intent } from "../ai/intents";
import { confidence, type Hit } from "../ai/rag";
import { hasOpenAI, streamOpenAI, SYSTEM_PROMPT, type ChatMsg } from "../ai/openai";
import { searchKb, logGap, bumpCitations } from "./kb";
import { createTicket, summarizeConversation } from "./tickets";
import { isEnabled, WORKFLOWS } from "./automations";

export type ChatEvent =
  | { type: "start"; conversationId: string; title: string; userMessage: { id: number; content: string }; redactions: { type: string; count: number }[] }
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: StoredMessage }
  | { type: "error"; error: string };

export interface Source {
  n: number;
  docId: number;
  title: string;
  heading: string;
  score: number;
  excerpt: string;
}

export interface MessageMeta {
  kind?: "answer" | "smalltalk" | "automation_offer" | "automation_result" | "ticket" | "blocked" | "gap" | "out_of_scope";
  intent?: string;
  intentLabel?: string;
  confidence?: number;
  engine?: "openai" | "local";
  sources?: Source[];
  quickReplies?: string[];
  redactions?: { type: string; count: number }[];
  blocked?: string;
  incident?: { title: string; service: string; since: string };
  action?: { workflow: string; label: string; state: "proposed" | "done" | "declined"; runId?: number };
  run?: { id: number; status: string; summary: string; steps: { label: string; detail: string; ms: number; ok: boolean }[] };
  ticket?: { key: string; priority: string; assignee: string; slaHours: number };
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  meta: MessageMeta;
  latency_ms: number | null;
  feedback: number | null;
  created_at: string;
}

const CONFIDENT = 0.42;

const OFFERS: Record<string, string> = {
  password_reset:
    "I can send you a password reset link right now. It goes to your registered work email and expires in 15 minutes. Please don't type your old or new password here.",
  account_unlock: "It sounds like your account is locked. I can unlock it for you right away; I'll verify it's you through your current session.",
  mfa_reset: "I can reset your MFA. That removes the authenticator on your old phone and gives you a new enrollment code valid for 24 hours.",
  vpn_reset: "That error usually means your VPN profile needs to be re-issued. I can revoke the old certificate and push a fresh profile to your laptop.",
  software_access: "",
  print_queue: "I can clear your stuck print jobs and restart the print spooler on the FollowMe queue.",
  mailbox_cleanup: "I can run the mailbox cleanup, which moves mail older than 12 months to your unlimited Online Archive. Nothing gets deleted.",
};

function softwareOffer(text: string) {
  const app = extractSoftware(text);
  if (!app) return "I can request that software for you through the catalog.";
  return app.preApproved
    ? `${app.name} is pre-approved, so I can install it on your laptop right now. No approval needed.`
    : `${app.name} uses a paid license, so it needs your manager's approval. I can send the request now and it will be provisioned automatically once approved.`;
}

const STILL_BROKEN = /^\s*(still (not working|broken|the same|doesn'?t work|having)|didn'?t (work|help|fix)|not fixed|no luck|that didn'?t|nope,? still)/i;
const SHOW_STEPS = /^\s*(show me the (manual )?steps|i'?ll do it myself|not now)/i;

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function trimSection(text: string, max = 900) {
  if (text.length <= max) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length > max) break;
    out.push(l);
    len += l.length + 1;
  }
  return out.join("\n");
}

/** Extractive answer built only from retrieved manual text (no model required). */
export function composeLocal(hits: Hit[]): string {
  const top = hits[0];
  const leads = [
    `From the **${top.docTitle}** guide [1]:`,
    `Here's the fix from **${top.docTitle}** [1]:`,
    `This is covered in **${top.docTitle}**, under *${top.heading}* [1]:`,
  ];
  let out = `${leads[hash(top.heading) % leads.length]}\n\n${trimSection(top.content)}`;
  const second = hits.slice(1).find((h) => h.score > top.score * 0.7 && h.id !== top.id);
  if (second) {
    const firstLines = second.content.split("\n").filter(Boolean).slice(0, 2).join("\n");
    out += `\n\nAlso relevant, *${second.heading}* [2]:\n${firstLines}`;
  }
  out += "\n\nDid that sort it out?";
  return out;
}

function toSources(hits: Hit[]): Source[] {
  return hits.map((h, i) => ({
    n: i + 1,
    docId: h.documentId,
    title: h.docTitle,
    heading: h.heading,
    score: Math.round(h.score * 100) / 100,
    excerpt: h.content.slice(0, 220),
  }));
}

async function activeIncident(text: string) {
  const rows = await q<{ title: string; name: string; keywords: string; created_at: string }>(
    `select i.title, s.name, s.keywords, i.created_at from incidents i join services s on s.id = i.service_id
     where i.status = 'active' order by i.created_at desc`,
  );
  const t = text.toLowerCase();
  const hit = rows.find((r) => r.keywords.split(/\s+/).some((k) => k && t.includes(k)));
  return hit ? { title: hit.title, service: hit.name, since: new Date(hit.created_at).toISOString() } : undefined;
}

export async function securityEvent(userId: number | null, type: string, severity: string, detail: string, sample = "") {
  await q("insert into security_events (user_id, type, severity, detail, sample) values ($1,$2,$3,$4,$5)", [userId, type, severity, detail, sample.slice(0, 200)]);
}

export async function runTurn(
  user: SessionUser,
  input: { conversationId?: string | null; text: string },
  emit: (e: ChatEvent) => void,
) {
  const t0 = Date.now();
  const raw = input.text.trim();
  if (!raw) return emit({ type: "error", error: "Type a message first." });

  if (!rateLimit(`chat:${user.id}`)) {
    await securityEvent(user.id, "rate_limited", "medium", "More than 15 messages in a minute");
    return emit({ type: "error", error: "You're sending messages very quickly. Give it a minute and try again." });
  }

  const guard = runGuardrails(raw);

  // Conversation (ownership enforced)
  let convId = input.conversationId ?? null;
  let title = "";
  if (convId) {
    const c = await one<{ id: string; title: string }>("select id, title from conversations where id = $1 and user_id = $2", [convId, user.id]);
    if (!c) return emit({ type: "error", error: "Conversation not found." });
    title = c.title;
  } else {
    convId = randomUUID();
    title = guard.text.replace(/\s+/g, " ").slice(0, 60) + (guard.text.length > 60 ? "…" : "");
    await q("insert into conversations (id, user_id, title) values ($1,$2,$3)", [convId, user.id, title]);
  }
  const conversationId = convId;

  const [um] = await q<{ id: number }>(
    "insert into messages (conversation_id, role, content, meta) values ($1,'user',$2,$3::jsonb) returning id",
    [conversationId, guard.text, JSON.stringify({ redactions: guard.redactions })],
  );
  emit({ type: "start", conversationId, title, userMessage: { id: um.id, content: guard.text }, redactions: guard.redactions });

  if (guard.redactions.length) {
    const what = guard.redactions.map((r) => `${r.count} ${r.type.replace("_", " ")}`).join(", ");
    await securityEvent(user.id, "pii_redacted", guard.redactions.some((r) => r.type === "password" || r.type === "card") ? "medium" : "low", `Redacted ${what}`, guard.text);
  }

  const history = await q<{ role: string; content: string; meta: MessageMeta }>(
    "select role, content, meta from messages where conversation_id = $1 and id < $2 order by id desc limit 8",
    [conversationId, um.id],
  );
  history.reverse();

  const reply = async (content: string, meta: MessageMeta, opts: { stream?: AsyncGenerator<string> } = {}) => {
    let text = content;
    if (opts.stream) {
      text = "";
      try {
        for await (const d of opts.stream) {
          text += d;
          emit({ type: "delta", text: d });
        }
      } catch {
        text = "";
      }
      if (!text) {
        // Model failed mid-flight: fall back to the extractive answer.
        meta.engine = "local";
        text = content;
        await typeOut(text, emit);
      }
    } else {
      await typeOut(text, emit);
    }
    const latency = Date.now() - t0;
    const [m] = await q<StoredMessage>(
      `insert into messages (conversation_id, role, content, meta, latency_ms) values ($1,'assistant',$2,$3::jsonb,$4)
       returning id, role, content, meta, latency_ms, feedback, created_at`,
      [conversationId, text, JSON.stringify(meta), latency],
    );
    await q("update conversations set updated_at = now(), intent = coalesce($2, intent) where id = $1", [conversationId, meta.intent ?? null]);
    emit({ type: "done", message: m });
  };

  const escalate = async (intent: Intent, reason: string, lead: string) => {
    emit({ type: "status", text: "Packaging details for IT" });
    const { transcript, tried } = await summarizeConversation(conversationId, guard.text);
    const priority = inferPriority(transcript, intent.id);
    const aiSummary = [
      `${user.name} (${user.department}) needs help with: ${intent.label.toLowerCase()}.`,
      `Why escalated: ${reason}.`,
      tried.length ? `Already suggested from manuals: ${tried.join(", ")}.` : "No manual matched the request closely.",
      `Suggested first step: confirm the device and the exact error message with the employee.`,
    ].join(" ");
    const lastUser = history.filter((h) => h.role === "user").pop()?.content;
    const subject = (STILL_BROKEN.test(guard.text) || intent.id === "human") && lastUser ? lastUser : guard.text;
    const ticket = await createTicket({
      conversationId,
      requesterId: user.id,
      title: subject.replace(/\s+/g, " ").slice(0, 120),
      description: transcript,
      aiSummary,
      category: intent.category,
      priority,
      intent: intent.id,
    });
    await reply(
      `${lead}\n\nI've opened ticket **${ticket.key}** (${ticket.priority}) and passed along everything we've discussed, so you won't have to repeat yourself. **${ticket.assignee}** will pick it up; the target response time is ${ticket.slaHours} hours. You can follow it under My tickets.`,
      { kind: "ticket", intent: intent.id, intentLabel: intent.label, ticket, quickReplies: ["Thanks", "I have another question"] },
    );
  };

  // 1. Hard blocks
  if (guard.injection) {
    await securityEvent(user.id, "injection_blocked", "high", guard.injection, raw);
    return reply(
      "I can't do that. I only follow Meridian's IT support policies and can only act on your own account. If you have an IT problem, tell me what's going on and I'll help.",
      { kind: "blocked", blocked: guard.injection, quickReplies: ["Reset my password", "VPN won't connect"] },
    );
  }
  if (guard.abuse) {
    await securityEvent(user.id, "abuse_blocked", "medium", guard.abuse, raw);
    return reply("Let's keep it professional so I can help. Describe the IT problem in a sentence or two and I'll take it from there.", {
      kind: "blocked",
      blocked: guard.abuse,
    });
  }

  emit({ type: "status", text: "Understanding your request" });
  const intent = classifyIntent(guard.text);
  const incident = await activeIncident(guard.text);
  // The incident is shown as a banner from meta.incident, so the reply text stays clean.
  const incidentLine = "";

  if (guard.outOfScope && (intent.id === "general" || intent.id === "human")) {
    await securityEvent(user.id, "out_of_scope", "low", `${guard.outOfScope} question`, guard.text);
    return reply(
      `That's a ${guard.outOfScope.toLowerCase()} question, which is outside what the IT helpdesk covers. Please reach the People & Payroll team through the HR portal or at hr@meridian.example. For anything IT related, I'm right here.`,
      { kind: "out_of_scope", intent: "out_of_scope", intentLabel: guard.outOfScope, quickReplies: ["Reset my password", "Request software"] },
    );
  }

  if (/^\s*(i have another question|another question|one more thing)\b/i.test(guard.text)) {
    return reply("Sure, what's going on?", { kind: "smalltalk", intent: "greeting", quickReplies: ["My laptop is slow", "Wi-Fi keeps dropping", "Request software"] });
  }

  switch (intent.id) {
    case "greeting":
      return reply(`Hi ${user.name.split(" ")[0]}. I'm the Meridian IT assistant. Tell me what's not working, or pick one of these.`, {
        kind: "smalltalk",
        intent: intent.id,
        quickReplies: ["I forgot my password", "VPN won't connect", "I need Figma", "My laptop is slow"],
      });
    case "thanks":
      return reply("Anytime. If something else comes up, I'm here around the clock.", { kind: "smalltalk", intent: intent.id });
    case "resolved":
      await q("update conversations set status = 'resolved' where id = $1 and status <> 'escalated'", [conversationId]);
      return reply("Glad that's sorted. I've marked this conversation as resolved.", { kind: "smalltalk", intent: intent.id, quickReplies: ["I have another question"] });
    case "human":
      return escalate(intent, "employee asked for a person", "Of course, I'll get a person on this.");
    case "security_incident": {
      return escalate(
        intent,
        "possible security incident",
        `Thanks for reporting this quickly, that matters. While Security takes a look:\n\n1. If you suspect malware, disconnect the laptop from Wi-Fi.\n2. Don't delete the suspicious email; Security needs it.\n3. Reset your password from a different, trusted device.`,
      );
    }
    case "hardware_repair":
      return escalate(
        intent,
        "physical hardware repair needed",
        "Physical repairs are something I can't do from here, but the hardware team can. Please stop using the device if there's liquid or a swollen battery.",
      );
  }

  if (STILL_BROKEN.test(guard.text) && history.some((h) => h.role === "assistant")) {
    const prevIntent = classifyIntent(history.filter((h) => h.role === "user").pop()?.content ?? guard.text);
    return escalate(prevIntent, "the self-service steps didn't fix it", "Sorry that didn't do it. Let's get a person on this.");
  }

  // 2. Routine requests -> offer an automation
  let queryText = guard.text;
  if (SHOW_STEPS.test(guard.text)) {
    const prevUser = history.filter((h) => h.role === "user").pop();
    if (prevUser) queryText = prevUser.content;
    const offer = [...history].reverse().find((h) => h.meta?.action?.state === "proposed");
    if (offer) await q("update messages set meta = jsonb_set(meta, '{action,state}', '\"declined\"') where conversation_id = $1 and meta->'action'->>'state' = 'proposed'", [conversationId]);
  } else if (intent.workflow && (await isEnabled(intent.workflow))) {
    const wf = WORKFLOWS.find((w) => w.id === intent.workflow)!;
    const text = intent.workflow === "software_access" ? softwareOffer(guard.text) : OFFERS[intent.workflow];
    return reply(incidentLine + text, {
      kind: "automation_offer",
      intent: intent.id,
      intentLabel: intent.label,
      incident,
      action: { workflow: wf.id, label: wf.name, state: "proposed" },
    });
  }

  // 3. Answer from manuals (RAG)
  emit({ type: "status", text: "Searching the manuals" });
  const hits = await searchKb(queryText, 4);
  const conf = confidence(hits);
  if (!hits.length || conf < CONFIDENT) {
    await logGap(queryText);
    return reply(
      incidentLine +
        "I couldn't find that in our IT manuals, and I'd rather not guess. Could you add a bit more detail, like the app name or the exact error? Or I can open a ticket for the IT team.",
      { kind: "gap", intent: intent.id, intentLabel: intent.label, confidence: conf, incident, quickReplies: ["Open a ticket", "VPN won't connect", "Reset my password"] },
    );
  }

  const used = hits.filter((h, i) => i === 0 || h.score > hits[0].score * 0.45).slice(0, 3);
  const sources = toSources(used);
  await bumpCitations([...new Set(used.map((h) => h.documentId))]);
  const local = incidentLine + composeLocal(used);
  const meta: MessageMeta = {
    kind: "answer",
    intent: intent.id,
    intentLabel: intent.label,
    confidence: Math.round(conf * 100) / 100,
    sources,
    incident,
    engine: hasOpenAI() ? "openai" : "local",
    quickReplies: ["That fixed it", "Still not working"],
  };

  if (hasOpenAI()) {
    emit({ type: "status", text: "Writing an answer" });
    const context = used.map((h, i) => `[${i + 1}] ${h.docTitle} — ${h.heading}\n${h.content}`).join("\n\n");
    const msgs: ChatMsg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6).map((h) => ({ role: h.role === "user" ? ("user" as const) : ("assistant" as const), content: h.content.slice(0, 1200) })),
      {
        role: "user",
        content: `CONTEXT:\n${context}\n${incident ? `\nACTIVE INCIDENT: ${incident.title} (${incident.service}). Mention it first.\n` : ""}\nEMPLOYEE QUESTION: ${queryText}`,
      },
    ];
    return reply(local, meta, { stream: streamOpenAI(msgs) });
  }
  return reply(local, meta);
}

/** Streams pre-composed text in small pieces so every reply feels typed. */
async function typeOut(text: string, emit: (e: ChatEvent) => void) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < parts.length; i += 3) {
    emit({ type: "delta", text: parts.slice(i, i + 3).join("") });
    await new Promise((r) => setTimeout(r, 14));
  }
}
