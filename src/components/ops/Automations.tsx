"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Mail, RotateCcw, Webhook, Workflow, X } from "lucide-react";
import { useToast } from "@/components/Providers";
import { Badge, Button, Card, CardHead, cx, PageHeader, Skeleton, Toggle } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";

interface Wf {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  minutes_saved: number;
  runs: number;
  succeeded: number;
  runs_7d: number;
  avg_ms: number;
}
interface Run {
  id: number;
  workflow: string;
  status: string;
  summary: string;
  steps: { label: string; detail: string; ms: number; ok?: boolean }[];
  duration_ms: number;
  created_at: string;
  user_name: string | null;
}

interface Approval {
  id: number;
  app: string;
  created_at: string;
  user_name: string;
  department: string;
}
interface Email {
  id: number;
  to_address: string;
  subject: string;
  status: string;
  detail: string;
  created_at: string;
}
interface Data {
  workflows: Wf[];
  runs: Run[];
  approvals: Approval[];
  emails: Email[];
  email: { configured: boolean; demoInbox: boolean };
  webhook: boolean;
}

export function Automations({ manager }: { manager: boolean }) {
  const toast = useToast();
  const { data, loading, setData, reload } = useApi<Data>("/api/automations", { poll: 20000 });
  const [open, setOpen] = useState<number | null>(null);
  const [deciding, setDeciding] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  const decide = async (a: Approval, decision: "approve" | "decline") => {
    setDeciding(a.id);
    try {
      await api(`/api/software/${a.id}`, { method: "POST", json: { decision } });
      toast(decision === "approve" ? `${a.app} approved for ${a.user_name}. They were emailed.` : `${a.app} declined for ${a.user_name}.`, decision === "approve" ? "ok" : "info");
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setDeciding(null);
    }
  };

  const resetDemo = async () => {
    setResetting(true);
    try {
      await api("/api/automations/demo-reset", { method: "POST" });
      toast("Demo records restored: Maria has stuck print jobs and a nearly full mailbox again.", "ok");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setResetting(false);
    }
  };

  const toggle = async (w: Wf, enabled: boolean) => {
    setData((d) => (d ? { ...d, workflows: d.workflows.map((x) => (x.id === w.id ? { ...x, enabled } : x)) } : d));
    try {
      await api(`/api/automations/${w.id}`, { method: "PATCH", json: { enabled } });
      toast(enabled ? `${w.name} is live again.` : `${w.name} paused. The assistant will answer from manuals instead.`, enabled ? "ok" : "info");
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  const totalHours = data ? data.workflows.reduce((s, w) => s + w.succeeded * w.minutes_saved, 0) / 60 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Automations"
        sub="Routine fixes the assistant can run after the employee confirms. Pause any of them and it falls back to manual steps."
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone={data?.email.configured ? "ok" : "warn"} dot>
              <Mail size={12} /> {data ? (data.email.configured ? "Email sending on" : "Email not set up (GMAIL_USER, GMAIL_APP_PASSWORD)") : "Email"}
            </Badge>
            {data?.webhook && (
              <Badge tone="ok" dot>
                <Webhook size={12} /> Forwarding runs to webhook
              </Badge>
            )}
            {manager && (
              <Button size="sm" variant="secondary" onClick={resetDemo} loading={resetting} icon={<RotateCcw size={13} />}>
                Reset demo records
              </Button>
            )}
          </div>
        }
      />
      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        data && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Runs, all time", data.workflows.reduce((s, w) => s + w.runs, 0).toLocaleString()],
                ["Runs this week", data.workflows.reduce((s, w) => s + w.runs_7d, 0).toLocaleString()],
                ["Success rate", `${Math.round((data.workflows.reduce((s, w) => s + w.succeeded, 0) / Math.max(1, data.workflows.reduce((s, w) => s + w.runs, 0))) * 100)}%`],
                ["IT hours saved", Math.round(totalHours).toLocaleString()],
              ].map(([k, v]) => (
                <Card key={k} className="px-4 py-3">
                  <p className="text-[12.5px] text-muted">{k}</p>
                  <p className="font-display text-[30px] leading-none">{v}</p>
                </Card>
              ))}
            </div>
            {data.approvals.length > 0 && (
              <Card className="mb-6 border-warn/40">
                <CardHead
                  title="Waiting for approval"
                  sub={manager ? "Licensed software requests from the assistant. The employee is emailed and messaged in chat when you decide." : "Licensed software requests waiting for an IT manager"}
                />
                <div className="mt-3 divide-y divide-line">
                  {data.approvals.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-medium">{a.app}</p>
                        <p className="text-[13px] text-muted">
                          {a.user_name} · {a.department} · {timeAgo(a.created_at)}
                        </p>
                      </div>
                      {manager && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => decide(a, "decline")} disabled={deciding === a.id}>
                            Decline
                          </Button>
                          <Button size="sm" onClick={() => decide(a, "approve")} loading={deciding === a.id}>
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {data.workflows.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className={cx("h-full p-5 transition", !w.enabled && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl transition-colors", w.enabled ? "bg-brand text-on-brand" : "bg-sunk text-muted")}>
                        <Workflow size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-display text-[20px] leading-tight">{w.name}</p>
                          <Toggle checked={w.enabled} onChange={(v) => toggle(w, v)} label={`${w.enabled ? "Pause" : "Enable"} ${w.name}`} />
                        </div>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{w.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[13px]">
                      <div>
                        <p className="text-faint">Runs</p>
                        <p className="font-mono">{w.runs}</p>
                      </div>
                      <div>
                        <p className="text-faint">Success</p>
                        <p className="font-mono">{w.runs ? Math.round((w.succeeded / w.runs) * 100) : 0}%</p>
                      </div>
                      <div>
                        <p className="text-faint">Saves</p>
                        <p className="font-mono">~{w.minutes_saved} min</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card className="mt-6">
              <CardHead title="Run log" sub="Every automation, with each step it took" />
              <div className="mt-3 divide-y divide-line">
                {data.runs.map((r) => (
                  <div key={r.id}>
                    <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-sunk/50">
                      <span className={cx("size-2 shrink-0 rounded-full", r.status === "success" ? "bg-ok" : r.status === "failed" || r.status === "declined" ? "bg-bad" : "bg-warn")} />
                      <span className="w-40 shrink-0 truncate text-[14px] font-medium">{r.workflow}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted">{r.summary}</span>
                      <span className="hidden w-32 truncate text-[13px] text-ink-2 sm:block">{r.user_name}</span>
                      <span className="w-16 text-right text-[12px] text-faint">{timeAgo(r.created_at)}</span>
                      <ChevronDown size={15} className={cx("text-faint transition", open === r.id && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {open === r.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          <ol className="space-y-2 px-5 pb-4 pl-10">
                            {r.steps.map((s, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-[13px]">
                                <span className={cx("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", s.ok === false ? "bg-bad text-white" : "bg-brand text-on-brand")}>
                                  {s.ok === false ? <X size={10} strokeWidth={3} /> : <Check size={10} strokeWidth={3} />}
                                </span>
                                <span className="font-medium">{s.label}</span>
                                <span className="font-mono text-muted">{s.detail}</span>
                                <span className="ml-auto font-mono text-faint">{s.ms}ms</span>
                              </li>
                            ))}
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-6">
              <CardHead title="Email log" sub={data.email.demoInbox ? "Mail for demo accounts goes to the DEMO_INBOX address" : "Set DEMO_INBOX to receive mail sent to demo accounts"} />
              <div className="mt-3 divide-y divide-line">
                {data.emails.length === 0 && <p className="px-5 py-4 text-[13.5px] text-muted">No email sent yet.</p>}
                {data.emails.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px]">
                    <span className={cx("size-2 shrink-0 rounded-full", e.status === "sent" ? "bg-ok" : e.status === "logged" ? "bg-warn" : "bg-bad")} />
                    <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                    <span className="hidden min-w-0 max-w-[40%] truncate text-muted sm:block" title={e.detail}>
                      {e.status === "sent" ? e.to_address : e.detail}
                    </span>
                    <span className="w-16 text-right text-[12px] text-faint">{timeAgo(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}
