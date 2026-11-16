import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError, isStaff } from "@/lib/server/auth";
import { loadTicket } from "@/lib/server/tickets";
import { redactPII } from "@/lib/ai/guardrails";

const Body = z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().optional() });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const t = await loadTicket(id, user);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Write a message first.");
  const internal = isStaff(user) ? !!parsed.data.internal : false;
  const { text } = redactPII(parsed.data.body);
  const [c] = await q("insert into ticket_comments (ticket_id, author_id, body, internal) values ($1,$2,$3,$4) returning id, body, internal, created_at", [t.id, user.id, text, internal]);
  if (!internal) {
    // Replies move the ticket along: agent reply -> in progress, employee reply on a waiting ticket -> back to the agent.
    if (isStaff(user)) await q("update tickets set status = case when status = 'open' then 'in_progress' else status end, updated_at = now() where id = $1", [t.id]);
    else await q("update tickets set status = case when status in ('waiting','resolved') then 'open' else status end, resolved_at = null, updated_at = now() where id = $1", [t.id]);
  }
  return NextResponse.json({ comment: { ...c, author: user.name, author_role: user.role } });
});
