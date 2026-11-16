"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Webhook, Workflow } from "lucide-react";
import { useToast } from "@/components/Providers";
import { Badge, Card, CardHead, cx, PageHeader, Skeleton, Toggle } from "@/components/ui";
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
  steps: { label: string; detail: string; ms: number }[];
  duration_ms: number;
  created_at: string;
  user_name: string | null;
}

export function Automations() {
  const toast = useToast();
  const { data, loading, setData } = useApi<{ workflows: Wf[]; runs: Run[]; webhook: boolean }>("/api/automations", { poll: 20000 });
  const [open, setOpen] = useState<number | null>(null);

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
          <Badge tone={data?.webhook ? "ok" : "neutral"} dot>
            <Webhook size={12} /> {data?.webhook ? "Forwarding runs to n8n webhook" : "Simulated connectors (set AUTOMATION_WEBHOOK_URL)"}
          </Badge>
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
                      <span className={cx("size-2 shrink-0 rounded-full", r.status === "success" ? "bg-ok" : "bg-warn")} />
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
                                <span className="mt-0.5 grid size-4 place-items-center rounded-full bg-brand text-on-brand">
                                  <Check size={10} strokeWidth={3} />
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
          </>
        )
      )}
    </div>
  );
}
