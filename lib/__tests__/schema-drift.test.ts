import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * SCHEMA DRIFT GUARD (roadmap v5 R2.6) — the test that would have caught R0.4.
 *
 * R0.4's bug: an insert wrote `saver_token` where the table's column is
 * `user_token`; the flagship merge case 500'd for its whole life because
 * nothing compared the SQL in lib/ against db/schema.sql. This guard does,
 * DELIBERATELY DUMBLY:
 *
 *   1. parse db/schema.sql into table → column sets (create table blocks +
 *      additive `alter table … add column` lines, comments stripped);
 *   2. scan lib/ app/ scripts/ source text for the unambiguous SQL shapes —
 *      `insert into t (col, …)`, `on conflict (col) do update set col = …`,
 *      `update t set col = …`, and single-table `where col =` — and assert
 *      every referenced column exists.
 *
 * Conservative by construction: unknown tables (CTEs), aliased/joined
 * queries, and expression fragments are SKIPPED, never guessed at. If a
 * legitimate dynamic fragment trips it, add it to ALLOW below with a note.
 * If schema.sql's formatting changes shape, the meta tests fail first.
 */

const ROOT = join(__dirname, "..", "..");

// ── 1. schema.sql → table → columns ─────────────────────────────────────────

function stripSqlComments(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

export function parseSchema(text: string): Map<string, Set<string>> {
  const clean = stripSqlComments(text);
  const tables = new Map<string, Set<string>>();
  const NOT_COLUMNS = new Set(["primary", "unique", "check", "constraint", "foreign"]);

  for (const m of clean.matchAll(/create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = new Set<string>();
    for (const line of m[2].split("\n")) {
      const first = line.trim().match(/^(\w+)/)?.[1];
      if (first && !NOT_COLUMNS.has(first)) cols.add(first);
    }
    tables.set(m[1], cols);
  }
  for (const m of clean.matchAll(/alter table (\w+) add column if not exists (\w+)/g)) {
    tables.get(m[1])?.add(m[2]);
  }
  return tables;
}

// ── 2. source text → column references ──────────────────────────────────────

export interface Ref {
  file: string;
  table: string;
  column: string;
  context: string;
}

/** Column names on the left of `=` in a SET list (never `=>`, `>=`, `==`, or
 *  dotted/qualified names — those belong to expressions, not assignments). */
function setCols(segment: string): string[] {
  return [...segment.matchAll(/(?<![.\w!<>=])(\w+)\s*=(?![=>])/g)].map((m) => m[1]);
}

export function extractRefs(
  file: string,
  src: string,
  tables: Map<string, Set<string>>,
): Ref[] {
  const refs: Ref[] = [];

  // insert into t (col, …) [ … on conflict (col) do update set col = … ]
  for (const m of src.matchAll(/insert into (\w+)\s*\(([^)]*)\)/g)) {
    const table = m[1];
    if (!tables.has(table)) continue;
    for (const raw of m[2].split(",")) {
      const col = raw.trim();
      if (/^\w+$/.test(col)) refs.push({ file, table, column: col, context: "insert columns" });
    }
    const tail = src.slice(m.index, m.index + 700);
    const oc = tail.match(/on conflict\s*\((\w+)\)/);
    if (oc) refs.push({ file, table, column: oc[1], context: "on conflict target" });
    const du = tail.match(/do update\s+set\s+([\s\S]*?)(?:\bwhere\b|\breturning\b|`)/);
    if (du) for (const c of setCols(du[1])) refs.push({ file, table, column: c, context: "conflict set" });
  }

  // update t set col = …
  for (const m of src.matchAll(/update (\w+)\s+set\s+([\s\S]*?)(?:\bwhere\b|\breturning\b|`)/g)) {
    if (!tables.has(m[1])) continue;
    for (const c of setCols(m[2])) refs.push({ file, table: m[1], column: c, context: "update set" });
  }

  // single-table `where col =` — skipped when joined, aliased, or spanning
  // template boundaries (a backtick between target and where means two queries)
  for (const m of src.matchAll(/\b(?:from|update) (\w+)\s([\s\S]{0,300}?)where\s+(\w+)\s*=/g)) {
    const [, table, between, col] = m;
    if (!tables.has(table)) continue;
    if (/\bjoin\b/.test(between) || between.includes("`")) continue;
    refs.push({ file, table, column: col, context: "where =" });
  }

  return refs;
}

// Legitimate fragments the dumb parser mis-attributes: "file|table.column".
const ALLOW = new Set<string>([]);

// ── 3. the sweep ─────────────────────────────────────────────────────────────

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const dir of ["lib", "app", "scripts"]) {
    for (const entry of readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      const full = join(entry.parentPath, entry.name);
      if (full.includes("__tests__")) continue;
      out.push(full);
    }
  }
  return out;
}

const schema = parseSchema(readFileSync(join(ROOT, "db", "schema.sql"), "utf8"));

describe("schema parsing (meta — if these fail, the guard went blind, fix it first)", () => {
  it("finds the load-bearing tables and columns", () => {
    expect(schema.get("events")?.has("multi_day_end")).toBe(true); // via alter table
    expect(schema.get("events")?.has("start_at")).toBe(true);
    expect(schema.get("saved_events")?.has("user_token")).toBe(true);
    expect(schema.get("subscribers")?.has("saver_token")).toBe(true);
    expect(schema.get("rate_events")?.has("bucket")).toBe(true);
  });

  it("does not hallucinate columns from constraints or commented-out DDL", () => {
    expect(schema.get("events")?.has("primary")).toBe(false);
    expect(schema.get("events")?.has("geom")).toBe(false); // commented alter, line ~95
  });
});

describe("the canary — the exact R0.4 typo class must be caught", () => {
  it("flags an insert that names a column from the WRONG table", () => {
    const fixture = "await sql`insert into saved_events (saver_token, event_id) values (1, 2)`";
    const refs = extractRefs("fixture.ts", fixture, schema);
    const bad = refs.filter((r) => !schema.get(r.table)?.has(r.column));
    expect(bad.map((r) => r.column)).toContain("saver_token");
  });

  it("stays quiet on the corrected form", () => {
    const fixture = "await sql`insert into saved_events (user_token, event_id) values (1, 2)`";
    const refs = extractRefs("fixture.ts", fixture, schema);
    expect(refs.filter((r) => !schema.get(r.table)?.has(r.column))).toEqual([]);
  });
});

describe("the sweep — every SQL column reference in lib/ app/ scripts/ exists in db/schema.sql", () => {
  const allRefs: Ref[] = [];
  for (const f of sourceFiles()) {
    allRefs.push(...extractRefs(relative(ROOT, f), readFileSync(f, "utf8"), schema));
  }

  it(`actually sees the codebase — ${allRefs.length} refs across ${new Set(allRefs.map((r) => r.file)).size} files (regex rot would collapse this)`, () => {
    expect(allRefs.length).toBeGreaterThanOrEqual(25);
  });

  it("finds no drift", () => {
    const bad = allRefs.filter(
      (r) =>
        !schema.get(r.table)?.has(r.column) &&
        !ALLOW.has(`${r.file}|${r.table}.${r.column}`),
    );
    const report = bad
      .map((r) => `${r.file}: ${r.table}.${r.column} (${r.context}) — not in db/schema.sql`)
      .join("\n");
    expect(bad, `\n${report}\n`).toEqual([]);
  });
});
