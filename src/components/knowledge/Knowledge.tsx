"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, FilePlus2, FileUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useToast } from "@/components/Providers";
import { Markdown } from "@/components/Markdown";
import { Badge, Button, Card, cx, Empty, Field, inputCls, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";

interface Doc {
  id: number;
  title: string;
  category: string;
  source: string;
  citations: number;
  updated_at: string;
  chars: number;
  chunks: number;
  author: string | null;
}
interface SearchRes {
  terms: string[];
  intent: { label: string; workflow?: string };
  confidence: number;
  ms: number;
  hits: { id: number; docId: number; title: string; heading: string; score: number; coverage: number; content: string }[];
}

const CATEGORIES = ["Accounts", "Access", "Network", "Email", "Devices", "Security", "Onboarding", "Hardware", "General"];
const SOURCE_LABEL: Record<string, string> = { seed: "Official", upload: "Uploaded", ticket: "From a ticket" };

function Editor({ initial, onClose, onSaved }: { initial: { id?: number; title: string; category: string; content: string }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"write" | "upload">(initial.id ? "write" : "write");
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "upload" && !initial.id) {
        if (!file) throw new Error("Choose a file first.");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", form.title);
        fd.append("category", form.category);
        await api("/api/kb", { method: "POST", body: fd });
      } else if (initial.id) {
        await api(`/api/kb/${initial.id}`, { method: "PATCH", json: form });
      } else {
        await api("/api/kb", { method: "POST", json: form });
      }
      toast(initial.id ? "Manual updated and re-indexed." : "Manual added. The assistant can use it right away.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-carbon/40" onClick={onClose} />
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl border border-line bg-surface shadow-lg sm:rounded-3xl"
        role="dialog"
        aria-label="Edit manual"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-[24px] leading-none">{initial.id ? "Edit manual" : "Add a manual"}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 scroll-thin">
          {!initial.id && (
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "write", label: "Write or paste" },
                { value: "upload", label: "Upload a file" },
              ]}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Title" hint={mode === "upload" ? "Leave empty to use the file name." : undefined}>
              <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Connecting a second monitor" />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          {mode === "upload" && !initial.id ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
              className={cx("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-brand bg-brand/5" : "border-line-2 hover:border-brand/50")}
            >
              <FileUp size={26} className="text-brand" />
              <p className="mt-3 text-[15px] font-medium">{file ? file.name : "Drop a PDF, Markdown or text file"}</p>
              <p className="mt-1 text-[13px] text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB · ready to index` : "or click to browse · up to 4 MB"}</p>
              <input type="file" accept=".pdf,.md,.markdown,.txt" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-2">Content</span>
                <button onClick={() => setPreview((p) => !p)} className="text-[12.5px] font-medium text-brand">
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>
              {preview ? (
                <div className="min-h-[260px] rounded-xl border border-line bg-sunk/40 p-4 text-[14px]">
                  <Markdown text={form.content} />
                </div>
              ) : (
                <textarea
                  className={cx(inputCls, "min-h-[260px] font-mono text-[13px] leading-relaxed")}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={"## Symptom or task\n1. First step\n2. Second step\n\n## Another section\n..."}
                />
              )}
              <p className="mt-1.5 text-[12px] text-faint">Each “## Heading” becomes a section the assistant can cite. Short sections with numbered steps work best.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {initial.id ? "Save and re-index" : "Add to knowledge base"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Viewer({ id, onClose, onEdit, onDeleted }: { id: number; onClose: () => void; onEdit: (d: { id: number; title: string; category: string; content: string }) => void; onDeleted: () => void }) {
  const toast = useToast();
  const { data } = useApi<{ doc: { id: number; title: string; category: string; content: string; source: string; author: string | null; updated_at: string }; chunks: { heading: string; chars: number }[] }>(`/api/kb/${id}`);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-carbon/30" onClick={onClose} />
      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="relative flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-lg">
        {!data ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            <div className="border-b border-line px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex gap-1.5">
                    <Badge tone="brand">{data.doc.category}</Badge>
                    <Badge>{SOURCE_LABEL[data.doc.source] ?? data.doc.source}</Badge>
                  </div>
                  <h2 className="font-display text-[28px] leading-[1.05]">{data.doc.title}</h2>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {data.chunks.length} sections indexed · updated {timeAgo(data.doc.updated_at)}
                    {data.doc.author ? ` by ${data.doc.author}` : ""}
                  </p>
                </div>
                <button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunk" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => onEdit(data.doc)}>
                  Edit
                </Button>
                {confirm ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await api(`/api/kb/${id}`, { method: "DELETE" });
                      toast("Manual removed from the knowledge base.");
                      onDeleted();
                    }}
                  >
                    Yes, delete it
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 scroll-thin">
              <Markdown text={data.doc.content.replace(/^#\s+.*\n?/, "")} className="text-[14.5px] leading-relaxed text-ink-2" />
            </div>
          </>
        )}
      </motion.aside>
    </div>
  );
}

function Playground() {
  const [q, setQ] = useState("my vpn certificate expired");
  const [res, setRes] = useState<SearchRes | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (query = q) => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setRes(await api<SearchRes>(`/api/kb/search?q=${encodeURIComponent(query)}`));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const max = Math.max(1, ...(res?.hits.map((h) => h.score) ?? [1]));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className={cx(inputCls, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question an employee might ask" aria-label="Test question" />
          </div>
          <Button type="submit" loading={busy}>
            Retrieve
          </Button>
        </form>
        <div className="mt-4 space-y-3">
          {res?.hits.map((h, i) => (
            <motion.div key={h.id + "-" + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={cx("p-4", i === 0 && res.confidence >= 0.42 && "border-brand/40")}>
                <div className="flex items-center gap-3">
                  <span className={cx("grid size-7 place-items-center rounded-lg font-mono text-[12px]", i === 0 ? "bg-brand text-on-brand" : "bg-sunk text-ink-2")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium">{h.heading}</p>
                    <p className="truncate text-[12.5px] text-muted">{h.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px]">{h.score.toFixed(2)}</p>
                    <p className="text-[11px] text-faint">BM25</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(h.score / max) * 100}%` }} transition={{ duration: 0.6 }} className={cx("h-full rounded-full", i === 0 ? "bg-brand" : "bg-brand/40")} />
                </div>
                <p className="mt-2.5 line-clamp-2 text-[13px] text-ink-2">{h.content.replace(/[#*`]/g, "")}</p>
                <p className="mt-1.5 text-[12px] text-faint">Matched {Math.round(h.coverage * 100)}% of the question&apos;s key words</p>
              </Card>
            </motion.div>
          ))}
          {res && !res.hits.length && <Empty title="No section matched" body="This question would be logged as a knowledge gap." />}
        </div>
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-[12.5px] text-muted">Confidence</p>
          <p className={cx("font-display text-[44px] leading-none", (res?.confidence ?? 0) >= 0.42 ? "text-brand" : "text-warn")}>{res ? res.confidence.toFixed(2) : "–"}</p>
          <p className="mt-2 text-[13px] text-ink-2">{!res ? "" : res.confidence >= 0.42 ? "Above 0.42, so the assistant would answer from section 1." : "Below 0.42, so the assistant would say it doesn't know and log a gap."}</p>
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted">Intent</span>
              <span className="font-medium">{res?.intent.label ?? "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Would automate</span>
              <span className="font-medium">{res?.intent.workflow ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Search time</span>
              <span className="font-mono">{res ? `${res.ms} ms` : "–"}</span>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-[12.5px] text-muted">Search terms after stemming and synonyms</p>
          <div className="flex flex-wrap gap-1.5">
            {res?.terms.map((t) => (
              <span key={t} className="rounded-md bg-sunk px-2 py-0.5 font-mono text-[12px] text-ink-2">
                {t}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Gaps({ onDraft }: { onDraft: (q: string) => void }) {
  const toast = useToast();
  const { data, reload, loading } = useApi<{ gaps: { id: number; query: string; hits: number; last_seen: string }[] }>("/api/kb/gaps");
  if (loading && !data) return <Skeleton className="h-60" />;
  if (!data?.gaps.length) return <Card><Empty icon={<BookOpen size={22} />} title="No open gaps" body="Every recent question matched a manual." /></Card>;
  return (
    <Card className="divide-y divide-line">
      {data.gaps.map((g) => (
        <div key={g.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-bg font-mono text-[13px] text-warn">{g.hits}×</span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{g.query}</p>
            <p className="text-[12.5px] text-muted">Last asked {timeAgo(g.last_seen)}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon={<FilePlus2 size={14} />} onClick={() => onDraft(g.query)}>
              Write manual
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api("/api/kb/gaps", { method: "PATCH", json: { id: g.id, status: "dismissed" } });
                toast("Dismissed.", "info");
                reload();
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function Knowledge() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"manuals" | "playground" | "gaps">((params.get("tab") as "gaps") ?? "manuals");
  const { data, loading, reload } = useApi<{ docs: Doc[] }>("/api/kb");
  const [viewing, setViewing] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id?: number; title: string; category: string; content: string } | null>(null);
  const [filter, setFilter] = useState("");
  const handled = useRef(false);

  useEffect(() => {
    const draft = params.get("draft");
    if (draft && !handled.current) {
      handled.current = true;
      setEditing({ title: draft.replace(/^how (do i|to) /i, "").replace(/^\w/, (c) => c.toUpperCase()), category: "General", content: `## ${draft}\n1. \n2. \n3. \n` });
      router.replace("/knowledge", { scroll: false });
    }
  }, [params, router]);

  const docs = (data?.docs ?? []).filter((d) => !filter || `${d.title} ${d.category}`.toLowerCase().includes(filter.toLowerCase()));
  const groups = docs.reduce<Record<string, Doc[]>>((acc, d) => ((acc[d.category] ??= []).push(d), acc), {});
  const totalChunks = (data?.docs ?? []).reduce((s, d) => s + d.chunks, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Knowledge base"
        sub={`The manuals the assistant reads. ${data ? `${data.docs.length} manuals, ${totalChunks} searchable sections.` : ""}`}
        right={
          <Button icon={<Plus size={16} />} onClick={() => setEditing({ title: "", category: "General", content: "" })}>
            Add manual
          </Button>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "manuals", label: "Manuals" },
          { value: "playground", label: "Test retrieval" },
          { value: "gaps", label: "Knowledge gaps" },
        ]}
        className="mb-6"
      />
      {tab === "manuals" &&
        (loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            <div className="relative mb-5 max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className={cx(inputCls, "pl-9")} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter manuals" aria-label="Filter manuals" />
            </div>
            {Object.entries(groups).map(([cat, list]) => (
              <section key={cat} className="mb-8">
                <h2 className="mb-3 font-display text-[22px]">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((d, i) => (
                    <motion.button
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setViewing(d.id)}
                      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                    >
                      <span className="absolute right-0 top-0 h-full w-1.5 bg-brand opacity-0 transition group-hover:opacity-100" />
                      <div className="flex items-start gap-3">
                        <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-carbon text-orange">
                          <span className="absolute left-1/2 top-0 h-2.5 w-4 -translate-x-1/2 rounded-b-[2px] bg-[#c9ccd6]" />
                          <BookOpen size={15} className="mt-1.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium leading-snug text-ink">{d.title}</p>
                          <p className="mt-1 text-[12.5px] text-muted">
                            {d.chunks} sections · cited {d.citations}×
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge tone={d.source === "seed" ? "neutral" : "hi"}>{SOURCE_LABEL[d.source] ?? d.source}</Badge>
                        <span className="text-[12px] text-faint">{timeAgo(d.updated_at)}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            ))}
          </>
        ))}
      {tab === "playground" && <Playground />}
      {tab === "gaps" && <Gaps onDraft={(q) => setEditing({ title: q.replace(/^\w/, (c) => c.toUpperCase()), category: "General", content: `## ${q}\n1. \n2. \n3. \n` })} />}

      <AnimatePresence>
        {viewing != null && (
          <Viewer
            key={viewing}
            id={viewing}
            onClose={() => setViewing(null)}
            onEdit={(d) => {
              setViewing(null);
              setEditing(d);
            }}
            onDeleted={() => {
              setViewing(null);
              reload();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editing && (
          <Editor
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
