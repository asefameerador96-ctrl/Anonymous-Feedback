import { Pool, types } from "pg";
import schema from "./schema";

/**
 * Data layer for Azure Database for PostgreSQL (Flexible Server).
 *
 * This used to depend on `@vercel/postgres`, whose driver only speaks to
 * Vercel/Neon's serverless HTTP endpoint and cannot connect to a standard
 * Postgres server. We use node-postgres (`pg`) so the app works against any
 * real Postgres — Azure, a local instance, RDS, etc.
 *
 * Every query call lazily ensures the schema exists (see ensureSchema), so a
 * fresh database is bootstrapped on first request with no manual migration.
 */

// `COUNT(...)` returns bigint (OID 20), which pg hands back as a string by
// default. Parse it to a number so our aggregation code keeps working.
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error(
        "No database connection string found. Set DATABASE_URL to your " +
          "Azure Database for PostgreSQL connection string."
      );
    }

    // Azure Postgres requires TLS. Set PGSSL=disable only for a plain local
    // Postgres without SSL.
    const sslDisabled =
      process.env.PGSSL === "disable" || process.env.PGSSLMODE === "disable";

    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslDisabled ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

// --- schema bootstrap -------------------------------------------------------

let schemaReady: Promise<void> | null = null;

async function initSchema(): Promise<void> {
  const p = getPool();
  for (const stmt of schema.DDL) {
    await p.query(stmt);
  }
  const { rows } = await p.query("SELECT COUNT(*)::int AS c FROM managers");
  if (rows[0].c === 0) {
    for (const [name, department] of schema.SEED_MANAGERS) {
      await p.query(
        "INSERT INTO managers (name, department) VALUES ($1, $2)",
        [name, department]
      );
    }
  }
}

/** Run the schema bootstrap exactly once per server process. */
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((err) => {
      // Allow a later request to retry if bootstrap failed (e.g. DB not ready).
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// --- query helpers ----------------------------------------------------------

export type QueryResult<T = any> = { rows: T[]; rowCount: number };

/**
 * Tagged-template query, API-compatible with the old `@vercel/postgres` `sql`.
 * Interpolated values become real bind parameters ($1, $2, …) — never string
 * concatenation — so this is injection-safe.
 *
 *   const { rows } = await sql`SELECT * FROM managers WHERE id = ${id}`;
 */
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<QueryResult<T>> {
  await ensureSchema();
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  const res = await getPool().query(text, values);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

/**
 * Plain parameterised query, for dynamically-built statements (e.g. bulk
 * inserts) where a tagged template isn't a good fit.
 */
export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

/**
 * Round a date to the start of the day in UTC.
 * Used to coarsen timestamps so they can't be correlated with badge/log data.
 */
export function dayBucket(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  return d.toISOString().split("T")[0];
}

/**
 * Minimum responses required to display any aggregated result for a group.
 * Below this threshold, results are suppressed entirely.
 */
export const MIN_AGGREGATE_THRESHOLD = 5;
