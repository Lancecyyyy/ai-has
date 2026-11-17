"use client";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { BookOpen, Cpu, Gauge, ShieldCheck, Sparkles, Ticket, Wand2 } from "lucide-react";
import { cx } from "@/components/ui";
import type { Mood } from "@/components/three/Bell3D";
import type { Msg } from "./types";

const Mascot = dynamic(() => import("@/components/three/Bell3D").then((m) => m.BellMascot), { ssr: false, loading: () => <div className="h-full" /> });

const DECISION: Record<string, { label: string; icon: typeof Sparkles }> = {
  answer: { label: "Answered from manuals", icon: BookOpen },
  automation_offer: { label: "Offered an automation", icon: Wand2 },
  automation_result: { label: "Ran an automation", icon: Wand2 },
  ticket: { label: "Escalated to a person", icon: Ticket },
  gap: { label: "Not in manuals, didn't guess", icon: Gauge },
  blocked: { label: "Blocked by shields", icon: ShieldCheck },
  out_of_scope: { label: "Redirected, out of scope", icon: ShieldCheck },
  smalltalk: { label: "Small talk", icon: Sparkles },
};

export function Inspector({ msg, mood, engine, onCite }: { msg: Msg | null; mood: Mood; engine: string; onCite: (n: number) => void }) {
  const meta = msg?.meta ?? {};
  const conf = meta.confidence;
  const d = meta.kind ? DECISION[meta.kind] : null;
  const steps = [
    { k: "Shields", v: meta.kind === "blocked" ? "Blocked" : "Passed", ok: meta.kind !== "blocked" },
    { k: "Intent", v: meta.intentLabel ?? "—", ok: !!meta.intentLabel },
    { k: "Retrieval", v: meta.sources?.length ? `${meta.sources.length} section${meta.sources.length > 1 ? "s" : ""}` : conf != null ? "Below threshold" : "Skipped", ok: !!meta.sources?.length },
    { k: "Decision", v: d?.label ?? "—", ok: !!d },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[190px] shrink-0 border-b border-line bg-sunk">
        <Mascot mood={mood} distance={8.6} />
        <p className="absolute bottom-2 left-0 right-0 text-center font-mono text-[11px] text-muted">
          {mood === "thinking" ? "working on it" : mood === "happy" ? "sorted" : mood === "alert" ? "shields up" : "listening"}
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 scroll-thin">
        <div>
          <h3 className="font-display text-[19px] leading-none">Under the hood</h3>
          <p className="mt-1 text-[12.5px] text-muted">How the assistant handled {msg ? "the selected reply" : "your last message"}.</p>
        </div>
        {!msg ? (
          <p className="rounded-xl border border-dashed border-line-2 p-3 text-[13px] text-muted">Send a message and this panel shows each step: safety checks, intent, which manual sections were used and why.</p>
        ) : (
          <>
            <ol className="space-y-0">
              {steps.map((s, i) => (
                <motion.li key={s.k + msg.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < steps.length - 1 && <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-line-2" />}
                  <span className={cx("relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2", s.ok ? "border-brand bg-brand" : "border-line-2 bg-surface")} />
                  <div className="min-w-0">
                    <p className="text-[12px] text-muted">{s.k}</p>
                    <p className="text-[14px] font-medium leading-snug text-ink">{s.v}</p>
                  </div>
                </motion.li>
              ))}
            </ol>

            {conf != null && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <p className="text-[12px] text-muted">Retrieval confidence</p>
                  <p className="font-mono text-[13px] text-ink">{conf.toFixed(2)}</p>
                </div>
                <div className="relative h-2 rounded-full bg-sunk">
                  <motion.div key={msg.id} initial={{ width: 0 }} animate={{ width: `${Math.min(100, conf * 100)}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} className={cx("h-full rounded-full", conf >= 0.42 ? "bg-signal" : "bg-warn")} />
                  <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/60" style={{ left: "42%" }} title="Answer threshold 0.42" />
                </div>
                <p className="mt-1.5 text-[11.5px] text-faint">Marker = 0.42. Below it, the assistant won&apos;t answer from the manuals.</p>
              </div>
            )}

            {meta.sources && meta.sources.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] text-muted">Sources used</p>
                <div className="space-y-2">
                  {meta.sources.map((s) => (
                    <button key={s.n} onClick={() => onCite(s.n)} className="block w-full rounded-xl border border-line bg-surface p-2.5 text-left transition hover:border-brand/40">
                      <div className="flex items-center gap-2">
                        <span className="grid size-5 place-items-center rounded-md bg-brand/10 font-mono text-[11px] text-brand">{s.n}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{s.title}</span>
                        <span className="font-mono text-[11px] text-faint">{s.score.toFixed(1)}</span>
                      </div>
                      <p className="mt-1 truncate pl-7 text-[12px] text-muted">{s.heading}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {meta.run && (
              <div className="rounded-xl bg-sunk p-3 text-[12.5px] text-ink-2">
                Automation run <span className="font-mono">#{meta.run.id}</span> · {meta.run.steps.length} steps · {(meta.run.steps.reduce((a, s) => a + s.ms, 0) / 1000).toFixed(1)}s
              </div>
            )}
          </>
        )}
        <div className="flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
          <Cpu size={13} />
          {engine === "openai" ? "Answers written by GPT-4o-mini, grounded on retrieved sections" : "Extractive engine: answers are quoted from retrieved sections"}
        </div>
      </div>
    </div>
  );
}
