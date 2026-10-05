import { describe, it, expect } from "vitest";
import { renderInboxEmail, type SubmissionRow, type ReportRow } from "../inbox-email";

const SUB_ROW = {
  id: "s1",
  title: "George Orwell's Animal Farm",
  venue: "Whitney Fine Arts Theater",
  city: "Minneapolis",
  address: "1424 Yale Pl.",
  start_local: "2026-10-16T19:30",
  end_local: "2026-10-16T21:00",
  price: "Free General Admission",
  ticket_url: "",
  source_url: "",
  submitter_email: "theater@metrostate.edu",
};

const corrected: SubmissionRow = {
  row: SUB_ROW,
  result: {
    submissionId: "s1",
    verdict: "corrected",
    note: "Six performances, not one.",
    evidence: "https://www.metrostate.edu/news/x",
    corrections: { end_local: "2026-10-24T14:00" },
  },
};

const clean: SubmissionRow = {
  row: { ...SUB_ROW, id: "s2" },
  result: { submissionId: "s2", verdict: "confirmed", note: "Matches the organiser." },
};

const report: ReportRow = {
  row: {
    id: "r1",
    event_title: "Damian Marley",
    event_venue: "Fillmore Minneapolis",
    event_start: "2026-10-05 20:00",
    event_status: "published",
    kind: "not_happening",
    reason: "This isn't on the Fillmore's site",
  },
  result: { reportId: "r1", verdict: "supported", note: "Not on the venue calendar." },
};

const render = (s: SubmissionRow[], r: ReportRow[]) =>
  renderInboxEmail(s, r, "https://www.citypulsemn.com/", "secret");

describe("renderInboxEmail", () => {
  it("offers the corrected button only when there is something to correct", () => {
    const withCorr = render([corrected], []).html;
    expect(withCorr).toContain("Publish corrected");
    expect(withCorr).toContain("end_local: 2026-10-16T21:00 → 2026-10-24T14:00");

    // Nothing to correct: offering both would be two buttons for one outcome.
    const without = render([clean], []).html;
    expect(without).not.toContain("Publish corrected");
    expect(without).toContain("Publish as sent");
  });

  it("carries both kinds in one message", () => {
    const { html, subject } = render([corrected], [report]);
    expect(html).toContain("SUBMISSIONS (1)");
    expect(html).toContain("REPORTS (1)");
    expect(subject).toMatch(/1 listing looks wrong/);
    expect(subject).toMatch(/1 submission ready to publish/);
  });

  it("signs each action differently, so a link cannot be edited into another", () => {
    const html = render([corrected], []).html;
    // &amp; in the href, because esc() escapes attributes — which is correct,
    // and which this test got wrong on the first pass.
    const tokens = [...html.matchAll(/submission-action\?id=s1&amp;a=([a-z-]+)&amp;t=([A-Za-z0-9_-]+)/g)];
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    const byAction = new Set(tokens.map((m) => m[2]));
    expect(byAction.size).toBe(tokens.length);
  });

  it("escapes a stranger's prose rather than rendering it", () => {
    const nasty: SubmissionRow = {
      row: { ...SUB_ROW, id: "s3", title: `<script>alert(1)</script>` },
      result: { submissionId: "s3", verdict: "unconfirmed" },
    };
    const html = render([nasty], []).html;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("says plainly that unconfirmed is not a finding of fake", () => {
    const html = render([{ ...clean, result: { submissionId: "s2", verdict: "unconfirmed" } }], []).html;
    expect(html).toMatch(/NOT the same as finding it false/);
    expect(html).toMatch(/No suggestion/);
  });

  it("has a plain-text part carrying every link", () => {
    const { text } = render([corrected], [report]);
    expect(text).toContain("Publish corrected: https://www.citypulsemn.com/submission-action");
    expect(text).toContain("Take it down: https://www.citypulsemn.com/report-action");
    expect(text).not.toContain("//submission-action");
  });

  it("falls back to a neutral subject when nothing needs action", () => {
    const { subject } = render([{ ...clean, result: { submissionId: "s2", verdict: "unconfirmed" } }], []);
    expect(subject).toBe("Checked 1 inbox item");
  });
});
