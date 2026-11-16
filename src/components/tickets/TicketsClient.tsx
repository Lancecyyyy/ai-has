"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Columns3, List, MessageSquare, Search, Ticket } from "lucide-react";
import { useUser } from "@/components/app/AppShell";
import { Badge, Card, cx, Empty, inputCls, PageHeader, PRIORITY_TONE, Segmented, Skeleton, STATUS_LABEL, STATUS_TONE } from "@/components/ui";
import { timeAgo, timeLeft, useApi } from "@/lib/client/api";

export interface TicketRow {
  id: number;
  key: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  sla_due: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  requester: string;
  department: string;
  assignee: string | null;
  assignee_id: number | null;
  comments: number;
}

const COLUMNS = ["open", "in_progress", "waiting", "resolved"] as const;

export function Sla({ t }: { t: TicketRow }) {
  if (t.status === "resolved") {
    const met = t.resolved_at && new Date(t.resolved_at) <= new Date(t.sla_due);
    return <span className={cx("text-[12px]", met ? "text-ok" : "text-warn")}>{met ? "Met SLA" : "Missed SLA"}</span>;
  }
  const l = timeLeft(t.sla_due);
  return (
    <span className={cx("inline-flex items-center gap-1 font-mono text-[12px]", l.overdue ? "text-bad" : "text-muted")}>
      <Clock size={12} />
      {l.text}
    </span>
  );
}

function Row({ t, staff }: { t: TicketRow; staff: boolean }) {
  return (
    <Link href={`/tickets/${t.key}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3.5 transition first:border-t-0 hover:bg-sunk/60 sm:grid-cols-[96px_1fr_130px_140px_110px]">
      <span className="hidden font-mono text-[13px] text-muted sm:block">{t.key}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-medium text-ink group-hover:text-brand">{t.title}</span>
        <span className="block truncate text-[12.5px] text-muted">
          <span className="font-mono sm:hidden">{t.key} · </span>
          {staff ? `${t.requester} · ${t.department}` : t.category} · {timeAgo(t.created_at)}
          {t.comments > 0 && (
            <span className="ml-2 inline-flex items-center gap-0.5">
              <MessageSquare size={11} /> {t.comments}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center justify-end gap-1.5 sm:justify-start">
        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
        <span className="hidden md:inline">
          <Badge tone={STATUS_TONE[t.status]} dot>
            {STATUS_LABEL[t.status]}
          </Badge>
        </span>
      </span>
      <span className="col-span-2 truncate text-[13px] text-ink-2 sm:col-span-1">{t.assignee ?? "Unassigned"}</span>
      <span className="hidden sm:block">
        <Sla t={t} />
      </span>
    </Link>
  );
}

export function TicketsClient() {
  const user = useUser();
  const staff = user.role !== "employee";
  const [scope, setScope] = useState<"queue" | "assigned">("queue");
  const [view, setView] = useState<"list" | "board">("list");
  const [status, setStatus] = useState<string>("active");
  const [q, setQ] = useState("");
  const { data, loading } = useApi<{ tickets: TicketRow[] }>(`/api/tickets?scope=${staff ? scope : "mine"}`, { poll: 15000 });

  const tickets = useMemo(() => {
    let list = data?.tickets ?? [];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((t) => `${t.key} ${t.title} ${t.requester} ${t.category}`.toLowerCase().includes(s));
    }
    return list;
  }, [data, q]);
  const filtered = status === "all" ? tickets : status === "active" ? tickets.filter((t) => t.status !== "resolved") : tickets.filter((t) => t.status === status);
  const counts = useMemo(() => Object.fromEntries(COLUMNS.map((c) => [c, tickets.filter((t) => t.status === c).length])), [tickets]);
  const breaching = tickets.filter((t) => t.status !== "resolved" && new Date(t.sla_due) < new Date()).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={staff ? "Ticket queue" : "My tickets"}
        sub={staff ? "Everything the assistant couldn't solve, with its summary attached. Least-busy agents get new tickets first." : "Requests the assistant handed to the IT team. Reply here if they ask you something."}
        right={
          staff && (
            <>
              <Segmented value={scope} onChange={setScope} options={[{ value: "queue", label: "All tickets" }, { value: "assigned", label: "Assigned to me" }]} />
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "list", label: <List size={15} aria-label="List view" /> },
                  { value: "board", label: <Columns3 size={15} aria-label="Board view" /> },
                ]}
              />
            </>
          )
        }
      />

      {staff && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Open", counts.open, "brand"],
            ["In progress", counts.in_progress, "hi"],
            ["Waiting on employee", counts.waiting, "warn"],
            ["Breaching SLA", breaching, breaching ? "bad" : "ok"],
          ].map(([label, n, tone]) => (
            <Card key={label as string} className="px-4 py-3">
              <p className="text-[12.5px] text-muted">{label}</p>
              <p className={cx("font-display text-[30px] leading-none", tone === "bad" ? "text-bad" : "text-ink")}>{loading ? "–" : (n as number)}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets" className={cx(inputCls, "pl-9")} aria-label="Search tickets" />
        </div>
        {view === "list" && (
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In progress" },
              { value: "resolved", label: "Resolved" },
              { value: "all", label: "All" },
            ]}
            className="overflow-x-auto"
          />
        )}
      </div>

      {loading && !data ? (
        <Card className="space-y-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      ) : view === "board" && staff ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = tickets.filter((t) => t.status === col).slice(0, col === "resolved" ? 8 : 50);
            return (
              <div key={col} className="rounded-2xl border border-line bg-sunk/60 p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <Badge tone={STATUS_TONE[col]} dot>
                    {STATUS_LABEL[col]}
                  </Badge>
                  <span className="font-mono text-[12px] text-faint">{counts[col]}</span>
                </div>
                <div className="mt-1 space-y-2">
                  <AnimatePresence>
                    {items.map((t, i) => (
                      <motion.div key={t.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.025 }}>
                        <Link href={`/tickets/${t.key}`} className="block rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px] text-muted">{t.key}</span>
                            <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-[14px] font-medium leading-snug text-ink">{t.title}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
                            <span className="truncate">{t.assignee ?? "Unassigned"}</span>
                            <Sla t={t} />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!items.length && <p className="px-2 py-6 text-center text-[12.5px] text-faint">Nothing here</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : !filtered.length ? (
        <Card>
          <Empty
            icon={<Ticket size={22} />}
            title={staff ? "Queue is clear" : "No tickets yet"}
            body={staff ? "No tickets match these filters." : "When the assistant can't solve something, it opens a ticket and it'll appear here."}
            action={!staff && <Link href="/chat" className="text-[14px] font-medium text-brand">Ask the assistant →</Link>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[96px_1fr_130px_140px_110px] gap-4 border-b border-line bg-sunk/50 px-4 py-2 text-[12px] font-medium text-muted sm:grid">
            <span>Ticket</span>
            <span>Subject</span>
            <span>Priority</span>
            <span>Assignee</span>
            <span>SLA</span>
          </div>
          {filtered.slice(0, 100).map((t) => (
            <Row key={t.key} t={t} staff={staff} />
          ))}
        </Card>
      )}
    </div>
  );
}
