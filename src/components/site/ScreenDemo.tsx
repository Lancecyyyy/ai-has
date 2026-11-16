"use client";
import { useEffect, useState } from "react";

/** Scripted loop shown on the 3D monitor: answer, fix, escalate. Pure DOM so it stays crisp. */
type Line = { who: "you" | "has" | "sys"; text: string; tag?: string };
const SCRIPTS: { steps: Line[] }[] = [
  {
    steps: [
      { who: "you", text: "VPN says certificate expired" },
      { who: "has", text: "I can re-issue your VPN profile now.", tag: "ROUTINE" },
      { who: "sys", text: "revoke old cert ........ ok" },
      { who: "sys", text: "push profile via MDM .... ok" },
      { who: "has", text: "Done. Reopen GlobalConnect." },
    ],
  },
  {
    steps: [
      { who: "you", text: "Outlook keeps asking for my password" },
      { who: "sys", text: "reading EMAIL.SOP ....... 0.81" },
      { who: "has", text: "Sign out of Office, then sign back in [1]", tag: "ANSWER" },
      { who: "you", text: "that fixed it" },
    ],
  },
  {
    steps: [
      { who: "you", text: "I clicked a link in a weird email" },
      { who: "has", text: "Disconnect Wi-Fi. Don't delete the email.", tag: "P1" },
      { who: "sys", text: "ticket HAS-1187 -> Security" },
    ],
  },
];

export function ScreenDemo() {
  const [s, setS] = useState(0);
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const script = SCRIPTS[s].steps;
    if (n < script.length) {
      const next = script[n];
      const pre = next.who === "has" ? 900 : next.who === "sys" ? 450 : 700;
      setTyping(next.who === "has");
      const t = setTimeout(() => {
        setTyping(false);
        setN(n + 1);
      }, pre);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setN(0);
      setS((s + 1) % SCRIPTS.length);
    }, 2600);
    return () => clearTimeout(t);
  }, [s, n]);

  const lines = SCRIPTS[s].steps.slice(0, n);
  return (
    <div
      className="scanlines relative flex h-full w-full flex-col overflow-hidden rounded-[14px] px-3.5 py-3 text-[11.5px] leading-[1.35]"
      style={{ background: "radial-gradient(120% 90% at 50% 40%, #241ba8 0%, #150f6e 70%)", color: "#f7dd7d", fontFamily: "var(--font-plex-mono), monospace" }}
    >
      <div className="mb-2 flex items-center justify-between text-[9.5px] opacity-70">
        <span>AI-HAS v1 · MERIDIAN IT</span>
        <span>{String(s + 1).padStart(2, "0")}/03</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5">
        {lines.map((l, i) => (
          <div key={`${s}-${i}`} className={l.who === "you" ? "self-end" : ""} style={{ animation: "fadein .25s ease-out" }}>
            {l.who === "you" ? (
              <span className="inline-block max-w-[210px] rounded-[8px] rounded-br-[3px] bg-[#f7dd7d] px-2 py-1 text-[#150f6e]">{l.text}</span>
            ) : l.who === "sys" ? (
              <span className="opacity-60">&gt; {l.text}</span>
            ) : (
              <span className="inline-flex max-w-[250px] items-start gap-1.5">
                <span className="text-[#fffdfb]">{l.text}</span>
                {l.tag && <span className="mt-px shrink-0 rounded-[4px] border border-[#f7dd7d]/50 px-1 text-[8.5px]">{l.tag}</span>}
              </span>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-1 py-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-full bg-[#f7dd7d]" style={{ animation: `dot 1s ${i * 0.15}s infinite` }} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 border-t border-[#f7dd7d]/20 pt-1.5 text-[10px] opacity-80">
        <span>&gt;</span>
        <span className="caret">_</span>
      </div>
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
