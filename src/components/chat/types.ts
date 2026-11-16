export interface Source {
  n: number;
  docId: number;
  title: string;
  heading: string;
  score: number;
  excerpt: string;
}

export interface Meta {
  kind?: "answer" | "smalltalk" | "automation_offer" | "automation_result" | "ticket" | "blocked" | "gap" | "out_of_scope";
  intent?: string;
  intentLabel?: string;
  confidence?: number;
  engine?: "openai" | "local";
  sources?: Source[];
  quickReplies?: string[];
  redactions?: { type: string; count: number }[];
  blocked?: string;
  incident?: { title: string; service: string; since: string };
  action?: { workflow: string; label: string; state: "proposed" | "done" | "declined"; runId?: number };
  run?: { id: number; status: string; summary: string; steps: { label: string; detail: string; ms: number; ok: boolean }[] };
  ticket?: { key: string; priority: string; assignee: string; slaHours: number };
}

export interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
  meta: Meta;
  latency_ms: number | null;
  feedback: number | null;
  created_at: string;
  /** client-only: animate automation steps on first render */
  fresh?: boolean;
}

export interface ConvSummary {
  id: string;
  title: string;
  status: string;
  intent: string | null;
  updated_at: string;
  messages: number;
}
