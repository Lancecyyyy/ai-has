"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, BookOpen, Check, Headset, LayoutDashboard, Ticket, User, Wand2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { demoLogin, type DemoRole } from "./demo";
import { cx } from "@/components/ui";

const HeroDesk = dynamic(() => import("@/components/three/Bell3D").then((m) => m.HeroDesk), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

function DemoButton({ role, children, variant = "primary", className }: { role: DemoRole; children: React.ReactNode; variant?: "primary" | "secondary" | "signal"; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await demoLogin(role);
        } catch {
          setBusy(false);
        }
      }}
      className={cx(
        "group inline-flex h-12 items-center gap-2.5 rounded-xl px-5 text-[15px] font-semibold transition active:translate-y-px",
        variant === "signal" && "bg-orange text-carbon shadow-[0_3px_0_#9c2f00,inset_0_1px_0_rgb(255_255_255/0.35)] hover:brightness-105",
        variant === "primary" && "bg-carbon text-paper shadow-[0_3px_0_#000,inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[#262624]",
        variant === "secondary" && "key border border-line-2 bg-surface text-ink",
        className,
      )}
    >
      {children}
      <ArrowRight size={16} className={cx("transition-transform group-hover:translate-x-0.5", busy && "animate-pulse")} />
    </button>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-2 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="AI-HAS home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] text-ink-2 md:flex">
          {[
            ["#how", "How it works"],
            ["#manuals", "Manuals"],
            ["#shields", "Safety"],
            ["#roles", "Who it's for"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="transition hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 font-mono text-[11.5px] text-muted lg:flex">
            <span className="size-1.5 rounded-full bg-[#19d27a] shadow-[0_0_6px_1px_rgb(25_210_122/0.7)]" />
            Desk online
          </span>
          <Link href="/login" className="key inline-flex h-9 items-center rounded-lg border border-line-2 bg-surface px-3.5 text-[13.5px] font-semibold text-ink">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

const SPECS = [
  ["Bell", "Ring it, or just type. It's listening around the clock."],
  ["Screen", "Answers from Meridian's own manuals, with sources."],
  ["Lights", "Green when idle, orange while it works, red when shields trip."],
  ["Slot", "Prints a ticket slip every time something gets fixed."],
];

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line-2">
      <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_72%_50%,black_30%,transparent_75%)]" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-2 px-4 pt-10 sm:px-6 lg:min-h-[calc(100svh-3.5rem-6rem)] lg:grid-cols-[1fr_1.15fr] lg:gap-0 lg:pt-0">
        <div className="relative z-10 py-4 lg:py-16">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-3 py-1 text-[13px] text-ink-2 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#19d27a] shadow-[0_0_6px_1px_rgb(25_210_122/0.7)]" />
            Meridian IT front desk, open 24/7
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="font-display text-[50px] leading-[0.9] text-ink sm:text-[72px] lg:text-[62px] xl:text-[70px] 2xl:text-[84px]">
            Ring once.
            <br />
            IT <span className="text-signal-ink">answers.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }} className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-ink-2">
            AI-HAS is Meridian&apos;s front desk for IT. It answers from the company&apos;s own manuals, fixes routine problems by itself, and hands the rest to a person with the whole story attached.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
            <DemoButton role="employee" variant="signal">
              Ask it something
            </DemoButton>
            <DemoButton role="manager" variant="secondary">
              Manager view
            </DemoButton>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.15 }} className="relative -mx-4 h-[340px] sm:mx-0 sm:h-[460px] lg:h-[min(600px,calc(100svh-11rem))] lg:min-h-[440px]">
          <HeroDesk />
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line-2 bg-surface/80 px-3 py-1 text-[12.5px] text-muted backdrop-blur">Click the bell</p>
        </motion.div>
      </div>

      <div className="relative border-t border-line-2 bg-surface/70">
        <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {SPECS.map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.08 }} className={cx("px-4 py-5 sm:px-6", i > 0 && "lg:border-l", i % 2 === 1 && "border-l", i > 1 && "border-t lg:border-t-0", "border-line-2")}>
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="font-mono text-[11px] text-signal-ink">0{i + 1}</span>
                {k}
              </p>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">{v}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MODES = [
  { key: "answer", icon: BookOpen, title: "Answer", body: "Questions like “Outlook keeps asking for my password” get the exact steps from the right manual, with numbered sources you can open." },
  { key: "fix", icon: Wand2, title: "Fix", body: "Password resets, lockouts, MFA on a new phone, VPN profiles, software installs, stuck printers, full mailboxes. It asks first, then runs." },
  { key: "handoff", icon: Ticket, title: "Hand off", body: "Anything it can't solve becomes a ticket with a summary, priority and SLA, routed to the least-busy agent. Nobody repeats themselves." },
] as const;

function ModeVisual({ k }: { k: (typeof MODES)[number]["key"] }) {
  if (k === "answer")
    return (
      <div className="space-y-3">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-carbon px-4 py-2.5 text-[14px] text-paper">Outlook keeps asking for my password</div>
        <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line-2 bg-surface px-4 py-3 text-[14px] text-ink shadow-sm">
          <p className="mb-1.5">
            From the <b>Email and Outlook</b> guide <span className="rounded bg-orange px-1 font-mono text-[11px] text-carbon">1</span>
          </p>
          <ol className="list-decimal space-y-0.5 pl-5 text-ink-2">
            <li>Close Outlook completely and reopen it.</li>
            <li>File › Office Account › Sign out, then sign in.</li>
            <li>Restart on the office network or VPN.</li>
          </ol>
        </div>
        <p className="font-mono text-[12px] text-muted">source 1 · Email and Outlook › Outlook keeps asking for a password · 11.2</p>
      </div>
    );
  if (k === "fix")
    return (
      <div className="rounded-2xl border border-line-2 bg-surface p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[16px] font-semibold">VPN profile re-issue</p>
          <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-medium text-ok">Done in 2.2s</span>
        </div>
        {["Locate device in MDM", "Revoke old certificate", "Issue new profile", "Push via device management"].map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.25 }} className="flex items-center gap-3 border-t border-line py-2.5 text-[14px] first:border-t-0">
            <span className="grid size-6 place-items-center rounded-md bg-carbon text-orange">
              <Check size={13} strokeWidth={3} />
            </span>
            {s}
          </motion.div>
        ))}
      </div>
    );
  return (
    <div className="mx-auto max-w-sm rounded-sm bg-paper p-5 font-mono text-[13px] text-carbon shadow-[0_20px_40px_-20px_rgb(0_0_0/0.4)] [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),95%_100%,90%_calc(100%-8px),85%_100%,80%_calc(100%-8px),75%_100%,70%_calc(100%-8px),65%_100%,60%_calc(100%-8px),55%_100%,50%_calc(100%-8px),45%_100%,40%_calc(100%-8px),35%_100%,30%_calc(100%-8px),25%_100%,20%_calc(100%-8px),15%_100%,10%_calc(100%-8px),5%_100%,0_calc(100%-8px))]">
      <div className="flex justify-between">
        <span className="font-semibold">HAS-1187</span>
        <span className="bg-orange px-1.5 font-semibold">P1 · 4H</span>
      </div>
      <p className="mt-1 text-[#666]">routed to Jun Dela Cruz (least busy)</p>
      <div className="my-3 border-t border-dashed border-[#bbb]" />
      <p className="font-sans text-[15px] font-semibold leading-snug">Clicked a link in a suspicious email</p>
      <p className="mt-2 font-sans leading-relaxed text-[#444]">Maria Santos (Marketing) reports a possible security incident. Already advised: disconnect Wi-Fi, keep the email. Next: confirm whether credentials were entered.</p>
      <div className="my-3 border-t border-dashed border-[#bbb]" />
      <p className="pb-2 text-[#666]">summary written by AI-HAS</p>
    </div>
  );
}

function HowItWorks() {
  const [mode, setMode] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  useEffect(() => {
    if (!auto || !inView) return;
    const t = setInterval(() => setMode((m) => (m + 1) % 3), 4200);
    return () => clearInterval(t);
  }, [auto, inView]);
  const m = MODES[mode];
  return (
    <section id="how" ref={ref} className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-[38px] leading-[0.95] sm:text-[54px]">One question. Three ways it ends.</h2>
          <p className="mt-4 max-w-md text-[17px] text-muted">Every message is checked, understood, then answered, fixed or handed off. The employee never has to know which path it took.</p>

          {/* three-position selector */}
          <div className="mt-10 inline-flex rounded-2xl border border-line-2 bg-sunk p-1.5 shadow-[inset_0_2px_4px_rgb(0_0_0/0.12)]" role="tablist" aria-label="Outcome">
            {MODES.map((x, i) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={mode === i}
                onClick={() => {
                  setMode(i);
                  setAuto(false);
                }}
                className={cx("relative flex h-14 w-28 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-semibold transition-colors sm:w-32", mode === i ? "text-paper" : "text-ink-2 hover:text-ink")}
              >
                {mode === i && <motion.span layoutId="mode-key" className="absolute inset-0 rounded-xl bg-carbon shadow-[0_3px_0_#000,inset_0_1px_0_rgb(255_255_255/0.1)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className={cx("relative size-1.5 rounded-full transition", mode === i ? "bg-orange shadow-[0_0_8px_2px_rgb(255_77_0/0.6)]" : "bg-black/20 dark:bg-white/20")} />
                <span className="relative">{x.title}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={m.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-2">
              {m.body}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="grain relative min-h-[380px] overflow-hidden rounded-[28px] border border-line-2 bg-sunk p-6 sm:p-10">
          <div className="grid-lines absolute inset-0 opacity-50" aria-hidden />
          <AnimatePresence mode="wait">
            <motion.div key={m.key} initial={{ opacity: 0, y: 24, rotateX: -8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -16 }} transition={spring} className="relative">
              <ModeVisual k={m.key} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const MANUALS = ["Office VPN", "Forgotten password", "Account lockout", "Software access", "MFA", "Office Wi-Fi", "Printers", "Email & Outlook"];

function Manuals() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35, once: true });
  const bars = [
    ["Email and Outlook › Outlook keeps asking…", 0.92],
    ["Forgotten password › After resetting…", 0.58],
    ["Account lockout › Repeated lockouts", 0.31],
  ] as const;
  return (
    <section id="manuals" className="bg-carbon text-paper">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-[38px] leading-[0.95] sm:text-[54px]">
            It reads Meridian&apos;s manuals.
            <br />
            <span className="text-orange">Not the internet.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-paper/70">
            Every manual is split into sections and indexed. For each question the assistant scores those sections, answers only from the best ones, and cites them. If nothing scores high enough it says so and logs the question, so IT knows which manual to write next.
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#0b0b0a] p-5 shadow-[inset_0_2px_12px_rgb(0_0_0/0.8)]">
            <p className="mb-4 font-mono text-[12px] text-paper/50">&gt; outlook keeps asking for my password</p>
            {bars.map(([label, v], i) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between gap-4 font-mono text-[12px]">
                  <span className="truncate text-paper/80">{label}</span>
                  <span className={i === 0 ? "text-orange" : "text-paper/45"}>{v.toFixed(2)}</span>
                </div>
                <div className="flex gap-[3px]">
                  {Array.from({ length: 24 }).map((_, j) => (
                    <motion.span key={j} initial={{ opacity: 0.08 }} whileInView={{ opacity: j / 24 < v ? 1 : 0.08 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15 + j * 0.02 }} className={cx("h-2.5 flex-1 rounded-[1px]", i === 0 ? "bg-orange" : "bg-paper/50")} />
                  ))}
                </div>
              </div>
            ))}
            <p className="mt-4 border-t border-white/10 pt-3 text-[13px] text-paper/55">Below 0.42 confidence it won&apos;t guess. The question becomes a knowledge gap.</p>
          </div>
        </div>

        {/* manual rack: cartridges slide in on scroll */}
        <div ref={ref} className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#2a2a28] to-[#1c1c1b] p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] sm:p-6">
          <div className="mb-4 flex items-center justify-between px-1 font-mono text-[11.5px] text-paper/50">
            <span>MANUAL RACK</span>
            <span>12 loaded · 43 sections</span>
          </div>
          <div className="space-y-2">
            {MANUALS.map((name, i) => (
              <motion.div
                key={name}
                initial={{ x: 140, opacity: 0 }}
                animate={inView ? { x: 0, opacity: 1 } : {}}
                transition={{ type: "spring", stiffness: 220, damping: 24, delay: i * 0.07 }}
                whileHover={{ x: -10 }}
                className="flex h-12 items-center gap-3 rounded-lg bg-gradient-to-b from-[#d9d9d5] to-[#b9b9b4] px-3 text-carbon shadow-[0_2px_0_#000,inset_0_1px_0_rgb(255_255_255/0.6)]"
              >
                <span className="flex gap-[3px]" aria-hidden>
                  {[0, 1, 2, 3].map((g) => (
                    <span key={g} className="h-6 w-[3px] rounded-full bg-black/20" />
                  ))}
                </span>
                <span className="flex h-7 flex-1 items-center rounded-[4px] bg-paper px-2.5 text-[13.5px] font-semibold">
                  <span className="mr-2 h-full w-1.5 bg-orange" />
                  {name}
                </span>
                <motion.span animate={inView ? { opacity: [0.3, 1, 0.3] } : {}} transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.3 }} className="size-1.5 rounded-full bg-[#19d27a]" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const RAW = "my password is Sunshine#2026 and my number is 0917 123 4567";
const SHIELDS = [
  ["Private details removed", "Passwords, phone, card and ID numbers, and API keys are stripped before anything is stored or sent to the model."],
  ["Prompt tricks blocked", "“Ignore your instructions”, fake system prompts and requests to act on someone else's account are refused and logged."],
  ["Stays in its lane", "Payroll, HR and banking questions are politely redirected. Physical repairs go to a person."],
  ["Only your own account", "Automations run on the signed-in employee only, after they confirm, with a full audit trail."],
];

function Shields() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [n, setN] = useState(0);
  const [redacted, setRedacted] = useState(false);
  const [on, setOn] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setN(0);
    setRedacted(false);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setN(i);
      if (i >= RAW.length) {
        clearInterval(t);
        setTimeout(() => setRedacted(true), 600);
      }
    }, 36);
    return () => clearInterval(t);
  }, [inView]);
  useEffect(() => {
    if (!inView) return;
    setOn(0);
    const t = setInterval(() => setOn((x) => (x >= SHIELDS.length ? x : x + 1)), 280);
    return () => clearInterval(t);
  }, [inView]);
  return (
    <section id="shields" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
      <div ref={ref} className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <h2 className="font-display text-[38px] leading-[0.95] sm:text-[54px]">Shields go up before it says a word.</h2>
          <p className="mt-4 max-w-md text-[17px] text-muted">Every message passes through safety checks first. Managers watch them on the Security page and can test any message in a sandbox.</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-line-2 bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-[12.5px] text-muted">
              <span>Employee types</span>
              <span className={cx("font-mono text-[11.5px]", redacted ? "text-ok" : "text-faint")}>{redacted ? "2 removed" : "scanning"}</span>
            </div>
            <div className="lcd m-3 min-h-[64px] rounded-lg px-4 py-3 font-mono text-[13.5px] leading-relaxed text-paper">
              {redacted ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  my password is <span className="bg-orange px-1 text-carbon">[REDACTED-PASSWORD]</span> and my number is <span className="bg-orange px-1 text-carbon">[REDACTED-PHONE]</span>
                </motion.span>
              ) : (
                <>
                  {RAW.slice(0, n)}
                  <span className="caret text-orange">▍</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="divide-y divide-line-2 rounded-[24px] border border-line-2 bg-surface shadow-sm">
          {SHIELDS.map(([t, b], i) => (
            <div key={t} className="flex gap-4 p-5">
              <span className={cx("relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors duration-300", i < on ? "border-carbon bg-carbon" : "border-line-2 bg-sunk")} aria-hidden>
                <motion.span animate={{ x: i < on ? 22 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cx("absolute top-[3px] size-5 rounded-full shadow", i < on ? "bg-orange" : "bg-surface")} />
              </span>
              <div>
                <p className="text-[16px] font-semibold">{t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    { role: "employee" as const, icon: User, name: "Employee", who: "Maria Santos, Marketing", does: ["Chat for help any time", "Run fixes with one tap", "Follow tickets and reply"] },
    { role: "agent" as const, icon: Headset, name: "IT agent", who: "Paolo Reyes, Service Desk", does: ["Ticket queue with SLA timers", "AI-drafted replies from manuals", "Turn solved tickets into manuals"] },
    { role: "manager" as const, icon: LayoutDashboard, name: "IT manager", who: "Grace Lim, IT Operations", does: ["Resolution and response KPIs", "Automation and security oversight", "Knowledge gaps and CSV reports"] },
  ];
  return (
    <section id="roles" className="border-t border-line-2 bg-sunk">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="max-w-2xl font-display text-[38px] leading-[0.95] sm:text-[54px]">Pick a seat and look around.</h2>
        <p className="mt-4 max-w-xl text-[17px] text-muted">Each demo account sees the product the way that person would. Data is shared, so a ticket you open as Maria shows up in Paolo&apos;s queue.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {roles.map((r, i) => (
            <motion.div key={r.role} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...spring, delay: i * 0.08 }} className="flex flex-col rounded-[22px] border border-line-2 bg-surface p-6 shadow-md">
              <div className="flex items-center justify-between">
                <span className={cx("grid size-11 place-items-center rounded-xl", i === 0 ? "bg-orange text-carbon" : "bg-carbon text-paper")}>
                  <r.icon size={20} />
                </span>
                <span className="font-mono text-[11.5px] text-faint">SEAT 0{i + 1}</span>
              </div>
              <p className="mt-5 font-display text-[26px] leading-none">{r.name}</p>
              <p className="mt-1.5 text-[14px] text-muted">{r.who}</p>
              <ul className="mt-5 flex-1 space-y-2 text-[14.5px] text-ink-2">
                {r.does.map((d) => (
                  <li key={d} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-signal-ink" />
                    {d}
                  </li>
                ))}
              </ul>
              <DemoButton role={r.role} variant={i === 0 ? "signal" : "secondary"} className="mt-6 w-full justify-center">
                Continue as {r.name.toLowerCase()}
              </DemoButton>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <Nav />
      <Hero />
      <HowItWorks />
      <Manuals />
      <Shields />
      <Roles />
      <footer className="border-t border-line-2">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>AI-Powered Enterprise Helpdesk &amp; Workflow Automation System · Capstone, WPH Academy BSIT</p>
        </div>
      </footer>
    </div>
  );
}
