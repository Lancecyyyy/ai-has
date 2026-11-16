import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";

const Body = z.object({
  serviceId: z.string().min(1),
  title: z.string().trim().min(4).max(120),
  body: z.string().trim().min(4).max(1000),
  severity: z.enum(["degraded", "outage"]),
});

export const POST = handle(async (req: Request) => {
  await requireUser(["agent", "manager"]);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Fill in the service, a title and what's happening.");
  const p = parsed.data;
  const [row] = await q("insert into incidents (service_id, title, body, severity) values ($1,$2,$3,$4) returning id", [p.serviceId, p.title, p.body, p.severity]);
  await q("update services set status = $1 where id = $2", [p.severity, p.serviceId]);
  return NextResponse.json(row);
});
