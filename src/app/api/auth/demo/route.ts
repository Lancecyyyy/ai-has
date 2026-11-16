import { NextResponse } from "next/server";
import { one } from "@/lib/server/db";
import { createSession, handle, HttpError } from "@/lib/server/auth";
import { DEMO_ACCOUNTS } from "@/lib/server/seed";

export const POST = handle(async (req: Request) => {
  if (process.env.DEMO_LOGIN === "off") throw new HttpError(403, "Demo sign-in is turned off.");
  const { role } = (await req.json().catch(() => ({}))) as { role?: keyof typeof DEMO_ACCOUNTS };
  const email = role ? DEMO_ACCOUNTS[role] : undefined;
  if (!email) throw new HttpError(400, "Unknown demo role.");
  const user = await one<{ id: number }>("select id from users where email = $1", [email]);
  if (!user) throw new HttpError(404, "Demo account missing.");
  await createSession(user.id);
  return NextResponse.json({ ok: true, role });
});
