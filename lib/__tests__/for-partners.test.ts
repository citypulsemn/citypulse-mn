import { describe, it, expect } from "vitest";
import { FOR_PARTNERS } from "../editorial";
import { allFeedSlugs } from "../feeds";
import { CATEGORIES } from "../categories";
import { COLLECTIONS } from "../collections";
import { NEIGHBORHOODS } from "../neighborhoods";
import { VENUE_PAGES } from "../venue-pages";

/**
 * /for-partners drift guards (Monetization B4).
 *
 * This page is an OFFER made to people outside the project — a hotel, a
 * newsroom, a chamber — so a sentence that quietly goes stale is not a typo,
 * it is a promise we stopped keeping. Two guards:
 *
 *  1. The counts the copy states must match the live registries.
 *  2. The copy must not promise capabilities that do not exist. Each banned
 *     phrase below was a real finding from the pre-publication check: no JSON
 *     or REST API is published (roadmap 6.2 is parked), no CORS header exists
 *     anywhere so an embedded widget cannot work, there is no SLA or uptime
 *     commitment, and the terms disclaim accuracy in plain words.
 */
describe("for-partners copy drift (B4)", () => {
  it("states the feed counts the registries actually have", () => {
    // If one of these fails, a registry grew and FOR_PARTNERS.shapes is now
    // lying to a partner. Update the sentence, not the expectation.
    expect(Object.keys(CATEGORIES).length).toBe(7);
    expect(COLLECTIONS.length).toBe(8);
    expect(VENUE_PAGES.length).toBe(47);
    expect(NEIGHBORHOODS.length).toBe(16);
    expect(allFeedSlugs().length).toBe(79);
  });

  it("spells those same counts in the copy", () => {
    const s = FOR_PARTNERS.shapes.toLowerCase();
    for (const word of ["seven categories", "eight collections", "forty-seven venues", "sixteen neighborhoods", "seventy-nine"]) {
      expect(s).toContain(word);
    }
  });

  it("never names a capability that does not exist", () => {
    const all = Object.values(FOR_PARTNERS).join(" ").toLowerCase();
    // These have no honest use on this page in any direction — there is no JSON
    // or REST surface to describe, and no CORS header, so no widget or embed
    // can work at all.
    for (const phrase of ["json", "rest api", "widget", "embed", "real-time", "realtime"]) {
      expect(all.includes(phrase)).toBe(false);
    }
    expect(/\bapi\b/.test(all)).toBe(false);
  });

  it("mentions uptime, SLAs and guarantees only to disclaim them", () => {
    // Unlike the words above, these have an honest use: saying we offer none.
    // So the guard is placement, not absence — they may appear only in the
    // paragraph whose whole job is to say no, and that paragraph must say it.
    const { stability, ...rest } = FOR_PARTNERS;
    const elsewhere = Object.values(rest).join(" ").toLowerCase();
    for (const word of ["sla", "uptime", "guarantee"]) {
      expect(elsewhere.includes(word)).toBe(false);
    }
    expect(stability.toLowerCase()).toMatch(/no uptime guarantee/);
  });

  it("says the three things an honest offer has to say", () => {
    const all = Object.values(FOR_PARTNERS).join(" ").toLowerCase();
    expect(all).toContain("attribution"); // what we ask in return
    expect(all).toContain("free"); // the price, stated rather than implied
    expect(all).toMatch(/opt out|out of the feed/); // the exit, named
  });

  it("keeps the house voice", () => {
    const all = Object.values(FOR_PARTNERS).join(" ").toLowerCase();
    for (const banned of ["nestled", "vibrant", "hidden gem", "look no further", "in the heart of"]) {
      expect(all).not.toContain(banned);
    }
  });
});
