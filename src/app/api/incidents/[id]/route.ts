import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

/** Resolve an incident; the service goes back to operational when nothing else is active on it. */
export const PATCH = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(["agent", "manager"]);
  const { id } = await params;
  const inc = await one<{ service_id: string }>("update incidents set status = 'resolved', resolved_at = now() where id = $1 and status = 'active' returning service_id", [Number(id)]);
  if (!inc) throw new HttpError(404, "Active incident not found.");
  await q(
    `update services set status = coalesce((select severity from incidents where service_id = $1 and status = 'active' order by created_at desc limit 1), 'operational') where id = $1`,
    [inc.service_id],
  );
  return NextResponse.json({ ok: true });
});
