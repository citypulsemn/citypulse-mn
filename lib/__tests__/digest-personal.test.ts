import { describe, it, expect } from "vitest";
import {
  selectSavedUpcoming,
  categoryAffinity,
  personalizePicks,
  PERSONAL_MAX_SAVED,
} from "../digest-personal";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-15T09:00:00-05:00");

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Show", category: "music", venue: "First Avenue", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-17T20:00", end: "", price: "$20", priceTier: "$$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: null, allDay: false,
    ...overrides,
  };
}

describe("selectSavedUpcoming — a reminder beats a recommendation", () => {
  it("keeps this week's saved events, soonest first", () => {
    const saved = [
      ev({ id: "sun", start: "2026-07-19T19:00" }),
      ev({ id: "tonight", start: "2026-07-15T20:00" }),
      ev({ id: "aug", start: "2026-08-10T20:00" }), // outside the week
      ev({ id: "past", start: "2026-07-10T20:00" }), // already happened
    ];
    expect(selectSavedUpcoming(saved, NOW).map((e) => e.id)).toEqual(["tonight", "sun"]);
  });

  it("an ongoing multi-day run they saved still counts — they can still go", () => {
    const fair = ev({ id: "fair", start: "2026-07-10T09:00", multiDayEnd: "2026-07-20T23:59" });
    expect(selectSavedUpcoming([fair], NOW).map((e) => e.id)).toEqual(["fair"]);
  });

  it("drops cancelled/draft saves and caps the list", () => {
    const saved = [
      ev({ id: "c", start: "2026-07-16T19:00", status: "cancelled" }),
      ...Array.from({ length: 8 }, (_, i) => ev({ id: `s${i}`, start: `2026-07-1${6 + (i % 3)}T19:00` })),
    ];
    const out = selectSavedUpcoming(saved, NOW);
    expect(out).toHaveLength(PERSONAL_MAX_SAVED);
    expect(out.some((e) => e.id === "c")).toBe(false);
  });

  it("no saves → empty (the digest degrades to standard)", () => {
    expect(selectSavedUpcoming([], NOW)).toEqual([]);
  });
});

describe("categoryAffinity — taste is long-lived", () => {
  it("ranks categories by save count", () => {
    const saved = [
      ev({ category: "music" }), ev({ category: "music" }), ev({ category: "music" }),
      ev({ category: "food" }),
      ev({ category: "arts" }), ev({ category: "arts" }),
    ];
    expect(categoryAffinity(saved)).toEqual(["music", "arts", "food"]);
  });

  it("only saved categories appear; ties keep canonical order (stable)", () => {
    const saved = [ev({ category: "sports" }), ev({ category: "music" })];
    // music before sports in CATEGORY_KEYS ⇒ tie resolves that way, deterministically
    expect(categoryAffinity(saved)).toEqual(["music", "sports"]);
  });
});

describe("personalizePicks — same curation, their taste first", () => {
  const picks = [
    ev({ id: "f1", category: "festival" }),
    ev({ id: "m1", category: "music" }),
    ev({ id: "f2", category: "festival" }),
    ev({ id: "m2", category: "music" }),
    ev({ id: "a1", category: "arts" }),
  ];

  it("moves affinity categories to the front, preserving order within each", () => {
    const out = personalizePicks(picks, ["music", "arts"]);
    expect(out.map((e) => e.id)).toEqual(["m1", "m2", "a1", "f1", "f2"]);
  });

  it("drops events already shown in the personal section (no double-feature)", () => {
    const out = personalizePicks(picks, ["music"], [picks[1]]); // m1 already shown
    expect(out.map((e) => e.id)).toEqual(["m2", "f1", "f2", "a1"]);
  });

  it("no affinity → picks unchanged (standard digest)", () => {
    expect(personalizePicks(picks, []).map((e) => e.id)).toEqual(["f1", "m1", "f2", "m2", "a1"]);
  });
});

// ── Render integration ─────────────────────────────────────────────────────
import { renderDigestEmail } from "../digest";

describe("renderDigestEmail with a personal section", () => {
  const base = {
    weekLabel: "July 15–21",
    unsubscribeUrl: "https://citypulsemn.com/unsubscribe?id=1&t=x",
    siteUrl: "https://citypulsemn.com",
  };
  const picks = [ev({ id: "p1", title: "General Pick One" }), ev({ id: "p2", title: "General Pick Two" })];

  it("leads with the saved section and retitles the subject", () => {
    const saved = [ev({ id: "s1", title: "Trampled by Turtles at First Ave" })];
    const { subject, html, text } = renderDigestEmail({ ...base, events: picks, savedThisWeek: saved });
    expect(subject).toBe('You saved "Trampled by Turtles at First Ave" — happening this week');
    expect(html).toContain("You saved these — happening this week");
    expect(html).toContain("Also worth your time");
    expect(html.indexOf("Trampled by Turtles")).toBeLessThan(html.indexOf("General Pick One"));
    expect(text).toContain("Trampled by Turtles");
  });

  it("plural subject for several saves", () => {
    const saved = [ev({ id: "s1" }), ev({ id: "s2" })];
    const { subject } = renderDigestEmail({ ...base, events: picks, savedThisWeek: saved });
    expect(subject).toBe("You saved 2 events — happening this week");
  });

  it("no saved events ⇒ byte-identical to the standard digest", () => {
    const standard = renderDigestEmail({ ...base, events: picks });
    const withEmpty = renderDigestEmail({ ...base, events: picks, savedThisWeek: [] });
    expect(withEmpty.html).toBe(standard.html);
    expect(withEmpty.subject).toBe(standard.subject);
    expect(standard.html).not.toContain("You saved these");
  });
});
