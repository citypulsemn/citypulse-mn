import { describe, it, expect } from "vitest";
import {
  subscribeSourceLabel,
  summarizeSubscriberSources,
  type SubscriberSourceCount,
} from "../subscribe";

describe("subscribeSourceLabel — friendly placement names (G1.1 attribution)", () => {
  it("maps the high-traffic sources to readable labels", () => {
    expect(subscribeSourceLabel("home")).toBe("Homepage");
    expect(subscribeSourceLabel("this-week")).toBe("This Week page");
    expect(subscribeSourceLabel("event")).toBe("Event pages");
    expect(subscribeSourceLabel("day")).toBe("Day pages"); // discovery-routing band
  });

  it("prettifies an unmapped source instead of showing the raw key", () => {
    expect(subscribeSourceLabel("collection-trending")).toBe("Collection Trending");
    expect(subscribeSourceLabel("neighborhoods")).toBe("Neighborhoods");
  });

  it("treats blank/legacy-empty source as Direct / other", () => {
    expect(subscribeSourceLabel("")).toBe("Direct / other");
    expect(subscribeSourceLabel("   ")).toBe("Direct / other");
    expect(subscribeSourceLabel("site")).toBe("Direct / other");
  });
});

describe("summarizeSubscriberSources — shape for the admin table", () => {
  const rows: SubscriberSourceCount[] = [
    { source: "home", total: 3, last30d: 1 },
    { source: "this-week", total: 5, last30d: 2 },
    { source: "event", total: 2, last30d: 0 },
  ];

  it("sorts by total desc and attaches label + share", () => {
    const out = summarizeSubscriberSources(rows);
    expect(out.map((r) => r.source)).toEqual(["this-week", "home", "event"]);
    expect(out[0]).toMatchObject({ label: "This Week page", total: 5, last30d: 2, share: 50 });
    // shares are whole-percent of the 10 total: 5/10, 3/10, 2/10
    expect(out.map((r) => r.share)).toEqual([50, 30, 20]);
  });

  it("breaks ties alphabetically by source for a stable order", () => {
    const tied: SubscriberSourceCount[] = [
      { source: "venues", total: 4, last30d: 0 },
      { source: "cities", total: 4, last30d: 0 },
    ];
    expect(summarizeSubscriberSources(tied).map((r) => r.source)).toEqual(["cities", "venues"]);
  });

  it("does NOT merge distinct sources that share a label (honest to the raw data)", () => {
    const out = summarizeSubscriberSources([
      { source: "venue", total: 2, last30d: 0 },
      { source: "venue-page", total: 1, last30d: 0 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.label === "Venue pages")).toBe(true);
    expect(out.map((r) => r.source)).toEqual(["venue", "venue-page"]);
  });

  it("honest-empty: no rows in, no rows out (no divide-by-zero)", () => {
    expect(summarizeSubscriberSources([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input: SubscriberSourceCount[] = [
      { source: "home", total: 1, last30d: 0 },
      { source: "event", total: 9, last30d: 0 },
    ];
    const snapshot = input.map((r) => r.source);
    summarizeSubscriberSources(input);
    expect(input.map((r) => r.source)).toEqual(snapshot);
  });
});
