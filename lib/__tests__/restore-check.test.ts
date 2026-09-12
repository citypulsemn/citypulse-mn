import { describe, it, expect } from "vitest";
import {
  buildRestorePrompt,
  parseRestoreResults,
  actionForRestore,
  type RestoreItem,
  type RestoreResult,
} from "../restore-check";

const NOW = new Date("2026-09-10T12:00:00Z");
const asked = new Set(["a", "b", "c"]);
const fence = (o: unknown) => "```json\n" + JSON.stringify(o) + "\n```";
const item: RestoreItem = {
  id: "a", title: "Apple Festival", venue: "Carpenter Nature Center", city: "Hastings",
  was: "2026-09-26T10:00", evidence: "organiser lists Oct 10-11",
};

describe("buildRestorePrompt", () => {
  it("names the organiser as the authority and rules aggregators out", () => {
    const p = buildRestorePrompt([item]);
    expect(p).toContain("GO TO THE ORGANISER");
    expect(p).toMatch(/aggregator is NOT the organiser/i);
    expect(p).toContain("Apple Festival");
    expect(p).toContain("2026-09-26T10:00");
  });

  it("tells it that unclear is an acceptable answer", () => {
    // The failure that matters is a confident wrong date, not a shrug.
    expect(buildRestorePrompt([item])).toMatch(/much better than a guess/i);
  });

  it("calls out the multiple-showtimes trap by name", () => {
    // Waiting for Godot: two showtimes, the agent picked a third.
    expect(buildRestorePrompt([item])).toMatch(/MULTIPLE SHOWTIMES/);
  });
});

describe("parseRestoreResults — a guess must never reach the database", () => {
  it("takes a well-formed correction", () => {
    const r = parseRestoreResults(
      fence([{ id: "a", outcome: "corrected", start: "2026-10-10T10:00", time_confirmed: false, source_url: "https://carpenternaturecenter.org/events/" }]),
      asked,
    );
    expect(r).toEqual([
      { id: "a", outcome: "corrected", start: "2026-10-10T10:00", timeConfirmed: false, sourceUrl: "https://carpenternaturecenter.org/events/", note: undefined },
    ]);
  });

  it("downgrades a correction with no source URL to unclear", () => {
    const r = parseRestoreResults(fence([{ id: "a", outcome: "corrected", start: "2026-10-10T10:00" }]), asked);
    expect(r[0].outcome).toBe("unclear");
  });

  it("downgrades a correction whose date is not a wall-clock string", () => {
    for (const start of ["October 10", "2026-10-10", "", "2026-13-99T99:99", null]) {
      const r = parseRestoreResults(
        fence([{ id: "a", outcome: "corrected", start, source_url: "https://x.org" }]),
        asked,
      );
      expect(r[0].outcome, String(start)).toBe("unclear");
    }
  });

  it("refuses a not_happening with no evidence — that would delete a real event", () => {
    const r = parseRestoreResults(fence([{ id: "a", outcome: "not_happening", note: "seems gone" }]), asked);
    expect(r[0].outcome).toBe("unclear");
  });

  it("has NO default outcome — an unknown one is unclear, never corrected", () => {
    for (const outcome of ["confirmed", "", null, 42, undefined]) {
      const r = parseRestoreResults(fence([{ id: "a", outcome, start: "2026-10-10T10:00", source_url: "https://x.org" }]), asked);
      expect(r[0].outcome, String(outcome)).toBe("unclear");
    }
  });

  it("drops ids it was not asked about, and de-dupes", () => {
    const r = parseRestoreResults(
      fence([{ id: "zzz", outcome: "unclear" }, { id: "a", outcome: "unclear" }, { id: "a", outcome: "unclear" }]),
      asked,
    );
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("survives junk without throwing", () => {
    for (const t of ["", "not json", "```json\n{oops}\n```", fence({ not: "an array" })]) {
      expect(() => parseRestoreResults(t, asked)).not.toThrow();
      expect(parseRestoreResults(t, asked)).toEqual([]);
    }
  });
});

describe("actionForRestore — the policy", () => {
  const corrected = (over: Partial<RestoreResult> = {}): RestoreResult => ({
    id: "a", outcome: "corrected", start: "2026-10-10T10:00", timeConfirmed: false,
    sourceUrl: "https://carpenternaturecenter.org/events/", ...over,
  });

  it("republishes a corrected date WITHOUT stamping verified when the time is inherited", () => {
    // The Waiting for Godot lesson: the date can be right and the time wrong,
    // so an unconfirmed time must not look checked.
    const a = actionForRestore(corrected(), { now: NOW });
    expect(a).toMatchObject({ kind: "republish", start: "2026-10-10T10:00", stampVerified: false });
  });

  it("stamps verified only when the organiser printed the time", () => {
    const a = actionForRestore(corrected({ timeConfirmed: true }), { now: NOW });
    expect(a).toMatchObject({ kind: "republish", stampVerified: true });
  });

  it("refuses a corrected date in the past", () => {
    expect(actionForRestore(corrected({ start: "2026-09-01T10:00" }), { now: NOW }).kind).toBe("leave");
  });

  it("refuses a correction implausibly far out — that shape is a misread year", () => {
    expect(actionForRestore(corrected({ start: "2028-10-10T10:00" }), { now: NOW }).kind).toBe("leave");
  });

  it("archives not_happening, carrying the page that says so", () => {
    const a = actionForRestore(
      { id: "a", outcome: "not_happening", sourceUrl: "https://chanhassendt.com", note: "run ended Feb 2026" },
      { now: NOW },
    );
    expect(a).toMatchObject({ kind: "archive", sourceUrl: "https://chanhassendt.com" });
  });

  it("leaves unclear alone — a drafted row is already safe", () => {
    expect(actionForRestore({ id: "a", outcome: "unclear" }, { now: NOW }).kind).toBe("leave");
  });

  it("never republishes without a source URL, whatever the parser handed it", () => {
    const a = actionForRestore({ id: "a", outcome: "corrected", start: "2026-10-10T10:00" } as RestoreResult, { now: NOW });
    // Parser guarantees sourceUrl on corrected; if that ever regresses, the
    // republish must not silently carry undefined into the row.
    if (a.kind === "republish") expect(a.sourceUrl).toBeTruthy();
  });
});

describe("the verified stamp needs a published schedule, not just a citation", () => {
  const at = (sourceUrl: string): RestoreResult => ({
    id: "a", outcome: "corrected", start: "2026-10-10T10:00", timeConfirmed: true, sourceUrl,
  });
  const NOW2 = new Date("2026-09-10T12:00:00Z");

  it("stamps verified from an organiser's own site", () => {
    for (const u of ["https://www.mncba.org/", "https://chanhassendt.com/annie/", "https://carpenternaturecenter.org/events/"]) {
      const a = actionForRestore(at(u), { now: NOW2 });
      expect(a.kind === "republish" && a.stampVerified, u).toBe(true);
    }
  });

  it("republishes but does NOT stamp from a directory, social page or reseller", () => {
    // These three really did get a verified stamp on 10 Sep 2026. The date is
    // still worth taking; the claim that a human-grade source confirmed it is not.
    for (const u of [
      "https://www.yelp.com/biz/can-can-wonderland-saint-paul-2",
      "https://www.facebook.com/MNvalleyNWR/",
      "https://www.ticketmaster.com/sanguisugabogg-tickets/artist/2805462",
    ]) {
      const a = actionForRestore(at(u), { now: NOW2 });
      expect(a.kind, u).toBe("republish");
      expect(a.kind === "republish" && a.stampVerified, u).toBe(false);
    }
  });

  it("does not stamp from an aggregator either", () => {
    const a = actionForRestore(at("https://www.familyfuntwincities.com/x/"), { now: NOW2 });
    expect(a.kind === "republish" && a.stampVerified).toBe(false);
  });

  it("an unconfirmed time is still unstamped even from a perfect source", () => {
    const a = actionForRestore({ ...at("https://www.mncba.org/"), timeConfirmed: false }, { now: NOW2 });
    expect(a.kind === "republish" && a.stampVerified).toBe(false);
  });
});

describe("a listing pulled for having no venue must not come back without one", () => {
  const NOW3 = new Date("2026-09-12T12:00:00Z");
  const noVenue = { venue: "TBD – Saint Paul", city: "Saint Paul" };
  const base: RestoreResult = {
    id: "a", outcome: "corrected", start: "2026-10-17T11:00", timeConfirmed: true,
    sourceUrl: "https://www.aicaf.org/powwow",
  };

  it("leaves it drafted when the organiser named no place either", () => {
    const a = actionForRestore(base, { now: NOW3, current: noVenue });
    expect(a.kind).toBe("leave");
    expect(a.kind === "leave" && a.note).toMatch(/still no venue/i);
  });

  it("republishes with the venue when the organiser named one", () => {
    const a = actionForRestore({ ...base, venue: "Base Camp, Fort Snelling" }, { now: NOW3, current: noVenue });
    expect(a).toMatchObject({ kind: "republish", venue: "Base Camp, Fort Snelling" });
  });

  it("refuses a venue that is just the hedge handed back", () => {
    // The failure mode worth guarding: the agent echoing our own placeholder.
    for (const v of ["TBD", "Saint Paul (location TBD)", "Various Locations", "Saint Paul"]) {
      const a = actionForRestore({ ...base, venue: v }, { now: NOW3, current: noVenue });
      expect(a.kind, v).toBe("leave");
    }
  });

  it("does not require a venue from a row that already had a good one", () => {
    // Most drafted rows were pulled for a wrong DATE, not a missing venue.
    // Demanding a venue from those would strand them.
    const a = actionForRestore(base, { now: NOW3, current: { venue: "Target Field", city: "Minneapolis" } });
    expect(a.kind).toBe("republish");
    expect(a.kind === "republish" && a.venue).toBeUndefined();
  });

  it("has no opinion on venues when the caller did not pass the row", () => {
    // "Not told" must not mean "no venue" — that would refuse every caller who
    // only cares about dates, which is most of them.
    expect(actionForRestore(base, { now: NOW3 }).kind).toBe("republish");
  });
});
