import { describe, it, expect } from "vitest";
import {
  SUBMISSION_ACTIONS,
  isSubmissionAction,
  makeSubmissionToken,
  verifySubmissionToken,
  submissionActionUrl,
  makeReportToken,
} from "../report-token";

describe("submission tokens share the HMAC but not the namespace", () => {
  const S = "test-secret";

  it("round-trips each action", () => {
    for (const a of SUBMISSION_ACTIONS) {
      expect(verifySubmissionToken("s1", a, makeSubmissionToken("s1", a, S), S)).toBe(true);
    }
  });

  it("refuses a token signed for a different action", () => {
    const t = makeSubmissionToken("s1", "reject", S);
    expect(verifySubmissionToken("s1", "publish-as-sent", t, S)).toBe(false);
  });

  it("refuses a token signed for a different submission", () => {
    const t = makeSubmissionToken("s1", "reject", S);
    expect(verifySubmissionToken("s2", "reject", t, S)).toBe(false);
  });

  it("cannot replay a REPORT token as a submission decision", () => {
    // Same secret, same id — only the namespace differs. If this ever passes,
    // a "keep this listing" link could become a publish.
    const reportTok = makeReportToken("x", "keep", S);
    expect(verifySubmissionToken("x", "publish-as-sent", reportTok, S)).toBe(false);
  });

  it("refuses an unknown action rather than throwing", () => {
    expect(verifySubmissionToken("s1", "delete-everything", "whatever", S)).toBe(false);
    expect(isSubmissionAction("delete")).toBe(false);
  });

  it("builds a URL carrying id, action and token", () => {
    const u = submissionActionUrl("https://example.com/", "s1", "publish-corrected", S);
    expect(u).toContain("/submission-action?id=s1&a=publish-corrected&t=");
    expect(u).not.toContain("//submission-action");
  });
});
