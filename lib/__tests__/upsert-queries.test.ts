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

function fnBody(name: string): string {
  const at = src.indexOf(`export async function ${name}`);
  expect(at, `${name} exists`).toBeGreaterThan(-1);
  const next = src.indexOf("export async function", at + 1);
  return next === -1 ? src.slice(at) : src.slice(at, next);
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
