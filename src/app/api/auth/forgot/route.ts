import { NextResponse } from "next/server";
import { z } from "zod";
import { one } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/ai/guardrails";
import { appUrl } from "@/lib/server/mail";
import { issueResetLink } from "@/lib/server/workflows";

const Body = z.object({ email: z.string().trim().email() });

/** "Forgot password" from the sign-in page. Same answer whether or not the account exists. */
export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Enter your work email.");
  const email = parsed.data.email.toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`forgot:${email}`, 3, 15 * 60_000) || !rateLimit(`forgot-ip:${ip}`, 10, 15 * 60_000)) throw new HttpError(429, "Too many requests. Wait a few minutes.");
  const user = await one<{ id: number; name: string; email: string }>("select id, name, email from users where email = $1", [email]);
  if (user) await issueResetLink(user, appUrl(req));
  return NextResponse.json({ ok: true });
});
