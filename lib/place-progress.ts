import {
  KIND_META,
  KIND_COVERAGE,
  PLACES,
  placesByKind,
  type KindCoverage,
  type KindMeta,
  type Place,
  type PlaceKind,
} from "./places";

/**
 * "Been there" progress (Places P5). Pure: takes the visitor's checked-off
 * slugs plus the in-code registry and returns the numbers and the one line a
 * page shows. The denominator is never hand-typed, and the wording is honest
 * about what the denominator IS — an exhaustive metro sweep ("of 50 splash
 * pads in the metro") or a curated pick ("of the 22 parks on our list").
 *
 * Orphans — a slug that has since left the registry, or a slug of another
 * kind — are ignored: never counted, never an error, never a ghost row.
 */
export interface PlaceProgress {
  kind: PlaceKind;
  visited: number;
  total: number;
  coverage: KindCoverage;
}

export function placeProgress(kind: PlaceKind, visitedSlugs: ReadonlySet<string>): PlaceProgress {
  const all = placesByKind(kind);
  let visited = 0;
  for (const p of all) if (visitedSlugs.has(p.slug)) visited++;
  return { kind, visited, total: all.length, coverage: KIND_COVERAGE[kind] };
}

/**
 * The progress line, or null at zero. The zero state renders NOTHING — no
 * empty bar, no "0 of 50", no nudge to start (no dark patterns). The line
 * appears only after the first deliberate check.
 */
export function progressLine(p: PlaceProgress): string | null {
  if (p.visited === 0 || p.total === 0) return null;
  const plural = KIND_META[p.kind].plural.toLowerCase();
  return p.coverage === "exhaustive"
    ? `Been to ${p.visited} of ${p.total} ${plural} in the metro`
    : `Been to ${p.visited} of the ${p.total} ${plural} on our list`;
}

export interface VisitedKindGroup {
  meta: KindMeta;
  places: Place[];
  progress: PlaceProgress;
}

const ratio = (p: PlaceProgress) => (p.total === 0 ? 0 : p.visited / p.total);

/**
 * For /saved: every kind with at least one visit, most-complete first, ties by
 * plural. Kinds with zero visits are omitted (honest emptiness). Places within
 * a kind keep registry order (free-first, alphabetical) — the same order as the
 * kind page, so the two surfaces agree.
 */
export function visitedByKind(visitedSlugs: ReadonlySet<string>): VisitedKindGroup[] {
  const groups: VisitedKindGroup[] = [];
  for (const meta of Object.values(KIND_META)) {
    const places = placesByKind(meta.kind).filter((p) => visitedSlugs.has(p.slug));
    if (places.length === 0) continue;
    groups.push({ meta, places, progress: placeProgress(meta.kind, visitedSlugs) });
  }
  return groups.sort(
    (a, b) => ratio(b.progress) - ratio(a.progress) || a.meta.plural.localeCompare(b.meta.plural),
  );
}

/** Distinct registry places the visitor has checked off (orphans excluded). */
export function visitedCount(visitedSlugs: ReadonlySet<string>): number {
  let n = 0;
  for (const p of PLACES) if (visitedSlugs.has(p.slug)) n++;
  return n;
}
