/**
 * The site's browse sections — the single source of truth for the shared TopBar
 * (every content page) AND the homepage's discovery strip (U3). Before U3 these
 * links appeared on the homepage only in the footer; now the homepage header
 * carries the same section-nav every other page has, so Places / Collections /
 * Venues / etc. are reachable from the top instead of buried at the bottom.
 */
export const SECTIONS: { href: string; label: string }[] = [
  // NOTE: these two must NOT read the same as the explorer's date presets
  // ("This Week" / "This Weekend" in components/ControlBar.tsx). Those filter
  // the calendar in place; these NAVIGATE to a curated shortlist. Same words on
  // two rows, one row apart, doing different things is a real trap — and the
  // "’s Best" suffix is what /this-week's own <h1> already calls itself.
  { href: "/this-week", label: "This Week’s Best" },
  { href: "/this-weekend", label: "This Weekend’s Best" },
  { href: "/ongoing", label: "Ongoing" },
  { href: "/collections", label: "Collections" },
  { href: "/places", label: "Places" },
  { href: "/venues", label: "Venues" },
  { href: "/neighborhoods", label: "Neighborhoods" },
  { href: "/cities", label: "Cities" },
];
