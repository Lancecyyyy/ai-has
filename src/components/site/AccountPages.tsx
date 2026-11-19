"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Field, inputCls } from "@/components/ui";

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-8 inline-block">
          <Logo />
        </Link>
        <h1 className="font-display text-[38px] leading-none">{title}</h1>
        <p className="mt-2 text-[15px] text-muted">{sub}</p>
        <div className="mt-7">{children}</div>
        <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </div>
  );
}

function Alert({ children, tone = "bad" }: { children: React.ReactNode; tone?: "bad" | "ok" }) {
  return (
    <p role="alert" className={tone === "bad" ? "rounded-xl bg-bad-bg px-3 py-2 text-[13.5px] text-bad" : "rounded-xl bg-ok-bg px-3 py-2 text-[13.5px] text-ok"}>
      {children}
    </p>
  );
}

export function ForgotClient() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Forgot your password?" sub="Enter your work email and we'll send you a link to choose a new one.">
      {sent ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <MailCheck className="text-brand" size={26} />
          <p className="mt-3 font-display text-[20px] leading-tight">Check your inbox</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            If <b className="text-ink">{email}</b> has a Meridian account, a reset link is on its way. It works once and expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Work email">
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Email me a reset link <ArrowRight size={16} />
          </Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetClient({ token }: { token: string }) {
  const [check, setCheck] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setCheck(d);
      })
      .catch((e: Error) => setError(e.message || "This reset link isn't valid."));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Shell title="Password changed" sub="You can sign in with your new password now.">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <CheckCircle2 className="text-ok" size={26} />
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Your account is unlocked too. We emailed you a confirmation.</p>
          <Link href="/login" className="mt-4 inline-block">
            <Button size="lg">
              Sign in <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell title="Choose a new password" sub={check ? `For ${check.email}. Use at least 10 characters.` : "Checking your link…"}>
      {!check && error ? (
        <Alert>{error}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 10 characters.">
            <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={10} required disabled={!check} />
          </Field>
          <Field label="Type it again">
            <input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={10} required disabled={!check} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!check}>
            Save new password <ArrowRight size={16} />
          </Button>
        </form>
      )}
    </Shell>
  );
}
