import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * UX6 — the shared TopBar. Before it, the eight sections lived only in the
 * footer, so a Google-arrival visitor couldn't reach the site's breadth from
 * the top. These pin: the TopBar carries every section + the ♥ saved link, and
 * the content pages actually use it (not their old bespoke headers).
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("TopBar component", () => {
  const src = read("components/TopBar.tsx");

  it("carries all six browse sections", () => {
    for (const href of ["/this-weekend", "/ongoing", "/collections", "/venues", "/neighborhoods", "/cities"]) {
      expect(src).toContain(`href: "${href}"`);
    }
  });

  it("carries the Logo (home) and the ♥ saved link on every page", () => {
    expect(src).toContain("<Logo />");
    expect(src).toContain("<SavedLink />");
  });

  it("the section nav is a horizontally-scrollable landmark", () => {
    expect(src).toContain('className="section-nav"');
    expect(src).toContain('aria-label="Browse sections"');
  });
});

describe("content pages use the shared TopBar", () => {
  const pages = [
    "app/event/[id]/page.tsx",
    "app/venues/[slug]/page.tsx",
    "app/venues/page.tsx",
    "app/neighborhoods/[slug]/page.tsx",
    "app/collections/[slug]/page.tsx",
    "app/collections/trending/page.tsx",
    "app/this-weekend/page.tsx",
    "app/ongoing/page.tsx",
    "app/day/[date]/page.tsx",
    "app/cities/[slug]/page.tsx",
    "app/saved/page.tsx",
    "app/submit/page.tsx",
    "app/for-venues/page.tsx",
  ];

  it("every content page renders <TopBar /> and no longer hand-rolls a topbar", () => {
    for (const p of pages) {
      const src = read(p);
      expect(src, `${p} uses TopBar`).toContain("<TopBar />");
      expect(src, `${p} dropped the bespoke header`).not.toContain('className="topbar"');
      expect(src, `${p} dropped the back-link`).not.toContain("page-back");
    }
  });

  it("only the terminal error-state pages keep a minimal header", () => {
    const withTopbar = readdirSync(join(ROOT, "app"), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && /\.tsx$/.test(e.name))
      .map((e) => join(e.parentPath, e.name))
      .filter((f) => readFileSync(f, "utf8").includes('className="topbar"'))
      .map((f) => f.replace(join(ROOT, "app"), "").replace(/\\/g, "/"));
    expect(withTopbar.sort()).toEqual(["/error.tsx", "/not-found.tsx", "/offline/page.tsx"]);
  });
});

describe("the homepage keeps its own interactive topbar", () => {
  it("EventsExplorer does NOT use TopBar (its presets/chips are its nav) but has the saved link", () => {
    const src = read("components/EventsExplorer.tsx");
    expect(src).not.toContain("TopBar");
    expect(src).toContain("<SavedLink />");
  });
});
