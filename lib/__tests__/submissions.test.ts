import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  submissionToDbEvent,
  normalizeUrl,
  endLocal,
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

  // UX8 — accept the bare-domain paste ("powderhornartfair.com") people
  // actually submit, but still reject a stray word ("notaurl").
  it("accepts a bare domain and stores it with a scheme", () => {
    const r = validateSubmission(base({ ticketUrl: "powderhornartfair.com" }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.ticket_url).toBe("https://powderhornartfair.com");
      expect(r.value.source_url).toBe("https://powderhornartfair.com");
    }
  });

  it("accepts a bare domain with a path, and still rejects a bare word", () => {
    expect(validateSubmission(base({ ticketUrl: "facebook.com/events/123" }), NOW).ok).toBe(true);
    expect(validateSubmission(base({ ticketUrl: "notaurl" }), NOW).ok).toBe(false);
  });

  // UX8 — a 9pm–1am show ends the NEXT day; pinning end to the start date
  // stored a backwards span.
  it("rolls a past-midnight end time to the next day", () => {
    const r = validateSubmission(base({ time: "21:00", endTime: "01:00" }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.start_local).toBe("2026-07-18T21:00");
      expect(r.value.end_local).toBe("2026-07-19T01:00");
    }
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

describe("normalizeUrl", () => {
  it("prepends https:// to a bare domain", () => {
    expect(normalizeUrl("powderhornartfair.com")).toBe("https://powderhornartfair.com");
    expect(normalizeUrl("facebook.com/events/1")).toBe("https://facebook.com/events/1");
  });
  it("leaves an existing scheme untouched", () => {
    expect(normalizeUrl("https://x.com")).toBe("https://x.com");
    expect(normalizeUrl("http://x.com")).toBe("http://x.com");
  });
  it("trims and passes through empty", () => {
    expect(normalizeUrl("  x.com  ")).toBe("https://x.com");
    expect(normalizeUrl("")).toBe("");
  });
});

describe("endLocal", () => {
  it("keeps a same-day end on the start date", () => {
    expect(endLocal("2026-07-18", "10:00", "17:00")).toBe("2026-07-18T17:00");
  });
  it("rolls a before-start end to the next day (midnight crossing)", () => {
    expect(endLocal("2026-07-18", "21:00", "01:00")).toBe("2026-07-19T01:00");
  });
  it("returns null when there's no end time", () => {
    expect(endLocal("2026-07-18", "21:00", "")).toBeNull();
  });
  it("advances the month boundary correctly", () => {
    expect(endLocal("2026-07-31", "22:00", "02:00")).toBe("2026-08-01T02:00");
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
