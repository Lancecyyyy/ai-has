import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";

export const GET = handle(async () => {
  await requireUser(["agent", "manager"]);
  const workflows = await q(
    `select a.id, a.name, a.description, a.enabled, a.minutes_saved,
       count(r.id)::int as runs,
       count(r.id) filter (where r.status = 'success')::int as succeeded,
       count(r.id) filter (where r.created_at > now() - interval '7 days')::int as runs_7d,
       coalesce(avg(r.duration_ms),0)::int as avg_ms
     from automations a left join automation_runs r on r.workflow_id = a.id
     group by a.id order by runs desc`,
  );
  const runs = await q(
    `select r.id, r.workflow_id, a.name as workflow, r.status, r.summary, r.steps, r.duration_ms, r.created_at, u.name as user_name
     from automation_runs r join automations a on a.id = r.workflow_id left join users u on u.id = r.user_id
     order by r.created_at desc limit 40`,
  );
  return NextResponse.json({ workflows, runs, webhook: !!process.env.AUTOMATION_WEBHOOK_URL });
});
