"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cx } from "@/components/ui";

/** Series colours: validated categorical slots (see globals.css --c1..--c4). */
export const SERIES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, children, width }: { x: number; y: number; children: React.ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 80), width - 80);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-md" style={{ left, top: y - 8 }}>
      {children}
    </div>
  );
}

/** Stacked daily bars with crosshair tooltip. */
export function StackedBars({ data, keys, labels, height = 220 }: { data: Record<string, number | string>[]; keys: string[]; labels: string[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const pad = { l: 34, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...data.map((d) => keys.reduce((s, k) => s + Number(d[k] ?? 0), 0)));
  const nice = Math.ceil(max / 5) * 5;
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily conversations by outcome" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          const x = pad.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          return (
            <g key={String(d.day)} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill={hover === i ? "var(--sunk)" : "transparent"} />
              {keys.map((k, ki) => {
                const v = Number(d[k] ?? 0);
                if (!v) return null;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const top = ki === keys.length - 1 || keys.slice(ki + 1).every((kk) => !Number(d[kk] ?? 0));
                const h = Math.max(0, y0 - y1 - 2);
                return (
                  <motion.rect
                    key={k}
                    x={x}
                    width={w}
                    initial={{ y: H - pad.b, height: 0 }}
                    animate={{ y: y1, height: h }}
                    transition={{ duration: 0.6, delay: i * 0.012, ease: [0.2, 0.8, 0.2, 1] }}
                    rx={top ? Math.min(4, w / 2) : 1.5}
                    fill={SERIES[ki]}
                  />
                );
              })}
              {i % labelEvery === 0 && (
                <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--faint)">
                  {new Date(String(d.day) + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && ref.current && (
        <Tooltip x={((pad.l + hover * bw + bw / 2) / W) * ref.current.clientWidth} y={(y(keys.reduce((s, k) => s + Number(data[hover][k] ?? 0), 0)) / H) * ref.current.clientHeight} width={ref.current.clientWidth}>
          <p className="mb-1 font-medium text-ink">{new Date(String(data[hover].day) + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
          {keys.map((k, i) => (
            <p key={k} className="flex items-center justify-between gap-4 text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm" style={{ background: SERIES[i] }} />
                {labels[i]}
              </span>
              <span className="font-mono text-ink">{Number(data[hover][k] ?? 0)}</span>
            </p>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const path = useMemo(() => {
    if (values.length < 2) return "";
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    return values.map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  }, [values]);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cx("h-8 w-full", className)} aria-hidden>
      <motion.path d={path} fill="none" stroke="var(--signal)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
    </svg>
  );
}

/** Horizontal bars: total with the resolved share inset. Direct labels, no legend needed beyond the header. */
export function HBars({ rows }: { rows: { label: string; total: number; part: number; partLabel: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{r.label}</span>
            <span className="shrink-0 font-mono text-[12px] text-muted">{hover === i ? `${r.part} ${r.partLabel} of ${r.total}` : r.total}</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-sunk">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.total / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }} className="absolute inset-y-0 left-0 rounded-full" style={{ background: "color-mix(in oklab, var(--c1) 28%, transparent)" }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.part / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.2, 0.8, 0.2, 1] }} className="absolute inset-y-0 left-0 rounded-full" style={{ background: "var(--c1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical histogram (single series, so no legend). */
export function Histogram({ buckets, labels }: { buckets: number[]; labels: string[] }) {
  const max = Math.max(1, ...buckets);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex h-[150px] items-end gap-2">
      {buckets.map((b, i) => (
        <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          {hover === i && <span className="absolute -top-1 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">{b}</span>}
          <motion.div initial={{ height: 0 }} animate={{ height: `${(b / max) * 82}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }} className={cx("w-full rounded-t-[4px] transition-opacity", hover != null && hover !== i && "opacity-50")} style={{ background: "var(--c1)", minHeight: b ? 3 : 0 }} />
          <span className="mt-1.5 whitespace-nowrap text-[10.5px] text-faint">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Ring gauge for a single percentage. */
export function Ring({ value, size = 120, label }: { value: number; size?: number; label: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" width={size} height={size} role="img" aria-label={`${label} ${Math.round(value * 100)}%`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--sunk)" strokeWidth="10" />
      <motion.circle cx="55" cy="55" r={r} fill="none" stroke="var(--signal)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} transform="rotate(-90 55 55)" />
      <text x="55" y="60" textAnchor="middle" fontSize="24" fill="var(--ink)" style={{ fontFamily: "var(--font-display)" }}>
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}
