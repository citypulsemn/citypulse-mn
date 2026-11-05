import { describe, it, expect } from "vitest";
import {
  selectOngoing,
  selectLastChance,
  ongoingStripPlan,
  alsoRunningPlan,
  throughLabel,
  ONGOING_CAP,
  ALSO_RUNNING_CAP,
  MIN_LAST_CHANCE,
} from "../ongoing";
import type { EventRecord } from "../types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Noon Chicago, Monday Jul 20 2026
const NOW = new Date("2026-07-20T17:00:00Z");

let seq = 0;
function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  seq += 1;
  return {
    id: `e${seq}`,
    title: "Run", category: "arts", venue: "V", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-10T10:00", end: "", price: "$10", priceTier: "$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: "2026-07-26T17:00", allDay: false,
    ...overrides,
  };
}

describe("the /day page's honest-emptiness gates (rule 6, in JSX)", () => {
  // The dishonest empty state — "Nothing on the calendar here yet" on a day with
  // three exhibitions open — lived in JSX, and so does the fix. Re-ternarying the
  // page would restore the exact bug with a green suite, so read the source.
  const page = readFileSync(
    join(__dirname, "..", "..", "app", "day", "[date]", "page.tsx"),
    "utf8",
  );

  it("the empty state fires only when BOTH the day list and the shelf are empty", () => {
    // once for the header count line, once for the empty-state block
    const gate = /events\.length === 0 && alsoRunning\.total === 0/g;
    expect((page.match(gate) ?? []).length).toBe(2);
    // and the old unconditional ternary is gone
    expect(page).not.toMatch(/\{events\.length === 0\s*\n?\s*\?/);
  });

  it("the shelf renders on its own total, not on the day list's", () => {
    expect(page).toContain("{alsoRunning.total > 0 && (");
  });

  it("the onward link does not quote a count /ongoing cannot honour", () => {
    expect(page).toContain("More ongoing runs");
    expect(page).not.toMatch(/See all \{alsoRunning\.total\}/);
  });
});

describe("alsoRunningPlan — the day-page shelf (5 Nov 2026)", () => {
  // The day being looked at. Everything below is relative to it.
  const DAY = "2026-07-20";

  // A run is "also running" only when the day surfaces cannot show it, so the
  // fixtures are built around the 14-day cap, not around NOW.
  const run = (start: string, end: string, over: Partial<EventRecord> = {}) =>
    ev({ start: `${start}T10:00`, end: "", multiDayEnd: `${end}T17:00`, ...over });

  it("an over-cap run that is open on the day is on the shelf", () => {
    const plan = alsoRunningPlan([run("2026-07-01", "2026-08-15")], DAY);
    expect(plan.total).toBe(1);
    expect(plan.items[0].endDay).toBe("2026-08-15");
  });

  it("an IN-cap run is not — the day query already shows it", () => {
    // 14 days inclusive, date diff 13: the longest run the day query admits.
    expect(alsoRunningPlan([run("2026-07-15", "2026-07-28")], DAY).total).toBe(0);
  });

  it("THE BOUNDARY: diff 13 is the day query's, diff 14 is the shelf's", () => {
    // Nothing may fall between the two predicates, and nothing may be in both.
    expect(alsoRunningPlan([run("2026-07-10", "2026-07-23")], DAY).total).toBe(0); // diff 13
    expect(alsoRunningPlan([run("2026-07-10", "2026-07-24")], DAY).total).toBe(1); // diff 14
  });

  it("a run that STARTS on the day is not — the main list has it", () => {
    expect(alsoRunningPlan([run("2026-07-20", "2026-09-30")], DAY).total).toBe(0);
  });

  it("a run that closed before the day is not", () => {
    expect(alsoRunningPlan([run("2026-05-01", "2026-07-19")], DAY).total).toBe(0);
  });

  it("…but one closing ON the day is — that is the one worth saying", () => {
    const plan = alsoRunningPlan([run("2026-05-01", "2026-07-20")], DAY);
    expect(plan.total).toBe(1);
    expect(throughLabel(plan.items[0].endDay, new Date("2026-07-20T17:00:00Z"))).toBe(
      "Last day today",
    );
  });

  it("a single-day event is never on the shelf", () => {
    expect(
      alsoRunningPlan([ev({ start: "2026-07-20T10:00", end: "", multiDayEnd: null })], DAY).total,
    ).toBe(0);
  });

  it("drafts and archived rows never reach it", () => {
    const rows = [
      run("2026-07-01", "2026-08-15", { status: "draft" }),
      run("2026-07-01", "2026-08-15", { status: "archived" }),
    ];
    expect(alsoRunningPlan(rows, DAY).total).toBe(0);
  });

  it("ENDING SOONEST FIRST — last chance is the only urgent thing here", () => {
    const rows = [
      run("2026-01-01", "2026-12-31", { title: "Long" }),
      run("2026-07-01", "2026-07-25", { title: "Closing" }),
      run("2026-06-01", "2026-09-01", { title: "Middle" }),
    ];
    expect(alsoRunningPlan(rows, DAY).items.map((o) => o.event.title)).toEqual([
      "Closing",
      "Middle",
      "Long",
    ]);
  });

  it("caps the items but reports the honest total, so the link can say it", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      run("2026-06-01", `2026-08-${String(i + 10).padStart(2, "0")}`),
    );
    const plan = alsoRunningPlan(rows, DAY);
    expect(plan.items).toHaveLength(ALSO_RUNNING_CAP);
    expect(plan.total).toBe(10);
  });

  it("an over-cap span carried by end_at instead of multiDayEnd counts", () => {
    const byEnd = ev({ start: "2026-07-01T10:00", end: "2026-08-15T17:00", multiDayEnd: null });
    expect(alsoRunningPlan([byEnd], DAY).total).toBe(1);
  });

  // ── COMPLEMENTARITY — the property the whole design rests on ──────────────
  // The /day page renders the day query's rows AND this shelf. If the two
  // predicates overlap, a run shows twice; if they leave a gap, a run that is
  // genuinely open shows nowhere. This mirrors the SQL in TS and checks both
  // directions across every offset around the cap.
  it("no row can land in both lists, and no open run lands in neither", () => {
    const dayNumOf = (k: string) =>
      Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 86_400_000;
    // readEventsForDay, in TS. Mirrors the SQL's span derivation from BOTH
    // sources — a sweep that only understood multiDayEnd would stay green over
    // an end_at-carried divergence forever, which is this project's own
    // "pure tests miss the caller" shape.
    const spanEndOf = (e: EventRecord) => {
      const s = e.start.slice(0, 10);
      if (e.multiDayEnd && e.multiDayEnd.slice(0, 10) > s) return e.multiDayEnd.slice(0, 10);
      if (e.end && e.end.slice(0, 10) > s) return e.end.slice(0, 10);
      return null;
    };
    const dayQueryAdmits = (e: EventRecord) => {
      const s = e.start.slice(0, 10);
      if (s === DAY) return true;
      const end = spanEndOf(e);
      if (!end) return false;
      return s <= DAY && end >= DAY && dayNumOf(end) - dayNumOf(s) <= 13;
    };

    const rows: EventRecord[] = [];
    for (let startOffset = -40; startOffset <= 2; startOffset += 1) {
      for (const len of [1, 2, 13, 14, 15, 16, 40, 200]) {
        const s = new Date(Date.UTC(2026, 6, 20) + startOffset * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const e = new Date(Date.UTC(2026, 6, 20) + (startOffset + len - 1) * 86_400_000)
          .toISOString()
          .slice(0, 10);
        if (len === 1) {
          rows.push(ev({ start: `${s}T10:00`, end: "", multiDayEnd: null }));
          continue;
        }
        rows.push(run(s, e));
        // the SAME span carried by end_at instead of multi_day_end
        rows.push(ev({ start: `${s}T10:00`, end: `${e}T17:00`, multiDayEnd: null }));
        // and the shape the two SQL clauses used to disagree about: a
        // multiDayEnd pinned to the start day while end_at runs on
        rows.push(ev({ start: `${s}T10:00`, end: `${e}T17:00`, multiDayEnd: `${s}T23:00` }));
      }
    }

    const shelf = new Set(
      alsoRunningPlan(rows, DAY, rows.length).items.map((o) => o.event.id),
    );
    const inDayList = new Set(rows.filter(dayQueryAdmits).map((r) => r.id));

    // 1. disjoint
    for (const id of shelf) expect(inDayList.has(id)).toBe(false);

    // 2. no gap: every row genuinely open on DAY is in exactly one of them
    for (const r of rows) {
      const s = r.start.slice(0, 10);
      const end = spanEndOf(r) ?? s;
      const open = s <= DAY && end >= DAY;
      expect(shelf.has(r.id) || inDayList.has(r.id), `${r.id} ${s}->${end}`).toBe(open);
    }
    expect(shelf.size).toBeGreaterThan(0);
    expect(inDayList.size).toBeGreaterThan(0);
  });
});

describe("selectOngoing — boundary days", () => {
  it("ends today → included, labeled 'Last day today'", () => {
    const out = selectOngoing([ev({ multiDayEnd: "2026-07-20T17:00" })], NOW);
    expect(out).toHaveLength(1);
    expect(throughLabel(out[0].endDay, NOW)).toBe("Last day today");
  });
  it("ended yesterday → out", () => {
    expect(selectOngoing([ev({ multiDayEnd: "2026-07-19T17:00" })], NOW)).toHaveLength(0);
  });
  it("starts today → out (today's calendar, not the ongoing shelf)", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-20T10:00", multiDayEnd: "2026-07-30T17:00" })], NOW),
    ).toHaveLength(0);
  });
  it("starts tomorrow → out", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-21T10:00", multiDayEnd: "2026-07-30T17:00" })], NOW),
    ).toHaveLength(0);
  });
});

describe("selectOngoing — the >3-day floor", () => {
  it("a Fri–Sun run (3 days) is a weekend thing, not ongoing", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-17T10:00", multiDayEnd: "2026-07-19T17:00" })],
        new Date("2026-07-18T17:00:00Z")),
    ).toHaveLength(0);
  });
  it("a 4-day run qualifies", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-17T10:00", multiDayEnd: "2026-07-20T17:00" })], NOW),
    ).toHaveLength(1);
  });
  it("single-day events never qualify", () => {
    expect(selectOngoing([ev({ multiDayEnd: null, start: "2026-07-19T10:00" })], NOW)).toHaveLength(0);
  });
});

describe("selectOngoing — the true-span rule (the weekend-page regression)", () => {
  it("a 17-day fair mid-run IS ongoing — spanEnd, never the capped daysSpanned", () => {
    const fair = ev({ start: "2026-07-10T09:00", multiDayEnd: "2026-07-26T23:59", allDay: true });
    const out = selectOngoing([fair], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].endDay).toBe("2026-07-26");
  });
  it("a late-night show (ends 1 AM next day) is NOT a run", () => {
    const show = ev({ start: "2026-07-19T21:00", multiDayEnd: null, end: "2026-07-20T01:00" });
    expect(selectOngoing([show], NOW)).toHaveLength(0);
  });
});

describe("selectOngoing — order and cap", () => {
  it("ending soonest first — last chance is the editorial angle", () => {
    const out = selectOngoing(
      [
        ev({ id: "november", multiDayEnd: "2026-11-01T17:00" }),
        ev({ id: "sunday", multiDayEnd: "2026-07-26T17:00" }),
        ev({ id: "friday", multiDayEnd: "2026-07-24T17:00" }),
      ],
      NOW,
    );
    expect(out.map((o) => o.event.id)).toEqual(["friday", "sunday", "november"]);
  });
  it(`caps at ${ONGOING_CAP}`, () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ev({ multiDayEnd: `2026-08-${String(i + 1).padStart(2, "0")}T17:00` }),
    );
    expect(selectOngoing(many, NOW)).toHaveLength(ONGOING_CAP);
  });
  it("drafts excluded", () => {
    expect(selectOngoing([ev({ status: "draft" })], NOW)).toHaveLength(0);
  });
});

describe("throughLabel", () => {
  it("formats the closing date", () => {
    expect(throughLabel("2026-08-02", NOW)).toBe("Through Aug 2");
  });
});

describe("selectLastChance (F2.2) — the urgent prefix", () => {
  // NOW is Mon Jul 20 → the week runs through Sun Jul 26 (today + 6).
  const week = (ends: string[]) =>
    selectOngoing(ends.map((e) => ev({ multiDayEnd: e })), NOW);

  it("boundary: today and today+6 are in; today+7 is out", () => {
    const ongoing = week(["2026-07-20T17:00", "2026-07-26T17:00", "2026-07-27T17:00"]);
    const lc = selectLastChance(ongoing, NOW);
    expect(lc.map((o) => o.endDay)).toEqual(["2026-07-20", "2026-07-26"]);
  });

  it("is always a PREFIX of the ongoing order (rest = slice, no double cards)", () => {
    const ongoing = week(["2026-11-01T17:00", "2026-07-24T17:00", "2026-07-26T17:00", "2026-08-15T17:00"]);
    const lc = selectLastChance(ongoing, NOW);
    expect(lc).toEqual(ongoing.slice(0, lc.length));
    expect(lc.map((o) => o.endDay)).toEqual(["2026-07-24", "2026-07-26"]);
  });

  it("empty in, empty out", () => {
    expect(selectLastChance([], NOW)).toEqual([]);
  });
});

describe("ongoingStripPlan (F2.2) — the label swap obeys honesty twice", () => {
  const closing = ["2026-07-21T17:00", "2026-07-23T17:00", "2026-07-25T17:00"];
  const later = ["2026-08-15T17:00", "2026-09-01T17:00", "2026-11-01T17:00"];

  it(`swaps to last-chance only at ${MIN_LAST_CHANCE}+ closing runs — and then shows ONLY those`, () => {
    const ongoing = selectOngoing([...closing, ...later].map((e) => ev({ multiDayEnd: e })), NOW);
    const plan = ongoingStripPlan(ongoing, NOW);
    expect(plan.lastChance).toBe(true);
    expect(plan.items).toHaveLength(3); // never padded with non-urgent runs
    expect(plan.items.every((o) => o.endDay <= "2026-07-26")).toBe(true);
  });

  it("below the floor: normal strip, normal slice", () => {
    const ongoing = selectOngoing(
      [closing[0], closing[1], ...later].map((e) => ev({ multiDayEnd: e })),
      NOW,
    );
    const plan = ongoingStripPlan(ongoing, NOW);
    expect(plan.lastChance).toBe(false);
    expect(plan.items).toHaveLength(5);
  });

  it("respects the cap when the whole town is closing", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      ev({ multiDayEnd: `2026-07-2${1 + (i % 6)}T17:00` }),
    );
    const plan = ongoingStripPlan(selectOngoing(many, NOW), NOW);
    expect(plan.lastChance).toBe(true);
    expect(plan.items).toHaveLength(6);
  });
});
