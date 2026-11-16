"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, MessageSquare, Moon, Search } from "lucide-react";
import { navFor } from "./nav";
import { usePrefs } from "@/components/Providers";
import { cx } from "@/components/ui";
import type { SessionUser } from "@/lib/server/auth";

type Cmd = { id: string; label: string; hint: string; icon: React.ComponentType<{ size?: number }>; run: () => void };

const ASKS = ["I forgot my password", "VPN won't connect", "I need access to Figma", "My print job is stuck", "My mailbox is full", "I got a new phone and MFA stopped working"];

export function CommandPalette({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const { prefs, setPrefs } = usePrefs();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIdx(0);
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const list: Cmd[] = navFor(user.role).map((n) => ({ id: n.href, label: n.label, hint: "Go to", icon: n.icon, run: go(n.href) }));
    ASKS.forEach((a) => list.push({ id: `ask-${a}`, label: a, hint: "Ask the assistant", icon: MessageSquare, run: go(`/chat?q=${encodeURIComponent(a)}`) }));
    list.push({
      id: "theme",
      label: prefs.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      hint: "Preference",
      icon: Moon,
      run: () => {
        setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
        setOpen(false);
      },
    });
    return list;
  }, [user.role, router, prefs.theme, setPrefs]);

  const q = query.trim().toLowerCase();
  const filtered = q ? cmds.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)) : cmds;
  const showAskFree = q.length > 3;
  const total = filtered.length + (showAskFree ? 1 : 0);

  const runAt = (i: number) => {
    if (showAskFree && i === filtered.length) {
      setOpen(false);
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    } else filtered[i]?.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-deep/35 backdrop-blur-[3px]" onClick={() => setOpen(false)} />
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-faint" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((i) => Math.min(total - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    runAt(idx);
                  }
                }}
                placeholder="Search pages, or describe an IT problem…"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              />
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2 scroll-thin">
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => runAt(i)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px]", idx === i ? "bg-sunk text-ink" : "text-ink-2")}
                >
                  <c.icon size={16} />
                  <span className="flex-1">{c.label}</span>
                  <span className="text-[12px] text-faint">{c.hint}</span>
                </button>
              ))}
              {showAskFree && (
                <button
                  onMouseEnter={() => setIdx(filtered.length)}
                  onClick={() => runAt(filtered.length)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px]", idx === filtered.length ? "bg-brand text-on-brand" : "text-ink-2")}
                >
                  <MessageSquare size={16} />
                  <span className="flex-1 truncate">Ask: “{query.trim()}”</span>
                  <CornerDownLeft size={14} />
                </button>
              )}
              {!total && <p className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</p>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
