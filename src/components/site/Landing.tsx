"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useMotionValueEvent } from "framer-motion";
import { ArrowRight, BookOpen, Check, ChevronRight, Headset, LayoutDashboard, Lock, ShieldCheck, Ticket, User, Wand2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ScreenDemo } from "./ScreenDemo";
import { demoLogin, type DemoRole } from "./demo";
import { cx } from "@/components/ui";

const HeroTerminal = dynamic(() => import("@/components/three/Terminal3D").then((m) => m.HeroTerminal), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

function DemoButton({ role, children, variant = "primary", className }: { role: DemoRole; children: React.ReactNode; variant?: "primary" | "secondary"; className?: string }) {
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
        "group inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-[15px] font-medium transition active:translate-y-px",
        variant === "primary" ? "bg-cobalt text-cream shadow-[inset_0_-3px_0_rgb(0_0_0/0.22)] hover:bg-[#1d1599]" : "border border-line-2 bg-surface text-ink hover:border-ink/40",
        className,
      )}
    >
      {children}
      <ArrowRight size={16} className={cx("transition-transform group-hover:translate-x-0.5", busy && "animate-pulse")} />
    </button>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <motion.nav
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className={cx(
          "flex w-full max-w-5xl items-center justify-between rounded-full border py-1.5 pl-3 pr-1.5 transition-all duration-300",
          scrolled ? "border-line bg-surface/85 shadow-md backdrop-blur-md" : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" aria-label="AI-HAS home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 text-[14px] text-ink-2 md:flex">
          {[
            ["#how", "How it works"],
            ["#manuals", "Manuals"],
            ["#shields", "Safety"],
            ["#roles", "Who it's for"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-1.5 transition hover:bg-sunk hover:text-ink">
              {label}
            </a>
          ))}
        </div>
        <Link href="/login" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-medium text-bg transition hover:opacity-90">
          Sign in <ChevronRight size={14} />
        </Link>
      </motion.nav>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative z-10">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2 shadow-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#3cc98a] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[#2fb47a]" />
            </span>
            Meridian IT helpdesk, open around the clock
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.22 }}
            className="font-display text-[54px] leading-[0.92] tracking-[-0.01em] text-ink sm:text-[76px] lg:text-[84px]"
          >
            The IT desk that
            <br />
            reads the <span className="relative inline-block">manual<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden><motion.path d="M3 9 C 50 2, 120 14, 197 5" stroke="#f7dd7d" strokeWidth="7" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.7, ease: "easeOut" }} /></svg></span> first.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.32 }} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
            AI-HAS answers routine IT questions from Meridian&apos;s own manuals, fixes the common problems by itself, and hands everything else to a person with the whole story attached.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.42 }} className="mt-8 flex flex-wrap gap-3">
            <DemoButton role="employee">Ask it something</DemoButton>
            <DemoButton role="manager" variant="secondary">
              Open the manager view
            </DemoButton>
          </motion.div>
          <p className="mt-4 text-[13px] text-faint">One click, no sign-up. Demo accounts for each role are ready.</p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.3 }} className="relative -mx-4 h-[420px] sm:h-[520px] lg:-mr-16 lg:h-[600px]">
          <HeroTerminal screen={<ScreenDemo />} />
        </motion.div>
      </div>
    </section>
  );
}

const OUTCOMES = [
  {
    key: "answer",
    icon: BookOpen,
    title: "Answers, with the page it came from",
    body: "Questions like “Outlook keeps asking for my password” get the exact steps from the right manual, with numbered sources you can open.",
  },
  {
    key: "fix",
    icon: Wand2,
    title: "Fixes routine problems itself",
    body: "Password resets, lockouts, MFA on a new phone, VPN profiles, software installs, stuck printers, full mailboxes. It asks first, then runs.",
  },
  {
    key: "escalate",
    icon: Ticket,
    title: "Hands the rest to a person",
    body: "Anything it can't solve becomes a ticket with a summary, priority and SLA, routed to the least-busy agent. Nobody repeats themselves.",
  },
] as const;

function OutcomeVisual({ k }: { k: (typeof OUTCOMES)[number]["key"] }) {
  if (k === "answer")
    return (
      <div className="space-y-3">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-cobalt px-4 py-2.5 text-[14px] text-cream">Outlook keeps asking for my password</div>
        <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[14px] text-ink shadow-sm">
          <p className="mb-1.5">
            From the <b>Email and Outlook</b> guide <span className="rounded bg-brand/10 px-1 font-mono text-[11px] text-brand">1</span>
          </p>
          <ol className="list-decimal space-y-0.5 pl-5 text-ink-2">
            <li>Close Outlook completely and reopen it.</li>
            <li>File › Office Account › Sign out, then sign in.</li>
            <li>Restart on the office network or VPN.</li>
          </ol>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-muted">
          <BookOpen size={14} /> Source 1 · Email and Outlook › Outlook keeps asking for a password · score 11.2
        </div>
      </div>
    );
  if (k === "fix")
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg">VPN profile re-issue</p>
          <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-medium text-ok">Done in 2.2s</span>
        </div>
        {["Locate device in MDM", "Revoke old certificate", "Issue new profile", "Push via device management"].map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.25 }} viewport={{ once: false, amount: 0.6 }} className="flex items-center gap-3 border-t border-line py-2.5 text-[14px] first:border-t-0">
            <span className="grid size-6 place-items-center rounded-full bg-cobalt text-cream">
              <Check size={13} />
            </span>
            {s}
          </motion.div>
        ))}
      </div>
    );
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] text-muted">HAS-1187</span>
        <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[12px] font-medium text-bad">P1 · 4h SLA</span>
      </div>
      <p className="mt-2 font-display text-xl leading-tight">Clicked a link in a suspicious email</p>
      <div className="mt-3 rounded-xl bg-sunk p-3 text-[13px] leading-relaxed text-ink-2">
        <span className="font-medium text-ink">AI summary.</span> Maria Santos (Marketing) reports a possible security incident. Already advised: disconnect Wi-Fi, keep the email. Suggested first step: confirm whether credentials were entered.
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
        <span className="grid size-6 place-items-center rounded-full bg-hi text-[11px] font-semibold text-on-hi">JD</span> Assigned to Jun Dela Cruz, least busy
      </div>
    </div>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center", "end center"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(2, Math.max(0, Math.floor(v * 3)))));
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="mb-14 max-w-2xl">
        <h2 className="font-display text-[42px] leading-none sm:text-[56px]">One question, three ways it ends.</h2>
        <p className="mt-4 text-[17px] text-muted">Every message is checked, understood, then answered, fixed or handed off. The employee never has to know which path it took.</p>
      </div>
      <div ref={ref} className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:h-fit">
          {OUTCOMES.map((o, i) => (
            <div key={o.key} className={cx("relative border-l-2 py-5 pl-6 transition-all duration-500", active === i ? "border-cobalt" : "border-line")}>
              <div className="flex items-center gap-3">
                <span className={cx("grid size-9 place-items-center rounded-xl transition-colors duration-500", active === i ? "bg-cobalt text-cream" : "bg-sunk text-ink-2")}>
                  <o.icon size={17} />
                </span>
                <h3 className={cx("font-display text-[24px] leading-tight transition-colors duration-500", active === i ? "text-ink" : "text-faint")}>{o.title}</h3>
              </div>
              <motion.p animate={{ height: active === i ? "auto" : 0, opacity: active === i ? 1 : 0 }} className="overflow-hidden pl-12 text-[15px] leading-relaxed text-muted">
                <span className="block pt-2">{o.body}</span>
              </motion.p>
            </div>
          ))}
        </div>
        <div className="space-y-[22vh] pb-[10vh]">
          {OUTCOMES.map((o, i) => (
            <motion.div key={o.key} initial={{ opacity: 0.25, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.6 }} transition={spring} className="relative">
              <span className="absolute -left-3 -top-6 font-display text-[80px] leading-none text-line-2 select-none">0{i + 1}</span>
              <div className="grain relative rounded-[28px] border border-line bg-sunk p-5 sm:p-8">
                <OutcomeVisual k={o.key} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MANUALS = ["Connecting to the Office VPN", "Resetting a Forgotten Password", "Account Lockout", "Requesting Software Access", "Multi-Factor Authentication", "Office Wi-Fi", "Printers and Scanning", "Email and Outlook"];
const DISK_COLORS = ["#261cc1", "#150f6e", "#e7c65c", "#2f27d0", "#1b1680", "#f7dd7d", "#261cc1", "#150f6e"];

function Manuals() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const bars = [
    ["Email and Outlook › Outlook keeps asking for a password", 0.92],
    ["Resetting a Forgotten Password › After resetting…", 0.58],
    ["Account Lockout › Repeated lockouts", 0.31],
  ] as const;
  return (
    <section id="manuals" className="bg-cobalt text-cream">
      <div className="grain relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-2">
        <div ref={ref} className="relative h-[380px] [perspective:1200px] sm:h-[440px]">
          {MANUALS.map((m, i) => {
            const light = DISK_COLORS[i] === "#e7c65c" || DISK_COLORS[i] === "#f7dd7d";
            return (
              <motion.div
                key={m}
                initial={{ opacity: 0, rotateX: 58, rotateZ: -18, y: 120 }}
                animate={inView ? { opacity: 1, rotateX: 58, rotateZ: -18, y: i * -30 } : {}}
                whileHover={{ y: i * -30 - 26, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                transition={{ ...spring, delay: i * 0.07 }}
                className="absolute left-1/2 top-[64%] h-[190px] w-[190px] -translate-x-1/2 rounded-[10px] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.5)] sm:h-[220px] sm:w-[220px]"
                style={{ background: DISK_COLORS[i], zIndex: i, transformStyle: "preserve-3d" }}
              >
                <div className="absolute left-1/2 top-0 h-[34%] w-[46%] -translate-x-1/2 rounded-b-[4px] bg-[linear-gradient(180deg,#d6d9e2,#9fa3b3)]">
                  <div className="absolute right-[22%] top-[14%] h-[62%] w-[18%] rounded-[2px] bg-[#6f7385]" />
                </div>
                <div className="absolute inset-x-[10%] bottom-[8%] h-[46%] rounded-[4px] bg-cream p-2.5 text-deep">
                  <div className={cx("-mx-2.5 -mt-2.5 mb-2 h-2.5 rounded-t-[4px]", light ? "bg-cobalt" : "bg-butter")} />
                  <p className="font-display text-[15px] leading-[1.05] sm:text-[17px]">{m}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div>
          <h2 className="font-display text-[42px] leading-none sm:text-[56px]">
            It reads Meridian&apos;s manuals.
            <br />
            <span className="text-butter">Not the internet.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-cream/75">
            Every manual is split into sections and indexed. For each question the assistant scores those sections, answers only from the best ones, and cites them. If nothing scores high enough it says so, opens a ticket on request, and logs the question so IT knows which manual to write next.
          </p>
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.06] p-5">
            <p className="mb-4 font-mono text-[12px] text-cream/60">“outlook keeps asking for my password”</p>
            {bars.map(([label, v], i) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between gap-4 text-[13px]">
                  <span className="truncate text-cream/85">{label}</span>
                  <span className="font-mono text-cream/60">{v.toFixed(2)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${v * 100}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} className={cx("h-full rounded-full", i === 0 ? "bg-butter" : "bg-white/40")} />
                </div>
              </div>
            ))}
            <p className="mt-4 border-t border-white/10 pt-3 text-[13px] text-cream/60">Answers below 0.42 confidence aren&apos;t guessed. They become knowledge gaps.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const RAW = "my password is Sunshine#2026 and my number is 0917 123 4567";
function Shields() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [n, setN] = useState(0);
  const [redacted, setRedacted] = useState(false);
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
        setTimeout(() => setRedacted(true), 700);
      }
    }, 38);
    return () => clearInterval(t);
  }, [inView]);
  const items = [
    [Lock, "Private details removed", "Passwords, phone numbers, card and ID numbers and API keys are stripped before anything is stored or sent to the model."],
    [ShieldCheck, "Prompt tricks blocked", "“Ignore your instructions”, fake system prompts and requests to act on someone else's account are refused and logged."],
    [Headset, "Stays in its lane", "Payroll, HR and banking questions are politely redirected. Physical repairs go to a person."],
    [User, "Only your own account", "Automations run on the signed-in employee only, after they confirm, with a full audit trail."],
  ] as const;
  return (
    <section id="shields" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-[42px] leading-none sm:text-[56px]">Shields go up before the AI says a word.</h2>
          <p className="mt-4 max-w-lg text-[17px] text-muted">Every message passes through safety checks first. Managers can watch them work on the Security page, and test any message in the sandbox.</p>
          <div ref={ref} className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-md">
            <p className="mb-2 text-[12px] text-faint">Employee types</p>
            <div className="min-h-[52px] rounded-xl bg-sunk px-4 py-3 font-mono text-[14px] text-ink">
              {redacted ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  my password is <span className="rounded bg-hi px-1 text-on-hi">[REDACTED-PASSWORD]</span> and my number is <span className="rounded bg-hi px-1 text-on-hi">[REDACTED-PHONE]</span>
                </motion.span>
              ) : (
                <>
                  {RAW.slice(0, n)}
                  <span className="caret">▍</span>
                </>
              )}
            </div>
            <motion.p animate={{ opacity: redacted ? 1 : 0 }} className="mt-2 flex items-center gap-1.5 text-[13px] text-ok">
              <ShieldCheck size={14} /> 2 private details removed before saving. Logged to Security.
            </motion.p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(([Icon, t, b], i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ ...spring, delay: i * 0.06 }} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <Icon size={20} className="text-cobalt" />
              <p className="mt-3 font-display text-[21px] leading-tight">{t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{b}</p>
            </motion.div>
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
    <section id="roles" className="border-t border-line bg-sunk">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h2 className="max-w-2xl font-display text-[42px] leading-none sm:text-[56px]">Pick a seat and look around.</h2>
        <p className="mt-4 max-w-xl text-[17px] text-muted">Each demo account sees the product the way that person would. Data is shared, so a ticket you open as Maria shows up in Paolo&apos;s queue.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {roles.map((r, i) => (
            <motion.div key={r.role} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...spring, delay: i * 0.08 }} className="flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <span className="grid size-11 place-items-center rounded-2xl bg-cobalt text-cream">
                <r.icon size={20} />
              </span>
              <p className="mt-4 font-display text-[28px] leading-none">{r.name}</p>
              <p className="mt-1 text-[14px] text-muted">{r.who}</p>
              <ul className="mt-5 flex-1 space-y-2 text-[14.5px] text-ink-2">
                {r.does.map((d) => (
                  <li key={d} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-cobalt" />
                    {d}
                  </li>
                ))}
              </ul>
              <DemoButton role={r.role} variant={i === 0 ? "primary" : "secondary"} className="mt-6 w-full justify-center">
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
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>AI-Powered Enterprise Helpdesk &amp; Workflow Automation System · Capstone, WPH Academy BSIT</p>
        </div>
      </footer>
    </div>
  );
}
