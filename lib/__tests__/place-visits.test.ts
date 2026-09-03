import { describe, it, expect } from "vitest";
import { isValidPlaceSlug } from "../place-visits";
import { PLACES } from "../places";

/**
 * Places P5 — the slug guard on the "Been there" server action. There is no
 * foreign key (the registry is code), so this is the only thing standing
 * between a request body and the place_visits table.
 */
describe("isValidPlaceSlug (guards toggleVisitAction)", () => {
  it("accepts a slug that exists in the registry", () => {
    expect(isValidPlaceSlug(PLACES[0].slug)).toBe(true);
    expect(isValidPlaceSlug(PLACES[PLACES.length - 1].slug)).toBe(true);
  });

  it("rejects unknown, malformed, and injection-ish input", () => {
    expect(isValidPlaceSlug("no-such-place")).toBe(false);
    expect(isValidPlaceSlug("")).toBe(false);
    expect(isValidPlaceSlug(PLACES[0].slug.toUpperCase())).toBe(false);
    expect(isValidPlaceSlug(`${PLACES[0].slug}; drop table place_visits`)).toBe(false);
    expect(isValidPlaceSlug("' or 1=1 --")).toBe(false);
    expect(isValidPlaceSlug(undefined)).toBe(false);
    expect(isValidPlaceSlug(42)).toBe(false);
    expect(isValidPlaceSlug({ slug: PLACES[0].slug })).toBe(false);
  });
});
