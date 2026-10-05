import { describe, it, expect } from "vitest";
import {
  ordinal,
  headerFor,
  detailsLine,
  CTA_LINE,
  DETAILS_TARGET,
  DETAILS_HARD_CAP,
} from "../format";
import type { CandidateEvent, WeekWindow } from "../types";

// 2026-08-03 is a Monday, 2026-08-08 a Saturday — verified against the calendar.
const MONDAY: WeekWindow = {
  postDay: "monday",
  start: "2026-08-03",
  end: "2026-08-07",
  isoWeek: 32,
  shotTypeKey: 0,
  audioLane: 2,
};

const FRIDAY: WeekWindow = {
  postDay: "friday",
  start: "2026-08-08",
  end: "2026-08-09",
  isoWeek: 32,
  shotTypeKey: 0,
  audioLane: 2,
};

const CROSS_MONTH: WeekWindow = {
  postDay: "monday",
  start: "2026-08-31",
  end: "2026-09-04",
  isoWeek: 36,
  shotTypeKey: 0,
  audioLane: 0,
};

function ev(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    id: "e1",
    title: "Test Event",
    category: "music",
    venue: "First Avenue",
    city: "Minneapolis",
    startAt: "2026-08-08T18:40:00-05:00", // Saturday
    endAt: null,
    price: "$25",
    priceTier: "$",
    sourceUrl: "https://example.com/e",
    description: "",
    ...overrides,
  };
}

describe("ordinal", () => {
  it("matches the published-reel forms including the teens", () => {
    const table: [number, string][] = [
      [1, "1ST"], [2, "2ND"], [3, "3RD"], [4, "4TH"],
      [11, "11TH"], [12, "12TH"], [13, "13TH"],
      [21, "21ST"], [22, "22ND"], [23, "23RD"], [31, "31ST"],
    ];
    for (const [n, want] of table) expect(ordinal(n)).toBe(want);
  });
});

describe("headerFor", () => {
  it("produces all six exact live wordings", () => {
    expect(headerFor("monday", "regular", MONDAY)).toBe(
      "THIS WEEK IN MPLS - AUGUST 3RD-7TH",
    );
    expect(headerFor("monday", "family", MONDAY)).toBe(
      "THIS WEEK WITH KIDS - AUGUST 3RD-7TH",
    );
    expect(headerFor("monday", "weird", MONDAY)).toBe(
      "THINGS HAPPENING THIS WEEK - AUGUST 3RD-7TH",
    );
    expect(headerFor("friday", "regular", FRIDAY)).toBe(
      "THIS WEEKEND IN MPLS - AUGUST 8TH-9TH",
    );
    expect(headerFor("friday", "family", FRIDAY)).toBe(
      "THIS WEEKEND WITH KIDS - AUGUST 8TH-9TH",
    );
    expect(headerFor("friday", "weird", FRIDAY)).toBe(
      "YOUR WEEKEND JUST GOT INTERESTING - AUGUST 8TH-9TH",
    );
  });

  it("names both months across a month boundary", () => {
    expect(headerFor("monday", "regular", CROSS_MONTH)).toBe(
      "THIS WEEK IN MPLS - AUGUST 31ST-SEPTEMBER 4TH",
    );
  });
});

describe("CTA_LINE", () => {
  it("is the exact live CTA row", () => {
    expect(CTA_LINE).toBe("FULL GUIDE AT CITYPULSEMN.COM");
  });
});

describe("detailsLine — golden lines", () => {
  it("renders the full Venue, City · Day · Time · Price form", () => {
    expect(detailsLine(ev(), FRIDAY)).toBe(
      "First Avenue, Minneapolis · Sat · 6:40 PM · $25",
    );
  });

  it("drops :00 minutes from on-the-hour times", () => {
    expect(detailsLine(ev({ startAt: "2026-08-08T10:00:00-05:00" }), FRIDAY)).toBe(
      "First Avenue, Minneapolis · Sat · 10 AM · $25",
    );
  });

  it("renders a same-day time range", () => {
    const line = detailsLine(
      ev({ startAt: "2026-08-08T10:00:00-05:00", endAt: "2026-08-08T16:00:00-05:00" }),
      FRIDAY,
    );
    expect(line).toBe("First Avenue, Minneapolis · Sat · 10 AM–4 PM · $25");
  });

  it("says All Day only when the DB attests it", () => {
    expect(
      detailsLine(ev({ startAt: "2026-08-08T00:00:00-05:00", allDay: true }), FRIDAY),
    ).toBe("First Avenue, Minneapolis · Sat · All Day · $25");
  });

  it("omits the time for an unattested midnight start — unknown is not All Day", () => {
    // Web top-up rows with no known time arrive as T00:00; "All Day" there
    // would be an invented fact (it reached a live card on 2026-10-05).
    expect(detailsLine(ev({ startAt: "2026-08-08T00:00:00-05:00" }), FRIDAY)).toBe(
      "First Avenue, Minneapolis · Sat · $25",
    );
  });

  it("skips the city when the venue already names it", () => {
    const line = detailsLine(
      ev({ venue: "Minneapolis Institute of Art", city: "Minneapolis" }),
      FRIDAY,
    );
    expect(line).toBe("Minneapolis Institute of Art · Sat · 6:40 PM · $25");
  });
});

describe("detailsLine — day logic", () => {
  it("says Sat & Sun for a weekend-spanning event in a friday window", () => {
    const line = detailsLine(
      ev({ startAt: "2026-08-08T10:00:00-05:00", endAt: "2026-08-09T16:00:00-05:00" }),
      FRIDAY,
    );
    expect(line).toBe("First Avenue, Minneapolis · Sat & Sun · 10 AM · $25");
  });

  it("keeps the start day for a 2-day span in a monday window", () => {
    const line = detailsLine(
      ev({ startAt: "2026-08-03T19:00:00-05:00", endAt: "2026-08-04T21:00:00-05:00" }),
      MONDAY,
    );
    expect(line).toContain(" · Mon · ");
  });

  // end_at is agent-supplied and unverified: a one-off parade with a stray
  // multi-day end_at once printed "Daily". The label is the start day, always.
  it("never says Weekdays, even when end_at spans the whole Mon–Fri window", () => {
    const line = detailsLine(
      ev({ startAt: "2026-08-03T09:00:00-05:00", endAt: "2026-08-07T17:00:00-05:00" }),
      MONDAY,
    );
    expect(line).toContain(" · Mon · ");
    expect(line).not.toMatch(/Weekdays|Daily/);
  });

  it("never says Daily for a multi-day end_at — start day only", () => {
    const line = detailsLine(
      ev({ startAt: "2026-08-04T09:00:00-05:00", endAt: "2026-08-06T17:00:00-05:00" }),
      MONDAY,
    );
    expect(line).toContain(" · Tue · ");
    expect(line).not.toMatch(/Weekdays|Daily/);
  });

  it("Sat & Sun needs a Saturday start ending exactly Sunday — not any weekend multi-day", () => {
    // Saturday start, end_at on Monday: the span is unattested → start day.
    expect(
      detailsLine(
        ev({ startAt: "2026-08-08T10:00:00-05:00", endAt: "2026-08-10T16:00:00-05:00" }),
        FRIDAY,
      ),
    ).toContain(" · Sat · ");
    // Sunday start running into Monday is not "Sat & Sun".
    expect(
      detailsLine(
        ev({ startAt: "2026-08-09T10:00:00-05:00", endAt: "2026-08-10T16:00:00-05:00" }),
        FRIDAY,
      ),
    ).toContain(" · Sun · ");
  });
});

describe("detailsLine — Free is only printed when the price says so unconditionally", () => {
  it("prints Free for plain free price text", () => {
    for (const price of ["Free", "free admission", "Free (donations appreciated)", "$0"]) {
      expect(detailsLine(ev({ price, priceTier: "Free" }), FRIDAY)).toMatch(/ · Free$/);
    }
  });

  it("falls to the floor for conditionally-free prices the tier calls Free", () => {
    for (const price of [
      '$18; children under 36" free',
      "$15 adults; children under 9 free",
      "Free with museum admission",
      "Free admission; fee for some activities",
      "Free (drinks priced separately)",
    ]) {
      const line = detailsLine(ev({ price, priceTier: "Free" }), FRIDAY);
      expect(line).not.toMatch(/ · Free$/);
      expect(line).toMatch(/ · Check site$/);
    }
  });
});

describe("detailsLine — shortened venues still read as names", () => {
  it("cuts at a natural separator and never leaves a dangling connector", () => {
    const cases: [string, string][] = [
      ["Lowell Park & Downtown Stillwater Riverfront Plaza", "Lowell Park"],
      ["Hennepin Avenue (W. 26th to 36th Streets) Uptown Corridor", "Hennepin Avenue"],
      ["Nickelodeon Universe at Mall of America Bloomington", "Nickelodeon Universe"],
      ["Huntington Bank Rotunda, Mall of America Bloomington", "Huntington Bank Rotunda"],
      ["Downtown Anoka - Main Street Historic District", "Downtown Anoka"],
    ];
    for (const [venue, expected] of cases) {
      const line = detailsLine(
        ev({ venue, city: "Somewhere", startAt: "2026-08-08T10:00:00-05:00", endAt: "2026-08-08T23:30:00-05:00" }),
        FRIDAY,
      );
      expect(line.startsWith(`${expected} · `)).toBe(true);
    }
  });
});

describe("detailsLine — price forms", () => {
  it("Free tier renders Free", () => {
    expect(detailsLine(ev({ price: "Free", priceTier: "Free" }), FRIDAY)).toMatch(
      /· Free$/,
    );
  });

  it('"from $X" text renders From $X', () => {
    expect(
      detailsLine(ev({ price: "Tickets from $15", priceTier: "$$" }), FRIDAY),
    ).toMatch(/· From \$15$/);
  });

  it("a bare dollar amount passes through", () => {
    expect(detailsLine(ev({ price: "$12" }), FRIDAY)).toMatch(/· \$12$/);
  });

  it("empty or unrecognized price renders Check site — never invented", () => {
    expect(detailsLine(ev({ price: "" }), FRIDAY)).toMatch(/· Check site$/);
    expect(detailsLine(ev({ price: "donations welcome" }), FRIDAY)).toMatch(
      /· Check site$/,
    );
  });
});

describe("detailsLine — shortening cascade", () => {
  it("step 1: drops the city when the full line overruns the target", () => {
    const line = detailsLine(ev({ venue: "The Cedar Cultural Center" }), FRIDAY);
    expect(line).toBe("The Cedar Cultural Center · Sat · 6:40 PM · $25");
    expect(line.length).toBeLessThanOrEqual(DETAILS_TARGET);
  });

  it("step 3: truncates the venue to its first 3 words", () => {
    const line = detailsLine(
      ev({ venue: "Great Northern Aleworks Barrel Room and Patio" }),
      FRIDAY,
    );
    expect(line).toBe("Great Northern Aleworks · Sat · 6:40 PM · $25");
  });

  it("step 4: collapses the time range to the start time as a last resort", () => {
    const line = detailsLine(
      ev({
        venue: "Minnesota Landscape Arboretum",
        city: "Chaska",
        startAt: "2026-08-08T10:00:00-05:00",
        endAt: "2026-08-08T16:00:00-05:00",
        price: "",
      }),
      FRIDAY,
    );
    // Over target but under the hard cap — best effort, range collapsed.
    expect(line).toBe("Minnesota Landscape Arboretum · Sat · 10 AM · Check site");
    expect(line.length).toBeGreaterThan(DETAILS_TARGET);
    expect(line.length).toBeLessThanOrEqual(DETAILS_HARD_CAP);
  });

  it("hard cap: clips the venue itself rather than ever touching the price", () => {
    const line = detailsLine(
      ev({
        venue:
          "Supercalifragilisticexpialidocious Antidisestablishmentarianism Floccinaucinihilipilification",
      }),
      FRIDAY,
    );
    expect(line.length).toBeLessThanOrEqual(DETAILS_HARD_CAP);
    expect(line).toContain("…");
    expect(line).toMatch(/· \$25$/);
  });

  it("the price survives every cascade stage, always last", () => {
    const stages = [
      ev(), // no shortening
      ev({ venue: "The Cedar Cultural Center" }), // city dropped
      ev({ venue: "Great Northern Aleworks Barrel Room and Patio" }), // venue truncated
      ev({
        venue: "Minnesota Landscape Arboretum",
        city: "Chaska",
        startAt: "2026-08-08T10:00:00-05:00",
        endAt: "2026-08-08T16:00:00-05:00",
      }), // range collapsed
      ev({
        venue:
          "Supercalifragilisticexpialidocious Antidisestablishmentarianism Floccinaucinihilipilification",
      }), // venue clipped at the hard cap
    ];
    for (const e of stages) {
      const line = detailsLine(e, FRIDAY);
      expect(line).toMatch(/ · (\$\d+|Check site)$/);
      expect(line).not.toContain("\n");
      expect(line.length).toBeLessThanOrEqual(DETAILS_HARD_CAP);
    }
  });
});

describe("detailsLine — honest emptiness", () => {
  it("empty venue falls back to the city, never an invented name", () => {
    expect(detailsLine(ev({ venue: "" }), FRIDAY)).toBe(
      "Minneapolis · Sat · 6:40 PM · $25",
    );
  });

  it("empty venue and city yields day/time/price only", () => {
    expect(detailsLine(ev({ venue: "", city: "" }), FRIDAY)).toBe(
      "Sat · 6:40 PM · $25",
    );
  });
});
