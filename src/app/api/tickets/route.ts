import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, isStaff } from "@/lib/server/auth";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const scope = isStaff(user) ? url.searchParams.get("scope") ?? "queue" : "mine";
  const where: string[] = [];
  const params: unknown[] = [];
  if (scope === "mine") {
    params.push(user.id);
    where.push(`t.requester_id = $${params.length}`);
  } else if (scope === "assigned") {
    params.push(user.id);
    where.push(`t.assignee_id = $${params.length}`);
  }
  const rows = await q(
    `select t.id, t.key, t.title, t.category, t.priority, t.status, t.sla_due, t.created_at, t.updated_at, t.resolved_at,
       r.name as requester, r.department, a.name as assignee, t.assignee_id,
       (select count(*)::int from ticket_comments c where c.ticket_id = t.id and (c.internal = false or $${params.length + 1})) as comments
     from tickets t join users r on r.id = t.requester_id left join users a on a.id = t.assignee_id
     ${where.length ? "where " + where.join(" and ") : ""}
     order by case t.status when 'open' then 0 when 'in_progress' then 1 when 'waiting' then 2 else 3 end,
              t.priority asc, t.created_at desc
     limit 200`,
    [...params, isStaff(user)],
  );
  return NextResponse.json({ tickets: rows, scope });
});
