"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, BookOpen, Download, FilePlus2, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHead, cx, PageHeader, Segmented, Skeleton, STATUS_LABEL } from "@/components/ui";
import { timeAgo, useApi } from "@/lib/client/api";
import { HBars, Histogram, Legend, Ring, SERIES, Sparkline, StackedBars } from "./charts";

interface K {
  total: number;
  resolved: number;
  escalated: number;
  avgMs: number;
  p90Ms: number;
  up: number;
  down: number;
  runs: number;
  runsOk: number;
  minutesSaved: number;
}
interface Metrics {
  days: number;
  kpis: { cur: K; prev: K };
  daily: { day: string; total: number; resolved: number; escalated: number; open: number }[];
  intents: { intent: string; total: number; resolved: number; escalated: number }[];
  latency: { bucket: number; count: number }[];
  tickets: Record<string, number>;
  docs: { id: number; title: string; category: string; citations: number }[];
  gaps: { id: number; query: string; hits: number }[];
  security: { type: string; count: number }[];
  recent: { id: string; title: string; status: string; intent: string | null; created_at: string; name: string; department: string }[];
  agents: { name: string; open: number; resolved: number }[];
}

const INTENT_LABEL: Record<string, string> = {
  password_reset: "Password reset",
  account_unlock: "Account unlock",
  mfa_reset: "MFA reset",
  vpn_reset: "VPN profile",
  vpn: "VPN",
  software_access: "Software access",
  print_queue: "Print queue",
  mailbox_cleanup: "Mailbox full",
  wifi: "Wi-Fi",
  email: "Email & Outlook",
  printer: "Printing",
  performance: "Slow laptop",
  files: "Files & remote desktop",
  security_incident: "Security incident",
  hardware_repair: "Hardware repair",
  onboarding: "Onboarding",
  general: "Other questions",
  blocked: "Blocked by shields",
  greeting: "Greetings",
  out_of_scope: "Out of scope",
};
const SEC_LABEL: Record<string, string> = { pii_redacted: "Private details redacted", injection_blocked: "Prompt injections blocked", abuse_blocked: "Abuse filtered", out_of_scope: "Out-of-scope redirected", rate_limited: "Rate limited" };

function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], onUpdate: setV });
    return () => c.stop();
  }, [value]);
  return <>{format(v)}</>;
}

function Delta({ cur, prev, invert, unit = "%" }: { cur: number; prev: number; invert?: boolean; unit?: string }) {
  if (!prev) return <span className="text-[12px] text-faint">no prior data</span>;
  const d = unit === "pts" ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
  const good = invert ? d < 0 : d > 0;
  if (Math.abs(d) < 0.5) return <span className="text-[12px] text-faint">flat vs prior</span>;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-[12px] font-medium", good ? "text-ok" : "text-bad")}>
      {d > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(d).toFixed(unit === "pts" ? 1 : 0)}
      {unit === "pts" ? " pts" : "%"}
    </span>
  );
}

function Kpi({ label, value, format, delta, spark, hint, i }: { label: string; value: number; format: (n: number) => string; delta: React.ReactNode; spark?: number[]; hint: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 30 }}>
      <Card className="h-full p-4" title={hint}>
        <p className="text-[12.5px] text-muted">{label}</p>
        <p className="mt-1 font-display text-[32px] leading-none text-ink">
          <CountUp value={value} format={format} />
        </p>
        <div className="mt-1.5">{delta}</div>
        {spark && <Sparkline values={spark} className="mt-2" />}
      </Card>
    </motion.div>
  );
}

export function Dashboard() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data, loading } = useApi<Metrics>(`/api/metrics?days=${days}`, { poll: 30000 });

  if (loading && !data)
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  if (!data) return null;
  const { cur, prev } = data.kpis;
  const rate = (k: K) => (k.total ? k.resolved / k.total : 0);
  const csat = (k: K) => (k.up + k.down ? k.up / (k.up + k.down) : 0);
  const hours = (k: K) => k.minutesSaved / 60 + (k.resolved - k.runsOk) * 0.13;
  const spark = (key: "total" | "resolved" | "escalated") => data.daily.map((d) => d[key]);
  const latencyBuckets = [0, 1, 2, 3, 4, 5].map((b) => data.latency.find((l) => Number(l.bucket) === b)?.count ?? 0);
  const t = data.tickets;
  const sla = t.resolved_period ? t.within_sla / t.resolved_period : 0;
  const ended = [
    { label: "Solved by AI", v: cur.resolved, color: SERIES[0] },
    { label: "Escalated to IT", v: cur.escalated, color: SERIES[1] },
    { label: "Unconfirmed", v: Math.max(0, cur.total - cur.resolved - cur.escalated), color: SERIES[2] },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Support health"
        sub="How the assistant and the IT team are doing. Numbers update every 30 seconds."
        right={
          <>
            <Segmented
              value={days}
              onChange={setDays}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
            />
            <a href={`/api/metrics/export?days=${days}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3.5 text-[14px] font-medium text-ink shadow-sm transition hover:border-ink/40">
              <Download size={15} /> Export CSV
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi i={0} label="Solved by AI" value={rate(cur) * 100} format={(n) => `${Math.round(n)}%`} delta={<Delta cur={rate(cur)} prev={rate(prev)} unit="pts" />} spark={spark("resolved")} hint="Conversations resolved without a human" />
        <Kpi i={1} label="Conversations" value={cur.total} format={(n) => Math.round(n).toLocaleString()} delta={<Delta cur={cur.total} prev={prev.total} />} spark={spark("total")} hint="Chats started in the period" />
        <Kpi i={2} label="Avg. response" value={cur.avgMs / 1000} format={(n) => `${n.toFixed(1)}s`} delta={<Delta cur={cur.avgMs} prev={prev.avgMs} invert />} hint={`p90 ${(cur.p90Ms / 1000).toFixed(1)}s`} />
        <Kpi i={3} label="Escalated to IT" value={cur.escalated} format={(n) => Math.round(n).toString()} delta={<Delta cur={cur.escalated / Math.max(1, cur.total)} prev={prev.escalated / Math.max(1, prev.total)} invert unit="pts" />} spark={spark("escalated")} hint="Conversations that became tickets" />
        <Kpi i={4} label="Satisfaction" value={csat(cur) * 100} format={(n) => `${Math.round(n)}%`} delta={<Delta cur={csat(cur)} prev={csat(prev)} unit="pts" />} hint={`${cur.up} helpful · ${cur.down} not helpful`} />
        <Kpi i={5} label="IT hours saved" value={hours(cur)} format={(n) => Math.round(n).toString()} delta={<Delta cur={hours(cur)} prev={hours(prev)} />} hint="Automation minutes plus about 8 min per AI-solved question" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHead title="Conversations per day" sub="Grouped by how each one ended" right={<Legend items={[{ label: "Solved by AI", color: SERIES[0] }, { label: "Escalated", color: SERIES[1] }, { label: "Unconfirmed", color: SERIES[2] }]} />} />
          <div className="px-3 pb-3 pt-2">
            <StackedBars data={data.daily} keys={["resolved", "escalated", "open"]} labels={["Solved by AI", "Escalated", "Unconfirmed"]} />
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHead title="Where conversations end" sub={`${cur.total} in the last ${days} days`} />
          <div className="flex flex-1 flex-col justify-center px-5 pb-5">
            <div className="mt-3 flex h-4 gap-[2px] overflow-hidden rounded-full">
              {ended.map((e, i) => (
                <motion.div key={e.label} initial={{ flexGrow: 0 }} animate={{ flexGrow: e.v || 0.0001 }} transition={{ duration: 0.9, delay: i * 0.1 }} style={{ background: e.color, flexBasis: 0 }} />
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {ended.map((e) => (
                <div key={e.label} className="flex items-center justify-between text-[14px]">
                  <span className="inline-flex items-center gap-2 text-ink-2">
                    <span className="size-2.5 rounded-[3px]" style={{ background: e.color }} />
                    {e.label}
                  </span>
                  <span className="font-mono text-ink">
                    {e.v} <span className="text-faint">· {cur.total ? Math.round((e.v / cur.total) * 100) : 0}%</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-sunk p-3 text-[12.5px] leading-relaxed text-muted">“Unconfirmed” means the assistant answered but the employee didn&apos;t confirm the fix or open a ticket.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHead title="What people ask about" sub="Darker part = solved by AI. Hover for numbers." />
          <div className="p-5">
            <HBars rows={data.intents.slice(0, 8).map((r) => ({ label: INTENT_LABEL[r.intent] ?? r.intent, total: r.total, part: r.resolved, partLabel: "solved" }))} />
          </div>
        </Card>
        <Card>
          <CardHead title="Response time" sub={`Average ${(cur.avgMs / 1000).toFixed(1)}s · 90% under ${(cur.p90Ms / 1000).toFixed(1)}s`} />
          <div className="px-5 pb-5 pt-6">
            <Histogram buckets={latencyBuckets} labels={["<0.5s", "0.5–1s", "1–1.5s", "1.5–2s", "2–3s", ">3s"]} />
          </div>
        </Card>
        <Card>
          <CardHead title="Tickets" sub={`${t.backlog} open now${t.breaching ? `, ${t.breaching} past target` : ""}`} />
          <div className="flex items-center gap-5 p-5">
            <div className="text-center">
              <Ring value={sla} label="Within SLA" />
              <p className="-mt-1 text-[12px] text-muted">resolved within SLA</p>
            </div>
            <div className="flex-1 space-y-2.5 text-[14px]">
              {(["open", "in_progress", "waiting"] as const).map((s) => (
                <div key={s} className="flex justify-between">
                  <span className="text-ink-2">{STATUS_LABEL[s]}</span>
                  <span className="font-mono">{t[s]}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2.5">
                <span className="text-ink-2">Avg. time to resolve</span>
                <span className="font-mono">{t.avg_hours.toFixed(1)}h</span>
              </div>
            </div>
          </div>
          <div className="border-t border-line px-5 py-3">
            <p className="mb-2 text-[12px] text-muted">Agent workload</p>
            <div className="space-y-1.5">
              {data.agents.map((a) => (
                <div key={a.name} className="flex items-center justify-between text-[13.5px]">
                  <span>{a.name}</span>
                  <span className="text-muted">
                    <b className="font-mono font-medium text-ink">{a.open}</b> open · {a.resolved} closed
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHead title="Knowledge gaps" sub="Questions the manuals couldn't answer" right={<Link href="/knowledge?tab=gaps" className="text-[13px] font-medium text-brand">All gaps</Link>} />
          <div className="p-3">
            {data.gaps.length ? (
              data.gaps.map((g) => (
                <Link key={g.id} href={`/knowledge?draft=${encodeURIComponent(g.query)}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-sunk">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warn-bg font-mono text-[12px] text-warn">{g.hits}×</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{g.query}</span>
                  <FilePlus2 size={15} className="text-faint transition group-hover:text-brand" />
                </Link>
              ))
            ) : (
              <p className="p-4 text-center text-[13px] text-muted">No open gaps. The manuals cover everything asked.</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHead title="Most-used manuals" sub="Times cited in answers" />
          <div className="p-3">
            {data.docs.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="font-mono text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <BookOpen size={15} className="text-brand" />
                <span className="min-w-0 flex-1 truncate text-[14px]">{d.title}</span>
                <span className="font-mono text-[13px] text-muted">{d.citations}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Safety shields" sub={`Last ${days} days`} right={<Link href="/security" className="text-[13px] font-medium text-brand">Details</Link>} />
          <div className="space-y-2 p-5">
            {data.security.length ? (
              data.security.map((s) => (
                <div key={s.type} className="flex items-center justify-between rounded-xl bg-sunk px-3 py-2.5 text-[14px]">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck size={15} className="text-brand" />
                    {SEC_LABEL[s.type] ?? s.type}
                  </span>
                  <span className="font-mono">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-[13px] text-muted">Quiet period.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead title="Latest conversations" sub="Live feed across the company" />
        <div className="divide-y divide-line px-2 pb-2">
          {data.recent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className={cx("size-2 shrink-0 rounded-full", r.status === "resolved" ? "bg-ok" : r.status === "escalated" ? "bg-warn" : "bg-brand")} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{r.title}</span>
              <span className="hidden text-[13px] text-muted sm:inline">
                {r.name} · {r.department}
              </span>
              <Badge tone={r.status === "resolved" ? "ok" : r.status === "escalated" ? "warn" : "brand"}>{r.status}</Badge>
              <span className="w-16 text-right text-[12px] text-faint">{timeAgo(r.created_at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
