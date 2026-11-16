import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

export const GET = handle(async () => {
  await requireUser(["agent", "manager"]);
  const gaps = await q("select id, query, hits, status, last_seen from knowledge_gaps where status = 'open' order by hits desc, last_seen desc limit 30");
  return NextResponse.json({ gaps });
});

export const PATCH = handle(async (req: Request) => {
  await requireUser(["agent", "manager"]);
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: number; status?: string };
  if (!id || !["open", "covered", "dismissed"].includes(String(status))) throw new HttpError(400, "Invalid update.");
  await q("update knowledge_gaps set status = $1 where id = $2", [status, id]);
  return NextResponse.json({ ok: true });
});
