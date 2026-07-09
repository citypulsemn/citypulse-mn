import { describe, it, expect } from "vitest";
import { sanitizeProps, track } from "../track";

describe("sanitizeProps", () => {
  it("keeps primitives and null", () => {
    expect(sanitizeProps({ a: "x", b: 3, c: true, d: null })).toEqual({
      a: "x",
      b: 3,
      c: true,
      d: null,
    });
  });

  it("stringifies non-primitives and drops undefined", () => {
    expect(sanitizeProps({ o: { x: 1 }, u: undefined, n: 5 })).toEqual({
      o: "[object Object]",
      n: 5,
    });
  });

  it("returns undefined when there are no props", () => {
    expect(sanitizeProps()).toBeUndefined();
  });
});

describe("track — no-op safety", () => {
  it("does not throw and returns undefined on the server (no window)", () => {
    expect(track("ticket_click", { id: "1", category: "music" })).toBeUndefined();
  });

  it("does not throw when called with no props", () => {
    expect(() => track("search")).not.toThrow();
  });
});
