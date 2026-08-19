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

  it("carries every browse section, incl. /this-week (G1.2 — the email shop window, sitewide-linked)", () => {
    // The section list is the shared SECTIONS source (used by TopBar AND the
    // homepage header since U3), so assert against it.
    const sections = read("lib/nav-sections.ts");
    for (const href of ["/this-week", "/this-weekend", "/ongoing", "/collections", "/places", "/venues", "/neighborhoods", "/cities"]) {
      expect(sections).toContain(`href: "${href}"`);
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

  it("every content page renders <TopBar> and no longer hand-rolls a topbar", () => {
    for (const p of pages) {
      const src = read(p);
      // "<TopBar" not "<TopBar />" — the events pages now pass an `actions` slot
      // (the view toggle), so they render <TopBar actions={…} />.
      expect(src, `${p} uses TopBar`).toContain("<TopBar");
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

describe("the view toggle rides the shared header on the events pages", () => {
  // The List/Calendar/Map control used to live ONLY inside EventsExplorer (the
  // homepage), so tapping "This Week" in the nav — a real navigation — landed on a
  // page with no view control at all. TopBar's `actions` slot existed but nothing
  // used it; these pages now fill it.
  const cases: [string, string][] = [
    ["app/this-week/page.tsx", 'range="week"'],
    ["app/this-weekend/page.tsx", 'range="weekend"'],
    ["app/ongoing/page.tsx", 'range="month"'],
  ];

  it("each events page passes ViewToggleLinks with its own range", () => {
    for (const [page, range] of cases) {
      const src = read(page);
      expect(src, `${page} imports the toggle`).toContain("ViewToggleLinks");
      expect(src, `${page} passes it via the actions slot`).toContain("<TopBar actions={");
      expect(src, `${page} carries its range`).toContain(range);
    }
  });

  it("TopBar still exposes the actions slot the pages fill", () => {
    const src = read("components/TopBar.tsx");
    expect(src).toContain("actions");
    expect(src).toContain("{actions}");
  });

  it("link mode navigates (anchors), it does not pretend to re-render in place", () => {
    // /this-week is a curated shortlist, not a date slice of the DB — Calendar/Map
    // genuinely cannot re-render the same events, so they must be links.
    const src = read("components/ViewToggle.tsx");
    expect(src).toContain('href={`/?view=${v.key}&range=${range}`}');
    expect(src).toContain('aria-current="page"'); // the page you're already on
  });
});

describe("SiteFooter links /this-week on every page (G1.2 internal-link equity)", () => {
  // The footer renders on the homepage too (which keeps its own topbar and so
  // has no section nav) — so this is /this-week's only sitewide link on the
  // site's highest-traffic page. Pin it, next to its This Weekend sibling.
  const src = read("components/SiteFooter.tsx");
  it("carries This Week and This Weekend in the footer link row", () => {
    expect(src).toContain('href="/this-week"');
    expect(src).toContain('href="/this-weekend"');
  });
});

describe("the homepage keeps its own interactive header", () => {
  it("EventsExplorer uses its own header (not the shared TopBar component), with the saved link AND the discovery section-nav (U3)", () => {
    const src = read("components/EventsExplorer.tsx");
    // Its own header, not the shared component (it needs the interactive view toggle).
    expect(src).not.toContain("<TopBar");
    expect(src).toContain("<SavedLink />");
    // U3: the browse sections are no longer footer-only on the homepage — the same
    // section-nav (from the shared SECTIONS source) now rides its header too.
    expect(src).toContain('className="section-nav"');
    expect(src).toContain("SECTIONS");
  });
});
