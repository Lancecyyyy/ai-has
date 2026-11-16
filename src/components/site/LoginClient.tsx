"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Headset, LayoutDashboard, User } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Field, inputCls, Segmented } from "@/components/ui";
import { demoLogin, HOME, type DemoRole } from "./demo";

const BOOT = [
  "MERIDIAN IT · AI-HAS v1.0",
  "loading manuals ............ 12 found",
  "indexing sections .......... 41 chunks",
  "safety shields ............. armed",
  "automations ................ 7 ready",
  "connecting to service desk . ok",
  "",
  "ready. who's at the keyboard?",
];

function Boot() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= BOOT.length) return;
    const t = setTimeout(() => setN(n + 1), n === 0 ? 300 : 260);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="font-mono text-[13px] leading-[1.8] text-butter/90">
      {BOOT.slice(0, n).map((l, i) => (
        <div key={i} className={i === BOOT.length - 1 ? "text-cream" : ""}>
          {l || " "}
        </div>
      ))}
      <span className="caret text-butter">▍</span>
    </div>
  );
}

const ROLES: { role: DemoRole; label: string; who: string; icon: typeof User }[] = [
  { role: "employee", label: "Employee", who: "Maria · Marketing", icon: User },
  { role: "agent", label: "IT agent", who: "Paolo · Service Desk", icon: Headset },
  { role: "manager", label: "IT manager", who: "Grace · IT Operations", icon: LayoutDashboard },
];

const DEPARTMENTS = ["Marketing", "Finance", "Sales", "Operations", "Legal", "Customer Care", "Engineering", "Procurement"];

export function LoginClient({ demo }: { demo: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "Marketing" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("form");
    setError(null);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "signin" ? { email: form.email, password: form.password } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      window.location.href = HOME[data.role as DemoRole] ?? "/chat";
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="grain relative hidden flex-col justify-between overflow-hidden bg-cobalt p-10 text-cream lg:flex">
        <Link href="/">
          <Logo tone="light" />
        </Link>
        <div className="relative mx-auto w-full max-w-md">
          <div className="rounded-[26px] bg-[#efe7d6] p-4 pb-10 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
            <div className="scanlines min-h-[270px] rounded-2xl p-5" style={{ background: "radial-gradient(120% 90% at 50% 40%, #241ba8 0%, #150f6e 70%)" }}>
              <Boot />
            </div>
            <div className="mt-4 flex items-center justify-between px-2">
              <div className="h-2 w-28 rounded-full bg-[#2a2547]" />
              <div className="h-2 w-4 rounded-sm bg-[#3cc98a]" />
            </div>
          </div>
        </div>
        <p className="max-w-sm text-[14px] text-cream/65">Answers from the manuals, fixes on request, and a person when it matters.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-[40px] leading-none">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-[15px] text-muted">{mode === "signin" ? "Sign in with your Meridian account." : "New employees can set up an account in a minute."}</p>

          {demo && mode === "signin" && (
            <div className="mt-7">
              <p className="mb-2.5 text-[13px] font-medium text-ink-2">Quick demo, pick a seat</p>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.role}
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(r.role);
                      try {
                        await demoLogin(r.role);
                      } catch (err) {
                        setError((err as Error).message);
                        setBusy(null);
                      }
                    }}
                    className="group relative flex flex-col items-start rounded-2xl border border-line-2 bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md disabled:opacity-60"
                  >
                    <span className="grid size-8 place-items-center rounded-xl bg-sunk text-ink transition group-hover:bg-brand group-hover:text-on-brand">
                      <r.icon size={16} />
                    </span>
                    <span className="mt-2.5 text-[14px] font-medium text-ink">{r.label}</span>
                    <span className="text-[11.5px] leading-tight text-muted">{r.who}</span>
                    {busy === r.role && <motion.span layoutId="busy" className="absolute inset-x-3 bottom-1.5 h-0.5 animate-pulse rounded-full bg-brand" />}
                  </button>
                ))}
              </div>
              <div className="my-7 flex items-center gap-3 text-[12px] text-faint">
                <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
              </div>
            </div>
          )}

          <form onSubmit={submit} className={mode === "signup" || !demo ? "mt-7 space-y-4" : "space-y-4"}>
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                  <Field label="Full name">
                    <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
                  </Field>
                  <Field label="Department">
                    <select className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="Work email">
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="you@meridian.example" required />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 10 characters." : undefined}>
              <input
                className={inputCls}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
            </Field>
            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-[13.5px] text-bad">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy === "form"}>
              {mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={16} />
            </Button>
          </form>
          <div className="mt-6 flex justify-center">
            <Segmented
              value={mode}
              onChange={(v) => {
                setMode(v);
                setError(null);
              }}
              options={[
                { value: "signin", label: "I have an account" },
                { value: "signup", label: "I'm new here" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
