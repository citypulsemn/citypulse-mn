import { describe, it, expect } from "vitest";
import {
  recommendationForSubmission,
  submissionVerdictHeadline,
  realCorrections,
  describeCorrections,
  correctedSubmission,
  buildSubmissionCheckPrompt,
  parseSubmissionChecks,
  SUBMISSION_VERDICTS,
  type SubmissionCheckInput,
} from "../submission-check";

const SUB: SubmissionCheckInput = {
  submissionId: "s1",
  title: "George Orwell's Animal Farm",
  venue: "Whitney Fine Arts Theater",
  city: "Minneapolis",
  address: "1424 Yale Pl.",
  start_local: "2026-10-16T19:30",
  end_local: "2026-10-16T21:00",
  price: "Free General Admission",
  ticket_url: "",
  source_url: "",
  description: "Metro State Theater presents…",
};

describe("recommendationForSubmission", () => {
  it("never recommends rejecting something it merely could not find", () => {
    // The asymmetry: a missing source is not proof of absence. A false
    // rejection loses a real event, and the submitter is not expecting a
    // reply, so nobody will ever chase it.
    expect(recommendationForSubmission("unconfirmed")).toBe("needs-a-human");
    expect(recommendationForSubmission("error")).toBe("needs-a-human");
  });

  it("maps the confident verdicts to an action", () => {
    expect(recommendationForSubmission("confirmed")).toBe("publish-as-sent");
    expect(recommendationForSubmission("corrected")).toBe("publish-corrected");
    expect(recommendationForSubmission("contradicted")).toBe("reject");
  });

  it("covers every verdict", () => {
    for (const v of SUBMISSION_VERDICTS) {
      expect(recommendationForSubmission(v)).toBeTruthy();
      expect(submissionVerdictHeadline(v).length).toBeGreaterThan(10);
    }
  });
});

describe("realCorrections — only what actually changes", () => {
  it("drops a correction identical to what was submitted", () => {
    expect(realCorrections(SUB, { title: "George Orwell's Animal Farm" })).toEqual({});
  });

  it("treats a blank as no opinion, never as 'clear this field'", () => {
    // A model returning "" for price must not wipe a price the reader gave.
    expect(realCorrections(SUB, { price: "", venue: "   " })).toEqual({});
  });

  it("keeps a genuine change, trimmed", () => {
    expect(realCorrections(SUB, { address: "  1424 Yale Place, Minneapolis, MN 55403  " }))
      .toEqual({ address: "1424 Yale Place, Minneapolis, MN 55403" });
  });

  it("handles the real Animal Farm case — one night was actually a run", () => {
    const c = realCorrections(SUB, { start_local: "2026-10-16T19:30", end_local: "2026-10-24T14:00" });
    expect(c).toEqual({ end_local: "2026-10-24T14:00" });
  });

  it("ignores fields that are not correctable", () => {
    expect(realCorrections(SUB, { status: "published" } as never)).toEqual({});
  });

  it("is empty when there are no corrections at all", () => {
    expect(realCorrections(SUB, undefined)).toEqual({});
  });
});

describe("describeCorrections", () => {
  it("shows what it was and what it should be", () => {
    expect(describeCorrections(SUB, { end_local: "2026-10-24T14:00" }))
      .toEqual(["end_local: 2026-10-16T21:00 → 2026-10-24T14:00"]);
  });

  it("says (empty) rather than printing nothing for a field the reader left blank", () => {
    expect(describeCorrections(SUB, { source_url: "https://www.metrostate.edu/news/x" }))
      .toEqual(["source_url: (empty) → https://www.metrostate.edu/news/x"]);
  });
});

describe("correctedSubmission", () => {
  it("merges corrections over the original without mutating it", () => {
    const merged = correctedSubmission(SUB as unknown as Record<string, unknown>, { venue: "Whitney Fine Arts Theater", price: "Free" });
    expect(merged.price).toBe("Free");
    expect(SUB.price).toBe("Free General Admission");
  });
});

describe("buildSubmissionCheckPrompt", () => {
  const prompt = buildSubmissionCheckPrompt([SUB]);

  it("warns about the two traps that actually bit us", () => {
    // Both are real: the Animal Farm run, and the Mall of America press
    // release from the previous year.
    expect(prompt).toMatch(/CHECK THE YEAR/);
    expect(prompt).toMatch(/ONE DATE OF A RUN/);
  });

  it("tells it that unconfirmed is a safe answer", () => {
    expect(prompt).toMatch(/NOT a finding that it is fake/);
  });

  it("carries the submission's own fields", () => {
    expect(prompt).toContain("id: s1");
    expect(prompt).toContain("Whitney Fine Arts Theater");
  });
});

describe("parseSubmissionChecks", () => {
  const ids = new Set(["s1", "s2"]);

  it("reads a well-formed reply with corrections", () => {
    const r = parseSubmissionChecks(
      `prose first\n[{"submissionId":"s1","verdict":"corrected","evidence":"https://metrostate.edu/x","note":"six performances","corrections":{"end_local":"2026-10-24T14:00"}}]`,
      ids,
    );
    expect(r).toHaveLength(1);
    expect(r[0].verdict).toBe("corrected");
    expect(r[0].corrections).toEqual({ end_local: "2026-10-24T14:00" });
  });

  it("drops an id it was not asked about", () => {
    expect(parseSubmissionChecks(`[{"submissionId":"nope","verdict":"confirmed"}]`, ids)).toEqual([]);
  });

  it("drops an invented verdict rather than coercing it", () => {
    expect(parseSubmissionChecks(`[{"submissionId":"s1","verdict":"probably-fine"}]`, ids)).toEqual([]);
  });

  it("keeps only the first answer for a repeated id", () => {
    const r = parseSubmissionChecks(
      `[{"submissionId":"s1","verdict":"confirmed"},{"submissionId":"s1","verdict":"contradicted"}]`,
      ids,
    );
    expect(r).toHaveLength(1);
    expect(r[0].verdict).toBe("confirmed");
  });

  it("ignores junk fields inside corrections", () => {
    const r = parseSubmissionChecks(
      `[{"submissionId":"s1","verdict":"corrected","corrections":{"status":"published","venue":"The Whitney"}}]`,
      ids,
    );
    expect(r[0].corrections).toEqual({ venue: "The Whitney" });
  });

  it("returns nothing for unparseable output rather than throwing", () => {
    expect(parseSubmissionChecks("the model apologised", ids)).toEqual([]);
    expect(parseSubmissionChecks("[not json", ids)).toEqual([]);
    expect(parseSubmissionChecks("", ids)).toEqual([]);
  });

  it("treats an empty corrections object as no corrections", () => {
    const r = parseSubmissionChecks(`[{"submissionId":"s1","verdict":"confirmed","corrections":{}}]`, ids);
    expect(r[0].corrections).toBeUndefined();
  });
});
