import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UX2 — app-shell safety net. App-Router boundary files can't be unit-rendered
 * here (no React test env), so these tripwires pin that the three boundaries
 * exist and carry the site chrome + an escape route, so a broken share link or
 * a data blip never lands a user on a bare, dead-end default page.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("not-found boundary (the broken-share-link case)", () => {
  it("exists, is noindex, wears the chrome, and offers a way back", () => {
    expect(existsSync(join(ROOT, "app", "not-found.tsx"))).toBe(true);
    const src = read("app/not-found.tsx");
    expect(src).toContain("index: false");
    expect(src).toContain("<Logo />");
    expect(src).toContain('href="/"'); // back to the calendar
  });
});

describe("error boundary (the data-blip case)", () => {
  it("exists, is a client component, logs, and offers a retry via reset()", () => {
    expect(existsSync(join(ROOT, "app", "error.tsx"))).toBe(true);
    const src = read("app/error.tsx");
    expect(src).toContain('"use client"');
    expect(src).toContain("reset");
    expect(src).toContain("onClick={() => reset()}");
    expect(src).toContain("console.error");
  });
});

describe("loading skeletons (perceived speed)", () => {
  it("leaf server pages have loading fallbacks using the shared skeletons", () => {
    // event = card shape; the list-shaped pages share ListSkeleton.
    expect(read("app/event/[id]/loading.tsx")).toContain("CardSkeleton");
    for (const seg of ["day/[date]", "venues", "collections"]) {
      expect(existsSync(join(ROOT, "app", ...seg.split("/"), "loading.tsx")), `${seg} loading`).toBe(true);
      expect(read(`app/${seg}/loading.tsx`)).toContain("ListSkeleton");
    }
  });

  it("there is NO root loading.tsx — it sticks over the homepage's client explorer", () => {
    expect(existsSync(join(ROOT, "app", "loading.tsx"))).toBe(false);
  });

  it("the skeleton shell is aria-busy and carries an SR 'Loading' label", () => {
    const src = read("components/Skeletons.tsx");
    expect(src).toContain('aria-busy="true"');
    expect(src).toContain("sr-only");
    expect(src).toContain("Loading");
  });

  it("shimmer + sr-only styles exist (and shimmer respects reduced-motion via the global reset)", () => {
    const css = read("app/globals.css");
    expect(css).toContain(".skel {");
    expect(css).toContain("@keyframes skel-shimmer");
    expect(css).toContain(".sr-only {");
    expect(css).toContain("prefers-reduced-motion");
  });
});
