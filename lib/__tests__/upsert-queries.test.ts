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

describe("getEventsForDay expansion cap (R1.7b) — SQL agrees with EXPAND_MAX_DAYS", () => {
  const eventsSrc = readFileSync(join(__dirname, "..", "events.ts"), "utf8");

  it("the SQL date-diff cap is <= 13 (14 days inclusive), matching daysSpanned", () => {
    expect(eventsSrc).toContain("::date <= 13");
    expect(eventsSrc).not.toMatch(/::date <= 14/);
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

describe("upsertEvents — a changed citation is an unread page", () => {
  const body = fnBody("upsertEvents");

  it("nulls source_checked_at when the conflict clause replaces source_url", () => {
    // Until 27 Oct 2026 this clause overwrote source_url and left the stamp
    // alone, so a row could carry a brand-new source with a freshness earned by
    // the old one. check-sources orders its ~400-page budget by that stamp
    // (`stalestFirst`, nulls first), so the new page went to the BACK of the
    // queue and the listing stopped being checked against anything real. It is
    // also the one thing that could silently undo `npm run correct`'s
    // source_url repair.
    expect(body).toContain("source_url  = excluded.source_url");
    expect(body).toContain("source_checked_at = case when events.source_url is distinct from excluded.source_url");
    expect(body).toContain("then null else events.source_checked_at end");
  });

  it("does not reset it unconditionally, which would re-read every page every week", () => {
    expect(body).not.toMatch(/source_checked_at\s*=\s*null\s*,/);
  });
});

describe("foldRunRefinds — the gate that stops a run being re-minted weekly", () => {
  // Not exported (the pure decision is planRunFolds, which has its own golden
  // tests); slice it by name so the SQL still gets a tripwire.
  const at = src.indexOf("async function foldRunRefinds");
  const body = src.slice(at, src.indexOf("export async function upsertEvents"));

  it("exists, and runs inside the upsert write path", () => {
    expect(at, "foldRunRefinds exists").toBeGreaterThan(-1);
    expect(src).toContain("await foldRunRefinds(sql, noDupes)");
  });

  it("its output is what gets inserted — not the pre-fold list", () => {
    // The fold is worthless if the batch it filtered is not the batch written.
    const upsert = src.slice(src.indexOf("export async function upsertEvents"));
    expect(upsert).toContain("const deduped = await foldRunRefinds(sql, noDupes);");
    expect(upsert).toContain("const rows = deduped.map");
  });

  it("runs AFTER the same-slot duplicate gate, so each still sees the full batch", () => {
    expect(src.indexOf("withoutLiveDuplicates(sql, byKey)")).toBeLessThan(
      src.indexOf("foldRunRefinds(sql, noDupes)"),
    );
  });

  it("bounds its read on the TRUE span, the same coalesce archivePastEvents uses", () => {
    // multi_day_end alone is the bug this whole function exists for: a run
    // carried in end_at is invisible to anything that reads only the span column.
    expect(body).toContain("coalesce(multi_day_end, end_at, start_at)");
    expect(body).toContain("at time zone 'America/Chicago')::date");
  });

  it("hands planRunFolds BOTH span sources, or it cannot see a run at all", () => {
    expect(body).toMatch(/to_char\(end_at at time zone 'America\/Chicago'/);
    expect(body).toMatch(/to_char\(multi_day_end at time zone 'America\/Chicago'/);
    expect(body).toContain('as "multiDayEnd"');
  });

  it("excludes a live row whose event_key is in the incoming batch", () => {
    // THE SELF-FOLD. planRunFolds cannot catch this: the live rows it is given
    // are keyed by uuid and the incoming rows by event_key, so its own id check
    // compares two namespaces and never fires. An ordinary re-find — same
    // title, venue and start day, therefore the same event_key, i.e. the normal
    // ON CONFLICT update — folded onto its OWN live row, declining the update
    // that carries price, ticket_url, end_at and cancellations. 107 of 149 live
    // runs on 4 Nov 2026, with every unit test green.
    expect(body).toMatch(/select id::text as id, event_key, title, city, category/);
    expect(body).toContain("const incomingKeys = new Set(incoming.map((e) => e.event_key));");
    expect(body).toContain("live.filter((l) => !incomingKeys.has(l.event_key))");
  });

  it("keeps PUBLISHED runs only, so a hidden draft cannot decline a visible row", () => {
    // status is set on INSERT alone, so a draft keeper declines a re-find that
    // would have been inserted published — and the event then renders nowhere.
    // 26 of 149 live runs are drafts. withoutLiveDuplicates reads drafts too,
    // and should: blocking a duplicate is not the same as suppressing the only
    // visible copy.
    expect(body).toContain("where status = 'published'");
    expect(body).not.toContain("where status in ('published', 'draft')");
  });

  it("extends a span through greatest(), so two folds onto one keeper cannot shrink it", () => {
    // Every extendTo is computed against the keeper's PRE-BATCH span, so two
    // re-finds of one run in a single batch both carry a non-null extendTo and
    // a bare assignment let the second — possibly the nearer — win. end_at is
    // in the greatest as well, because spanEnd prefers multi_day_end once set.
    expect(body).toMatch(/set multi_day_end = greatest\(/);
    expect(body).toMatch(/multi_day_end,\s*\n\s*end_at\)/);
  });

  it("records the keeper's TITLE, and cannot be killed by a failed audit write", () => {
    // Rule 1: the instrument must not kill the panel. The span and last_seen_at
    // are already committed by the time this insert runs, and it is the only
    // source the digest's Run folds section reads.
    expect(body).toContain("kept_title: keptTitle");
    const insertAt = body.indexOf("insert into admin_audit");
    expect(body.lastIndexOf("try {", insertAt)).toBeGreaterThan(-1);
    expect(body.slice(insertAt)).toContain("} catch (err) {");
  });

  it("writes the exact action and patch keys the ops digest reads back", () => {
    // Three times in 2026 a channel was dead for weeks because the writer and
    // the reader drifted apart silently (the revalidation endpoint, the source
    // check, the checker email). Rename either side and the Monday section
    // reads "no re-finds folded" forever, which looks like a quiet week.
    const inputs = readFileSync(join(__dirname, "..", "ops-inputs.ts"), "utf8");
    expect(body).toContain("'run:folded'");
    expect(inputs).toContain("action = 'run:folded'");
    for (const key of ["title", "kept", "kept_title", "extended_to", "drift"]) {
      expect(body, `gate writes patch.${key}`).toContain(`${key}:`);
      expect(inputs, `digest reads patch.${key}`).toContain(`patch->>'${key}'`);
    }
  });

  it("says WHICH rule folded the row, in the audit trail and in the Actions log", () => {
    // Both of these survived a mutation pass: collapsing the audit `why` to one
    // string, and deleting the marker from the console line, broke no test. The
    // audit `why` is the only place a future reader learns that a fold was a
    // similarity judgement rather than an identical name, and the console line
    // is the only trace while a pipeline run is in flight.
    expect(body).toContain("DRIFTED from a run");
    expect(body).toContain("title similarity, not an identical name");
  });

  it("carries the planner's drift flag through, rather than deciding again", () => {
    // Two definitions of "was this a judgement call" would drift apart exactly
    // like the gates this fold exists to patch over. planRunFolds derives the
    // flag from the keeper's own keys; the applier is only a courier for it,
    // and the digest reads what the courier wrote.
    expect(body).toContain("drift: f.drift");
    const inputs = readFileSync(join(__dirname, "..", "ops-inputs.ts"), "utf8");
    // Rows written before the drift rule existed carry no flag and were all
    // key matches, so an absent flag must read as false, never as null.
    expect(inputs).toContain("coalesce((patch->>'drift')::boolean, false)");
  });

  it("extends the keeper through the ::text cast, not a bare ISO param", () => {
    // postgres.js types an ISO-shaped string as timestamptz and shifts it
    // +5/6h before the tz attach (confirmed against prod 2026-07-20).
    expect(body).toContain("::text::timestamp at time zone 'America/Chicago'");
    expect(body).not.toMatch(/set multi_day_end = \$\{[^}]*\}\s*$/m);
  });

  it("refreshes last_seen_at on the run it folded onto", () => {
    // The point of folding rather than dropping: the run RECEIVED this week's
    // sighting. Without it the keeper reads as abandoned.
    expect(body).toContain("set last_seen_at = now()");
  });

  it("leaves a trail", () => {
    expect(body).toContain("'run:folded'");
  });
});
