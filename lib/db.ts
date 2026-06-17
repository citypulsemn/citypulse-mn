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
      max: 5,
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
