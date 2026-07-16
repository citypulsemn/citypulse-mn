import { CITY_AREA, normalizeCity, AREAS, type AreaKey } from "./areas";

/**
 * CITY LANDING PAGES (roadmap 6.2) — the other SEO axis.
 *
 * 5.5 built the neighborhood layer for the two core cities; this builds the
 * CITY layer for the whole metro: /cities/st-paul, /cities/bloomington —
 * the "things to do in {city}" searches.
 *
 * Derived from the area machinery (lib/areas.ts) the same way venue pages
 * derive from the sweep registry: every mapped city gets a stable URL, and
 * matching goes through the SAME normalizeCity the area filter uses, so
 * "Saint Paul", "St. Paul", and "st paul, MN" all land on one page.
 *
 * THIN-CONTENT RULE: ~110 suburbs exist in the map; most have no events most
 * weeks. All slugs render (stable URLs), but the index and the sitemap only
 * surface cities WITH upcoming events — a hundred empty pages is spam, not
 * SEO.
 */

export interface CityPage {
  slug: string;
  /** Canonical display name ("St. Paul", "White Bear Lake"). */
  name: string;
  area: AreaKey;
}

/** "st paul" → "St. Paul"; "white bear lake" → "White Bear Lake". */
export function displayCityName(normalized: string): string {
  return normalized
    .split(" ")
    .map((w) => (w === "st" ? "St." : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Normalized city → slug: "st paul" → "st-paul". */
export function slugifyCity(normalized: string): string {
  return normalized.replace(/ /g, "-");
}

export const CITY_PAGES: CityPage[] = Object.entries(CITY_AREA).map(([norm, area]) => ({
  slug: slugifyCity(norm),
  name: displayCityName(norm),
  area,
}));

const BY_SLUG = new Map(CITY_PAGES.map((c) => [c.slug, c]));

export function cityBySlug(slug: string): CityPage | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Match a free-text event city ("Saint Paul, MN") to a city slug, or null. */
export function matchCitySlug(eventCity: string): string | null {
  const slug = slugifyCity(normalizeCity(eventCity));
  return BY_SLUG.has(slug) ? slug : null;
}

/** Area label for grouping the index ("South metro"). */
export function areaLabel(key: AreaKey): string {
  return AREAS.find((a) => a.key === key)?.label ?? "Elsewhere";
}
