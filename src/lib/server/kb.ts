import "server-only";
import { q, one } from "./db";
import { Bm25Index, chunkDocument, type Chunk, type Hit } from "../ai/rag";

type G = typeof globalThis & { __hasIndex?: { stamp: string; index: Bm25Index } };
const g = globalThis as G;

/** Cached BM25 index, rebuilt whenever the knowledge base changes (on any instance). */
export async function getIndex(): Promise<Bm25Index> {
  const stamp = await one<{ s: string }>(
    "select coalesce(count(*)::text,'0') || ':' || coalesce(max(updated_at)::text,'') as s from kb_documents",
  );
  const key = stamp?.s ?? "0";
  if (g.__hasIndex?.stamp === key) return g.__hasIndex.index;
  const rows = await q<{ id: number; document_id: number; heading: string; content: string; title: string; category: string }>(
    `select c.id, c.document_id, c.heading, c.content, d.title, d.category
     from kb_chunks c join kb_documents d on d.id = c.document_id order by c.document_id, c.ord`,
  );
  const chunks: Chunk[] = rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    docTitle: r.title,
    category: r.category,
    heading: r.heading,
    content: r.content,
  }));
  const index = new Bm25Index(chunks);
  g.__hasIndex = { stamp: key, index };
  return index;
}

export async function searchKb(query: string, k = 4): Promise<Hit[]> {
  const index = await getIndex();
  return index.search(query, k);
}

export async function addDocument(args: { title: string; category: string; content: string; source: string; userId: number | null }) {
  const [doc] = await q<{ id: number }>(
    "insert into kb_documents (title, category, source, content, created_by) values ($1,$2,$3,$4,$5) returning id",
    [args.title, args.category, args.source, args.content, args.userId],
  );
  await writeChunks(doc.id, args.title, args.content);
  return doc.id;
}

export async function writeChunks(docId: number, title: string, content: string) {
  await q("delete from kb_chunks where document_id = $1", [docId]);
  const chunks = chunkDocument(title, content);
  if (!chunks.length) return 0;
  const params: unknown[] = [];
  const values = chunks.map((c, i) => {
    params.push(docId, i, c.heading, c.content);
    return `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`;
  });
  await q(`insert into kb_chunks (document_id, ord, heading, content) values ${values.join(",")}`, params);
  return chunks.length;
}

export async function logGap(query: string) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (normalized.length < 6) return;
  await q(
    `insert into knowledge_gaps (query, normalized) values ($1,$2)
     on conflict (normalized) do update set hits = knowledge_gaps.hits + 1, last_seen = now(), status = 'open'`,
    [query.slice(0, 240), normalized],
  );
}

export async function bumpCitations(docIds: number[]) {
  if (!docIds.length) return;
  await q("update kb_documents set citations = citations + 1 where id = any($1::int[])", [docIds]);
}
