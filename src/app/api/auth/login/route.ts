import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one } from "@/lib/server/db";
import { createSession, handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/ai/guardrails";

const Body = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Enter a valid email and password.");
  const email = parsed.data.email.toLowerCase().trim();
  if (!rateLimit(`login:${email}`, 8, 5 * 60_000)) throw new HttpError(429, "Too many attempts. Wait a few minutes.");
  const user = await one<{ id: number; password_hash: string | null; role: string }>("select id, password_hash, role from users where email = $1", [email]);
  const ok = user?.password_hash ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
  if (!user || !ok) throw new HttpError(401, "That email and password don't match.");
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
});
