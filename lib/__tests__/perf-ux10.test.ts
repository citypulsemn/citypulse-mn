import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UX10 — perceived speed & interaction polish. These are render/CSS/perf
 * behaviors the node test env can't exercise, so the tripwires pin the
 * load-bearing wiring: fonts are self-hosted (no render-blocking Google Fonts
 * request), the lazy map has a sized placeholder, add-to-calendar is one tap,
 * and the back-to-top exists and is mounted.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("next/font migration (no render-blocking Google Fonts)", () => {
  const layout = read("app/layout.tsx");
  const css = read("app/globals.css");

  it("layout loads Inter + Oswald via next/font and applies their variables", () => {
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain("Inter(");
    expect(layout).toContain("Oswald(");
    expect(layout).toContain('variable: "--font-inter"');
    expect(layout).toContain('variable: "--font-oswald"');
    expect(layout).toContain("inter.variable");
    expect(layout).toContain("oswald.variable");
  });

  it("layout no longer requests fonts.googleapis / gstatic", () => {
    expect(layout).not.toContain("fonts.googleapis.com");
    expect(layout).not.toContain("fonts.gstatic.com");
  });

  it("globals.css references the font variables, not bare family names", () => {
    expect(css).toContain("var(--font-inter)");
    expect(css).toContain("var(--font-oswald)");
    // No stray quoted family literals left behind by the migration.
    expect(css).not.toContain('"Oswald"');
    expect(css).not.toContain('"Inter"');
  });
});

describe("lazy MapView has a sized loading placeholder", () => {
  const src = read("components/EventsExplorer.tsx");
  it("the dynamic import provides a loading fallback", () => {
    expect(src).toContain("loading:");
    expect(src).toContain("map-loading");
  });
  it("the placeholder is sized to the map height in CSS", () => {
    const css = read("app/globals.css");
    expect(css).toContain(".map-loading");
    expect(css).toContain("clamp(440px, 64vh, 720px)");
  });
});

describe("add-to-calendar is one tap (.ics primary, Google secondary)", () => {
  const src = read("components/AddToCalendar.tsx");
  it("the primary control is the .ics download link itself", () => {
    expect(src).toContain("download={");
    expect(src).toContain('className="addcal-btn"');
    expect(src).toContain("＋ Add to calendar");
  });
  it("Google Calendar is a secondary link, and the old disclosure is gone", () => {
    expect(src).toContain('className="addcal-gcal"');
    expect(src).not.toContain("<summary");
    expect(src).not.toContain("<details");
  });
});

describe("back-to-top", () => {
  it("shows only after scrolling and honors reduced motion", () => {
    const src = read("components/BackToTop.tsx");
    expect(src).toContain("window.scrollY > 800");
    expect(src).toContain("prefers-reduced-motion: reduce");
    expect(src).toContain('behavior: reduce ? "auto" : "smooth"');
  });
  it("is mounted globally in the layout", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("<BackToTop");
  });
});
