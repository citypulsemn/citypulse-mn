import { describe, it, expect } from "vitest";
import { normalizeEmail, isValidEmail } from "../subscribe";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Taren@Example.COM ")).toBe("taren@example.com");
  });
  it("handles empty/nullish", () => {
    expect(normalizeEmail("")).toBe("");
    // @ts-expect-error exercising defensive nullish handling
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    for (const e of ["a@b.co", "taren.m@example.com", "x+tag@sub.domain.org"]) {
      expect(isValidEmail(e)).toBe(true);
    }
  });
  it("rejects malformed addresses", () => {
    for (const e of ["", "nope", "a@b", "a@ b.com", "a b@c.com", "@b.com", "a@.com", "a@b."]) {
      expect(isValidEmail(e)).toBe(false);
    }
  });
  it("rejects absurdly long addresses", () => {
    expect(isValidEmail("a".repeat(250) + "@b.com")).toBe(false);
  });
});
