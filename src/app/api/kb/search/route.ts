import { NextResponse } from "next/server";
import { requireUser, handle } from "@/lib/server/auth";
import { searchKb } from "@/lib/server/kb";
import { confidence, expandQuery } from "@/lib/ai/rag";
import { classifyIntent } from "@/lib/ai/intents";

/** Retrieval playground: shows exactly what the AI would read for a question. */
export const GET = handle(async (req: Request) => {
  await requireUser(["agent", "manager"]);
  const query = new URL(req.url).searchParams.get("q")?.slice(0, 300) ?? "";
  const t0 = performance.now();
  const hits = await searchKb(query, 6);
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  return NextResponse.json({
    query,
    terms: expandQuery(query),
    intent: classifyIntent(query),
    confidence: Math.round(confidence(hits) * 100) / 100,
    ms,
    hits: hits.map((h) => ({ id: h.id, docId: h.documentId, title: h.docTitle, heading: h.heading, score: Math.round(h.score * 100) / 100, coverage: Math.round(h.coverage * 100) / 100, content: h.content })),
  });
});
