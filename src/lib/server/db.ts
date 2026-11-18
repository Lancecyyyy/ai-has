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

type Conn = { db: Db; setup: Db; release: () => Promise<void> };

async function connect(): Promise<Conn> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // postgres.js JSON.stringify()s every json/jsonb parameter. The app already passes
    // JSON text (as PGlite expects), so pass strings through untouched or they are
    // stored double-encoded as a jsonb string instead of an object.
    const types = {
      json: {
        to: 114,
        from: [114, 3802],
        serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
        parse: (x: string) => JSON.parse(x),
      },
    };
    const sql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX) || 5,
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
      types,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    });
    const wrap = (client: typeof sql): Db => ({
      engine: "postgres",
      async query<T>(text: string, params: unknown[] = []) {
        const rows = await client.unsafe(text, params as never[]);
        return rows as unknown as T[];
      },
      async exec(text: string) {
        await client.unsafe(text);
      },
    });
    // Schema + seed run on one dedicated session so the advisory lock below holds.
    // Poolers (Neon/PgBouncer in transaction mode) can't hold session locks, so use the
    // direct URL for setup when the provider gives one.
    const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL_NON_POOLING;
    if (direct) {
      const setupSql = postgres(direct, { max: 1, prepare: false, onnotice: () => {}, types, ssl: /localhost|127\.0\.0\.1/.test(direct) ? false : "require" });
      return { db: wrap(sql), setup: wrap(setupSql), release: async () => setupSql.end({ timeout: 5 }) };
    }
    const reserved = await sql.reserve();
    return { db: wrap(sql), setup: wrap(reserved as unknown as typeof sql), release: async () => reserved.release() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const db: Db = {
    engine: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query(text, params as never[]);
      return res.rows as T[];
    },
    async exec(text: string) {
      await pg.exec(text);
    },
  };
  return { db, setup: db, release: async () => {} };
}

async function init(): Promise<Db> {
  const { db, setup, release } = await connect();
  try {
    // Several serverless instances can cold-start together; only one creates and seeds.
    await setup.query("select pg_advisory_lock(727001)");
    try {
      await setup.exec(SCHEMA);
      const [{ n }] = await setup.query<{ n: number }>("select count(*)::int as n from users");
      if (n === 0) await seedDatabase(setup);
      // Repair rows written before the json serializer fix (stored as a jsonb string).
      await setup.exec(`
        update messages set meta = (meta #>> '{}')::jsonb where jsonb_typeof(meta) = 'string';
        update automation_runs set steps = (steps #>> '{}')::jsonb where jsonb_typeof(steps) = 'string';
      `);
    } finally {
      await setup.query("select pg_advisory_unlock(727001)");
    }
  } finally {
    await release();
  }
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
