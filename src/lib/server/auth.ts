import "server-only";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { one } from "./db";

export type Role = "employee" | "agent" | "manager";
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string;
}

const COOKIE = "has_session";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  if (process.env.AUTH_SECRET) return new TextEncoder().encode(process.env.AUTH_SECRET);
  // No AUTH_SECRET: derive a key from the (private) database URL so a deploy with only
  // DATABASE_URL is still safe. Rotating the DB password signs everyone out, which is fine.
  if (process.env.DATABASE_URL) return new TextEncoder().encode(createHash("sha256").update(`ai-has-session:${process.env.DATABASE_URL}`).digest("hex"));
  if (process.env.VERCEL_ENV === "production") console.warn("[ai-has] Set AUTH_SECRET or DATABASE_URL; using the development session key.");
  return new TextEncoder().encode("ai-has-dev-secret-change-me-please-0123456789");
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = Number(payload.uid);
    if (!uid) return null;
    return await one<SessionUser>("select id, name, email, role, department from users where id = $1", [uid]);
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Sign in required");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "You don't have access to this");
  return user;
}

/** Wrap a route handler: maps HttpError to JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 });
    }
  };
}

export const isStaff = (u: SessionUser) => u.role === "agent" || u.role === "manager";
