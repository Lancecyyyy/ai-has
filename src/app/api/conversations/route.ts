import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await q(
    `select c.id, c.title, c.status, c.intent, c.updated_at,
       (select count(*)::int from messages m where m.conversation_id = c.id) as messages
     from conversations c where c.user_id = $1 order by c.updated_at desc limit 50`,
    [user.id],
  );
  return NextResponse.json({ conversations: rows });
});
