import { neighborhoodByKey } from "@/lib/neighborhoods";
import { KIND_META, PLACE_DETAIL_LABELS, type Place, type PlaceCost, type PlaceDetails } from "@/lib/places";

const COST_LABEL: Record<PlaceCost, string> = { free: "Free", paid: "Paid", donation: "Donation" };

/** The truthy detail facts of a place, as [key, label] pairs in render order. */
function detailBadges(details: PlaceDetails | undefined): [string, string][] {
  if (!details) return [];
  return (Object.keys(PLACE_DETAIL_LABELS) as (keyof PlaceDetails)[])
    .filter((k) => details[k] === true)
    .map((k) => [k, PLACE_DETAIL_LABELS[k]!]);
}

/**
 * The list beneath the map — and the accessible, screen-reader/keyboard path to
 * every location (the clustered GL map isn't per-point focusable). Rows carry an
 * `id={slug}` so a map popup can deep-link straight to one via `#slug` (the row
 * has `scroll-margin-top` so the sticky TopBar doesn't hide it). The leading
 * number is a plain ordinal now — the interactive map clusters, so the old
 * "pin N = row N" contract is gone. Each row: name, cost badge, neighborhood
 * link (the bridge to neighborhood pages) + city, amenity tags, house-voice
 * intro, and the source link — the honesty anchor for hours and exact dates.
 */
export function PlacesList({
  places,
  distances,
  showKind = false,
}: {
  places: Place[];
  /** Optional slug → straight-line miles from the user (set by the "Near me"
   *  sort). When present, each row shows its distance. */
  distances?: Map<string, number>;
  /** Cross-kind mode (the discover view): show each row's kind as a link, since
   *  the list mixes pools, museums, parks, etc. */
  showKind?: boolean;
}) {
  return (
    <ol className="places-list">
      {places.map((p, i) => {
        const hood = p.neighborhood ? neighborhoodByKey(p.neighborhood) : null;
        const miles = distances?.get(p.slug);
        const badges = detailBadges(p.details);
        return (
          <li key={p.slug} id={p.slug} className="place-row">
            <div className="place-num" aria-hidden="true">
              {i + 1}
            </div>
            <div className="place-body">
              <div className="place-head">
                <h2 className="place-name">{p.name}</h2>
                <span className={`place-cost cost-${p.cost}`}>{COST_LABEL[p.cost]}</span>
              </div>
              <div className="place-meta">
                {showKind && (
                  <>
                    <a className="place-kind" href={`/places/${p.kind}`}>
                      {KIND_META[p.kind].label}
                    </a>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                {hood && (
                  <>
                    <a href={`/neighborhoods/${p.neighborhood}`}>{hood.label}</a>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                <span>{p.city}</span>
                {miles !== undefined && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="place-dist">{miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi</span>
                  </>
                )}
              </div>
              {badges.length > 0 && (
                <div className="place-details">
                  {badges.map(([k, label]) => (
                    <span key={k} className="place-detail">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              {p.tags.length > 0 && (
                <div className="place-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="place-tag">
                      {t.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>
              )}
              <p className="place-intro">{p.intro}</p>
              <a className="place-source" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                Hours &amp; details ↗
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
