import { NextResponse } from "next/server";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError, isStaff } from "@/lib/server/auth";
import { loadTicket } from "@/lib/server/tickets";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const t = await loadTicket(id, user);
  const comments = await q(
    `select c.id, c.body, c.internal, c.created_at, u.name as author, u.role as author_role
     from ticket_comments c left join users u on u.id = c.author_id
     where c.ticket_id = $1 and (c.internal = false or $2) order by c.created_at asc`,
    [t.id, isStaff(user)],
  );
  const transcript =
    t.conversation_id && isStaff(user)
      ? await q("select role, content, created_at from messages where conversation_id = $1 order by id asc limit 40", [t.conversation_id])
      : [];
  const agents = isStaff(user) ? await q("select id, name from users where role = 'agent' order by name") : [];
  return NextResponse.json({ ticket: t, comments, transcript, agents });
});

const Patch = z.object({
  status: z.enum(["open", "in_progress", "waiting", "resolved"]).optional(),
  priority: z.enum(["P1", "P2", "P3"]).optional(),
  assigneeId: z.number().int().nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const t = await loadTicket(id, user);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Invalid update.");
  const p = parsed.data;
  if (!isStaff(user) && (p.priority || p.assigneeId !== undefined || (p.status && p.status !== "resolved"))) {
    throw new HttpError(403, "Only IT staff can change that.");
  }
  if (p.status) {
    await q("update tickets set status = $1, resolved_at = case when $1 = 'resolved' then now() else null end, updated_at = now() where id = $2", [p.status, t.id]);
    await q("insert into ticket_comments (ticket_id, author_id, body, internal) values ($1,$2,$3,true)", [t.id, user.id, `Status changed to ${p.status.replace("_", " ")}`]);
    if (p.status === "resolved" && t.conversation_id) await q("update conversations set updated_at = now() where id = $1", [t.conversation_id]);
  }
  if (p.priority) {
    const hours = p.priority === "P1" ? 4 : p.priority === "P2" ? 8 : 24;
    await q("update tickets set priority = $1, sla_due = created_at + ($2 || ' hours')::interval, updated_at = now() where id = $3", [p.priority, String(hours), t.id]);
  }
  if (p.assigneeId !== undefined) {
    await q("update tickets set assignee_id = $1, updated_at = now() where id = $2", [p.assigneeId, t.id]);
  }
  return NextResponse.json({ ok: true });
});
