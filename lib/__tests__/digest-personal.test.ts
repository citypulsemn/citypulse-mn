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
    now: NOW, weekLabel: "July 15–21",
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

describe("selectSavedUpcoming — send-morning boundary (R1.4, rule 10)", () => {
  it("a saved event later on send day survives the Thursday 10 AM CT send", () => {
    const sendMorning = new Date("2026-07-16T15:00:00Z"); // 10 AM CDT
    const saved = [
      ev({ id: "today1pm", start: "2026-07-16T13:00" }), // old code dropped this
      // "arts", not the helper's default "music": PER_NIGHT = {sports, music},
      // so staleSpanIds deletes a music row carrying a multiDayEnd.
      ev({ id: "run", category: "arts", start: "2026-07-01T10:00", multiDayEnd: "2026-07-20T23:59" }),
      ev({ id: "over", category: "arts", start: "2026-07-01T10:00", multiDayEnd: "2026-07-15T23:59" }),
    ];
    // ORDER CHANGED 6 Nov 2026, deliberately. This pinned ["run", "today1pm"]:
    // the run opened on 1 July, so a start-ascending sort put it at the head of
    // a block headed "happening this week", ahead of the 1 PM event today.
    expect(selectSavedUpcoming(saved, sendMorning).map((e) => e.id)).toEqual(["today1pm", "run"]);
  });
});

describe("selectSavedUpcoming — runs never outrank what is happening (6 Nov 2026)", () => {
  const sendMorning = new Date("2026-07-16T15:00:00Z"); // Thu 10 AM CDT
  const run = (id: string, start: string, end: string) =>
    ev({ id, category: "arts", start, multiDayEnd: end });

  it("dated events lead, runs follow, ending-soonest first", () => {
    const saved = [
      run("closes-later", "2026-05-01T10:00", "2026-09-30T23:59"),
      run("closes-sooner", "2026-05-01T10:00", "2026-07-20T23:59"),
      ev({ id: "sat", start: "2026-07-18T20:00" }),
      ev({ id: "today", start: "2026-07-16T13:00" }),
    ];
    expect(selectSavedUpcoming(saved, sendMorning).map((e) => e.id)).toEqual([
      "today",
      "sat",
      "closes-sooner",
      "closes-later",
    ]);
  });

  it("a run no longer evicts a dated event at the cap of five", () => {
    // PERSONAL_MAX_SAVED = 5. Six qualifying rows, one a run that opened in
    // May: the run used to take slot 1 and push the last dated row out.
    const saved = [
      run("exhibition", "2026-05-23T10:00", "2027-01-10T23:59"),
      ...["16T13:00", "17T19:00", "18T20:00", "19T15:00", "20T19:00"].map((d, i) =>
        ev({ id: "d" + i, start: "2026-07-" + d }),
      ),
    ];
    const out = selectSavedUpcoming(saved, sendMorning).map((e) => e.id);
    expect(out).toHaveLength(PERSONAL_MAX_SAVED);
    expect(out).toEqual(["d0", "d1", "d2", "d3", "d4"]);
    expect(out).not.toContain("exhibition");
  });

  it("but a run still leads when nothing is dated — rule 6, not an exclusion", () => {
    const saved = [run("only-thing", "2026-05-23T10:00", "2027-01-10T23:59")];
    expect(selectSavedUpcoming(saved, sendMorning).map((e) => e.id)).toEqual(["only-thing"]);
  });
});
