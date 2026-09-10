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
