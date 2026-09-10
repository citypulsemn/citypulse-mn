import { describe, it, expect } from "vitest";
import {
  actionFor,
  selectForVerification,
  parseVerdicts,
  batchForVerification,
  withinBudget,
  DEFAULT_CAP,
  RUN_BUDGET_MS,
  VERDICTS,
} from "../verify";
import { buildVerifyPrompt, buildResearchPrompt, buildVenueSweepPrompt } from "../agents/prompts";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-15T09:00:00-05:00");

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Show",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-17T20:00",
    end: "",
    price: "$30",
    priceTier: "$$",
    ticketUrl: "https://tickets.example/x",
    description: "",
    image: "",
    sourceUrl: "https://venue.example/cal",
    status: "published",
    multiDayEnd: null,
    ...overrides,
  };
}

describe("actionFor — THE SAFETY POLICY", () => {
  it("cancels only with evidence", () => {
    const withEvidence = actionFor({ id: "a", verdict: "cancelled", evidence: "https://venue/cancelled" });
    expect(withEvidence.kind).toBe("cancel");
  });

  it("downgrades an evidence-free cancel verdict to a flag", () => {
    const bare = actionFor({ id: "a", verdict: "cancelled" });
    expect(bare.kind).toBe("flag");
    const blank = actionFor({ id: "a", verdict: "cancelled", evidence: "   " });
    expect(blank.kind).toBe("flag");
  });

  it("NEVER cancels on a missing page — absence is not evidence", () => {
    const gone = actionFor({ id: "a", verdict: "not_found" });
    expect(gone.kind).toBe("flag");
    if (gone.kind === "flag") expect(gone.note.toLowerCase()).toContain("not cancelled");
  });

  it("never auto-applies a time change — moved is a flag for the admin", () => {
    const moved = actionFor({ id: "a", verdict: "moved", newStart: "2026-07-18T19:00" });
    expect(moved.kind).toBe("flag");
    if (moved.kind === "flag") expect(moved.note).toContain("2026-07-18T19:00");
  });

  it("confirmed stamps verification", () => {
    expect(actionFor({ id: "a", verdict: "confirmed" }).kind).toBe("confirm");
  });
});

describe("selectForVerification", () => {
  it("picks published events in the next 7 days with a source, soonest first", () => {
    const list = [
      ev({ id: "sun", start: "2026-07-19T19:00" }),
      ev({ id: "tonight", start: "2026-07-15T20:00" }),
      ev({ id: "nextMonth", start: "2026-08-20T20:00" }), // outside window
      ev({ id: "past", start: "2026-07-10T20:00" }), // already happened
      ev({ id: "draft", start: "2026-07-16T20:00", status: "draft" }),
      ev({ id: "noSource", start: "2026-07-16T21:00", sourceUrl: "", ticketUrl: "" }),
    ];
    // Window pinned to 7: this test is about WHAT gets excluded (past, draft,
    // sourceless, outside the window) and the soonest-first order. The default
    // horizon is now 92 days, which would legitimately include "nextMonth".
    const picked = selectForVerification(list, NOW, { days: 7 });
    expect(picked.map((e) => e.id)).toEqual(["tonight", "sun"]);
  });

  it("the default horizon reaches as far as the pipeline researches", () => {
    // The pipeline researches 92 days out (lib/horizon.ts) while this pass
    // looked 7. Everything in between was published and never checkable — 88%
    // of unverified events on 9 Sep 2026.
    const nextMonth = ev({ id: "nextMonth", start: "2026-08-20T20:00" });
    expect(selectForVerification([nextMonth], NOW).map((e) => e.id)).toEqual(["nextMonth"]);
  });

  it("caps the batch and keeps the soonest (tonight beats Sunday)", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      ev({ id: `e${i}`, start: `2026-07-${String(15 + (i % 6)).padStart(2, "0")}T2${i % 4}:00` }),
    );
    const picked = selectForVerification(many, NOW, { cap: 10 });
    expect(picked).toHaveLength(10);
    for (let i = 1; i < picked.length; i++) {
      expect(picked[i].start >= picked[i - 1].start).toBe(true);
    }
  });

  it("puts never-verified events ahead of already-verified ones", () => {
    // The budget bug, in miniature: two confirmed rows sit earlier in the week
    // than an unconfirmed one. Soonest-first spends both slots re-checking.
    const list = [
      { ...ev({ id: "confirmedTonight", start: "2026-07-15T20:00" }), verifiedAt: "2026-07-14T10:00:00Z" },
      { ...ev({ id: "confirmedTomorrow", start: "2026-07-16T20:00" }), verifiedAt: "2026-07-14T10:00:00Z" },
      { ...ev({ id: "neverSunday", start: "2026-07-19T19:00" }), verifiedAt: null },
    ];
    expect(selectForVerification(list, NOW, { cap: 1 }).map((e) => e.id)).toEqual(["neverSunday"]);
    expect(selectForVerification(list, NOW).map((e) => e.id)).toEqual([
      "neverSunday",
      "confirmedTonight",
      "confirmedTomorrow",
    ]);
  });

  it("still sorts soonest-first inside each group", () => {
    const list = [
      { ...ev({ id: "neverLate", start: "2026-07-19T19:00" }), verifiedAt: null },
      { ...ev({ id: "neverEarly", start: "2026-07-15T20:00" }), verifiedAt: null },
      { ...ev({ id: "seenLate", start: "2026-07-18T19:00" }), verifiedAt: "2026-07-14T10:00:00Z" },
      { ...ev({ id: "seenEarly", start: "2026-07-16T19:00" }), verifiedAt: "2026-07-14T10:00:00Z" },
    ];
    expect(selectForVerification(list, NOW).map((e) => e.id)).toEqual([
      "neverEarly",
      "neverLate",
      "seenEarly",
      "seenLate",
    ]);
  });

  it("treats a missing verifiedAt as never verified", () => {
    // Callers that don't select the column must not be silently deprioritized.
    const list = [
      { ...ev({ id: "seen", start: "2026-07-15T20:00" }), verifiedAt: "2026-07-14T10:00:00Z" },
      ev({ id: "absentField", start: "2026-07-19T19:00" }),
    ];
    expect(selectForVerification(list, NOW, { cap: 1 }).map((e) => e.id)).toEqual(["absentField"]);
  });

  it("defaults to a cap that covers a full week's window", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      ev({ id: `e${i}`, start: `2026-07-${String(15 + (i % 6)).padStart(2, "0")}T20:00` }),
    );
    // 40 covered about 25 hours of a 7-day window; 165 was the live count.
    expect(selectForVerification(many, NOW)).toHaveLength(DEFAULT_CAP);
    expect(DEFAULT_CAP).toBeGreaterThanOrEqual(165);
  });
});

describe("withinBudget", () => {
  const start = 1_000_000;

  it("allows another batch while time remains", () => {
    expect(withinBudget(start, start + 5 * 60_000, 20 * 60_000)).toBe(true);
  });

  it("stops starting batches once the budget is spent", () => {
    expect(withinBudget(start, start + 20 * 60_000, 20 * 60_000)).toBe(false);
    expect(withinBudget(start, start + 25 * 60_000, 20 * 60_000)).toBe(false);
  });

  it("leaves the Actions timeout room to be a backstop, not the stop", () => {
    // The job allows 30 minutes; the script must give up well before that so
    // the final writes land instead of being killed mid-flush.
    expect(RUN_BUDGET_MS).toBeLessThan(30 * 60_000);
  });

  it("a ticket URL qualifies when there's no source URL", () => {
    const picked = selectForVerification([ev({ id: "t", sourceUrl: "", ticketUrl: "https://tix" })], NOW);
    expect(picked.map((e) => e.id)).toEqual(["t"]);
  });
});

describe("parseVerdicts", () => {
  const valid = new Set(["a", "b", "c"]);

  it("parses a fenced JSON block and keeps known ids/verdicts", () => {
    const text = 'Checked them.\n```json\n[{"id":"a","verdict":"confirmed"},{"id":"b","verdict":"cancelled","evidence":"https://x"},{"id":"zzz","verdict":"confirmed"},{"id":"c","verdict":"maybe"}]\n```';
    const out = parseVerdicts(text, valid);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "a", verdict: "confirmed" });
    expect(out[1]).toMatchObject({ id: "b", verdict: "cancelled", evidence: "https://x" });
  });

  it("carries new_start for moved verdicts", () => {
    const out = parseVerdicts('```json\n[{"id":"a","verdict":"moved","new_start":"2026-07-18T19:00"}]\n```', valid);
    expect(out[0].newStart).toBe("2026-07-18T19:00");
  });

  it("returns [] on garbage instead of throwing", () => {
    expect(parseVerdicts("no json here", valid)).toEqual([]);
    expect(parseVerdicts('```json\n{"not":"an array"}\n```', valid)).toEqual([]);
  });
});

describe("batchForVerification", () => {
  it("chunks without losing anyone", () => {
    const events = Array.from({ length: 19 }, (_, i) => ({ id: `e${i}` }));
    const batches = batchForVerification(events, 8);
    expect(batches.map((b) => b.length)).toEqual([8, 8, 3]);
    expect(batches.flat()).toHaveLength(19);
  });
});

describe("selectForVerification — CI runner boundary (R1.6, rule 10)", () => {
  it("tonight is still verifiable on the Thursday 16:00Z runner", () => {
    // verify-events.yml runs Thu 16:00 UTC = 11:00 AM CDT. The old naive
    // window dropped everything between 11 AM and ~4 PM CT wall on run day.
    const runnerNow = new Date("2026-07-16T16:00:00Z");
    const earlyAfternoon = ev({ id: "onepm", start: "2026-07-16T13:00" });
    const out = selectForVerification([earlyAfternoon], runnerNow);
    expect(out.map((e) => e.id)).toEqual(["onepm"]);
  });
  it("events just past day 7 no longer sneak in through the shifted far edge", () => {
    const runnerNow = new Date("2026-07-16T16:00:00Z"); // wall 11:00, so far edge is 7/23 11:00 wall
    const sneaky = ev({ id: "late", start: "2026-07-23T14:00" }); // old fake-UTC edge admitted this
    // `days` is pinned because this test is about WHERE the far edge falls
    // (wall clock, not naive UTC), not about the horizon's default — which is
    // now 92 days, matching what the pipeline researches.
    expect(selectForVerification([sneaky], runnerNow, { days: 7 })).toEqual([]);
  });
});

/**
 * THE MARLEY/FILLMORE FIX (Sep 2026).
 *
 * The freshness pass CONFIRMED a fabricated event: "Damian 'Jr. Gong' Marley &
 * Stephen Marley" at The Fillmore, when the venue had Masego that night and the
 * roundup article we cited never mentioned the Marleys. `verified_at` was
 * stamped two days before a reader caught it.
 */
describe("wrong_event — the venue lists something else that night", () => {
  it("is a real verdict", () => {
    expect(VERDICTS).toContain("wrong_event");
  });

  it("FLAGS rather than hiding, and never stamps verified_at", () => {
    // The stamp is the specific failure: it made a fabricated listing look
    // trustworthy and stopped anyone looking again.
    const a = actionFor({ id: "x", verdict: "wrong_event", evidence: "Fillmore lists Masego" });
    expect(a.kind).toBe("flag");
    expect(a.kind === "flag" && a.verdict).toBe("wrong_event");
  });

  it("carries what the venue actually has into the note", () => {
    const a = actionFor({
      id: "x",
      verdict: "wrong_event",
      evidence: "The Fillmore's calendar lists Masego — Fix Your Face Tour",
    });
    expect(a.kind === "flag" && a.note).toContain("Masego");
  });

  it("still flags when the model gives no evidence, and says so", () => {
    const a = actionFor({ id: "x", verdict: "wrong_event" });
    expect(a.kind).toBe("flag");
    expect(a.kind === "flag" && a.note).toMatch(/no evidence given/);
  });

  it("does not auto-hide — one instrument is not two", () => {
    // The house standard for hiding is two instruments agreeing
    // (scripts/resolve-conflicts.ts). A support act or a renamed billing can
    // look like "a different act", and a false removal deletes a real event.
    for (const v of ["wrong_event", "not_found", "moved", "sold_out"] as const) {
      expect(actionFor({ id: "x", verdict: v }).kind).toBe("flag");
    }
  });
});

describe("parseVerdicts no longer defaults to confirmed", () => {
  const ids = new Set(["a"]);

  it("SKIPS an entry with no verdict field", () => {
    // This used to default to "confirmed", so a malformed answer stamped
    // verified_at on an event nobody had checked. Silence is not confirmation.
    expect(parseVerdicts('```json\n[{"id":"a"}]\n```', ids)).toEqual([]);
    expect(parseVerdicts('```json\n[{"id":"a","verdict":null}]\n```', ids)).toEqual([]);
    expect(parseVerdicts('```json\n[{"id":"a","verdict":123}]\n```', ids)).toEqual([]);
  });

  it("still accepts a well-formed verdict", () => {
    expect(parseVerdicts('```json\n[{"id":"a","verdict":"confirmed"}]\n```', ids)).toHaveLength(1);
    const wrong = parseVerdicts('```json\n[{"id":"a","verdict":"wrong_event","evidence":"x"}]\n```', ids);
    expect(wrong[0]).toMatchObject({ verdict: "wrong_event", evidence: "x" });
  });
});

describe("the verify prompt asks the question that catches a fabrication", () => {
  const prompt = buildVerifyPrompt([
    {
      id: "a",
      title: "Damian 'Jr. Gong' Marley & Stephen Marley",
      venue: "The Fillmore Minneapolis",
      city: "Minneapolis",
      start: "2026-09-05T19:00",
      sourceUrl: "https://www.exploreminnesota.com/events/best-fall-concerts-minneapolis-st-paul",
      ticketUrl: "",
    },
  ]);

  it("makes the venue's own calendar the authority", () => {
    expect(prompt).toMatch(/VENUE'S OWN CALENDAR/i);
    expect(prompt).toMatch(/outranks the source we cite/i);
  });

  it("says a source that does not name the event confirms nothing", () => {
    expect(prompt).toMatch(/does not actually name this event, it confirms nothing/i);
  });

  it("forbids confirming an event that was not found", () => {
    // The exact failure: the agent returned "confirmed" for an event that
    // appears in no authoritative listing anywhere.
    expect(prompt).toMatch(/NEVER "confirmed"/);
    expect(prompt).toMatch(/"confirmed" is not the safe default/i);
  });

  it("offers wrong_event and asks it to name what the venue has", () => {
    expect(prompt).toContain('"wrong_event"');
    expect(prompt).toMatch(/naming what the venue actually has/i);
  });
});

/**
 * THE YEAR-SHIFT (6 Sep 2026).
 *
 * The research agent read `exploreminnesota.com/events/best-fall-concerts-…` —
 * an EVERGREEN URL carrying the 2025 fall season — and wrote every show with the
 * current year. All 15 listings from that one article were real shows at real
 * venues on the right day of the month, in the wrong year. Seven were still live
 * a year later, including The Black Keys at The Armory "tonight".
 */
describe("the research prompts guard against a stale year", () => {
  it("the category prompt tells the agent to check the year on every page", () => {
    const p = buildResearchPrompt("music", "2026-09-06", "2026-09-13");
    expect(p).toMatch(/CHECK THE YEAR ON EVERY PAGE YOU READ/);
    expect(p).toMatch(/evergreen URLs/i);
    expect(p).toMatch(/DO NOT include the event/);
  });

  it("the category prompt says a roundup is not a schedule", () => {
    const p = buildResearchPrompt("music", "2026-09-06", "2026-09-13");
    expect(p).toMatch(/A ROUNDUP ARTICLE IS NOT A SCHEDULE/);
    // An article is only usable when it pins all three.
    expect(p).toMatch(/the full date including the year/);
  });

  it("the venue sweep carries the same guard", () => {
    const p = buildVenueSweepPrompt(
      "music",
      [{ name: "Turf Club", city: "St. Paul" }],
      "2026-09-06",
      "2026-09-13",
    );
    expect(p).toMatch(/CHECK THE YEAR/);
    expect(p).toMatch(/archive of a past season/i);
  });
});

describe("selectForVerification — riskiest source first (Sep 2026)", () => {
  const base = {
    venue: "V", city: "Minneapolis", ticketUrl: "", status: "published" as const,
  };
  const at = (id: string, start: string, sourceUrl: string, verifiedAt: string | null) => ({
    ...base, id, title: id, start, sourceUrl, verifiedAt,
  });
  // "now" is fixed; all three start comfortably inside the horizon.
  const NOW = new Date("2026-09-10T12:00:00Z");

  it("puts a never-verified ROUNDUP-sourced event ahead of a sooner never-verified one", () => {
    // The Westwood Hills listing was unverified and roundup-sourced, and sat
    // behind hundreds of other unverified rows. It is the shape that has twice
    // turned out to be fabricated, so it goes first.
    const picked = selectForVerification(
      [
        at("venue-page", "2026-09-11T19:00", "https://first-avenue.com/show/x", null),
        at("roundup", "2026-09-30T19:00", "https://bringmethenews.com/x/best-halloween", null),
      ],
      NOW,
    );
    expect(picked.map((p) => p.id)).toEqual(["roundup", "venue-page"]);
  });

  it("still puts any never-verified event ahead of a confirmed one", () => {
    const picked = selectForVerification(
      [
        at("confirmed", "2026-09-11T19:00", "https://bringmethenews.com/x", "2026-09-01"),
        at("never", "2026-09-25T19:00", "https://first-avenue.com/show/x", null),
      ],
      NOW,
    );
    expect(picked.map((p) => p.id)).toEqual(["never", "confirmed"]);
  });

  it("breaks ties by soonest within the same risk band", () => {
    const picked = selectForVerification(
      [
        at("later", "2026-09-30T19:00", "https://mspmag.com/a", null),
        at("sooner", "2026-09-12T19:00", "https://mspmag.com/b", null),
      ],
      NOW,
    );
    expect(picked.map((p) => p.id)).toEqual(["sooner", "later"]);
  });

  it("reaches past 7 days now — the backlog was invisible before", () => {
    // 88% of unverified events started more than 7 days out. Under the old
    // hardcoded 7-day window this returned nothing at all.
    const far = at("far", "2026-10-25T19:00", "https://mspmag.com/a", null);
    expect(selectForVerification([far], NOW).map((p) => p.id)).toEqual(["far"]);
    expect(selectForVerification([far], NOW, { days: 7 })).toEqual([]);
  });
});
