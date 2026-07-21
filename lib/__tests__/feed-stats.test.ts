import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFeedBeacon,
  summarizeFeedAdoption,
  FEED_SOURCES,
  type FeedCountRow,
} from "../feed-stats";
import { allFeedSlugs } from "../feeds";

const REAL_SLUGS = new Set(allFeedSlugs());

describe("parseFeedBeacon — integrity is the FK the beacon lacks", () => {
  it("accepts an advertised slug + known source (wire key 'feed' → payload 'slug')", () => {
    expect(parseFeedBeacon({ feed: "this-weekend", source: "weekend" })).toEqual({
      slug: "this-weekend",
      source: "weekend",
    });
    expect(parseFeedBeacon({ feed: "venue-first-avenue", source: "venue" }, REAL_SLUGS)).toEqual({
      slug: "venue-first-avenue",
      source: "venue",
    });
  });

  it("rejects an unadvertised slug (can't invent feeds to inflate)", () => {
    expect(parseFeedBeacon({ feed: "venue-my-basement", source: "venue" })).toBeNull();
    expect(parseFeedBeacon({ feed: "weird", source: "category" })).toBeNull(); // raw key, not a slug
  });

  it("rejects an unknown source", () => {
    expect(parseFeedBeacon({ feed: "this-weekend", source: "billboard" })).toBeNull();
  });

  it("rejects junk shapes without throwing", () => {
    expect(parseFeedBeacon(null)).toBeNull();
    expect(parseFeedBeacon("nope")).toBeNull();
    expect(parseFeedBeacon({ feed: 42, source: "venue" })).toBeNull();
    expect(parseFeedBeacon({ source: "venue" })).toBeNull();
    // event-beacon shape must NOT parse as a feed beacon
    expect(parseFeedBeacon({ id: "abc", action: "view" })).toBeNull();
  });

  it("every advertised slug is acceptable with a valid source", () => {
    for (const slug of allFeedSlugs()) {
      expect(parseFeedBeacon({ feed: slug, source: "other" })).not.toBeNull();
    }
    expect(FEED_SOURCES).toContain("other");
  });
});

describe("summarizeFeedAdoption — sums across sources, ranks by slug", () => {
  const rows: FeedCountRow[] = [
    { slug: "venue-first-avenue", source: "venue", n: 4 },
    { slug: "venue-first-avenue", source: "other", n: 1 }, // same feed, two surfaces
    { slug: "live-music", source: "collection", n: 3 },
    { slug: "uptown", source: "neighborhood", n: 2 },
  ];

  it("grand total counts every row", () => {
    expect(summarizeFeedAdoption(rows).clicks7).toBe(10);
  });

  it("top feeds merge a slug's sources and sort by count", () => {
    const { top } = summarizeFeedAdoption(rows);
    expect(top).toEqual([
      { label: "venue-first-avenue", count: 5 },
      { label: "live-music", count: 3 },
      { label: "uptown", count: 2 },
    ]);
  });

  it("honest emptiness: no rows → zero and no fake top", () => {
    expect(summarizeFeedAdoption([])).toEqual({ clicks7: 0, top: [] });
  });

  it("respects the top-N cap", () => {
    expect(summarizeFeedAdoption(rows, 2).top).toHaveLength(2);
  });
});

describe("query-text tripwires — the SQL the unit suite can't run", () => {
  const src = readFileSync(join(__dirname, "..", "feed-stats.ts"), "utf8");

  it("recordFeedClick upserts the per-(slug,source,day) counter in the Chicago frame", () => {
    expect(src).toContain("insert into feed_events (slug, source, day, count)");
    expect(src).toContain("(now() at time zone 'America/Chicago')::date");
    expect(src).toContain("on conflict (slug, source, day)");
    expect(src).toContain("do update set count = feed_events.count + 1");
  });

  it("getFeedAdoption windows on the Chicago day and groups by slug+source", () => {
    expect(src).toContain("from feed_events");
    expect(src).toContain("group by slug, source");
  });

  it("recordFeedClick swallows failures (never-break contract)", () => {
    const body = src.slice(src.indexOf("export async function recordFeedClick"));
    expect(body).toContain("catch");
  });
});

describe("beacon route wiring (F2.5)", () => {
  const route = readFileSync(join(__dirname, "..", "..", "app", "api", "beacon", "route.ts"), "utf8");

  it("parses BOTH beacon kinds before the rate check, records feed clicks, stays 204", () => {
    expect(route).toContain("parseFeedBeacon(raw)");
    expect(route.indexOf("parseBeacon(")).toBeLessThan(route.indexOf("rateAllow("));
    expect(route.indexOf("parseFeedBeacon(")).toBeLessThan(route.indexOf("rateAllow("));
    expect(route).toContain("recordFeedClick(feed.slug, feed.source)");
    expect(route).toContain("status: 204");
  });
});
