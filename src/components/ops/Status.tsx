"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Cpu, Database, Megaphone, XCircle } from "lucide-react";
import { useUser } from "@/components/app/AppShell";
import { useToast } from "@/components/Providers";
import { Badge, Button, Card, CardHead, cx, Field, inputCls, PageHeader, Skeleton } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";

interface S {
  services: { id: string; name: string; status: string }[];
  incidents: { id: number; title: string; body: string; severity: string; status: string; created_at: string; resolved_at: string | null; service: string; service_id: string }[];
  system: { engine: string; model: string | null; database: string };
}

const ST: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  operational: { label: "Operational", icon: CheckCircle2, cls: "text-ok" },
  degraded: { label: "Degraded", icon: AlertTriangle, cls: "text-warn" },
  outage: { label: "Outage", icon: XCircle, cls: "text-bad" },
};

export function Status() {
  const user = useUser();
  const staff = user.role !== "employee";
  const toast = useToast();
  const { data, loading, reload } = useApi<S>("/api/status", { poll: 30000 });
  const [form, setForm] = useState<{ serviceId: string; title: string; body: string; severity: "degraded" | "outage" } | null>(null);
  const [busy, setBusy] = useState(false);

  const allOk = data?.services.every((s) => s.status === "operational");
  const active = data?.incidents.filter((i) => i.status === "active") ?? [];

  const post = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await api("/api/incidents", { method: "POST", json: form });
      toast("Incident posted. The assistant will mention it in related chats.");
      setForm(null);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="System status"
        sub="Live health of Meridian's IT services. The assistant checks this before answering, so it can warn you about known problems."
        right={staff && <Button icon={<Megaphone size={15} />} onClick={() => setForm({ serviceId: "vpn", title: "", body: "", severity: "degraded" })}>Post incident</Button>}
      />
      {loading && !data ? (
        <Skeleton className="h-80" />
      ) : (
        data && (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx("grain relative mb-5 overflow-hidden rounded-3xl p-6", allOk ? "bg-ok-bg" : "bg-warn-bg")}>
              <p className={cx("font-display text-[30px] leading-none", allOk ? "text-ok" : "text-warn")}>{allOk ? "All systems working" : `${active.length} active incident${active.length === 1 ? "" : "s"}`}</p>
              <p className="mt-1.5 text-[14px] text-ink-2">Checked {timeAgo(new Date())}</p>
            </motion.div>

            <Card className="mb-5 divide-y divide-line">
              {data.services.map((s) => {
                const st = ST[s.status] ?? ST.operational;
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-[15px] font-medium">{s.name}</span>
                    <span className={cx("inline-flex items-center gap-1.5 text-[14px]", st.cls)}>
                      <st.icon size={16} /> {st.label}
                    </span>
                  </div>
                );
              })}
            </Card>

            <Card className="mb-5">
              <CardHead title="Incidents" sub="Current and recent" />
              <div className="space-y-3 p-5">
                {data.incidents.map((i) => (
                  <div key={i.id} className={cx("rounded-2xl border p-4", i.status === "active" ? "border-warn/40 bg-warn-bg/60" : "border-line")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={i.status === "active" ? (i.severity === "outage" ? "bad" : "warn") : "ok"} dot>
                          {i.status === "active" ? (i.severity === "outage" ? "Outage" : "Degraded") : "Resolved"}
                        </Badge>
                        <span className="text-[13px] text-muted">{i.service}</span>
                      </div>
                      <span className="text-[12px] text-faint">{i.status === "active" ? `since ${timeAgo(i.created_at)}` : `resolved ${timeAgo(i.resolved_at ?? i.created_at)}`}</span>
                    </div>
                    <p className="mt-2 text-[15px] font-medium">{i.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{i.body}</p>
                    {staff && i.status === "active" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={async () => {
                          await api(`/api/incidents/${i.id}`, { method: "PATCH" });
                          toast("Incident resolved.");
                          reload();
                        }}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="flex items-center gap-3 p-4">
                <Cpu size={18} className="text-brand" />
                <div>
                  <p className="text-[12.5px] text-muted">Answer engine</p>
                  <p className="text-[14px] font-medium">{data.system.engine === "openai" ? `OpenAI ${data.system.model}, grounded on manuals` : "Built-in extractive engine (no API key set)"}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3 p-4">
                <Database size={18} className="text-brand" />
                <div>
                  <p className="text-[12.5px] text-muted">Database</p>
                  <p className="text-[14px] font-medium">{data.system.database === "postgres" ? "PostgreSQL" : "Embedded Postgres (PGlite, demo mode)"}</p>
                </div>
              </Card>
            </div>
          </>
        )
      )}

      <AnimatePresence>
        {form && data && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-deep/40" onClick={() => setForm(null)} />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative w-full max-w-lg space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-lg" role="dialog" aria-label="Post incident">
              <h2 className="font-display text-[26px] leading-none">Post an incident</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service">
                  <select className={inputCls} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                    {data.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Severity">
                  <select className={inputCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as "degraded" | "outage" })}>
                    <option value="degraded">Degraded</option>
                    <option value="outage">Outage</option>
                  </select>
                </Field>
              </div>
              <Field label="Title">
                <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Printers on 5F are offline" />
              </Field>
              <Field label="What's happening and any workaround">
                <textarea className={cx(inputCls, "min-h-[100px]")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button onClick={post} loading={busy}>
                  Post incident
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
