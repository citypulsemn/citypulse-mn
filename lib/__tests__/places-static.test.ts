import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Vercel Fluid Active CPU went 4h16m over a 4h allowance on 26 Aug 2026.
 *
 * The cause was not one expensive route — it was 2,198 sitemap URLs on 30-to-60
 * minute TTLs, walked by crawlers about once a day. A 1-hour TTL guarantees that
 * every daily crawl finds the page stale and pays for a full re-render:
 *
 *     human page views (30d)      3,464
 *     function invocations      131,218      — 38 per human view
 *     ISR writes                 80,539      — 61% of all invocations
 *
 * The 519 place detail pages were the largest single block, and they render from
 * `lib/places.ts` alone: no database, no clock. Their output cannot change
 * without a deploy, so they must never revalidate.
 *
 * This is a drift guard because the failure is invisible — a TTL added back here
 * costs money and changes nothing a reader would notice.
 */
const ROOT = join(__dirname, "..", "..");
// Normalize CRLF: this repo checks out with Windows line endings, and an
// anchored `\n}\n` silently matches nothing against `\r\n}\r\n`.
const read = (p: string) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

/** Source with comments removed — prose about `openNow` is not a call to it. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DETAIL = "app/places/[kind]/[slug]/page.tsx";
const DISCOVER = "app/places/discover/page.tsx";
const KIND = "app/places/[kind]/page.tsx";

describe("the places pages stay static", () => {
  it.each([DETAIL, KIND, DISCOVER])("%s never reads the visitor cookie on the server (P5)", (file) => {
    // "Been there" state is per visitor. Reading the cookie here would make
    // every one of these pages render per request — the exact CPU stampede
    // above. The state hydrates client-side from /api/visited instead.
    const body = codeOnly(read(file));
    expect(body).not.toMatch(/next\/headers/);
    expect(body).not.toMatch(/@\/lib\/saver/);
    expect(body).not.toMatch(/@\/lib\/place-visits/);
    expect(body).not.toMatch(/getSaverToken|getVisitedSlugs/);
  });

  it("place detail never revalidates", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/export const revalidate = false/);
    expect(src).not.toMatch(/export const revalidate = \d/);
  });

  it("place detail 404s unknown slugs at the CDN, not in a function", () => {
    // dynamicParams = true would make /places/beach/anything-at-all a function
    // invocation that renders notFound(). The registry is complete at build.
    expect(read(DETAIL)).toMatch(/export const dynamicParams = false/);
  });

  it("discover never revalidates", () => {
    const src = read(DISCOVER);
    expect(src).toMatch(/export const revalidate = false/);
    expect(src).not.toMatch(/export const revalidate = \d/);
  });

  it.each([DETAIL, DISCOVER])("%s reads no clock on the server", (file) => {
    // generateStaticParams runs at BUILD time and may enumerate with a date —
    // that is fine and does not make the rendered page date-dependent. The page
    // body is what must stay clock-free.
    const body = codeOnly(read(file)).replace(
      /export function generateStaticParams\(\)[\s\S]*?\n}\n/,
      "",
    );
    expect(body).not.toMatch(/new Date\(\)/);
    expect(body).not.toMatch(/\bopenNow\b/);
    expect(body).not.toMatch(/placesSeasonBanner/);
  });

  it("the open-now filter is client-side, which is what makes this safe", () => {
    // If this ever moved to the server, the pages above would freeze a seasonal
    // badge at build time and quietly tell a family a splash pad is open.
    const discover = read("components/PlacesDiscover.tsx");
    const browser = read("components/PlacesBrowser.tsx");
    for (const src of [discover, browser]) {
      expect(src.startsWith('"use client"')).toBe(true);
      expect(src).toMatch(/new Date\(\)/);
    }
  });
});
