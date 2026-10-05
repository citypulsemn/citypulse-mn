import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLACES,
  openNow,
  placeOfTheWeek,
  placeForWeek,
  placeWeekOf,
  placeSlot,
  inPrimeSeason,
  PLACE_OF_WEEK_PIN,
  PLACE_WHEEL_WEEKS,
  PLACE_FLOOR_WEEKS,
  PLACE_SEASON_EDGE,
  type Place,
  type PlaceKind,
} from "../places";

/**
 * PLACE OF THE WEEK — the rotation rebuilt in Oct 2026.
 *
 * The first rotation passed its tests and was wrong in production: four sample
 * dates can't see a pool of two places alternating through November. So the
 * heart of this file is a SIMULATION — every Thursday for ten years against the
 * real registry — and the assertions on it are the ones that stay true however
 * the registry grows. Registry-shaped numbers (how often, what share) get a
 * bound with room in it, never an exact count.
 */

const DAY = 86_400_000;
// Noon UTC is early morning in Chicago on the same calendar day.
const at = (isoDay: string) => new Date(`${isoDay}T12:00:00Z`);
const weekOf = (isoDay: string) => placeWeekOf(at(isoDay));
const thursdayOf = (week: number) => new Date(week * 7 * DAY).toISOString().slice(0, 10);

function simulate(fromDay: string, weeks: number, places?: Place[]) {
  const first = weekOf(fromDay);
  return Array.from({ length: weeks }, (_, i) => ({
    week: first + i,
    day: thursdayOf(first + i),
    place: placeForWeek(first + i, places)!,
  }));
}

/** Every return visit in a run, as the number of weeks since that place's last one. */
function returnGaps(run: { week: number; place: Place }[]) {
  const last = new Map<string, number>();
  const gaps: { slug: string; kind: PlaceKind; gap: number }[] = [];
  for (const { week, place } of run) {
    const before = last.get(place.slug);
    if (before !== undefined) gaps.push({ slug: place.slug, kind: place.kind, gap: week - before });
    last.set(place.slug, week);
  }
  return gaps;
}

// The first send after this shipped, then every Thursday after it.
const YEAR = simulate("2026-10-08", 52);
const DECADE = simulate("2026-10-08", 520);

const withSeason = (season: Place["season"]): Place => ({ ...PLACES[0], slug: "synthetic", season });
const SUMMER = withSeason({ type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" });
const WINTER = withSeason({ type: "seasonal", openMonth: 12, closeMonth: 2, label: "December–February" });
const FALL = withSeason({ type: "seasonal", openMonth: 9, closeMonth: 10, label: "September–October" });

describe("place of the week — the knobs", () => {
  it("ships with automatic rotation (no manual pin)", () => {
    expect(PLACE_OF_WEEK_PIN).toBeNull();
  });

  it("the wheel is longer than a year, a multiple of the floor, and both are odd", () => {
    expect(PLACE_WHEEL_WEEKS).toBeGreaterThan(52);
    expect(PLACE_WHEEL_WEEKS % PLACE_FLOOR_WEEKS).toBe(0);
    // Odd, so a place's turns alternate between the seasonal and year-round
    // lanes. On an even wheel half the registry could never be picked.
    expect(PLACE_WHEEL_WEEKS % 2).toBe(1);
    expect(PLACE_FLOOR_WEEKS % 2).toBe(1);
  });

  it("the season trim leaves a middle to feature", () => {
    expect(PLACE_SEASON_EDGE).toBeGreaterThan(0);
    expect(PLACE_SEASON_EDGE).toBeLessThan(0.5);
  });
});

describe("placeWeekOf — the week the rotation runs on", () => {
  it("turns over on Thursday in the Chicago frame, not UTC", () => {
    const wedNight = placeWeekOf(new Date("2026-07-15T23:30:00-05:00"));
    const thuMorning = placeWeekOf(new Date("2026-07-16T00:30:00-05:00"));
    const nextWedNight = placeWeekOf(new Date("2026-07-22T23:30:00-05:00"));
    expect(thuMorning).toBe(wedNight + 1);
    expect(nextWedNight).toBe(thuMorning);
  });

  it("advances by exactly one per weekly send", () => {
    expect(weekOf("2026-10-15")).toBe(weekOf("2026-10-08") + 1);
    expect(YEAR.at(-1)!.week - YEAR[0].week).toBe(51);
  });
});

describe("inPrimeSeason — only the settled middle of a season", () => {
  it("a year-round place is always in", () => {
    const museum = withSeason({ type: "year-round" });
    for (const day of ["2026-01-15", "2026-05-01", "2026-07-16", "2026-11-12"]) {
      expect(inPrimeSeason(museum, weekOf(day)), day).toBe(true);
    }
  });

  it("the two dates from the bug report: no beach on 1 May or 25 September", () => {
    expect(inPrimeSeason(SUMMER, weekOf("2026-05-01"))).toBe(false);
    expect(inPrimeSeason(SUMMER, weekOf("2026-09-25"))).toBe(false);
  });

  it("summer (May–Sep on paper) is featured from the first Thursday of June to the last before Labor Day week", () => {
    expect(inPrimeSeason(SUMMER, weekOf("2026-05-28"))).toBe(false); // 27 days in
    expect(inPrimeSeason(SUMMER, weekOf("2026-06-04"))).toBe(true);
    expect(inPrimeSeason(SUMMER, weekOf("2026-08-20"))).toBe(true); // week ends 26 Aug
    expect(inPrimeSeason(SUMMER, weekOf("2026-08-27"))).toBe(false); // week runs into September
  });

  it("a winter season that wraps the new year is trimmed at both ends, across the year boundary", () => {
    expect(inPrimeSeason(WINTER, weekOf("2026-12-17"))).toBe(false);
    expect(inPrimeSeason(WINTER, weekOf("2026-12-24"))).toBe(true);
    expect(inPrimeSeason(WINTER, weekOf("2027-01-14"))).toBe(true); // opened the year before
    expect(inPrimeSeason(WINTER, weekOf("2027-02-04"))).toBe(true);
    expect(inPrimeSeason(WINTER, weekOf("2027-02-11"))).toBe(false);
    expect(inPrimeSeason(WINTER, weekOf("2026-07-16"))).toBe(false);
  });

  it("a leap-year February closes on the 29th", () => {
    expect(inPrimeSeason(WINTER, weekOf("2028-02-03"))).toBe(true);
    expect(inPrimeSeason(WINTER, weekOf("2028-02-10"))).toBe(false);
  });

  it("a two-month season still has a middle (orchards: mid-September to mid-October)", () => {
    expect(inPrimeSeason(FALL, weekOf("2026-09-10"))).toBe(false);
    expect(inPrimeSeason(FALL, weekOf("2026-09-17"))).toBe(true);
    expect(inPrimeSeason(FALL, weekOf("2026-10-08"))).toBe(true);
    expect(inPrimeSeason(FALL, weekOf("2026-10-15"))).toBe(false);
  });

  it("prime is always inside the open season — all seven days of the week, for every season in the registry", () => {
    const seasons = new Map<string, Place>();
    for (const p of PLACES) {
      if (p.season.type === "seasonal") seasons.set(`${p.season.openMonth}-${p.season.closeMonth}`, p);
    }
    expect(seasons.size).toBeGreaterThan(0);
    for (const p of seasons.values()) {
      let primeWeeks = 0;
      for (let week = weekOf("2026-10-08"); week < weekOf("2026-10-08") + 104; week++) {
        if (!inPrimeSeason(p, week)) continue;
        primeWeeks++;
        for (let d = 0; d < 7; d++) {
          const day = new Date(week * 7 * DAY + d * DAY + DAY / 2);
          expect(openNow(p, day), `${p.slug} ${day.toISOString()}`).toBe(true);
        }
      }
      // Every season has a prime, or its places could never be featured at all.
      expect(primeWeeks, p.slug).toBeGreaterThan(0);
    }
  });
});

describe("the rotation, simulated against the real registry", () => {
  it("every week of the year features a real place that is open all week and in prime season", () => {
    for (const { week, day, place } of YEAR) {
      expect(place, day).toBeTruthy();
      expect(PLACES).toContain(place);
      expect(inPrimeSeason(place, week), `${place.slug} ${day}`).toBe(true);
      for (let d = 0; d < 7; d++) {
        expect(openNow(place, new Date(week * 7 * DAY + d * DAY + DAY / 2)), `${place.slug} ${day}+${d}`).toBe(true);
      }
    }
  });

  it("a full year of sends never features the same place two weeks running", () => {
    for (let i = 1; i < YEAR.length; i++) {
      expect(YEAR[i].place.slug, YEAR[i].day).not.toBe(YEAR[i - 1].place.slug);
    }
  });

  it("across ten years no place returns inside the floor, and every return lands on its own slot", () => {
    const gaps = returnGaps(DECADE);
    expect(gaps.length).toBeGreaterThan(0); // 520 sends from a few hundred places: some do return
    for (const { slug, gap } of gaps) {
      expect(gap, slug).toBeGreaterThanOrEqual(PLACE_FLOOR_WEEKS);
      // The structural signature of the wheel: a place only ever appears on
      // weeks congruent to its slot, so its visits are whole turns apart.
      expect(gap % PLACE_FLOOR_WEEKS, slug).toBe(0);
    }
  });

  it("a return inside a year is the rare exception (under 2% of sends)", () => {
    const early = returnGaps(DECADE).filter((g) => g.gap < 52);
    expect(early.length / DECADE.length).toBeLessThan(0.02);
  });

  it("a short-season place is never featured twice in one season", () => {
    const shortSeason: PlaceKind[] = ["beach", "splash-pad", "sledding", "ski-hill", "orchard", "golf-course"];
    for (const g of returnGaps(DECADE).filter((g) => shortSeason.includes(g.kind))) {
      expect(g.gap, g.slug).toBeGreaterThan(30);
    }
  });

  it("never the same kind two weeks running, in ten years", () => {
    for (let i = 1; i < DECADE.length; i++) {
      expect(DECADE[i].place.kind, DECADE[i].day).not.toBe(DECADE[i - 1].place.kind);
    }
  });

  it("the same kind two weeks apart is rare (under 5% of sends)", () => {
    let echoes = 0;
    for (let i = 2; i < DECADE.length; i++) {
      if (DECADE[i].place.kind === DECADE[i - 2].place.kind) echoes++;
    }
    expect(echoes / DECADE.length).toBeLessThan(0.05);
  });

  it("year-round places are featured in every month, and carry the thin ones", () => {
    const share = (month: string) => {
      const sends = DECADE.filter((s) => s.day.slice(5, 7) === month);
      return sends.filter((s) => s.place.season.type === "year-round").length / sends.length;
    };
    for (let m = 1; m <= 12; m++) {
      const month = String(m).padStart(2, "0");
      expect(share(month), `month ${month}`).toBeGreaterThanOrEqual(1 / 3);
    }
    // Nothing seasonal is in prime in these three; the old picker filled
    // November with two places.
    for (const month of ["03", "04", "11"]) expect(share(month), `month ${month}`).toBeGreaterThan(0.9);
  });

  it("still tied to the season: a real share of January and high summer is in-season picks", () => {
    for (const month of ["01", "06", "07", "08"]) {
      const sends = DECADE.filter((s) => s.day.slice(5, 7) === month);
      const seasonal = sends.filter((s) => s.place.season.type === "seasonal").length;
      expect(seasonal / sends.length, `month ${month}`).toBeGreaterThan(0.2);
    }
  });

  it("a Memorial Day–Labor Day place is only ever featured in June, July or August", () => {
    const summer = DECADE.filter(
      (s) => s.place.season.type === "seasonal" && s.place.season.label === "Memorial Day–Labor Day",
    );
    expect(summer.length).toBeGreaterThan(0);
    for (const s of summer) expect(["06", "07", "08"], `${s.place.slug} ${s.day}`).toContain(s.day.slice(5, 7));
  });

  it("November 2026 — the month that alternated two places — is four different places", () => {
    const november = YEAR.filter((s) => s.day.startsWith("2026-11"));
    expect(november.map((s) => s.day)).toEqual(["2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26"]);
    expect(new Set(november.map((s) => s.place.slug)).size).toBe(4);
  });

  it("late February into March 2027 — the back-to-back repeat — is two different places", () => {
    const feb = YEAR.find((s) => s.day === "2027-02-25")!;
    const mar = YEAR.find((s) => s.day === "2027-03-04")!;
    expect(feb.place.slug).not.toBe(mar.place.slug);
  });

  it("April 2027 — five golf courses in a row — is five places and no golf (the courses aren't in prime until mid-May)", () => {
    const april = YEAR.filter((s) => s.day.startsWith("2027-04"));
    expect(april).toHaveLength(5);
    expect(new Set(april.map((s) => s.place.slug)).size).toBe(5);
    expect(april.map((s) => s.place.kind)).not.toContain("golf-course");
  });

  it("every pick lands on its own slot — the last-resort tiers never fire for the real registry", () => {
    // Tiers 5–6 of placeForWeek ignore the wheel. A pick that is off its own
    // floor slot could only have come from them.
    for (const { week, day, place } of DECADE) {
      expect((week - placeSlot(place)) % PLACE_FLOOR_WEEKS, `${place.slug} ${day}`).toBe(0);
    }
  });

  it("…and never can: every floor slot holds year-round places of at least three kinds", () => {
    // The floor tier refuses at most the two kinds its neighbours used, and
    // year-round places are always in prime — so three kinds per slot means it
    // always has an answer. Adding places can only deepen a slot.
    for (let slot = 0; slot < PLACE_FLOOR_WEEKS; slot++) {
      const kinds = new Set(
        PLACES.filter((p) => p.season.type === "year-round" && placeSlot(p) % PLACE_FLOOR_WEEKS === slot).map(
          (p) => p.kind,
        ),
      );
      expect(kinds.size, `floor slot ${slot}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("a year-round place off its own turn (the floor tier) is the rare exception (under 5% of sends)", () => {
    const offTurn = DECADE.filter(
      (s) => s.place.season.type === "year-round" && (s.week - placeSlot(s.place)) % PLACE_WHEEL_WEEKS !== 0,
    );
    expect(offTurn.length / DECADE.length).toBeLessThan(0.05);
  });
});

describe("placeOfTheWeek — what the digest and Admin → Content both call", () => {
  it("is the simulated pick for the week containing `now`", () => {
    expect(placeOfTheWeek(at("2026-10-08"))).toBe(YEAR[0].place);
    expect(placeOfTheWeek(at("2027-01-14"))).toBe(YEAR.find((s) => s.day === "2027-01-14")!.place);
  });

  it("is one answer for the whole week — Thursday's email and a Wednesday look at the admin page agree", () => {
    const thursday = placeOfTheWeek(new Date("2026-07-16T00:05:00-05:00"));
    const wednesday = placeOfTheWeek(new Date("2026-07-22T23:55:00-05:00"));
    expect(wednesday).toBe(thursday);
  });

  it("does not change when a month turns over mid-week (the old pool was rebuilt on the 1st)", () => {
    // Thu 29 Oct – Wed 4 Nov 2026 straddles the boundary where the old pool
    // went from 150-odd seasonal places to two.
    const october = placeOfTheWeek(new Date("2026-10-31T20:00:00-05:00"));
    const november = placeOfTheWeek(new Date("2026-11-01T08:00:00-06:00"));
    expect(november).toBe(october);
  });

  it("moves on the next Thursday", () => {
    expect(placeOfTheWeek(new Date("2026-07-23T00:05:00-05:00"))).not.toBe(
      placeOfTheWeek(new Date("2026-07-22T23:55:00-05:00")),
    );
  });

  it("both callers go through it, so the two channels cannot drift", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(read("lib/digest-send.ts")).toContain("placeOfTheWeek(now)");
    expect(read("app/admin/content/page.tsx")).toContain("placeOfTheWeek(now)");
  });
});

describe("placeForWeek on synthetic registries — the rules in isolation", () => {
  const KINDS = Object.freeze([
    "museum", "park", "playground", "nature-center", "disc-golf", "dog-park",
    "garden", "pool", "rink", "indoor-playground", "trampoline-climbing", "music-venue",
  ] as PlaceKind[]);
  const mk = (slug: string, kind: PlaceKind, season: Place["season"] = { type: "year-round" }): Place => ({
    ...PLACES[0],
    slug,
    kind,
    season,
  });
  // Deep enough that every week has candidates on their own turn: ~10 per slot.
  const EVERGREENS = Array.from({ length: 600 }, (_, i) => mk(`evergreen-${i}`, KINDS[i % KINDS.length]));
  const SLEDDING = Array.from({ length: 120 }, (_, i) =>
    mk(`hill-${i}`, "sledding", { type: "seasonal", openMonth: 12, closeMonth: 2, label: "December–February" }),
  );
  const WEEK0 = weekOf("2026-10-08");

  it("honest emptiness: an empty registry is null, not a placeholder", () => {
    expect(placeForWeek(WEEK0, [])).toBeNull();
  });

  it("honest emptiness: a beach in January, or in the first week of its own season, is null", () => {
    const beach = [mk("lone-beach", "beach", SUMMER.season)];
    expect(placeForWeek(weekOf("2027-01-14"), beach)).toBeNull();
    expect(openNow(beach[0], at("2027-05-06"))).toBe(true); // open on paper…
    expect(placeForWeek(weekOf("2027-05-06"), beach)).toBeNull(); // …and not featured yet
    expect(placeForWeek(weekOf("2027-07-15"), beach)).toBe(beach[0]);
  });

  it("a registry of one still answers every week (something beats nothing)", () => {
    const only = [mk("only-museum", "museum")];
    for (let w = WEEK0; w < WEEK0 + 8; w++) expect(placeForWeek(w, only)).toBe(only[0]);
  });

  it("is a pure function of the week: same week, same registry, same answer", () => {
    expect(placeForWeek(WEEK0 + 7, EVERGREENS)).toBe(placeForWeek(WEEK0 + 7, EVERGREENS));
  });

  it("with enough to choose from, any three consecutive weeks are three different kinds", () => {
    const run = simulate("2026-10-08", 300, EVERGREENS);
    for (let i = 2; i < run.length; i++) {
      const kinds = new Set([run[i - 2].place.kind, run[i - 1].place.kind, run[i].place.kind]);
      expect(kinds.size, run[i].day).toBe(3);
    }
  });

  it("a year-round place cannot return for a full wheel", () => {
    const gaps = returnGaps(simulate("2026-10-08", 400, EVERGREENS));
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.gap, g.slug).toBeGreaterThanOrEqual(PLACE_WHEEL_WEEKS);
      expect(g.gap % PLACE_WHEEL_WEEKS, g.slug).toBe(0);
    }
  });

  it("lanes: in-season picks land on even weeks, only in prime, and never the same hill twice in a winter", () => {
    const registry = [...EVERGREENS, ...SLEDDING];
    const run = simulate("2026-10-08", 260, registry);
    const hills = run.filter((s) => s.place.kind === "sledding");
    expect(hills.length).toBeGreaterThanOrEqual(5); // five winters, at least one hill each
    for (const s of hills) {
      expect(s.week % 2, s.day).toBe(0);
      expect(inPrimeSeason(s.place, s.week), s.day).toBe(true);
    }
    for (const g of returnGaps(run).filter((g) => g.kind === "sledding")) expect(g.gap, g.slug).toBeGreaterThan(30);
    // …and the odd weeks of those same winters stay year-round.
    const januaries = run.filter((s) => s.day.slice(5, 7) === "01" && s.week % 2 === 1);
    for (const s of januaries) expect(s.place.season.type, s.day).toBe("year-round");
  });

  it("adding places never moves anyone else's slot", () => {
    // The property that makes the no-repeat guarantee survive a registry sweep:
    // a place's turn depends on its own slug and nothing else. Fifty arrivals
    // may win weeks, but every original place still lands on the same slot.
    const before = simulate("2026-10-08", 300, EVERGREENS);
    const arrivals = Array.from({ length: 50 }, (_, i) => mk(`arrival-${i}`, KINDS[(i * 5) % KINDS.length]));
    const after = simulate("2026-10-08", 300, [...EVERGREENS, ...arrivals]);
    const slotOf = new Map<string, number>();
    for (const { week, place } of [...before, ...after]) {
      const slot = week % PLACE_WHEEL_WEEKS;
      expect(slotOf.get(place.slug) ?? slot, place.slug).toBe(slot);
      slotOf.set(place.slug, slot);
    }
    expect(after.some((s) => s.place.slug.startsWith("arrival-"))).toBe(true);
  });
});
