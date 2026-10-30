import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

describe("no route-level loading.tsx (the soft-404 rule, 30 Oct 2026)", () => {
  it("has none anywhere under app/", () => {
    // A loading.tsx wraps its segment AND every child segment in <Suspense>, so
    // React resolves the shell with the fallback and Next flushes the response —
    // status 200 — before the page's own notFound() has run. app-render.js is the
    // only place a notFound() becomes a status code, and by then the headers are
    // gone. The page still swaps in the not-found UI, so it LOOKS right; only the
    // status code and the position of the robots meta give it away.
    //
    // Measured 30 Oct 2026 on a production build against the real database. With
    // the four files present: /event/<unknown-uuid>, /venues/zzz-not-real,
    // /collections/zzz-not-real and /day/not-a-date all answered 200. With them
    // gone: all four answer 404, and the noindex meta moves from the body into
    // the head where a crawler is guaranteed to read it.
    //
    // This subsumes the older "NO root loading.tsx" tripwire, which existed
    // because a root one stuck over the homepage's client explorer (UX2, Jul).
    // Same file, a second and worse failure, so the rule is now simply: none.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : e.name === "loading.tsx"
            ? [join(dir, e.name).slice(ROOT.length + 1)]
            : [],
      );
    expect(walk(join(ROOT, "app"))).toEqual([]);
  });
});

describe("skeleton styles (still used by the admin panels and the explorer)", () => {
  it("shimmer + sr-only styles exist and respect reduced-motion", () => {
    // components/Skeletons.tsx went with the loading.tsx files, but .skel is still
    // worn by app/admin/growth, app/admin/ops and components/EventsExplorer.
    const css = read("app/globals.css");
    expect(css).toContain(".skel {");
    expect(css).toContain("@keyframes skel-shimmer");
    expect(css).toContain(".sr-only {");
    expect(css).toContain("prefers-reduced-motion");
  });
});
