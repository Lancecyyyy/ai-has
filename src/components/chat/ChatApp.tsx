"use client";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, History, Mic, MicOff, PanelRight, Plus, Trash2, X } from "lucide-react";
import { useUser } from "@/components/app/AppShell";
import { useToast } from "@/components/Providers";
import { Badge, cx } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";
import { playClick } from "@/lib/client/sound";
import type { Mood } from "@/components/three/Terminal3D";
import { AssistantMessage, Typing, UserBubble } from "./MessageView";
import { Inspector } from "./Inspector";
import { SourceModal } from "./SourceModal";
import type { ConvSummary, Msg } from "./types";

const Mascot = dynamic(() => import("@/components/three/Terminal3D").then((m) => m.MascotTerminal), { ssr: false, loading: () => <div className="h-full" /> });

const STARTERS = [
  { title: "I forgot my password", sub: "Get a reset link in seconds" },
  { title: "VPN says certificate expired", sub: "Re-issue your VPN profile" },
  { title: "I need access to Figma", sub: "Request software from the catalog" },
  { title: "Outlook keeps asking for my password", sub: "Step-by-step from the manual" },
];

const STATUS_DOT: Record<string, string> = { resolved: "bg-ok", escalated: "bg-warn", open: "bg-brand" };

type SR = { start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; lang: string; interimResults: boolean };

export function ChatApp() {
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const urlConv = params.get("c");
  const urlQ = params.get("q");

  const convs = useApi<{ conversations: ConvSummary[] }>("/api/conversations");
  const status = useApi<{ system: { engine: string } }>("/api/status");
  const engine = status.data?.system.engine ?? "local";

  const [convId, setConvId] = useState<string | null>(urlConv);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [stream, setStream] = useState<{ status: string; text: string } | null>(null);
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [cite, setCite] = useState<{ docId: number; heading: string; n: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [listening, setListening] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const skipLoad = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const sentQ = useRef(false);
  const recog = useRef<SR | null>(null);

  // Load a conversation when the URL changes (but not when we just created it ourselves)
  useEffect(() => {
    setConvId(urlConv);
    if (!urlConv) {
      setMessages([]);
      setSelected(null);
      return;
    }
    if (skipLoad.current === urlConv) return;
    setLoadingConv(true);
    api<{ messages: Msg[] }>(`/api/conversations/${urlConv}`)
      .then((d) => {
        setMessages(d.messages);
        setSelected(null);
      })
      .catch(() => {
        toast("That conversation couldn't be opened.", "bad");
        router.replace("/chat");
      })
      .finally(() => setLoadingConv(false));
  }, [urlConv, router, toast]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, stream?.text, stream?.status]);

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant") ?? null, [messages]);
  const inspected = (selected != null ? messages.find((m) => m.id === selected) : null) ?? lastAssistant;

  useEffect(() => {
    if (stream) return setMood("thinking");
    const k = lastAssistant?.meta?.kind;
    if (k === "blocked") setMood("alert");
    else if (k === "automation_result" || lastAssistant?.meta?.intent === "resolved") setMood("happy");
    else setMood("idle");
  }, [stream, lastAssistant]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || stream) return;
      setInput("");
      setSelected(null);
      const tempId = -Date.now();
      setMessages((m) => [...m, { id: tempId, role: "user", content: t, meta: {}, latency_ms: null, feedback: null, created_at: new Date().toISOString() }]);
      setStream({ status: "Checking your message", text: "" });
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: convId, text: t }) });
        if (res.status === 401) return void (window.location.href = "/login");
        if (!res.body) throw new Error("No response");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line);
            if (e.type === "start") {
              setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, id: e.userMessage.id, content: e.userMessage.content, meta: { redactions: e.redactions } } : x)));
              if (!convId) {
                skipLoad.current = e.conversationId;
                setConvId(e.conversationId);
                router.replace(`/chat?c=${e.conversationId}`, { scroll: false });
              }
            } else if (e.type === "status") setStream((s) => ({ status: e.text, text: s?.text ?? "" }));
            else if (e.type === "delta") {
              acc += e.text;
              setStream((s) => ({ status: s?.status ?? "", text: acc }));
            } else if (e.type === "done") {
              setMessages((m) => [...m, e.message]);
              playClick("soft");
            } else if (e.type === "error") {
              toast(e.error, "bad");
              setMessages((m) => m.filter((x) => x.id !== tempId));
              setInput(t);
            }
          }
        }
      } catch {
        toast("Connection dropped. Your message wasn't sent.", "bad");
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setInput(t);
      } finally {
        setStream(null);
        convs.reload();
        ta.current?.focus();
      }
    },
    [convId, stream, router, toast, convs],
  );

  // ?q= from the command palette or landing
  useEffect(() => {
    if (urlQ && !sentQ.current && !urlConv) {
      sentQ.current = true;
      router.replace("/chat", { scroll: false });
      void send(urlQ);
    }
  }, [urlQ, urlConv, send, router]);

  const run = async (m: Msg) => {
    setRunningId(m.id);
    try {
      const d = await api<{ offer: { id: number; meta: Msg["meta"] }; result: Msg }>("/api/automations/run", { method: "POST", json: { messageId: m.id } });
      setMessages((list) => [...list.map((x) => (x.id === d.offer.id ? { ...x, meta: d.offer.meta } : x)), { ...d.result, fresh: true }]);
      setSelected(null);
      const total = d.result.meta.run?.steps.reduce((a, s) => a + s.ms, 0) ?? 0;
      setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }), total + 250);
      convs.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setRunningId(null);
    }
  };

  const feedback = async (m: Msg, v: number) => {
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: v === 0 ? null : v } : x)));
    try {
      await api(`/api/messages/${m.id}/feedback`, { method: "POST", json: { value: v } });
      if (v === -1) toast("Thanks. Managers review unhelpful answers to improve the manuals.", "info");
    } catch {
      toast("Couldn't save feedback.", "bad");
    }
  };

  const openCite = (m: Msg, n: number) => {
    const s = m.meta?.sources?.find((x) => x.n === n);
    if (s) setCite({ docId: s.docId, heading: s.heading, n });
  };

  const newChat = () => {
    skipLoad.current = null;
    router.push("/chat");
    setShowHistory(false);
    setTimeout(() => ta.current?.focus(), 50);
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/conversations/${id}`, { method: "DELETE" });
      convs.reload();
      if (id === convId) newChat();
    } catch (e) {
      toast((e as Error).message, "info");
    }
  };

  const toggleMic = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return toast("Voice input isn't supported in this browser.", "info");
    if (listening) {
      recog.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.onresult = (e) => setInput(Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    recog.current = r;
    setListening(true);
    r.start();
  };

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  }, [input]);

  const quick = !stream && lastAssistant && messages[messages.length - 1]?.id === lastAssistant.id ? lastAssistant.meta?.quickReplies ?? [] : [];
  const empty = !messages.length && !loadingConv && !stream;
  const activeTitle = convs.data?.conversations.find((c) => c.id === convId)?.title;

  const history = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="font-display text-[19px]">Conversations</h2>
        <button onClick={newChat} className="grid size-8 place-items-center rounded-lg bg-brand text-on-brand transition hover:bg-brand-2" aria-label="New conversation" title="New conversation">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
        {convs.loading && !convs.data ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-sunk" />
            ))}
          </div>
        ) : !convs.data?.conversations.length ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted">Your past conversations will show up here.</p>
        ) : (
          convs.data.conversations.map((c) => (
            <div key={c.id} className="group relative">
              <button
                onClick={() => {
                  skipLoad.current = null;
                  router.push(`/chat?c=${c.id}`);
                  setShowHistory(false);
                }}
                className={cx("flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition", c.id === convId ? "bg-surface shadow-sm ring-1 ring-line" : "hover:bg-surface/70")}
              >
                <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[c.status] ?? "bg-faint")} title={c.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{c.title}</span>
                  <span className="block text-[12px] text-faint">
                    {timeAgo(c.updated_at)} · {c.status}
                  </span>
                </span>
              </button>
              {c.status !== "escalated" && (
                <button onClick={() => remove(c.id)} className="absolute right-2 top-2.5 grid size-7 place-items-center rounded-lg text-faint opacity-0 transition hover:bg-bad-bg hover:text-bad group-hover:opacity-100" aria-label="Delete conversation">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-[272px] shrink-0 border-r border-line bg-sunk/60 md:block">{history}</aside>

      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-deep/40" onClick={() => setShowHistory(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="absolute inset-y-0 left-0 w-[290px] bg-bg">
              {history}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-5">
          <button onClick={() => setShowHistory(true)} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-sunk md:hidden" aria-label="Conversations">
            <History size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-medium text-ink">{activeTitle ?? (convId ? "Conversation" : "New conversation")}</p>
          </div>
          <span className="hidden sm:block">
            <Badge tone={engine === "openai" ? "brand" : "neutral"}>{engine === "openai" ? "GPT-4o-mini + manuals" : "Manual retrieval engine"}</Badge>
          </span>
          <button onClick={() => setShowInspector((s) => !s)} className={cx("grid size-9 place-items-center rounded-lg hover:bg-sunk xl:hidden", showInspector ? "text-brand" : "text-ink-2")} aria-label="Under the hood">
            <PanelRight size={18} />
          </button>
          <button onClick={newChat} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-sunk md:hidden" aria-label="New conversation">
            <Plus size={18} />
          </button>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto scroll-thin">
          {empty ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-8">
              <div className="h-[230px] w-full max-w-[340px] sm:h-[270px]">
                <Mascot mood={input ? "thinking" : "idle"} />
              </div>
              <h1 className="mt-2 text-center font-display text-[34px] leading-none sm:text-[42px]">Hi {user.name.split(" ")[0]}, what&apos;s not working?</h1>
              <p className="mt-3 max-w-md text-center text-[15px] text-muted">I answer from Meridian&apos;s IT manuals, can fix routine problems for you, and bring in a person when I can&apos;t.</p>
              <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-2">
                {STARTERS.map((s, i) => (
                  <motion.button
                    key={s.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => send(s.title)}
                    className="rounded-2xl border border-line bg-surface p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                  >
                    <p className="text-[14.5px] font-medium text-ink">{s.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">{s.sub}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-3 py-6 sm:px-6">
              {loadingConv && <div className="mx-auto h-5 w-40 animate-pulse rounded bg-sunk" />}
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} m={m} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    m={m}
                    selected={inspected?.id === m.id}
                    onSelect={() => setSelected(m.id)}
                    onRun={run}
                    onDecline={() => send("Show me the manual steps")}
                    onFeedback={feedback}
                    onCite={openCite}
                    running={runningId === m.id}
                  />
                ),
              )}
              {stream && <Typing status={stream.status} text={stream.text} />}
              {quick.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-2 pl-[42px]">
                  {quick.map((q) => (
                    <button key={q} onClick={() => send(q)} className="rounded-full border border-brand/30 bg-surface px-3.5 py-1.5 text-[13.5px] font-medium text-brand transition hover:bg-brand hover:text-on-brand">
                      {q}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-line-2 bg-surface p-2 shadow-md transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
          >
            <button type="button" onClick={toggleMic} className={cx("grid size-10 shrink-0 place-items-center rounded-2xl transition", listening ? "bg-bad text-white" : "text-muted hover:bg-sunk hover:text-ink")} aria-label={listening ? "Stop voice input" : "Voice input"}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <textarea
              ref={ta}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={listening ? "Listening…" : "Describe the problem, e.g. “VPN keeps disconnecting”"}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-snug text-ink outline-none placeholder:text-faint"
              aria-label="Message"
            />
            <button type="submit" disabled={!input.trim() || !!stream} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand transition hover:bg-brand-2 disabled:bg-line-2 disabled:text-faint" aria-label="Send">
              <ArrowUp size={19} strokeWidth={2.4} />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11.5px] text-faint">Never type passwords here. Private details are hidden automatically. Enter to send, Shift + Enter for a new line.</p>
        </div>
      </section>

      <aside className="hidden w-[320px] shrink-0 border-l border-line bg-surface/50 xl:block">
        <Inspector msg={inspected} mood={mood} engine={engine} onCite={(n) => inspected && openCite(inspected, n)} />
      </aside>
      <AnimatePresence>
        {showInspector && (
          <div className="fixed inset-0 z-40 xl:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-deep/40" onClick={() => setShowInspector(false)} />
            <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="absolute inset-y-0 right-0 w-[330px] max-w-[90vw] bg-bg">
              <button onClick={() => setShowInspector(false)} className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg bg-surface/80 text-ink-2" aria-label="Close panel">
                <X size={16} />
              </button>
              <Inspector msg={inspected} mood={mood} engine={engine} onCite={(n) => inspected && openCite(inspected, n)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SourceModal source={cite} onClose={() => setCite(null)} />
    </div>
  );
}
