import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";

const n = (v: unknown) => Number(v ?? 0);

export const GET = handle(async (req: Request) => {
  await requireUser(["manager", "agent"]);
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const P = [String(days)];

  const period = (offset: number) => `created_at >= now() - (($1::int + ${offset}) || ' days')::interval and created_at < now() - (${offset} || ' days')::interval`;
  const kpi = async (offsetDays: string) => {
    const where = offsetDays === "0" ? period(0) : `created_at >= now() - (($1::int * 2) || ' days')::interval and created_at < now() - ($1::int || ' days')::interval`;
    const c = await one<Record<string, unknown>>(
      `select count(*)::int as total,
         count(*) filter (where status = 'resolved')::int as resolved,
         count(*) filter (where status = 'escalated')::int as escalated
       from conversations where ${where}`,
      P,
    );
    const m = await one<Record<string, unknown>>(
      `select coalesce(avg(latency_ms),0)::int as avg_ms,
         coalesce(percentile_cont(0.9) within group (order by latency_ms),0)::int as p90_ms,
         count(*) filter (where feedback = 1)::int as up, count(*) filter (where feedback = -1)::int as down
       from messages where role = 'assistant' and latency_ms is not null and ${where}`,
      P,
    );
    const r = await one<Record<string, unknown>>(
      `select count(*)::int as runs, count(*) filter (where r.status = 'success')::int as ok,
         coalesce(sum(a.minutes_saved) filter (where r.status = 'success'),0)::int as minutes
       from automation_runs r join automations a on a.id = r.workflow_id where ${where.replaceAll("created_at", "r.created_at")}`,
      P,
    );
    return {
      total: n(c?.total),
      resolved: n(c?.resolved),
      escalated: n(c?.escalated),
      avgMs: n(m?.avg_ms),
      p90Ms: n(m?.p90_ms),
      up: n(m?.up),
      down: n(m?.down),
      runs: n(r?.runs),
      runsOk: n(r?.ok),
      minutesSaved: n(r?.minutes),
    };
  };
  const [cur, prev] = await Promise.all([kpi("0"), kpi("prev")]);

  const daily = await q(
    `with d as (select generate_series((now() - (($1::int - 1) || ' days')::interval)::date, now()::date, interval '1 day')::date as day)
     select to_char(d.day, 'YYYY-MM-DD') as day,
       count(c.id)::int as total,
       count(c.id) filter (where c.status = 'resolved')::int as resolved,
       count(c.id) filter (where c.status = 'escalated')::int as escalated,
       count(c.id) filter (where c.status = 'open')::int as open
     from d left join conversations c on c.created_at::date = d.day
     group by d.day order by d.day`,
    P,
  );

  const intents = await q(
    `select coalesce(intent,'general') as intent, count(*)::int as total,
       count(*) filter (where status = 'resolved')::int as resolved,
       count(*) filter (where status = 'escalated')::int as escalated
     from conversations where ${period(0)} group by 1 order by total desc limit 10`,
    P,
  );

  const latency = await q(
    `select case when latency_ms < 500 then 0 when latency_ms < 1000 then 1 when latency_ms < 1500 then 2
              when latency_ms < 2000 then 3 when latency_ms < 3000 then 4 else 5 end as bucket, count(*)::int as count
     from messages where role = 'assistant' and latency_ms is not null and ${period(0)} group by 1 order by 1`,
    P,
  );

  const tickets = await one<Record<string, unknown>>(
    `select count(*) filter (where status in ('open','in_progress','waiting'))::int as backlog,
       count(*) filter (where status = 'open')::int as open,
       count(*) filter (where status = 'in_progress')::int as in_progress,
       count(*) filter (where status = 'waiting')::int as waiting,
       count(*) filter (where status in ('open','in_progress','waiting') and sla_due < now())::int as breaching,
       count(*) filter (where status = 'resolved' and ${period(0)})::int as resolved_period,
       count(*) filter (where status = 'resolved' and resolved_at <= sla_due and ${period(0)})::int as within_sla,
       coalesce(avg(extract(epoch from (resolved_at - created_at)) / 3600) filter (where status = 'resolved' and ${period(0)}), 0)::float as avg_hours
     from tickets`,
    P,
  );

  const docs = await q("select id, title, category, citations from kb_documents order by citations desc limit 6");
  const gaps = await q("select id, query, hits from knowledge_gaps where status = 'open' order by hits desc limit 5");
  const security = await q(`select type, count(*)::int as count from security_events where ${period(0)} group by type order by count desc`, P);
  const recent = await q(
    `select c.id, c.title, c.status, c.intent, c.created_at, u.name, u.department
     from conversations c join users u on u.id = c.user_id order by c.created_at desc limit 8`,
  );
  const agents = await q(
    `select u.name, count(t.id) filter (where t.status in ('open','in_progress','waiting'))::int as open,
       count(t.id) filter (where t.status = 'resolved' and t.resolved_at > now() - ($1::int || ' days')::interval)::int as resolved
     from users u left join tickets t on t.assignee_id = u.id where u.role = 'agent' group by u.id, u.name order by u.name`,
    P,
  );

  return NextResponse.json({
    days,
    kpis: { cur, prev },
    daily,
    intents,
    latency,
    tickets: Object.fromEntries(Object.entries(tickets ?? {}).map(([k, v]) => [k, n(v)])),
    docs,
    gaps,
    security,
    recent,
    agents,
  });
});
