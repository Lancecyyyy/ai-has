import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const conv = await one("select id, title, status from conversations where id = $1 and user_id = $2", [id, user.id]);
  if (!conv) throw new HttpError(404, "Conversation not found.");
  const messages = await q(
    "select id, role, content, meta, latency_ms, feedback, created_at from messages where conversation_id = $1 order by id asc",
    [id],
  );
  return NextResponse.json({ conversation: conv, messages });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const rows = await q("delete from conversations where id = $1 and user_id = $2 and status <> 'escalated' returning id", [id, user.id]);
  if (!rows.length) throw new HttpError(409, "Conversations linked to a ticket are kept for the IT team.");
  return NextResponse.json({ ok: true });
});
