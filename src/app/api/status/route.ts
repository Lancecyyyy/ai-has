import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";
import { hasOpenAI } from "@/lib/ai/openai";
import { getDb } from "@/lib/server/db";

export const GET = handle(async () => {
  await requireUser();
  const services = await q("select id, name, status from services order by sort");
  const incidents = await q(
    `select i.id, i.title, i.body, i.severity, i.status, i.created_at, i.resolved_at, s.name as service, i.service_id
     from incidents i join services s on s.id = i.service_id order by (i.status = 'active') desc, i.created_at desc limit 20`,
  );
  const db = await getDb();
  return NextResponse.json({
    services,
    incidents,
    system: { engine: hasOpenAI() ? "openai" : "local", model: hasOpenAI() ? process.env.OPENAI_MODEL || "gpt-4o-mini" : null, database: db.engine },
  });
});
