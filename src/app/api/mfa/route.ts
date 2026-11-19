import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/server/totp";
import { sendAccountMail } from "@/lib/server/mail";
import { MFA_ENROLL_HOURS } from "@/lib/server/workflows";

type Row = { mfa_secret: string | null; mfa_pending_secret: string | null; mfa_pending_expires: string | null };

async function load(userId: number) {
  return one<Row>("select mfa_secret, mfa_pending_secret, mfa_pending_expires from users where id = $1", [userId]);
}

async function state(userId: number, email: string) {
  const r = await load(userId);
  const pendingOk = !!r?.mfa_pending_secret && !!r.mfa_pending_expires && new Date(r.mfa_pending_expires) > new Date();
  return {
    enabled: !!r?.mfa_secret,
    pending: pendingOk
      ? {
          secret: r!.mfa_pending_secret!,
          expires: r!.mfa_pending_expires!,
          qr: await QRCode.toDataURL(otpauthUrl(r!.mfa_pending_secret!, email), { margin: 1, width: 240 }),
        }
      : null,
  };
}

export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json(await state(user.id, user.email));
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("verify"), code: z.string().max(12) }),
  z.object({ action: z.literal("disable"), code: z.string().max(12) }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Bad request");
  const b = parsed.data;
  const r = await load(user.id);

  if (b.action === "start") {
    if (r?.mfa_secret) throw new HttpError(409, "An authenticator is already set up. Ask the assistant to reset MFA if you changed phones.");
    const pendingOk = !!r?.mfa_pending_secret && !!r.mfa_pending_expires && new Date(r.mfa_pending_expires) > new Date();
    if (!pendingOk) {
      const expires = new Date(Date.now() + MFA_ENROLL_HOURS * 3600_000);
      await q("update users set mfa_pending_secret = $2, mfa_pending_expires = $3 where id = $1", [user.id, generateSecret(), expires.toISOString()]);
    }
    return NextResponse.json(await state(user.id, user.email));
  }

  if (b.action === "verify") {
    if (!r?.mfa_pending_secret || !r.mfa_pending_expires || new Date(r.mfa_pending_expires) <= new Date()) throw new HttpError(410, "This enrollment expired. Start again.");
    if (!verifyTotp(r.mfa_pending_secret, b.code)) throw new HttpError(400, "That code isn't right. Check the time on your phone and enter the current 6-digit code.");
    await q("update users set mfa_secret = mfa_pending_secret, mfa_pending_secret = null, mfa_pending_expires = null where id = $1", [user.id]);
    await q("insert into security_events (user_id, type, severity, detail) values ($1,'mfa_enrolled','low','New authenticator set up')", [user.id]);
    await sendAccountMail({
      accountEmail: user.email,
      kind: "mfa_enrolled",
      subject: "New authenticator added",
      title: "New authenticator added",
      paragraphs: ["A new authenticator app was added to your Meridian account. You'll be asked for its 6-digit code when you sign in with your password.", "If this wasn't you, contact IT right away."],
    });
    return NextResponse.json(await state(user.id, user.email));
  }

  if (!r?.mfa_secret || !verifyTotp(r.mfa_secret, b.code)) throw new HttpError(400, "That code isn't right.");
  await q("update users set mfa_secret = null where id = $1", [user.id]);
  await q("insert into security_events (user_id, type, severity, detail) values ($1,'mfa_removed','medium','Authenticator turned off by the employee')", [user.id]);
  return NextResponse.json(await state(user.id, user.email));
});
