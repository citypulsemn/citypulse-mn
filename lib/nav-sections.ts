/**
 * The site's browse sections — the single source of truth for the shared TopBar
 * (every content page) AND the homepage's discovery strip (U3). Before U3 these
 * links appeared on the homepage only in the footer; now the homepage header
 * carries the same section-nav every other page has, so Places / Collections /
 * Venues / etc. are reachable from the top instead of buried at the bottom.
 */
export const SECTIONS: { href: string; label: string }[] = [
  { href: "/this-week", label: "This Week" },
  { href: "/this-weekend", label: "This Weekend" },
  { href: "/ongoing", label: "Ongoing" },
  { href: "/collections", label: "Collections" },
  { href: "/places", label: "Places" },
  { href: "/venues", label: "Venues" },
  { href: "/neighborhoods", label: "Neighborhoods" },
  { href: "/cities", label: "Cities" },
];
