"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Skeleton } from "@/components/ui";
import { api } from "@/lib/client/api";

/** Opens the cited manual and scrolls to the exact section the answer came from. */
export function SourceModal({ source, onClose }: { source: { docId: number; heading: string; n: number } | null; onClose: () => void }) {
  const [doc, setDoc] = useState<{ title: string; category: string; content: string } | null>(null);
  const hl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setDoc(null);
    if (!source) return;
    api<{ doc: { title: string; category: string; content: string } }>(`/api/kb/${source.docId}`)
      .then((d) => setDoc(d.doc))
      .catch(() => setDoc({ title: "Manual unavailable", category: "", content: "This manual was removed or you don't have access." }));
  }, [source]);
  useEffect(() => {
    if (doc) setTimeout(() => hl.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
  }, [doc]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const sections = doc ? doc.content.split(/\n(?=##\s)/) : [];
  return (
    <AnimatePresence>
      {source && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-carbon/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Source manual"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-lg sm:rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <BookOpen size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted">Source {source.n}{doc?.category ? ` · ${doc.category}` : ""}</p>
                <p className="truncate font-display text-[20px] leading-tight">{doc?.title ?? "Loading…"}</p>
              </div>
              <button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-sunk hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 scroll-thin">
              {!doc ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : (
                sections.map((sec, i) => {
                  const heading = sec.match(/^##\s+(.*)/)?.[1]?.trim();
                  const active = heading && heading === source.heading;
                  const body = i === 0 ? sec.replace(/^#\s+.*\n?/, "") : sec;
                  return (
                    <div key={i} ref={active ? hl : undefined} className={active ? "relative -mx-3 my-2 rounded-2xl bg-hi/35 px-3 py-1 ring-1 ring-hi" : ""}>
                      {active && <span className="absolute -top-2.5 right-3 rounded-full bg-hi px-2 py-0.5 text-[11px] font-medium text-on-hi">Used in the answer</span>}
                      <Markdown text={body} className="text-[14.5px] leading-relaxed text-ink-2" />
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
