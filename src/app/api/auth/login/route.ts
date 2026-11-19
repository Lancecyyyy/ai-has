import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { createSession, handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/ai/guardrails";
import { verifyTotp } from "@/lib/server/totp";
import { clock } from "@/lib/server/workflows";

const Body = z.object({ email: z.string().email(), password: z.string().min(1).max(200), code: z.string().max(12).optional() });

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Enter a valid email and password.");
  const email = parsed.data.email.toLowerCase().trim();
  if (!rateLimit(`login:${email}`, 12, 5 * 60_000)) throw new HttpError(429, "Too many attempts. Wait a few minutes.");
  const user = await one<{ id: number; password_hash: string | null; role: string; failed_logins: number; locked_until: string | null; mfa_secret: string | null }>(
    "select id, password_hash, role, failed_logins, locked_until, mfa_secret from users where email = $1",
    [email],
  );
  if (!user) throw new HttpError(401, "That email and password don't match.");

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new HttpError(423, `This account is locked after too many wrong passwords. Try again after ${clock(new Date(user.locked_until))}, reset your password, or ask the IT assistant to unlock it.`);
  }

  const ok = user.password_hash ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
  if (!ok) {
    const failed = (user.failed_logins ?? 0) + 1;
    if (failed >= MAX_FAILED) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
      await q("update users set failed_logins = $2, locked_until = $3 where id = $1", [user.id, failed, until.toISOString()]);
      await q("insert into security_events (user_id, type, severity, detail) values ($1,'account_locked','medium',$2)", [user.id, `Locked after ${failed} failed sign-ins`]);
      throw new HttpError(423, `Too many wrong passwords, so the account is locked until ${clock(until)}. Reset your password, or ask the IT assistant to unlock it.`);
    }
    await q("update users set failed_logins = $2 where id = $1", [user.id, failed]);
    const left = MAX_FAILED - failed;
    throw new HttpError(401, `That email and password don't match. ${left} ${left === 1 ? "try" : "tries"} left before the account locks.`);
  }

  if (user.mfa_secret) {
    if (!parsed.data.code) return NextResponse.json({ mfa: true });
    if (!verifyTotp(user.mfa_secret, parsed.data.code)) throw new HttpError(401, "That code isn't right. Enter the 6-digit code your authenticator shows now.");
  }

  await q("update users set failed_logins = 0, locked_until = null where id = $1", [user.id]);
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
});
