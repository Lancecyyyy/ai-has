"use client";
import { Fragment } from "react";

/**
 * Small, safe markdown renderer for assistant replies and manuals.
 * Supports paragraphs, numbered / bulleted lists, ## headings, **bold**, *italic*, `code`
 * and [n] citation markers. Never injects HTML.
 */
function inline(text: string, onCite?: (n: number) => void, key = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\d\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const n = Number(t.slice(1, -1));
      out.push(
        <button
          key={k}
          type="button"
          onClick={() => onCite?.(n)}
          className="mx-0.5 inline-grid h-[18px] min-w-[18px] -translate-y-px place-items-center rounded-md bg-brand/10 px-1 align-middle font-mono text-[10.5px] font-medium text-brand transition hover:bg-brand hover:text-on-brand"
          aria-label={`Source ${n}`}
        >
          {n}
        </button>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onCite, className }: { text: string; onCite?: (n: number) => void; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { type: "ol" | "ul"; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(para.join(" "), onCite, k)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => <li key={i}>{inline(it, onCite, `${k}-${i}`)}</li>);
      blocks.push(list.type === "ol" ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const h = line.match(/^#{1,3}\s+(.*)/);
    if (h) {
      flushPara();
      flushList();
      blocks.push(<h3 key={`h${blocks.length}`}>{h[1]}</h3>);
    } else if (ol || ul) {
      flushPara();
      const type = ol ? "ol" : "ul";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ol ?? ul)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className={`prose-chat ${className ?? ""}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
