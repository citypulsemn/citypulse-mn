import { describe, it, expect } from "vitest";
import {
  actionFor,
  selectForVerification,
  parseVerdicts,
  batchForVerification,
} from "../verify";
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
    const picked = selectForVerification(list, NOW);
    expect(picked.map((e) => e.id)).toEqual(["tonight", "sun"]);
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
    expect(selectForVerification([sneaky], runnerNow)).toEqual([]);
  });
});
