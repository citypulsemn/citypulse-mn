import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * G1.1 — the subscribe ask now reaches the two surfaces that were carrying only
 * the quiet footer form: the homepage (most traffic) and event pages (highest
 * intent). These tripwires pin that each mounts exactly one SubscribeBand with a
 * distinct source (so the ops digest reports conversion by placement), and that
 * the homepage band sits mid-flow (before the collections strip), not stacked on
 * the footer. Copy itself is intentionally NOT pinned — editorial is the owner's.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("homepage subscribe placement", () => {
  const home = read("app/page.tsx");

  it("mounts one SubscribeBand with source=home", () => {
    expect(home).toContain("SubscribeBand");
    expect(home).toContain('source="home"');
    expect((home.match(/<SubscribeBand/g) ?? []).length).toBe(1);
  });

  it("sits mid-flow, before the collections strip (not on the footer)", () => {
    expect(home.indexOf("<SubscribeBand")).toBeLessThan(home.indexOf("<CollectionsStrip"));
    expect(home.indexOf("<SubscribeBand")).toBeLessThan(home.indexOf("<SiteFooter"));
  });
});

describe("event page subscribe placement", () => {
  const page = read("app/event/[id]/page.tsx");

  it("mounts one SubscribeBand with source=event", () => {
    expect(page).toContain('source="event"');
    expect((page.match(/<SubscribeBand/g) ?? []).length).toBe(1);
  });

  it("sits after the event content, above the onward-discovery strips", () => {
    // band comes after the main </article>, before MoreAtVenue and the footer
    expect(page.indexOf("<SubscribeBand")).toBeGreaterThan(page.indexOf("</article>"));
    expect(page.indexOf("<SubscribeBand")).toBeLessThan(page.indexOf("<MoreAtVenue"));
  });
});

describe("warm-lead subscribe surfaces (G1.1 tail)", () => {
  it("the first-save nudge points the warm saver at /this-week", () => {
    const nudge = read("components/FirstSaveNudge.tsx");
    expect(nudge).toContain('href="/this-week"');
  });
});
