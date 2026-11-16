import { q } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const GET = handle(async (req: Request) => {
  await requireUser(["manager"]);
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const rows = await q<Record<string, unknown>>(
    `select c.id, to_char(c.created_at, 'YYYY-MM-DD HH24:MI') as created, u.department, coalesce(c.intent,'general') as intent, c.status,
       (select m.latency_ms from messages m where m.conversation_id = c.id and m.role = 'assistant' order by m.id limit 1) as first_response_ms,
       (select max(m.feedback) from messages m where m.conversation_id = c.id) as feedback,
       (select t.key from tickets t where t.conversation_id = c.id limit 1) as ticket
     from conversations c join users u on u.id = c.user_id
     where c.created_at >= now() - ($1::int || ' days')::interval order by c.created_at desc`,
    [String(days)],
  );
  const header = ["conversation_id", "created", "department", "intent", "status", "first_response_ms", "feedback", "ticket"];
  const csv = [header.join(","), ...rows.map((r) => [r.id, r.created, r.department, r.intent, r.status, r.first_response_ms, r.feedback, r.ticket].map(cell).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ai-has-report-${days}d.csv"`,
    },
  });
});
