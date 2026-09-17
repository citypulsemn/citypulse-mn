import { describe, it, expect } from "vitest";
import {
  normalizeRequestEmail,
  requestReference,
  describePlan,
  totalRows,
  DELETION_TABLES,
  type DeletionCount,
} from "../data-deletion";

describe("normalizeRequestEmail — the guard, not the formatter", () => {
  it("REFUSES blank input, which is the one that would delete everybody", () => {
    // event_submissions.submitter_email and event_reports.reporter_email are
    // `not null default ''`. An anonymous submission IS the empty string, so a
    // delete keyed on blank would take every anonymous submission and report in
    // the table. This is the most important assertion in the file.
    for (const v of ["", "   ", "\t", "\n", null, undefined]) {
      expect(normalizeRequestEmail(v), JSON.stringify(v)).toBeNull();
    }
  });

  it("refuses anything that is not unambiguously ONE address", () => {
    for (const v of [
      "a@b.com, c@d.com", // two addresses
      "a@b.com; c@d.com",
      "a@b.com c@d.com",
      "not an email",
      "@nodomain.com",
      "nolocal@",
      "no@dots",
      "a@b.c", // single-letter TLD
      "%", // a wildcard someone might reach for
      "' OR 1=1 --",
      42,
      {},
      [],
      "a".repeat(250) + "@example.com", // past the practical maximum
    ] as unknown[]) {
      expect(normalizeRequestEmail(v), JSON.stringify(v)).toBeNull();
    }
  });

  it("accepts and normalises a real address", () => {
    expect(normalizeRequestEmail("  Taren@Example.COM ")).toBe("taren@example.com");
    expect(normalizeRequestEmail("first.last+tag@sub.example.co.uk")).toBe(
      "first.last+tag@sub.example.co.uk",
    );
  });
});

describe("requestReference — an audit row must not re-create what it deleted", () => {
  it("is stable for the same address and salt", () => {
    expect(requestReference("a@b.com", "s")).toBe(requestReference("a@b.com", "s"));
  });

  it("differs by address and by salt", () => {
    expect(requestReference("a@b.com", "s")).not.toBe(requestReference("c@d.com", "s"));
    expect(requestReference("a@b.com", "s1")).not.toBe(requestReference("a@b.com", "s2"));
  });

  it("does not contain the address it references", () => {
    // Writing the email into admin_audit would leave the data in the database
    // under another name, which is not deletion.
    const ref = requestReference("taren@example.com", "salt");
    expect(ref).not.toContain("taren");
    expect(ref).not.toContain("example");
    expect(ref).not.toContain("@");
    expect(ref).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("the plan an operator reads before typing --apply", () => {
  const counts: DeletionCount[] = [
    { table: "saved_events", rows: 4, what: "events saved in their browser" },
    { table: "subscribers", rows: 1, what: "the subscription and its saver token" },
    { table: "event_submissions", rows: 0, what: "events they submitted" },
    { table: "event_reports", rows: 2, what: "listing reports they sent" },
  ];

  it("names every table, including the empty ones", () => {
    // "subscribers 0" is the useful half of the answer when someone asks
    // whether you still hold their address.
    const text = describePlan("a@b.com", counts);
    for (const t of DELETION_TABLES) expect(text, t).toContain(t);
  });

  it("totals the rows and says it cannot be undone", () => {
    expect(totalRows(counts)).toBe(7);
    expect(describePlan("a@b.com", counts)).toContain("7 row(s)");
    expect(describePlan("a@b.com", counts)).toMatch(/cannot be undone/i);
  });

  it("says plainly when there is nothing to delete", () => {
    const none = DELETION_TABLES.map((table) => ({ table, rows: 0, what: "x" }));
    const text = describePlan("a@b.com", none);
    expect(text).toMatch(/Nothing found/);
    expect(text).not.toMatch(/cannot be undone/i);
  });

  it("survives a broken count instead of printing NaN", () => {
    expect(totalRows([{ table: "subscribers", rows: NaN, what: "x" }])).toBe(0);
  });
});

describe("DELETION_TABLES ordering", () => {
  it("reads saved_events before subscribers, because the bridge is cut there", () => {
    // subscribers.saver_token is the only route from an email to that browser's
    // saved events. Delete the subscriber first and the saves are orphaned and
    // unreachable — still in the database, and still theirs.
    expect(DELETION_TABLES.indexOf("saved_events")).toBeLessThan(
      DELETION_TABLES.indexOf("subscribers"),
    );
  });
});
