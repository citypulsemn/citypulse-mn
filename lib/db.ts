import postgres from "postgres";

/**
 * Single Postgres connection, reused across hot reloads and serverless
 * invocations. Works with any standard Postgres connection string —
 * Supabase (use the pooled "Transaction" connection string) or Neon
 * (use the pooled connection string). Set DATABASE_URL to switch providers.
 */

const url = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __citypulseSql: ReturnType<typeof postgres> | undefined;
}

export const sql = url
  ? (globalThis.__citypulseSql ??= postgres(url, {
      // One connection per instance, not five. A serverless invocation serves
      // one request at a time and nothing in this codebase runs two queries
      // concurrently, so a pool of 5 bought nothing and multiplied our
      // footprint against Supabase's pooler by 5x. That multiplier is what
      // turned a burst of /api/saved requests into EMAXCONN on 9 Sep 2026.
      max: 1,
      idle_timeout: 20,
      prepare: false, // required for pooled (pgbouncer) connections
    }))
  : null;

export const hasDatabase = Boolean(url);

export function requireSql() {
  if (!sql) {
    throw new Error(
      "DATABASE_URL is not set. The pipeline needs a database connection.",
    );
  }
  return sql;
}
