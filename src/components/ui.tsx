"use client";
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "hi" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  const v = {
    primary: "bg-brand text-on-brand shadow-[0_2px_0_rgb(0_0_0/0.28),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-2",
    secondary: "key bg-surface text-ink border border-line-2 hover:border-ink/40",
    ghost: "text-ink-2 hover:bg-sunk",
    hi: "bg-hi text-on-hi shadow-[0_2px_0_rgb(140_36_0/0.45),inset_0_1px_0_rgb(255_255_255/0.3)] hover:brightness-105",
    danger: "bg-bad-bg text-bad hover:bg-bad hover:text-white",
  }[variant];
  const s = { sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg", md: "h-10 px-4 text-sm gap-2 rounded-xl", lg: "h-12 px-5 text-[15px] gap-2 rounded-2xl" }[size];
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,border,transform,filter] duration-150 active:translate-y-px disabled:opacity-50",
        v,
        s,
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface shadow-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, sub, right }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        <h3 className="font-display text-[19px] leading-tight text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  neutral: "bg-sunk text-ink-2",
  brand: "bg-ink/[0.07] text-ink",
  hi: "bg-hi text-on-hi",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
} as const;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, keyof typeof TONES> = {
  open: "brand",
  in_progress: "hi",
  waiting: "warn",
  resolved: "ok",
  escalated: "warn",
};
export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting on employee",
  resolved: "Resolved",
  escalated: "Escalated",
};
export const PRIORITY_TONE: Record<string, keyof typeof TONES> = { P1: "bad", P2: "warn", P3: "neutral" };

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("relative inline-flex rounded-xl border border-line bg-sunk p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx("relative z-10 h-8 rounded-[10px] px-3 text-[13px] font-medium transition-colors", o.value === value ? "text-ink" : "text-muted hover:text-ink")}
        >
          {o.value === value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 -z-10 rounded-[10px] bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-bad">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-faint">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line-2 bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint outline-none shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition focus:border-signal focus:ring-4 focus:ring-signal/15";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-sunk", className)} />;
}

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-sunk text-ink-2">{icon}</div>}
      <p className="font-display text-xl text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[34px] leading-none text-ink sm:text-[40px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-signal" : "bg-line-2")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")} />
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line-2 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
