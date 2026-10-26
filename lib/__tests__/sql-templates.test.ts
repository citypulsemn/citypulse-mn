import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * NO PROSE INSIDE A SQL TEMPLATE.
 *
 * On 29 Sep 2026 a correct one-word logic fix — `status in ('draft','archived')`
 * narrowed to `status = 'draft'` — shipped with its eleven-line rationale
 * written INSIDE the `sql` template as `//` lines. Postgres received them as the
 * start of the statement:
 *
 *   PostgresError: syntax error at or near "//"   position: 8
 *
 * Position 8 is the first slash after the indent. The query never ran again. It
 * took down `npm run import-sports` on every week a team had a game to add, and
 * because that step has no `continue-on-error`, the two steps after it —
 * `import-venues` and `check-sources` — never ran either. The free weekly
 * fabrication check was dead for FOUR WEEKS and the last `source_checked_at`
 * stamp in the database was 28 Sep. The same block had been pasted into
 * `import-venues.ts`, so both queries were broken.
 *
 * A SQL comment is `--`. A `//` inside a tagged template is not a comment at
 * all; it is text sent to the server. The same hazard in the other direction bit
 * `scripts/apply-correction.ts` on 18 Oct, where a BACKTICK inside a SQL comment
 * terminated the JS template literal.
 *
 * So: explanations go ABOVE the `await sql\`` line, never inside it.
 */

const ROOTS = ["lib", "scripts", "app", "components"];
const TAGS = /\b(sql|db|own)\s*`([\s\S]*?)`/g;

/**
 * This file. It has to contain the broken shape as a fixture, so it matches
 * itself — which it duly did on the first run.
 */
const SELF = "sql-templates.test.ts";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const repoRoot = join(__dirname, "..", "..");

describe("SQL templates", () => {
  const files = ROOTS.flatMap((r) => {
    try {
      return sourceFiles(join(repoRoot, r));
    } catch {
      return [];
    }
  });

  it("finds source files to check at all", () => {
    // A guard that silently scans nothing is worse than no guard.
    expect(files.length).toBeGreaterThan(100);
  });

  it("contains no `//` line, which Postgres reads as part of the statement", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith(SELF)) continue;
      const src = readFileSync(file, "utf8");
      // Skip doc blocks: a JSDoc mentioning `sql` in backticks otherwise matches
      // across the comment and reports itself.
      for (const m of src.matchAll(TAGS)) {
        const body = m[2];
        if (!/\b(select|insert|update|delete|with|alter|create)\b/i.test(body)) continue;
        const bad = body.split("\n").filter((l) => /^\s*\/\//.test(l));
        if (bad.length === 0) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(
          `${file.slice(repoRoot.length + 1)}:${line} — ${bad.length} JS comment line(s), first: ${bad[0].trim().slice(0, 60)}`,
        );
      }
    }
    expect(offenders, `use -- for a SQL comment, or put the prose above the query:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  it("would have caught the 29 Sep regression", () => {
    // The exact shape that shipped, proving the detector is not vacuous.
    const broken = [
      "      const woken = await sql`",
      "      // 'draft' ONLY, never 'archived'. An archive is deliberate.",
      "        update events set status = 'published'",
      "        where event_key = any(${keys}) and status = 'draft'",
      "      `;",
    ].join("\n");
    const found = [...broken.matchAll(TAGS)].some((m) =>
      m[2].split("\n").some((l) => /^\s*\/\//.test(l)),
    );
    expect(found).toBe(true);
  });
});
