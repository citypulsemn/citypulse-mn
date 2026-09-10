import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReportCheckPrompt,
  parseReportChecks,
  recommendationFor,
  verdictHeadline,
  selectReportsToCheck,
  formatCheckLine,
  type ReportCheckInput,
} from "../report-check";
import {
  makeReportToken,
  verifyReportToken,
  reportActionUrl,
  isReportAction,
} from "../report-token";

/**
 * The incident these exist for (5 Sep 2026): a reader reported that our
 * "Damian 'Jr. Gong' Marley & Stephen Marley" listing at The Fillmore was
 * wrong. The Fillmore's own calendar had Masego that night, Live Nation had no
 * Marley dates at all, and the exploreminnesota article we cited never
 * mentioned the Marleys. The listing was live and `verified_at` two days old.
 */

const MARLEY: ReportCheckInput = {
  reportId: "425659b0-48ef-4acb-bd37-f1aec0b064ef",
  eventId: "b8bea235-094d-4b8b-b605-cc25e3e3e8ed",
  title: "Damian 'Jr. Gong' Marley & Stephen Marley",
  venue: "The Fillmore Minneapolis",
  city: "Minneapolis",
  start: "2026-09-05 19:00",
  sourceUrl: "https://www.exploreminnesota.com/events/best-fall-concerts-minneapolis-st-paul",
  ticketUrl: "https://www.fillmoreminneapolis.com/",
  kind: "removal",
  reason: "The show is wrong.\nMasego tonight at Fillmore",
  evidenceUrl: "",
};

describe("buildReportCheckPrompt", () => {
  const prompt = buildReportCheckPrompt([MARLEY]);

  it("makes the venue's own calendar the authority", () => {
    // The freshness pass asks only whether an event "still appears as
    // scheduled" against its own source. When that source is a roundup that
    // never mentioned the event, that question cannot catch a fabrication.
    expect(prompt).toMatch(/VENUE'S OWN CALENDAR/i);
    expect(prompt).toMatch(/outranks everything else/i);
  });

  it("asks the model to name whatever the room actually has that night", () => {
    expect(prompt).toMatch(/name that act/i);
  });

  it("says a roundup article is not a schedule", () => {
    expect(prompt).toMatch(/roundup article is NOT a schedule/i);
  });

  it("carries the reader's claim and both of our URLs", () => {
    expect(prompt).toContain("Masego tonight at Fillmore");
    expect(prompt).toContain("exploreminnesota.com");
    expect(prompt).toContain("fillmoreminneapolis.com");
  });

  it("collapses the reader's newlines so one report stays one list item", () => {
    const body = prompt.slice(prompt.indexOf("- id:"), prompt.indexOf("HOW TO CHECK"));
    expect(body.split("\n").filter((l) => l.startsWith("- id:"))).toHaveLength(1);
  });

  it("requires evidence and prefers unclear over a guess", () => {
    expect(prompt).toMatch(/"evidence" is REQUIRED/);
    expect(prompt).toMatch(/NOT evidence that an event is fake/i);
  });
});

describe("parseReportChecks", () => {
  const ids = new Set([MARLEY.reportId, "other-id"]);

  it("parses the verdict that would have caught the Marley listing", () => {
    const text =
      'Checked it.\n```json\n[{"id":"425659b0-48ef-4acb-bd37-f1aec0b064ef","verdict":"supported",' +
      '"evidence":"https://www.fillmoreminneapolis.com/","note":"The Fillmore lists Masego that night."}]\n```';
    const out = parseReportChecks(text, ids);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ verdict: "supported", note: "The Fillmore lists Masego that night." });
    expect(recommendationFor(out[0].verdict)).toBe("take-it-down");
  });

  it("DOWNGRADES a decisive verdict that comes with no evidence", () => {
    // An assertion without a source is exactly what put the listing on the site.
    const text = '```json\n[{"id":"other-id","verdict":"supported","note":"Looks wrong to me."}]\n```';
    const out = parseReportChecks(text, ids);
    expect(out[0].verdict).toBe("unclear");
    expect(out[0].note).toMatch(/downgraded/i);
    expect(recommendationFor(out[0].verdict)).toBe("needs-a-human");
  });

  it("keeps `unclear` without evidence — that verdict asserts nothing", () => {
    const text = '```json\n[{"id":"other-id","verdict":"unclear","note":"Venue site was down."}]\n```';
    expect(parseReportChecks(text, ids)[0]).toMatchObject({ verdict: "unclear" });
  });

  it("drops unknown ids, unknown verdicts and duplicates", () => {
    const text =
      '```json\n[{"id":"nope","verdict":"supported","evidence":"x"},' +
      '{"id":"other-id","verdict":"probably","evidence":"x"},' +
      '{"id":"other-id","verdict":"contradicted","evidence":"a"},' +
      '{"id":"other-id","verdict":"supported","evidence":"b"}]\n```';
    const out = parseReportChecks(text, ids);
    expect(out).toHaveLength(1);
    // First verdict for an id wins; the later duplicate is dropped rather than
    // overwriting it, so a model that changes its mind cannot flip a decision.
    expect(out[0]).toMatchObject({ reportId: "other-id", verdict: "contradicted" });
  });

  it("returns [] on garbage rather than throwing", () => {
    expect(parseReportChecks("no json at all", ids)).toEqual([]);
    expect(parseReportChecks('```json\n{"not":"an array"}\n```', ids)).toEqual([]);
    expect(parseReportChecks("```json\n[[[\n```", ids)).toEqual([]);
  });
});

describe("recommendationFor", () => {
  it("never recommends removal on an unresolved check", () => {
    // A page you cannot find is not evidence that an event is fake. Same
    // asymmetry as lib/verify.ts: a false removal deletes a real event, and
    // nobody ever reports THAT.
    expect(recommendationFor("unclear")).toBe("needs-a-human");
    expect(recommendationFor("error")).toBe("needs-a-human");
    expect(recommendationFor("supported")).toBe("take-it-down");
    expect(recommendationFor("contradicted")).toBe("keep-it");
  });

  it("has a headline for every verdict", () => {
    for (const v of ["supported", "contradicted", "unclear", "error"] as const) {
      expect(verdictHeadline(v).length).toBeGreaterThan(10);
    }
  });
});

describe("selectReportsToCheck", () => {
  it("caps the batch, oldest first", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ reportId: `r${i}` }));
    const picked = selectReportsToCheck(many, 5);
    expect(picked.map((p) => p.reportId)).toEqual(["r0", "r1", "r2", "r3", "r4"]);
  });

  it("handles an empty queue and a zero cap", () => {
    expect(selectReportsToCheck([], 5)).toEqual([]);
    expect(selectReportsToCheck([{ reportId: "a" }], 0)).toEqual([]);
  });
});

describe("formatCheckLine", () => {
  it("includes the note and the evidence when present", () => {
    const line = formatCheckLine({
      verdict: "supported",
      note: "The Fillmore lists Masego.",
      evidence: "https://fillmoreminneapolis.com/",
    });
    expect(line).toContain("Masego");
    expect(line).toContain("Evidence: https://fillmoreminneapolis.com/");
  });

  it("is still a sentence with neither", () => {
    expect(formatCheckLine({ verdict: "unclear" })).toBe(verdictHeadline("unclear"));
  });
});

describe("report action tokens", () => {
  const SECRET = "test-secret-value";
  const ID = "425659b0-48ef-4acb-bd37-f1aec0b064ef";

  it("accepts its own token", () => {
    expect(verifyReportToken(ID, "delete", makeReportToken(ID, "delete", SECRET), SECRET)).toBe(true);
    expect(verifyReportToken(ID, "keep", makeReportToken(ID, "keep", SECRET), SECRET)).toBe(true);
  });

  it("SIGNS THE ACTION, so a keep link cannot be edited into a takedown", () => {
    const keep = makeReportToken(ID, "keep", SECRET);
    expect(verifyReportToken(ID, "delete", keep, SECRET)).toBe(false);
  });

  it("is bound to the report id", () => {
    const t = makeReportToken(ID, "delete", SECRET);
    expect(verifyReportToken("some-other-id", "delete", t, SECRET)).toBe(false);
  });

  it("rejects a wrong secret, a wrong-length token and junk, without throwing", () => {
    const t = makeReportToken(ID, "delete", SECRET);
    expect(verifyReportToken(ID, "delete", t, "other-secret")).toBe(false);
    expect(() => verifyReportToken(ID, "delete", "short", SECRET)).not.toThrow();
    expect(verifyReportToken(ID, "delete", "short", SECRET)).toBe(false);
    expect(verifyReportToken(ID, "delete", "", SECRET)).toBe(false);
  });

  it("rejects an action that is not one of the two", () => {
    expect(isReportAction("delete")).toBe(true);
    expect(isReportAction("keep")).toBe(true);
    expect(isReportAction("drop-table")).toBe(false);
    expect(verifyReportToken(ID, "drop-table", "anything", SECRET)).toBe(false);
  });

  it("builds a URL that carries id, action and token", () => {
    const url = reportActionUrl("https://www.citypulsemn.com/", ID, "delete", SECRET);
    expect(url).toBe(
      `https://www.citypulsemn.com/report-action?id=${ID}&a=delete&t=${makeReportToken(ID, "delete", SECRET)}`,
    );
    expect(url).not.toContain("//report-action");
  });
});

/**
 * The one that matters most operationally: mail providers fetch every link in a
 * message before a human sees it. A GET that hid a listing would take events off
 * the site by itself.
 */
describe("the action route never mutates on GET", () => {
  const route = readFileSync(
    join(__dirname, "..", "..", "app/report-action/route.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("only POST applies a decision", () => {
    const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    expect(get).not.toMatch(/applyEmailedDecision/);
    const post = route.slice(route.indexOf("export async function POST"));
    expect(post).toMatch(/applyEmailedDecision/);
  });

  it("checks the token on both verbs", () => {
    const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    const post = route.slice(route.indexOf("export async function POST"));
    expect(get).toMatch(/verifyReportToken/);
    expect(post).toMatch(/verifyReportToken/);
  });

  it("the confirm page posts a form rather than linking the action", () => {
    expect(route).toMatch(/<form method="post"/);
  });
});

/**
 * The Flower Hour false positive, 10 Sep 2026 — found by accident while testing
 * the dispatch trigger, which makes it the most expensive kind of bug: nobody
 * was looking for it.
 *
 * Our listing cited the Minneapolis Parks calendar page FOR THAT EXACT DATE,
 * which reads "September 10 @ 4:00 pm - 5:00 pm". The check never opened it. It
 * found neighborhood-association pages republishing the SUMMER program guide
 * ("Thursdays, May 7-Aug 27"), reasoned that September is after August, and
 * returned "supported" — recommending we hide a real event that started in 75
 * minutes.
 *
 * That is the same reasoning that was CORRECT about the Woodbury movie night the
 * same morning. Only the organizer's own calendar distinguishes them, so the
 * prompt has to say to read it.
 */
describe("the prompt distinguishes our source from a third party's summary", () => {
  const p = buildReportCheckPrompt([
    {
      reportId: "r1",
      eventId: "e1",
      title: "Flower Hour",
      venue: "Eloise Butler Wildflower Garden",
      city: "Minneapolis",
      start: "2026-09-10 16:00",
      sourceUrl: "https://www.minneapolisparks.org/event-calendar/flower-hour-2/2026-09-10/",
      ticketUrl: "",
      kind: "other",
      reason: "not happening",
      evidenceUrl: "",
    },
  ]);

  it("says an organizer's date-specific page IS the authority, not a weaker tier", () => {
    expect(p).toContain("DATE-SPECIFIC page");
    expect(p).toContain("OPEN IT");
  });

  it("names the season-summary trap explicitly", () => {
    expect(p).toContain("A SERIES CAN HAVE MORE THAN ONE SEASON");
    expect(p).toContain("Absence from a season summary is absence of information");
  });

  it("still says a roundup is not a schedule — the Marley rule must survive", () => {
    expect(p).toContain("A ROUNDUP ARTICLE IS NOT A SCHEDULE");
  });
});
