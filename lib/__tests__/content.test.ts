import { describe, it, expect } from "vitest";
import { weeklyPicks, scoreEvent } from "../content/weekly-picks";
import { captionFor, weeklyCaptionFor, hashtagsFor, shortDate } from "../content/templates";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-13T09:00:00-05:00"); // a Monday

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Some Event",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T20:00", // Wed, in window
    end: "",
    price: "$25",
    priceTier: "$$",
    ticketUrl: "https://t.co/x",
    description: "A great show with lots of detail in the description here.",
    image: "https://img/x.jpg",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("scoreEvent", () => {
  it("rewards completeness and weekends", () => {
    const weekend = ev({ start: "2026-07-18T20:00" }); // Saturday
    const weekday = ev({ start: "2026-07-14T11:00", ticketUrl: "", description: "", image: "" });
    expect(scoreEvent(weekend)).toBeGreaterThan(scoreEvent(weekday));
  });
});

describe("weeklyPicks", () => {
  it("only includes published events within the 7-day window", () => {
    const list = [
      ev({ id: "in", start: "2026-07-15T20:00" }),
      ev({ id: "past", start: "2026-07-10T20:00" }),
      ev({ id: "far", start: "2026-08-30T20:00" }),
      ev({ id: "draft", start: "2026-07-16T20:00", status: "draft" }),
    ];
    const picks = weeklyPicks(list, NOW);
    const ids = picks.all.map((e) => e.id);
    expect(ids).toContain("in");
    expect(ids).not.toContain("past");
    expect(ids).not.toContain("far");
    expect(ids).not.toContain("draft");
  });

  it("routes family and unique to their formats", () => {
    const list = [
      ev({ id: "fam", category: "family", start: "2026-07-16T10:00" }),
      ev({ id: "wei", category: "weird", start: "2026-07-17T19:00" }),
      ev({ id: "mus", category: "music", start: "2026-07-18T20:00" }),
    ];
    const picks = weeklyPicks(list, NOW);
    expect(picks.family?.id).toBe("fam");
    expect(picks.unique?.id).toBe("wei");
  });

  it("excludes the family/unique picks from the regular set", () => {
    const list = [
      ev({ id: "fam", category: "family", start: "2026-07-16T10:00" }),
      ev({ id: "wei", category: "weird", start: "2026-07-17T19:00" }),
      ev({ id: "mus", category: "music", venue: "Palace", start: "2026-07-18T20:00" }),
    ];
    const picks = weeklyPicks(list, NOW);
    const regIds = picks.regular.map((e) => e.id);
    expect(regIds).not.toContain("fam");
    expect(regIds).not.toContain("wei");
    expect(regIds).toContain("mus");
  });

  it("caps one event per venue in the regular set", () => {
    const list = [
      ev({ id: "a", venue: "Armory", start: "2026-07-15T20:00" }),
      ev({ id: "b", venue: "Armory", start: "2026-07-16T20:00" }),
      ev({ id: "c", venue: "Palace", start: "2026-07-17T20:00" }),
    ];
    const picks = weeklyPicks(list, NOW);
    const venues = picks.regular.map((e) => e.venue);
    expect(new Set(venues).size).toBe(venues.length); // no dup venues
  });

  it("returns nulls/empties when nothing is in window", () => {
    const picks = weeklyPicks([ev({ start: "2026-09-01T20:00" })], NOW);
    expect(picks.family).toBeNull();
    expect(picks.unique).toBeNull();
    expect(picks.regular).toHaveLength(0);
  });
});

describe("templates", () => {
  it("shortDate formats a Central date", () => {
    expect(shortDate("2026-07-18T20:00")).toBe("Sat, Jul 18");
  });

  it("caption includes title, date, venue, CTA and hashtags", () => {
    const c = captionFor(ev({ title: "Trampled by Turtles" }), "regular");
    expect(c).toContain("Trampled by Turtles");
    expect(c).toContain("📍 First Avenue");
    expect(c).toContain("citypulsemn.com");
    expect(c).toContain("#TwinCities");
  });

  it("family caption uses the family hook", () => {
    expect(captionFor(ev({ category: "family" }), "family")).toContain("whole crew");
  });

  it("hashtags include category + suburb tags and are capped", () => {
    const tags = hashtagsFor(ev({ category: "food", city: "Maple Grove" }));
    expect(tags).toContain("#MNfood");
    expect(tags).toContain("#MapleGrove");
    expect(tags.length).toBeLessThanOrEqual(11);
  });

  it("does not add a city hashtag for Minneapolis", () => {
    expect(hashtagsFor(ev({ city: "Minneapolis" }))).not.toContain("#Minneapolis".replace("Minneapolis", "MinneapolisCity"));
    // Minneapolis is a base tag already; no duplicate suburb tag added
    const tags = hashtagsFor(ev({ city: "Minneapolis" }));
    expect(tags.filter((t) => t === "#Minneapolis")).toHaveLength(1);
  });

  it("weekly caption lists picks and the site CTA", () => {
    const list = [
      ev({ id: "fam", title: "Zoo Day", category: "family", start: "2026-07-16T10:00" }),
      ev({ id: "mus", title: "Big Show", category: "music", start: "2026-07-18T20:00" }),
    ];
    const cap = weeklyCaptionFor(weeklyPicks(list, NOW));
    expect(cap).toContain("THIS WEEK IN THE TWIN CITIES");
    expect(cap).toContain("Zoo Day");
    expect(cap).toContain("citypulsemn.com");
  });
});
