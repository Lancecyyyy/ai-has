import "server-only";
import { SCHEMA } from "./schema";
import { seedDatabase } from "./seed";

/**
 * One tiny interface over two engines:
 *  - DATABASE_URL set  -> real Postgres (Neon, Supabase, Vercel Postgres) via `postgres`
 *  - DATABASE_URL empty -> embedded Postgres (PGlite, WASM) in memory, seeded on boot
 * Every query in the app is plain parameterised SQL, so both engines run the same code.
 */
export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  engine: "postgres" | "pglite";
}

type G = typeof globalThis & { __hasDb?: Promise<Db> };
const g = globalThis as G;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    });
    return {
      engine: "postgres",
      async query<T>(text: string, params: unknown[] = []) {
        const rows = await sql.unsafe(text, params as never[]);
        return rows as unknown as T[];
      },
      async exec(text: string) {
        await sql.unsafe(text);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  return {
    engine: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query(text, params as never[]);
      return res.rows as T[];
    },
    async exec(text: string) {
      await pg.exec(text);
    },
  };
}

async function init(): Promise<Db> {
  const db = await connect();
  await db.exec(SCHEMA);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from users");
  if (n === 0) await seedDatabase(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__hasDb) {
    g.__hasDb = init().catch((err) => {
      g.__hasDb = undefined;
      throw err;
    });
  }
  return g.__hasDb;
}

export async function q<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(sql, params);
}

export async function one<T = Row>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}
