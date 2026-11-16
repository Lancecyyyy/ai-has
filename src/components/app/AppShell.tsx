"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, Moon, Search, Sun, Volume2, VolumeX, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { usePrefs } from "@/components/Providers";
import { cx, Kbd } from "@/components/ui";
import { navFor, ROLE_LABEL } from "./nav";
import { CommandPalette } from "./CommandPalette";
import type { SessionUser } from "@/lib/server/auth";

const UserCtx = createContext<SessionUser | null>(null);
export const useUser = () => useContext(UserCtx)!;

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SideNav({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const path = usePathname();
  const { prefs, setPrefs } = usePrefs();
  const router = useRouter();
  const items = navFor(user.role);
  return (
    <div className="grain relative flex h-full flex-col bg-side px-3 pb-3 pt-5 text-side-ink">
      <Link href={items[0].href} onClick={onNavigate} className="mb-6 px-2">
        <Logo tone="light" />
      </Link>
      <button
        onClick={() => window.dispatchEvent(new Event("open-palette"))}
        className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[13.5px] text-side-ink/70 transition hover:bg-white/10"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Jump to…</span>
        <span className="rounded-md border border-white/15 px-1.5 font-mono text-[10.5px]">Ctrl K</span>
      </button>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cx("relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors", active ? "text-deep" : "text-side-ink/75 hover:bg-white/[0.07] hover:text-side-ink")}
            >
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-butter" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <item.icon size={17} className="relative" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mb-3 flex gap-1.5 px-1">
        <button
          onClick={() => setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}
          className="grid size-9 place-items-center rounded-xl text-side-ink/70 transition hover:bg-white/10 hover:text-side-ink"
          aria-label={prefs.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title="Theme"
        >
          {prefs.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          onClick={() => setPrefs({ sound: !prefs.sound })}
          className="grid size-9 place-items-center rounded-xl text-side-ink/70 transition hover:bg-white/10 hover:text-side-ink"
          aria-label={prefs.sound ? "Mute click sounds" : "Turn on click sounds"}
          title="Click sounds"
          data-silent
        >
          {prefs.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] p-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-butter text-[13px] font-semibold text-deep">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{user.name}</p>
          <p className="truncate text-[12px] text-side-ink/60">
            {ROLE_LABEL[user.role]} · {user.department}
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
          }}
          className="grid size-8 place-items-center rounded-lg text-side-ink/60 transition hover:bg-white/10 hover:text-side-ink"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <UserCtx.Provider value={user}>
      <div className="flex h-dvh overflow-hidden bg-bg">
        <aside className="hidden w-[248px] shrink-0 lg:block">
          <SideNav user={user} />
        </aside>
        <AnimatePresence>
          {open && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-deep/40 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="fixed inset-y-0 left-0 z-50 w-[260px] lg:hidden"
              >
                <SideNav user={user} onNavigate={() => setOpen(false)} />
                <button onClick={() => setOpen(false)} className="absolute right-3 top-5 grid size-8 place-items-center rounded-lg text-cream/70 hover:bg-white/10" aria-label="Close menu">
                  <X size={18} />
                </button>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface/80 px-3 backdrop-blur lg:hidden">
            <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl text-ink hover:bg-sunk" aria-label="Open menu">
              <Menu size={20} />
            </button>
            <Logo />
            <button onClick={() => window.dispatchEvent(new Event("open-palette"))} className="grid size-10 place-items-center rounded-xl text-ink hover:bg-sunk" aria-label="Search">
              <Search size={19} />
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto scroll-thin">{children}</main>
        </div>
      </div>
      <CommandPalette user={user} />
      <span className="sr-only">
        Press <Kbd>Ctrl K</Kbd> to search
      </span>
    </UserCtx.Provider>
  );
}
