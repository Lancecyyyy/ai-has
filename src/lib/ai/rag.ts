/**
 * Retrieval (the "R" in RAG), dependency-free so it runs anywhere.
 * Manuals are split at "## " headings; each chunk is scored with BM25 over
 * stemmed tokens plus a small IT synonym map, with a boost for heading matches.
 */

export interface Chunk {
  id: number;
  documentId: number;
  docTitle: string;
  category: string;
  heading: string;
  content: string;
}

export interface Hit extends Chunk {
  score: number;
  /** share of the query's meaningful terms found in this chunk, 0..1 */
  coverage: number;
}

const STOP = new Set(
  "a an and are as at be but by can could do does for from get got has have how i if im in into is it its just me my need no not of on or our please so some that the their then there this to too up us was we what when where which who why will with would you your hi hello hey help want trying try keep keeps still cant can't dont don't wont won't".split(
    " ",
  ),
);

const SYNONYMS: Record<string, string[]> = {
  pw: ["password"],
  pwd: ["password"],
  passwd: ["password"],
  forgot: ["forgotten", "reset"],
  login: ["sign"],
  logon: ["sign"],
  signin: ["sign"],
  locked: ["lockout", "lock"],
  lockout: ["locked"],
  wifi: ["wi-fi", "wireless"],
  internet: ["wi-fi", "network"],
  vpn: ["globalconnect"],
  "2fa": ["mfa"],
  authenticator: ["mfa"],
  otp: ["mfa", "code"],
  mail: ["email", "outlook"],
  inbox: ["mailbox", "email"],
  printer: ["print"],
  printing: ["print"],
  slow: ["slow", "performance"],
  laggy: ["slow"],
  lag: ["slow"],
  computer: ["laptop", "pc"],
  pc: ["laptop"],
  app: ["software"],
  install: ["software", "provision"],
  license: ["software", "approval"],
  phishing: ["suspicious", "security"],
  hacked: ["incident", "security"],
  virus: ["malware", "security"],
  drive: ["share", "folder"],
  rdp: ["remote", "desktop"],
  newhire: ["onboarding"],
};

export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_#>\[\]()]/g, " ")
    .split(/[^a-z0-9\-']+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export function expandQuery(text: string): string[] {
  const raw = text.toLowerCase().split(/[^a-z0-9\-']+/).filter(Boolean);
  const out = new Set(tokenize(text));
  for (const r of raw) for (const s of SYNONYMS[r] ?? []) tokenize(s).forEach((t) => out.add(t));
  return [...out];
}

/** Split a markdown manual into retrievable sections. */
export function chunkDocument(title: string, content: string): { heading: string; content: string }[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const chunks: { heading: string; content: string }[] = [];
  let heading = "Overview";
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) chunks.push({ heading, content: body });
    buf = [];
  };
  for (const line of lines) {
    if (/^#\s+/.test(line)) continue; // document title
    const h = line.match(/^#{2,3}\s+(.*)/);
    if (h) {
      flush();
      heading = h[1].trim();
    } else buf.push(line);
  }
  flush();
  // Plain-text uploads without headings: split into ~900 char windows on paragraph breaks.
  if (chunks.length === 1 && chunks[0].content.length > 1400) {
    const paras = chunks[0].content.split(/\n\s*\n/);
    const windows: { heading: string; content: string }[] = [];
    let cur = "";
    for (const p of paras) {
      if ((cur + "\n\n" + p).length > 900 && cur) {
        windows.push({ heading: `${title} (part ${windows.length + 1})`, content: cur.trim() });
        cur = p;
      } else cur = cur ? cur + "\n\n" + p : p;
    }
    if (cur) windows.push({ heading: `${title} (part ${windows.length + 1})`, content: cur.trim() });
    return windows;
  }
  return chunks;
}

export class Bm25Index {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number; head: Set<string> }[] = [];
  private df = new Map<string, number>();
  private avg = 1;
  private k1 = 1.2;
  private b = 0.75;
  constructor(chunks: Chunk[]) {
    for (const chunk of chunks) {
      const toks = tokenize(`${chunk.docTitle} ${chunk.heading} ${chunk.content}`);
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ chunk, tf, len: toks.length, head: new Set(tokenize(`${chunk.docTitle} ${chunk.heading}`)) });
    }
    this.avg = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }

  get size() {
    return this.docs.length;
  }

  search(query: string, k = 4): Hit[] {
    const terms = expandQuery(query);
    const core = new Set(tokenize(query));
    if (!terms.length) return [];
    const N = this.docs.length;
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        if (core.has(t)) matched++;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const weight = core.has(t) ? 1 : 0.6;
        score += weight * idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avg)));
        if (d.head.has(t)) score += weight * idf * 0.8;
      }
      if (score > 0) hits.push({ ...d.chunk, score, coverage: core.size ? matched / core.size : 0 });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

/** 0..1 confidence that the top hit actually answers the question. */
export function confidence(hits: Hit[]): number {
  if (!hits.length) return 0;
  const top = hits[0];
  const s = 1 - Math.exp(-top.score / 6);
  const margin = hits[1] ? Math.min(1, (top.score - hits[1].score) / Math.max(1, top.score)) : 1;
  return Math.max(0, Math.min(1, 0.55 * s + 0.35 * top.coverage + 0.1 * margin));
}
