import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/ai/guardrails";
import { sendAccountMail } from "@/lib/server/mail";
import { hashToken } from "@/lib/server/workflows";

const Body = z.object({ token: z.string().min(20).max(200), password: z.string().min(10, "Use at least 10 characters.").max(200) });
const EXPIRED = "This reset link has expired or was already used. Ask the IT assistant for a new one.";

/** Check a reset link before showing the form. */
export const GET = handle(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const row = await one<{ name: string; email: string }>(
    "select u.name, u.email from password_resets r join users u on u.id = r.user_id where r.token_hash = $1 and r.used_at is null and r.expires_at > now()",
    [hashToken(token)],
  );
  if (!row) throw new HttpError(410, EXPIRED);
  return NextResponse.json({ name: row.name.split(" ")[0], email: row.email });
});

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Wait a few minutes.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const used = await q<{ user_id: number }>(
    "update password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id",
    [hashToken(parsed.data.token)],
  );
  if (!used.length) throw new HttpError(410, EXPIRED);
  const user = await one<{ id: number; name: string; email: string }>("select id, name, email from users where id = $1", [used[0].user_id]);
  if (!user) throw new HttpError(410, EXPIRED);
  const hash = await bcrypt.hash(parsed.data.password, 10);
  await q("update users set password_hash = $2, failed_logins = 0, locked_until = null where id = $1", [user.id, hash]);
  await q("update password_resets set used_at = now() where user_id = $1 and used_at is null", [user.id]);
  await q("insert into security_events (user_id, type, severity, detail) values ($1,'password_changed','low','Password changed with an emailed reset link')", [user.id]);
  await sendAccountMail({
    accountEmail: user.email,
    kind: "password_changed",
    subject: "Your Meridian password was changed",
    title: "Your password was changed",
    paragraphs: [`Hi ${user.name.split(" ")[0]}, your password was just changed using a reset link.`, "If this wasn't you, contact IT right away."],
  });
  return NextResponse.json({ ok: true, email: user.email });
});
