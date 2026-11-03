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

  it("is self-clearing — live, upcoming, and flagged, computed not stored", () => {
    expect(src).toContain("e.status = 'published'");
    expect(src).toContain("e.start_at >= now()");
    // One flag per listing, the latest one.
    expect(src).toContain("distinct on (e.id)");
    expect(src).toContain("order by e.id, a.at desc");
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
