import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Query-text tripwires (Roadmap v5 pattern, introduced with R0.2). The archive
 * and dedupe predicates live in SQL the unit suite can't execute — these
 * guards make sure the load-bearing fragments can't silently regress. Deliberately
 * dumb: they assert the source text, nothing more. If you're editing the
 * queries on purpose, update these alongside — that's the point.
 */
const src = readFileSync(join(__dirname, "..", "upsert.ts"), "utf8");
const adminSrc = readFileSync(join(__dirname, "..", "admin.ts"), "utf8");

function fnBody(name: string, source = src): string {
  const at = source.indexOf(`export async function ${name}`);
  expect(at, `${name} exists`).toBeGreaterThan(-1);
  const next = source.indexOf("export async function", at + 1);
  return next === -1 ? source.slice(at) : source.slice(at, next);
}

describe("archivePastEvents (R0.2) — the predicate that killed festivals mid-run", () => {
  const body = fnBody("archivePastEvents");

  it("reads the TRUE span: multi_day_end first in the coalesce", () => {
    expect(body).toContain("coalesce(multi_day_end, end_at, start_at)");
  });

  it("grants end-of-day grace in the Chicago frame (date-vs-date, not instant-vs-now)", () => {
    expect(body).toContain("at time zone 'America/Chicago')::date");
    expect(body).not.toMatch(/coalesce\(end_at, start_at\) < now\(\)/);
  });
});

describe("dedupeNearDuplicates (R0.3) — same-day means the same CHICAGO day", () => {
  const body = fnBody("dedupeNearDuplicates");

  it("casts both sides to the Chicago date, never the session-zone date", () => {
    expect(body).toContain("(a.start_at at time zone 'America/Chicago')::date");
    expect(body).toContain("(b.start_at at time zone 'America/Chicago')::date");
    expect(body).not.toMatch(/a\.start_at::date = b\.start_at::date/);
  });

  it("survivorship is earliest-seen (created_at), not a UUID coin flip", () => {
    expect(body).toContain("(a.created_at, a.id) < (b.created_at, b.id)");
  });

  it("keepers are anchored: a row archived this pass can't justify another archive", () => {
    expect(body).toContain("keep_id not in (select dup_id from pairs)");
  });
});

describe("getDuplicatePairs (admin view) — same R0.3 predicate", () => {
  const body = fnBody("getDuplicatePairs", adminSrc);

  it("matches the dedupe's Chicago-day and survivorship semantics", () => {
    expect(body).toContain("(a.start_at at time zone 'America/Chicago')::date");
    expect(body).toContain("(a.created_at, a.id) < (b.created_at, b.id)");
    expect(body).not.toMatch(/a\.start_at::date = b\.start_at::date/);
  });
});
