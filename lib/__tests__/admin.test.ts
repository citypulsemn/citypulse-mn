import { describe, it, expect } from "vitest";
import { parseEventPatch } from "../admin";
import { parseBasicAuth, safeEqual, checkAuth } from "../admin-auth";

const base = {
  title: "Trampled by Turtles",
  venue: "First Avenue",
  city: "Minneapolis",
  start: "2026-07-15T20:00",
  end: "2026-07-15T23:00",
  price: "$35",
  ticket_url: "https://tickets.example/x",
  description: "A show.",
};

describe("parseEventPatch", () => {
  it("accepts a valid patch and normalizes fields", () => {
    const r = parseEventPatch(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.title).toBe("Trampled by Turtles");
      expect(r.patch.start).toBe("2026-07-15T20:00");
      expect(r.patch.end).toBe("2026-07-15T23:00");
    }
  });

  it("requires a title", () => {
    expect(parseEventPatch({ ...base, title: "  " }).ok).toBe(false);
  });

  it("requires a valid start", () => {
    expect(parseEventPatch({ ...base, start: "not-a-date" }).ok).toBe(false);
  });

  it("allows an empty end (null)", () => {
    const r = parseEventPatch({ ...base, end: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.end).toBeNull();
  });

  it("rejects end before start", () => {
    const r = parseEventPatch({ ...base, end: "2026-07-15T19:00" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-http ticket URL", () => {
    expect(parseEventPatch({ ...base, ticket_url: "javascript:alert(1)" }).ok).toBe(false);
  });

  it("allows an empty ticket URL", () => {
    expect(parseEventPatch({ ...base, ticket_url: "" }).ok).toBe(true);
  });

  it("defaults a blank price to 'See listing'", () => {
    const r = parseEventPatch({ ...base, price: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.price).toBe("See listing");
  });
});

describe("Basic-auth helpers", () => {
  const header = "Basic " + Buffer.from("taren:s3cret").toString("base64");

  it("parses a Basic header", () => {
    expect(parseBasicAuth(header)).toEqual({ user: "taren", pass: "s3cret" });
  });
  it("returns null for missing/garbage headers", () => {
    expect(parseBasicAuth(null)).toBeNull();
    expect(parseBasicAuth("Bearer xyz")).toBeNull();
  });
  it("safeEqual compares correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("checkAuth validates against expected creds", () => {
    expect(checkAuth(header, "taren", "s3cret")).toBe(true);
    expect(checkAuth(header, "taren", "wrong")).toBe(false);
    expect(checkAuth(header, "other", "s3cret")).toBe(false);
  });
});
