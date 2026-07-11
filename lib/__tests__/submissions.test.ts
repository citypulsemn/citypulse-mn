import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  submissionToDbEvent,
  METRO_CENTER,
  type SubmissionInput,
  type SubmissionEventFields,
} from "../submissions";

const NOW = new Date("2026-07-13T09:00:00-05:00");

function base(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    title: "Powderhorn Art Fair",
    category: "arts",
    date: "2026-07-18",
    time: "10:00",
    venue: "Powderhorn Park",
    city: "Minneapolis",
    ...overrides,
  };
}

describe("validateSubmission", () => {
  it("accepts a valid minimal submission", () => {
    const r = validateSubmission(base(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.start_local).toBe("2026-07-18T10:00");
      expect(r.value.end_local).toBeNull();
      expect(r.value.category).toBe("arts");
      expect(r.value.price).toBe("See listing");
    }
  });

  it("composes start + end local from date and times", () => {
    const r = validateSubmission(base({ endTime: "13:30", price: "Free" }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.start_local).toBe("2026-07-18T10:00");
      expect(r.value.end_local).toBe("2026-07-18T13:30");
      expect(r.value.price).toBe("Free");
    }
  });

  it("requires title, category, venue, city", () => {
    const r = validateSubmission(base({ title: "", category: "", venue: "", city: "" }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveProperty("title");
      expect(r.errors).toHaveProperty("category");
      expect(r.errors).toHaveProperty("venue");
      expect(r.errors).toHaveProperty("city");
    }
  });

  it("rejects an unknown category", () => {
    const r = validateSubmission(base({ category: "politics" }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.category).toBeTruthy();
  });

  it("rejects a past date and a too-far date", () => {
    expect(validateSubmission(base({ date: "2020-01-01" }), NOW).ok).toBe(false);
    expect(validateSubmission(base({ date: "2099-01-01" }), NOW).ok).toBe(false);
  });

  it("rejects a bad time", () => {
    const r = validateSubmission(base({ time: "25:99" }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.time).toBeTruthy();
  });

  it("validates the ticket URL and email format", () => {
    expect(validateSubmission(base({ ticketUrl: "notaurl" }), NOW).ok).toBe(false);
    expect(validateSubmission(base({ ticketUrl: "https://ok.com" }), NOW).ok).toBe(true);
    expect(validateSubmission(base({ submitterEmail: "nope" }), NOW).ok).toBe(false);
    expect(validateSubmission(base({ submitterEmail: "a@b.com" }), NOW).ok).toBe(true);
  });

  it("enforces length limits", () => {
    expect(validateSubmission(base({ title: "x".repeat(141) }), NOW).ok).toBe(false);
    expect(validateSubmission(base({ description: "x".repeat(1001) }), NOW).ok).toBe(false);
  });

  it("uses the ticket link as the source url and lowercases email", () => {
    const r = validateSubmission(base({ ticketUrl: "https://x.com", submitterEmail: "A@B.COM" }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source_url).toBe("https://x.com");
      expect(r.value.submitter_email).toBe("a@b.com");
    }
  });
});

describe("submissionToDbEvent", () => {
  const sub: SubmissionEventFields = {
    title: "Powderhorn Art Fair",
    category: "arts",
    venue: "Powderhorn Park",
    city: "Minneapolis",
    address: "3400 15th Ave S",
    start_local: "2026-07-18T10:00",
    end_local: "2026-07-18T17:00",
    price: "Free",
    ticket_url: "https://x.com",
    description: "Art in the park.",
    source_url: "https://x.com",
  };

  it("maps to a publishable event with UTC-correct instants", () => {
    const geo = { lat: 44.94, lng: -93.24 };
    const ev = submissionToDbEvent(sub, geo);
    expect(ev.status).toBe("published");
    expect(ev.lat).toBe(44.94);
    expect(ev.priceTier).toBe("Free");
    // 2026-07-18 10:00 CDT (-05:00) → 15:00Z
    expect(new Date(ev.start_at).toISOString()).toBe("2026-07-18T15:00:00.000Z");
    expect(ev.event_key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("falls back to the metro center when geocoding fails", () => {
    const ev = submissionToDbEvent(sub, null);
    expect(ev.lat).toBe(METRO_CENTER.lat);
    expect(ev.lng).toBe(METRO_CENTER.lng);
  });

  it("produces a stable event_key for the same submission", () => {
    expect(submissionToDbEvent(sub, null).event_key).toBe(submissionToDbEvent(sub, null).event_key);
  });
});
