import { NextResponse } from "next/server";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { recordRun } from "@/lib/server/automations";
import { appUrl, sendAccountMail } from "@/lib/server/mail";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ decision: z.enum(["approve", "decline"]) });

/** A manager approves or declines a licensed software request. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const manager = await requireUser(["manager"]);
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Choose approve or decline.");
  const approve = parsed.data.decision === "approve";
  const t0 = Date.now();
  const [r] = await q<{ id: number; user_id: number; app: string; conversation_id: string | null }>(
    "update software_requests set status = $2, approver_id = $3, decided_at = now() where id = $1 and status = 'pending' returning id, user_id, app, conversation_id",
    [Number(id), approve ? "installed" : "declined", manager.id],
  );
  if (!r) throw new HttpError(409, "That request was already decided.");
  const emp = await one<{ name: string; email: string }>("select name, email from users where id = $1", [r.user_id]);
  const first = emp?.name.split(" ")[0] ?? "there";
  const mail = emp
    ? await sendAccountMail({
        accountEmail: emp.email,
        kind: "software_decision",
        subject: approve ? `${r.app} was approved` : `${r.app} request declined`,
        title: approve ? `${r.app} is ready` : `${r.app} request declined`,
        paragraphs: approve
          ? [`Hi ${first}, ${manager.name} approved your ${r.app} request, and a license was assigned to your account.`, "You'll find it under My IT in AI-HAS."]
          : [`Hi ${first}, ${manager.name} declined your ${r.app} request.`, "If you still need it, talk to your manager or ask the IT assistant to open a ticket."],
        button: { label: "Open My IT", url: `${appUrl(req)}/my-it` },
      })
    : null;
  const status = approve ? "success" : "declined";
  const steps = [
    { label: approve ? "Manager approved" : "Manager declined", detail: `Decided by ${manager.name}`, ms: 1, ok: true },
    ...(approve ? [{ label: "Assign license", detail: `${r.app} assigned to ${emp?.name ?? "the employee"}`, ms: 1, ok: true }] : []),
    { label: "Email the employee", detail: mail?.detail ?? "Employee not found", ms: Date.now() - t0, ok: !!mail?.ok },
  ];
  const summary = approve
    ? `Good news: ${manager.name} approved ${r.app}, and it's now assigned to your account. You'll find it under [My IT](/my-it).`
    : `${manager.name} declined your ${r.app} request. If you still need it, I can open a ticket for IT.`;
  const runId = await recordRun({ workflowId: "software_access", userId: r.user_id, conversationId: r.conversation_id, status, summary, steps });
  if (r.conversation_id) {
    const meta = {
      kind: "automation_result",
      intent: "software_access",
      intentLabel: "Software access",
      run: { id: runId, status, summary, steps },
      quickReplies: approve ? ["Thanks", "I have another question"] : ["Open a ticket", "I have another question"],
    };
    await q("insert into messages (conversation_id, role, content, meta, latency_ms) values ($1,'assistant',$2,$3::jsonb,$4)", [r.conversation_id, summary, JSON.stringify(meta), Date.now() - t0]);
    await q("update conversations set updated_at = now(), status = case when $2 then 'resolved' else status end where id = $1 and status <> 'escalated'", [r.conversation_id, approve]);
  }
  return NextResponse.json({ ok: true });
});
