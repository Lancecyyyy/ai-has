import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, one } from "@/lib/server/db";
import { createSession, handle, HttpError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/ai/guardrails";

const Body = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().email("Enter a valid work email.").max(120),
  department: z.string().trim().min(2, "Pick your department.").max(60),
  password: z.string().min(10, "Use at least 10 characters for your password.").max(200),
});

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000)) throw new HttpError(429, "Too many sign-ups from this network.");
  const email = parsed.data.email.toLowerCase();
  if (await one("select 1 from users where email = $1", [email])) throw new HttpError(409, "An account with that email already exists.");
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const [u] = await q<{ id: number }>(
    "insert into users (name, email, password_hash, role, department) values ($1,$2,$3,'employee',$4) returning id",
    [parsed.data.name, email, hash, parsed.data.department],
  );
  await createSession(u.id);
  return NextResponse.json({ ok: true, role: "employee" });
});
