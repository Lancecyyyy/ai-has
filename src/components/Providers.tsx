"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { installGlobalClickSound, setSoundEnabled } from "@/lib/client/sound";

type Toast = { id: number; tone: "ok" | "info" | "bad"; text: string };
type Prefs = { sound: boolean; theme: "light" | "dark" };

const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
const PrefsCtx = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void }>({
  prefs: { sound: true, theme: "light" },
  setPrefs: () => {},
});

export const useToast = () => useContext(ToastCtx);
export const usePrefs = () => useContext(PrefsCtx);

function read(): Prefs {
  try {
    return {
      sound: localStorage.getItem("has-sound") !== "off",
      theme: (localStorage.getItem("has-theme") as Prefs["theme"]) || "light",
    };
  } catch {
    return { sound: true, theme: "light" };
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>({ sound: true, theme: "light" });

  useEffect(() => {
    const p = read();
    setPrefsState(p);
    setSoundEnabled(p.sound);
    return installGlobalClickSound();
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("has-sound", next.sound ? "on" : "off");
        localStorage.setItem("has-theme", next.theme);
      } catch {}
      setSoundEnabled(next.sound);
      document.documentElement.dataset.theme = next.theme;
      return next;
    });
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const prefsValue = useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);

  return (
    <PrefsCtx.Provider value={prefsValue}>
      <ToastCtx.Provider value={toast}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full bg-carbon py-2 pl-2.5 pr-3 text-sm text-paper shadow-lg ring-1 ring-white/10"
              >
                <span
                  className={`grid size-6 place-items-center rounded-full ${t.tone === "ok" ? "bg-orange text-carbon" : t.tone === "bad" ? "bg-[#ff7a8a] text-carbon" : "bg-white/15"}`}
                >
                  {t.tone === "ok" ? <Check size={14} /> : t.tone === "bad" ? <TriangleAlert size={13} /> : <Info size={13} />}
                </span>
                <span className="leading-snug">{t.text}</span>
                <button
                  className="ml-1 rounded-full p-0.5 text-paper/60 hover:text-paper"
                  onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ToastCtx.Provider>
    </PrefsCtx.Provider>
  );
}
