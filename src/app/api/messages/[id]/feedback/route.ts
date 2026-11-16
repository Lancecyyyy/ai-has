import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const { value } = (await req.json().catch(() => ({}))) as { value?: number };
  if (![1, -1, 0].includes(Number(value))) throw new HttpError(400, "Invalid feedback.");
  const rows = await q(
    `update messages m set feedback = $1 from conversations c
     where m.id = $2 and m.conversation_id = c.id and c.user_id = $3 and m.role = 'assistant' returning m.id`,
    [Number(value) === 0 ? null : Number(value), Number(id), user.id],
  );
  if (!rows.length) throw new HttpError(404, "Message not found.");
  return NextResponse.json({ ok: true });
});
