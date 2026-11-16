import { NextResponse } from "next/server";
import { requireUser, handle } from "@/lib/server/auth";
import { runGuardrails } from "@/lib/ai/guardrails";
import { classifyIntent } from "@/lib/ai/intents";

/** Guardrail sandbox: run any text through the shields without sending it to the assistant. */
export const POST = handle(async (req: Request) => {
  await requireUser(["agent", "manager"]);
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const input = String(text ?? "").slice(0, 2000);
  const g = runGuardrails(input);
  const verdict = g.injection ? "blocked" : g.abuse ? "blocked" : g.outOfScope ? "redirected" : g.redactions.length ? "redacted" : "allowed";
  return NextResponse.json({ ...g, intent: classifyIntent(g.text), verdict });
});
