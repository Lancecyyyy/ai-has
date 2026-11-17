"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, Clock, EyeOff, Loader2, ShieldAlert, ThumbsDown, ThumbsUp, Ticket, Wand2 } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { LogoMark } from "@/components/Logo";
import { Badge, Button, cx, PRIORITY_TONE } from "@/components/ui";
import { playChime } from "@/lib/client/sound";
import type { Msg } from "./types";

const REDACT_LABEL: Record<string, string> = { password: "password", card: "card number", phone: "phone number", gov_id: "ID number", secret: "secret key", email: "personal email" };

export function UserBubble({ m }: { m: Msg }) {
  const red = m.meta?.redactions ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 34 }} className="flex flex-col items-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-on-brand shadow-sm sm:max-w-[75%]">{m.content}</div>
      {red.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
          <EyeOff size={12} />
          Hidden for your safety: {red.map((r) => `${r.count > 1 ? r.count + " " : ""}${REDACT_LABEL[r.type] ?? r.type}${r.count > 1 ? "s" : ""}`).join(", ")}
        </p>
      )}
    </motion.div>
  );
}

function Steps({ steps, animate, status }: { steps: NonNullable<Msg["meta"]["run"]>["steps"]; animate: boolean; status: string }) {
  const [shown, setShown] = useState(animate ? 0 : steps.length);
  useEffect(() => {
    if (shown >= steps.length) {
      if (animate && shown === steps.length && status === "success") playChime();
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), steps[shown].ms);
    return () => clearTimeout(t);
  }, [shown, steps, animate, status]);
  return (
    <ol className="mt-3 space-y-0">
      {steps.map((s, i) => {
        const done = i < shown;
        const running = i === shown;
        return (
          <li key={i} className={cx("relative flex gap-3 pb-3 last:pb-0", !done && !running && "opacity-40")}>
            {i < steps.length - 1 && <span className={cx("absolute left-[11px] top-6 h-[calc(100%-18px)] w-px transition-colors duration-300", done ? "bg-brand" : "bg-line-2")} />}
            <span className={cx("relative z-10 grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300", done ? "bg-brand text-on-brand" : "border border-line-2 bg-surface text-muted")}>
              {done ? <Check size={13} strokeWidth={2.5} /> : running ? <Loader2 size={12} className="animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[14px] font-medium leading-tight text-ink">{s.label}</p>
              {done && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5 font-mono text-[12px] text-muted">
                  {s.detail}
                </motion.p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AssistantMessage({
  m,
  selected,
  onSelect,
  onRun,
  onDecline,
  onFeedback,
  onCite,
  running,
}: {
  m: Msg;
  selected: boolean;
  onSelect: () => void;
  onRun: (m: Msg) => void;
  onDecline: () => void;
  onFeedback: (m: Msg, v: number) => void;
  onCite: (m: Msg, n: number) => void;
  running: boolean;
}) {
  const meta = m.meta ?? {};
  const [stepsDone, setStepsDone] = useState(!m.fresh);
  useEffect(() => {
    if (!m.fresh || !meta.run) return;
    const total = meta.run.steps.reduce((s, x) => s + x.ms, 0);
    const t = setTimeout(() => setStepsDone(true), total + 150);
    return () => clearTimeout(t);
  }, [m.fresh, meta.run]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className="group flex gap-3">
      <LogoMark size={30} className="mt-0.5 shrink-0 text-carbon dark:text-[#2a2a28]" />
      <div className="min-w-0 max-w-[92%] flex-1 sm:max-w-[80%]">
        <div
          onClick={onSelect}
          className={cx(
            "cursor-default rounded-[20px] rounded-tl-md border bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink shadow-sm transition-colors",
            selected ? "border-brand/40" : "border-line",
            meta.kind === "blocked" && "border-bad/30 bg-bad-bg",
          )}
        >
          {meta.kind === "blocked" && (
            <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-bad">
              <ShieldAlert size={14} /> Blocked by safety shields{meta.blocked ? `: ${meta.blocked.toLowerCase()}` : ""}
            </p>
          )}
          {meta.incident && (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2 text-[13px] text-warn">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                Active incident: <b>{meta.incident.title}</b>. Some of what you see may be caused by it, and IT is already on it.
              </span>
            </div>
          )}
          {meta.kind === "automation_result" && meta.run ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Wand2 size={16} className="text-brand" />
                <span className="font-display text-[18px] leading-none">{meta.intentLabel ?? "Automation"}</span>
                {stepsDone ? (
                  <Badge tone={meta.run.status === "success" ? "ok" : "warn"} dot>
                    {meta.run.status === "success" ? "Done" : "Waiting for approval"}
                  </Badge>
                ) : (
                  <Badge tone="brand">Running</Badge>
                )}
              </div>
              <Steps steps={meta.run.steps} animate={!!m.fresh} status={meta.run.status} />
              {stepsDone && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 border-t border-line pt-3">
                  {m.content}
                </motion.p>
              )}
            </div>
          ) : (
            <Markdown text={m.content} onCite={(n) => onCite(m, n)} />
          )}

          {meta.kind === "automation_offer" && meta.action && (
            <div className="mt-3 rounded-2xl border border-line bg-sunk p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted">Automation</p>
                  <p className="font-display text-[18px] leading-tight">{meta.action.label}</p>
                </div>
                {meta.action.state === "proposed" ? (
                  <Button size="sm" variant="primary" onClick={() => onRun(m)} loading={running} icon={<Wand2 size={14} />}>
                    Run it
                  </Button>
                ) : meta.action.state === "done" ? (
                  <Badge tone="ok" dot>
                    Ran
                  </Badge>
                ) : (
                  <Badge>Skipped</Badge>
                )}
              </div>
              {meta.action.state === "proposed" && (
                <p className="mt-2 text-[12.5px] text-muted">
                  Runs only on your own account and is logged. Prefer to do it yourself?{" "}
                  <button className="font-medium text-brand underline-offset-2 hover:underline" onClick={onDecline}>
                    Show me the steps
                  </button>
                </p>
              )}
            </div>
          )}

          {meta.kind === "ticket" && meta.ticket && (
            <Link href={`/tickets/${meta.ticket.key}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-sunk p-3 transition hover:border-brand/40">
              <span className="grid size-10 place-items-center rounded-xl bg-hi text-on-hi">
                <Ticket size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] text-ink">{meta.ticket.key}</p>
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <Clock size={12} /> {meta.ticket.assignee} · {meta.ticket.slaHours}h target
                </p>
              </div>
              <Badge tone={PRIORITY_TONE[meta.ticket.priority]}>{meta.ticket.priority}</Badge>
              <ArrowUpRight size={16} className="text-faint" />
            </Link>
          )}
        </div>

        <div className="mt-1.5 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-[12px] text-faint">
          {meta.sources && meta.sources.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {meta.sources.map((s) => (
                <button key={s.n} onClick={() => onCite(m, s.n)} className="max-w-[220px] truncate rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11.5px] text-ink-2 transition hover:border-brand/40 hover:text-brand">
                  <span className="font-mono text-brand">{s.n}</span> {meta.sources!.every((x) => x.title === meta.sources![0].title) ? s.heading : s.title}
                </button>
              ))}
            </span>
          )}
          {m.latency_ms != null && <span className="font-mono">{(m.latency_ms / 1000).toFixed(1)}s</span>}
          {meta.kind !== "smalltalk" && meta.kind !== "blocked" && (
            <span className={cx("flex items-center gap-0.5 transition-opacity", m.feedback == null && "opacity-0 group-hover:opacity-100 focus-within:opacity-100")}>
              <button onClick={() => onFeedback(m, m.feedback === 1 ? 0 : 1)} className={cx("grid size-6 place-items-center rounded-md hover:bg-sunk", m.feedback === 1 ? "text-ok" : "hover:text-ink")} aria-label="Helpful">
                <ThumbsUp size={13} />
              </button>
              <button onClick={() => onFeedback(m, m.feedback === -1 ? 0 : -1)} className={cx("grid size-6 place-items-center rounded-md hover:bg-sunk", m.feedback === -1 ? "text-bad" : "hover:text-ink")} aria-label="Not helpful">
                <ThumbsDown size={13} />
              </button>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Typing({ status, text }: { status: string; text: string }) {
  return (
    <div className="flex gap-3">
      <LogoMark size={30} className="mt-0.5 shrink-0 text-carbon dark:text-[#2a2a28]" />
      <div className="min-w-0 max-w-[92%] rounded-[20px] rounded-tl-md border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink shadow-sm sm:max-w-[80%]">
        {text ? (
          <Markdown text={text + " ▍"} />
        ) : (
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-brand" style={{ animation: `dot 1s ${i * 0.15}s infinite` }} />
              ))}
            </span>
            {status}…
          </div>
        )}
      </div>
    </div>
  );
}
