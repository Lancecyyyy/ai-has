import { NextResponse } from "next/server";
import { requireUser, handle } from "@/lib/server/auth";
import { loadTicket } from "@/lib/server/tickets";
import { searchKb } from "@/lib/server/kb";
import { confidence } from "@/lib/ai/rag";
import { hasOpenAI, streamOpenAI } from "@/lib/ai/openai";

/** Drafts a reply for the agent, grounded on the manuals. The agent edits before sending. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["agent", "manager"]);
  const { id } = await params;
  const t = await loadTicket(id, user);
  const hits = await searchKb(`${t.title} ${t.description}`, 3);
  const first = t.requester.split(" ")[0];
  const conf = confidence(hits);
  let draft: string;
  if (!hits.length || conf < 0.35) {
    draft = `Hi ${first},\n\nThanks for the details. Could you tell me the exact error message you see and when it started? A screenshot helps too. I'll take it from there.\n\n${user.name}\nIT Service Desk`;
  } else {
    const stepsOf = (c: string) => c.split("\n").filter((l) => /^\d+\./.test(l.trim()));
    const best = hits.find((h) => h.score > hits[0].score * 0.6 && stepsOf(h.content).length >= 2) ?? hits[0];
    const steps = stepsOf(best.content).slice(0, 4).join("\n");
    draft = `Hi ${first},\n\nThanks for reaching out. Based on our "${best.docTitle}" guide, could you try these steps?\n\n${steps || best.content.slice(0, 400)}\n\nLet me know how it goes and I'll stay on this until it's fixed.\n\n${user.name}\nIT Service Desk`;
  }
  if (hasOpenAI() && hits.length) {
    try {
      let out = "";
      const ctx = hits.map((h, i) => `[${i + 1}] ${h.docTitle} — ${h.heading}\n${h.content}`).join("\n\n");
      for await (const d of streamOpenAI(
        [
          { role: "system", content: "You draft short, warm, professional replies from an IT agent to an employee. Use only the manual CONTEXT for steps. No markdown headings. Sign off with the agent's name and 'IT Service Desk'." },
          { role: "user", content: `CONTEXT:\n${ctx}\n\nTICKET: ${t.title}\n${t.description}\n\nEmployee first name: ${first}. Agent: ${user.name}.` },
        ],
        { maxTokens: 300 },
      ))
        out += d;
      if (out.trim()) draft = out.trim();
    } catch {
      /* keep extractive draft */
    }
  }
  return NextResponse.json({ draft, sources: hits.map((h) => ({ title: h.docTitle, heading: h.heading, score: Math.round(h.score * 100) / 100 })) });
});
