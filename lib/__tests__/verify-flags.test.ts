import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flagRank, openVerifyFlags, openVerifyFlagIds } from "../verify-flags";
import { getAdminEvents } from "../admin";

describe("flagRank — most dangerous verdict first", () => {
  it("wrong_event outranks everything, cancelled next", () => {
    expect(flagRank("wrong_event")).toBeLessThan(flagRank("cancelled"));
    expect(flagRank("cancelled")).toBeLessThan(flagRank("moved"));
  });

  it("every other verdict shares the back of the queue, stably", () => {
    // Not an ordering between them — just "after the two that matter".
    for (const v of ["moved", "not_found", "weak_source", "unproven", "sold_out", "flag", ""]) {
      expect(flagRank(v), v).toBe(2);
    }
  });

  it("sorts a real verdict mix the way the email prints it", () => {
    const mix = ["moved", "sold_out", "wrong_event", "not_found", "cancelled"];
    expect([...mix].sort((a, b) => flagRank(a) - flagRank(b))[0]).toBe("wrong_event");
    expect([...mix].sort((a, b) => flagRank(a) - flagRank(b))[1]).toBe("cancelled");
  });
});

describe("the open-flag predicate, as source", () => {
  const src = readFileSync(join(__dirname, "..", "verify-flags.ts"), "utf8");

  it("counts a flag raised AFTER a stamp — the clause everyone drops", () => {
    // Dropping it turns 33 into 25 against the live calendar, and it is the most
    // dangerous flag there is: something re-checked a confirmed listing and
    // disagreed, and the stamp swallowed the disagreement.
    expect(src).toContain("e.verified_at is null or a.at > e.verified_at");
  });

  it("is self-clearing — live, STILL ON, and flagged, computed not stored", () => {
    expect(src).toContain("e.status = 'published'");
    // One flag per listing, the latest one.
    expect(src).toContain("distinct on (e.id)");
    expect(src).toContain("order by e.id, a.at desc");
  });

  it("asks whether the listing is STILL ON, not whether it is still to come", () => {
    // This was `e.start_at >= now()`, so a run that opened before today fell out
    // of triage while staying live. Measured 10 Nov 2026: 846 listings have ever
    // carried a verify flag and 240 of them are runs, 277 flags were cancelled or
    // wrong_event, and the longest live run was 333 days — so a hidden cancelled
    // run could sit unseen for most of a year. (0 were hidden on the day of the
    // fix; this is the shape that admits it, not a count of victims.)
    expect(src).toContain("greatest(e.start_at, e.end_at, e.multi_day_end) >= now()");
    expect(src).not.toContain("and e.start_at >= now()");
  });

  it("prints a SPAN for a run, not the day it opened", () => {
    // Widening the window made runs reachable, and `day` was to_char(start_at)
    // alone — so a cancelled exhibition would have reached the operator email as
    // "· May 23", a date months past for something still on.
    const select = src.slice(src.indexOf("select distinct on"), src.indexOf("from admin_audit"));
    expect(select).toContain("end as day");
    expect(select).toContain("|| ' – ' ||");
  });

  it("uses greatest(), not the coalesce that disagrees with isEnded", () => {
    // A bare coalesce(multi_day_end, end_at, start_at) prefers multi_day_end even
    // when it is NOT later than the start, which is the latent disagreement
    // lib/events.ts documents. isEnded takes the LATEST of the three.
    //
    // Scoped to the WHERE clause, not the whole file: the docstring above names
    // the coalesce form in order to reject it, and a blunt not.toContain over
    // the source matched that prose — this test failed on its own explanation.
    const where = src.slice(src.indexOf("from admin_audit"), src.indexOf("order by e.id"));
    expect(where).toContain("greatest(e.start_at, e.end_at, e.multi_day_end) >= now()");
    expect(where).not.toContain("coalesce(");
  });
});

describe("the /admin filter is wired to the predicate, not to a status", () => {
  const admin = readFileSync(join(__dirname, "..", "admin.ts"), "utf8");

  it("filters by the flagged ids, and orders them soonest first", () => {
    // "flagged" is not a value of events.status, so a branch that fell through
    // to `status = 'flagged'` would quietly return nothing on a real database
    // while looking like it worked. The no-database test below cannot tell those
    // two apart, so the branch is pinned here.
    expect(admin).toContain("const flaggedOnly = status === \"flagged\"");
    expect(admin).toContain("id = any(");
    expect(admin).toContain("start_at asc");
  });
});

describe("without a database, nothing claims to be flagged", () => {
  it("returns an honest empty rather than a number", async () => {
    // The tests run with no DATABASE_URL, so this is the never-break path. The
    // failure mode worth guarding is the opposite one: a `flagged` filter that
    // falls through and hands back the whole sample calendar as if every
    // listing were flagged.
    await expect(openVerifyFlags()).resolves.toEqual([]);
    await expect(openVerifyFlagIds()).resolves.toEqual([]);
    await expect(getAdminEvents({ status: "flagged" })).resolves.toEqual([]);
  });

  it("…while the ordinary filters still return the sample calendar", async () => {
    // If this went empty too, the test above would be passing for the wrong
    // reason and would stop meaning anything.
    expect((await getAdminEvents({ status: "all" })).length).toBeGreaterThan(0);
    expect((await getAdminEvents({ status: "published" })).length).toBeGreaterThan(0);
  });
});
