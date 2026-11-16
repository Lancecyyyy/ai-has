import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { writeChunks } from "@/lib/server/kb";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const doc = await one("select d.*, u.name as author from kb_documents d left join users u on u.id = d.created_by where d.id = $1", [Number(id)]);
  if (!doc) throw new HttpError(404, "Manual not found.");
  const chunks = await q("select id, ord, heading, length(content)::int as chars from kb_chunks where document_id = $1 order by ord", [Number(id)]);
  return NextResponse.json({ doc, chunks });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requireUser(["agent", "manager"]);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; category?: string; content?: string };
  const doc = await one<{ id: number; title: string; content: string; category: string }>("select id, title, content, category from kb_documents where id = $1", [Number(id)]);
  if (!doc) throw new HttpError(404, "Manual not found.");
  const title = body.title?.trim() || doc.title;
  const content = body.content?.trim() || doc.content;
  const category = body.category?.trim() || doc.category;
  await q("update kb_documents set title = $1, content = $2, category = $3, updated_at = now() where id = $4", [title, content, category, doc.id]);
  const chunks = await writeChunks(doc.id, title, content);
  return NextResponse.json({ ok: true, chunks });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireUser(["manager", "agent"]);
  const { id } = await params;
  await q("delete from kb_documents where id = $1", [Number(id)]);
  return NextResponse.json({ ok: true });
});
