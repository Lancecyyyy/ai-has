import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";
import { resetDemoRecords } from "@/lib/server/records";

/** Restores the demo employee's stuck print jobs and nearly full mailbox. */
export const POST = handle(async () => {
  await requireUser(["manager"]);
  await resetDemoRecords(await getDb());
  return NextResponse.json({ ok: true });
});
