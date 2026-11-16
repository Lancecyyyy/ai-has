"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookPlus, ChevronDown, Lock, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { initials, useUser } from "@/components/app/AppShell";
import { useToast } from "@/components/Providers";
import { Badge, Button, Card, cx, Field, inputCls, PRIORITY_TONE, Skeleton, STATUS_LABEL, STATUS_TONE, Toggle } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";
import { Sla, type TicketRow } from "./TicketsClient";

interface Detail {
  ticket: TicketRow & { description: string; ai_summary: string; requester_email: string; conversation_id: string | null };
  comments: { id: number; body: string; internal: boolean; created_at: string; author: string | null; author_role: string | null }[];
  transcript: { role: string; content: string; created_at: string }[];
  agents: { id: number; name: string }[];
}

export function TicketDetail({ ticketKey }: { ticketKey: string }) {
  const user = useUser();
  const staff = user.role !== "employee";
  const toast = useToast();
  const { data, error, reload, loading } = useApi<Detail>(`/api/tickets/${ticketKey}`, { poll: 20000 });
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [publish, setPublish] = useState<{ title: string; resolution: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  if (error) return <div className="p-10 text-center text-muted">{error}</div>;
  if (loading || !data)
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  const t = data.ticket;

  const patch = async (p: Record<string, unknown>, msg: string) => {
    try {
      await api(`/api/tickets/${t.key}`, { method: "PATCH", json: p });
      toast(msg);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/api/tickets/${t.key}/comments`, { method: "POST", json: { body, internal } });
      setBody("");
      setInternal(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setSending(false);
    }
  };

  const suggest = async () => {
    setDrafting(true);
    try {
      const d = await api<{ draft: string; sources: { title: string }[] }>(`/api/tickets/${t.key}/suggest`, { method: "POST" });
      setBody(d.draft);
      setInternal(false);
      toast(d.sources.length ? `Draft based on “${d.sources[0].title}”. Review before sending.` : "Draft ready. Review before sending.", "info");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setDrafting(false);
    }
  };

  const doPublish = async () => {
    if (!publish) return;
    setPublishing(true);
    try {
      await api(`/api/tickets/${t.key}/publish`, { method: "POST", json: publish });
      toast("Published. The assistant can answer this from now on.");
      setPublish(null);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setPublishing(false);
    }
  };

  const lastStaffReply = [...data.comments].reverse().find((c) => !c.internal && c.author_role !== "employee" && !c.body.startsWith("Status changed"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/tickets" className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <ArrowLeft size={15} /> {staff ? "Ticket queue" : "My tickets"}
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] text-muted">{t.key}</span>
            <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
            <Badge tone={STATUS_TONE[t.status]} dot>
              {STATUS_LABEL[t.status]}
            </Badge>
            <Badge>{t.category}</Badge>
          </div>
          <h1 className="font-display text-[30px] leading-[1.05] sm:text-[38px]">{t.title}</h1>
        </div>
        {!staff && t.status !== "resolved" && (
          <Button variant="secondary" onClick={() => patch({ status: "resolved" }, "Marked as resolved. Thanks!")}>
            It&apos;s fixed, close ticket
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <Card className="grain relative overflow-hidden border-hi/60 p-5" style={{ background: "color-mix(in oklab, var(--hi) 24%, var(--surface))" }}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
              <Sparkles size={14} /> Hand-off note from the assistant
            </p>
            <p className="text-[15px] leading-relaxed text-ink">{t.ai_summary || "No summary."}</p>
            {staff && data.transcript.length > 0 && (
              <button onClick={() => setShowTranscript((s) => !s)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand">
                {showTranscript ? "Hide" : "Show"} the chat ({data.transcript.length} messages) <ChevronDown size={14} className={cx("transition", showTranscript && "rotate-180")} />
              </button>
            )}
            <AnimatePresence>
              {showTranscript && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-2 rounded-xl bg-surface/70 p-3">
                    {data.transcript.map((m, i) => (
                      <div key={i} className="text-[13.5px]">
                        <span className={cx("mr-2 font-medium", m.role === "user" ? "text-brand" : "text-ink-2")}>{m.role === "user" ? t.requester.split(" ")[0] : "Assistant"}</span>
                        <span className="whitespace-pre-wrap text-ink-2">{m.content.replace(/\*\*/g, "").slice(0, 600)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[19px]">Conversation</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunk text-[12px] font-semibold text-ink-2">{initials(t.requester)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]">
                    <b className="font-medium">{t.requester}</b> <span className="text-faint">opened this {timeAgo(t.created_at)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{t.description.replace(/^- /gm, "")}</p>
                </div>
              </div>
              {data.comments.map((c) =>
                c.body.startsWith("Status changed") ? (
                  <p key={c.id} className="pl-11 text-[12.5px] text-faint">
                    {c.author} · {c.body.toLowerCase()} · {timeAgo(c.created_at)}
                  </p>
                ) : (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold", c.author_role === "employee" ? "bg-sunk text-ink-2" : "bg-brand text-on-brand")}>{initials(c.author ?? "?")}</span>
                    <div className={cx("min-w-0 flex-1 rounded-2xl px-3.5 py-2.5", c.internal ? "border border-dashed border-warn/50 bg-warn-bg" : "bg-sunk/70")}>
                      <p className="text-[13px]">
                        <b className="font-medium">{c.author}</b> <span className="text-faint">{timeAgo(c.created_at)}</span>
                        {c.internal && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-warn">
                            <Lock size={11} /> Internal note
                          </span>
                        )}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{c.body}</p>
                    </div>
                  </motion.div>
                ),
              )}
            </div>
            <div className="border-t border-line p-4">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={body.split("\n").length > 3 ? 8 : 3}
                placeholder={staff ? (internal ? "Note for IT only…" : `Reply to ${t.requester.split(" ")[0]}…`) : "Add a reply for the IT team…"}
                className={cx(inputCls, "resize-y", internal && "border-warn/50 bg-warn-bg")}
                aria-label="Reply"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {staff && (
                    <>
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        <Toggle checked={internal} onChange={setInternal} label="Internal note" /> Internal note
                      </label>
                      <Button variant="hi" size="sm" onClick={suggest} loading={drafting} icon={<Sparkles size={14} />}>
                        Draft with AI
                      </Button>
                    </>
                  )}
                </div>
                <Button onClick={send} loading={sending} disabled={!body.trim()} icon={<Send size={15} />}>
                  {internal ? "Add note" : "Send reply"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            {staff ? (
              <>
                <Field label="Status">
                  <select className={inputCls} value={t.status} onChange={(e) => patch({ status: e.target.value }, `Status set to ${STATUS_LABEL[e.target.value].toLowerCase()}`)}>
                    {Object.entries(STATUS_LABEL)
                      .filter(([k]) => k !== "escalated")
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={inputCls} value={t.priority} onChange={(e) => patch({ priority: e.target.value }, `Priority set to ${e.target.value}`)}>
                    <option value="P1">P1 · 4 hour target</option>
                    <option value="P2">P2 · 8 hour target</option>
                    <option value="P3">P3 · 24 hour target</option>
                  </select>
                </Field>
                <Field label="Assignee">
                  <select className={inputCls} value={t.assignee_id ?? ""} onChange={(e) => patch({ assigneeId: e.target.value ? Number(e.target.value) : null }, "Assignee updated")}>
                    <option value="">Unassigned</option>
                    {data.agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {t.assignee_id !== user.id && user.role === "agent" && (
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => patch({ assigneeId: user.id, status: t.status === "open" ? "in_progress" : t.status }, "Assigned to you")}>
                    Assign to me
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3 text-[14px]">
                <div>
                  <p className="text-[12px] text-muted">Handled by</p>
                  <p className="font-medium">{t.assignee ?? "IT Service Desk"}</p>
                </div>
              </div>
            )}
            <div className="space-y-3 border-t border-line pt-4 text-[14px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Target</span>
                <Sla t={t} />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Requester</span>
                <span className="truncate text-right">{t.requester}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Department</span>
                <span>{t.department}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Opened</span>
                <span>{new Date(t.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            </div>
          </Card>
          {staff && (
            <Card className="p-5">
              <p className="font-display text-[18px] leading-tight">Close the loop</p>
              <p className="mt-1 text-[13px] text-muted">Turn this fix into a manual so the assistant can answer it next time.</p>
              <Button variant="secondary" size="sm" className="mt-3 w-full" icon={<BookPlus size={15} />} onClick={() => setPublish({ title: t.title, resolution: lastStaffReply?.body ?? "" })}>
                Publish as manual
              </Button>
            </Card>
          )}
          {t.conversation_id && !staff && (
            <Link href={`/chat?c=${t.conversation_id}`} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] text-ink-2 shadow-sm transition hover:border-brand/40">
              <MessageSquare size={16} /> Open the original chat
            </Link>
          )}
        </div>
      </div>

      <AnimatePresence>
        {publish && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-deep/40" onClick={() => setPublish(null)} />
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-lg" role="dialog" aria-label="Publish as manual">
              <button onClick={() => setPublish(null)} className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk" aria-label="Close">
                <X size={16} />
              </button>
              <h2 className="font-display text-[26px] leading-none">Publish as manual</h2>
              <p className="mt-2 text-[13.5px] text-muted">The symptoms come from the ticket. Write the fix in numbered steps; it&apos;s indexed immediately.</p>
              <div className="mt-5 space-y-4">
                <Field label="Title">
                  <input className={inputCls} value={publish.title} onChange={(e) => setPublish({ ...publish, title: e.target.value })} />
                </Field>
                <Field label="How to fix it" hint="Tip: 1. … 2. … 3. …">
                  <textarea className={cx(inputCls, "min-h-[140px]")} value={publish.resolution} onChange={(e) => setPublish({ ...publish, resolution: e.target.value })} placeholder={"1. Unplug the dock for 10 seconds\n2. Update the DisplayLink driver from the Company Portal\n3. Reconnect the monitor with the USB-C cable"} />
                </Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPublish(null)}>
                  Cancel
                </Button>
                <Button onClick={doPublish} loading={publishing} icon={<BookPlus size={15} />}>
                  Publish
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
