import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser(["agent", "manager"]);
  const { id } = await params;
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof enabled !== "boolean") throw new HttpError(400, "enabled must be true or false");
  const rows = await q("update automations set enabled = $1 where id = $2 returning id, enabled", [enabled, id]);
  if (!rows.length) throw new HttpError(404, "Automation not found.");
  return NextResponse.json(rows[0]);
});
