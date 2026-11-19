import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { recordRun, isEnabled } from "@/lib/server/automations";
import { runWorkflow } from "@/lib/server/workflows";
import type { MessageMeta, StoredMessage } from "@/lib/server/engine";

/** Employee confirmed an automation offered in chat. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { messageId } = (await req.json().catch(() => ({}))) as { messageId?: number };
  const msg = await one<{ id: number; conversation_id: string; meta: MessageMeta }>(
    `select m.id, m.conversation_id, m.meta from messages m join conversations c on c.id = m.conversation_id
     where m.id = $1 and c.user_id = $2 and m.role = 'assistant'`,
    [Number(messageId), user.id],
  );
  if (!msg?.meta.action) throw new HttpError(404, "That action is no longer available.");
  if (msg.meta.action.state !== "proposed") throw new HttpError(409, "This action already ran.");
  const workflow = msg.meta.action.workflow;
  if (!(await isEnabled(workflow))) throw new HttpError(403, "IT has paused this automation. I can open a ticket instead.");

  const lastUser = await one<{ content: string }>(
    "select content from messages where conversation_id = $1 and role = 'user' and id < $2 order by id desc limit 1",
    [msg.conversation_id, msg.id],
  );
  const plan = await runWorkflow(workflow, user, { context: lastUser?.content ?? "", conversationId: msg.conversation_id, req });
  const runId = await recordRun({ workflowId: workflow, userId: user.id, conversationId: msg.conversation_id, ...plan });

  const meta: MessageMeta = { ...msg.meta, action: { ...msg.meta.action, state: "done", runId } };
  await q("update messages set meta = $1::jsonb where id = $2", [JSON.stringify(meta), msg.id]);

  const resultMeta: MessageMeta = {
    kind: "automation_result",
    intent: msg.meta.intent,
    intentLabel: msg.meta.intentLabel,
    run: { id: runId, ...plan },
    quickReplies: plan.status === "success" ? ["That fixed it", "Still not working"] : plan.status === "failed" ? ["Open a ticket", "I have another question"] : ["Thanks", "I have another question"],
  };
  const latency = plan.steps.reduce((s, x) => s + x.ms, 0);
  const [result] = await q<StoredMessage>(
    `insert into messages (conversation_id, role, content, meta, latency_ms) values ($1,'assistant',$2,$3::jsonb,$4)
     returning id, role, content, meta, latency_ms, feedback, created_at`,
    [msg.conversation_id, plan.summary, JSON.stringify(resultMeta), latency],
  );
  await q("update conversations set status = case when $2 = 'success' and status <> 'escalated' then 'resolved' else status end, updated_at = now() where id = $1", [
    msg.conversation_id,
    plan.status,
  ]);
  return NextResponse.json({ offer: { id: msg.id, meta }, result });
});
