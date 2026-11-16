import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";

export const GET = handle(async () => {
  await requireUser(["agent", "manager"]);
  const events = await q(
    `select e.id, e.type, e.severity, e.detail, e.sample, e.created_at, u.name as user_name
     from security_events e left join users u on u.id = e.user_id order by e.created_at desc limit 60`,
  );
  const counts = await q(
    `select type, count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week
     from security_events group by type order by total desc`,
  );
  return NextResponse.json({ events, counts });
});
