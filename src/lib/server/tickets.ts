import "server-only";
import { q, one } from "./db";
import { forward } from "./automations";
import type { IntentId } from "../ai/intents";
import { HttpError, isStaff, type SessionUser } from "./auth";

export async function loadTicket(key: string, user: SessionUser) {
  const t = await one<Record<string, unknown> & { id: number; key: string; title: string; description: string; category: string; requester: string; requester_id: number; conversation_id: string | null }>(
    `select t.*, r.name as requester, r.email as requester_email, r.department, a.name as assignee
     from tickets t join users r on r.id = t.requester_id left join users a on a.id = t.assignee_id
     where t.key = $1`,
    [key],
  );
  if (!t || (!isStaff(user) && t.requester_id !== user.id)) throw new HttpError(404, "Ticket not found.");
  return t;
}

const SLA_HOURS: Record<string, number> = { P1: 4, P2: 8, P3: 24 };

export async function nextTicketKey() {
  const row = await one<{ n: number }>("select coalesce(max(id), 0)::int + 1 as n from tickets");
  return `HAS-${1000 + (row?.n ?? 1)}`;
}

/** Least-loaded agent gets the ticket. */
async function pickAssignee(): Promise<number | null> {
  const row = await one<{ id: number }>(
    `select u.id from users u
     left join tickets t on t.assignee_id = u.id and t.status in ('open','in_progress','waiting')
     where u.role = 'agent' group by u.id order by count(t.id) asc, u.id asc limit 1`,
  );
  return row?.id ?? null;
}

export async function createTicket(args: {
  conversationId: string | null;
  requesterId: number;
  title: string;
  description: string;
  aiSummary: string;
  category: string;
  priority: "P1" | "P2" | "P3";
  intent?: IntentId;
}) {
  const key = await nextTicketKey();
  const assignee = await pickAssignee();
  const due = new Date(Date.now() + SLA_HOURS[args.priority] * 3600_000);
  const [t] = await q<{ id: number; key: string }>(
    `insert into tickets (key, conversation_id, requester_id, assignee_id, title, description, ai_summary, category, priority, sla_due)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, key`,
    [key, args.conversationId, args.requesterId, assignee, args.title.slice(0, 140), args.description, args.aiSummary, args.category, args.priority, due.toISOString()],
  );
  if (args.conversationId) {
    await q("update conversations set status = 'escalated', updated_at = now() where id = $1", [args.conversationId]);
  }
  const agent = assignee ? await one<{ name: string }>("select name from users where id = $1", [assignee]) : null;
  void forward(process.env.TICKET_WEBHOOK_URL, { event: "ticket.created", key, ...args, assignee: agent?.name ?? null, sla_due: due });
  return { id: t.id, key: t.key, priority: args.priority, assignee: agent?.name ?? "IT Service Desk", slaHours: SLA_HOURS[args.priority] };
}

/** Builds the hand-off note a human agent reads first. */
export async function summarizeConversation(conversationId: string | null, fallback: string) {
  if (!conversationId) return { transcript: fallback, tried: [] as string[] };
  const msgs = await q<{ role: string; content: string; meta: { sources?: { title: string }[] } }>(
    "select role, content, meta from messages where conversation_id = $1 order by id asc limit 30",
    [conversationId],
  );
  const transcript = msgs
    .filter((m) => m.role === "user")
    .map((m) => `- ${m.content.slice(0, 280)}`)
    .join("\n");
  const tried = [...new Set(msgs.flatMap((m) => m.meta?.sources?.map((s) => s.title) ?? []))];
  return { transcript: transcript || fallback, tried };
}
