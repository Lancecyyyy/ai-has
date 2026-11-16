import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { loadTicket } from "@/lib/server/tickets";
import { addDocument } from "@/lib/server/kb";

/** Knowledge loop: turn a solved ticket into a manual so the AI can answer it next time. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["agent", "manager"]);
  const { id } = await params;
  const t = await loadTicket(id, user);
  const body = (await req.json().catch(() => ({}))) as { title?: string; resolution?: string };
  const resolution = body.resolution?.trim();
  if (!resolution || resolution.length < 20) throw new HttpError(400, "Describe the fix in at least a sentence.");
  const title = (body.title?.trim() || t.title).slice(0, 120);
  const content = `# ${title}\n\n## Symptoms\n${t.description.replace(/^- /gm, "").trim()}\n\n## How to fix it\n${resolution}\n\n## Still stuck\nAsk the helpdesk assistant to open a ticket and mention ${t.key}.`;
  const docId = await addDocument({ title, category: t.category, content, source: "ticket", userId: user.id });
  const normalized = t.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  await q("update knowledge_gaps set status = 'covered' where normalized = $1", [normalized]);
  return NextResponse.json({ ok: true, docId });
});
