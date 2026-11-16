import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { addDocument } from "@/lib/server/kb";

export const maxDuration = 30;

export const GET = handle(async () => {
  await requireUser();
  const docs = await q(
    `select d.id, d.title, d.category, d.source, d.citations, d.updated_at, length(d.content)::int as chars,
       (select count(*)::int from kb_chunks c where c.document_id = d.id) as chunks, u.name as author
     from kb_documents d left join users u on u.id = d.created_by order by d.category, d.title`,
  );
  return NextResponse.json({ docs });
});

async function pdfToText(buf: ArrayBuffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map((p, i) => `## Page ${i + 1}\n${p.trim()}`).join("\n\n");
}

/** Upload a manual: multipart (file: .md/.txt/.pdf) or JSON { title, category, content }. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["agent", "manager"]);
  let title = "";
  let category = "General";
  let content = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    title = String(form.get("title") ?? "");
    category = String(form.get("category") ?? "General");
    if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload.");
    if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "Files must be under 4 MB.");
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) content = await pdfToText(await file.arrayBuffer());
    else if (/\.(md|markdown|txt)$/.test(name)) content = await file.text();
    else throw new HttpError(415, "Upload a .pdf, .md or .txt file.");
    if (!title) title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  } else {
    const body = (await req.json().catch(() => ({}))) as { title?: string; category?: string; content?: string };
    title = body.title ?? "";
    category = body.category ?? "General";
    content = body.content ?? "";
  }
  title = title.trim().slice(0, 120);
  content = content.replace(/\u0000/g, "").trim();
  if (title.length < 3) throw new HttpError(400, "Give the manual a title.");
  if (content.length < 40) throw new HttpError(400, "The manual looks empty. Add at least a few sentences.");
  const id = await addDocument({ title, category: category.trim().slice(0, 40) || "General", content, source: "upload", userId: user.id });
  return NextResponse.json({ ok: true, id });
});
