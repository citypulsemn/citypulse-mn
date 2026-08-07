import { neighborhoodByKey } from "@/lib/neighborhoods";
import type { Place, PlaceCost } from "@/lib/places";

const COST_LABEL: Record<PlaceCost, string> = { free: "Free", paid: "Paid", donation: "Donation" };

/**
 * The numbered list beneath the map. Entry N corresponds to map pin N (both take
 * the same free-first-sorted array from placesByKind). Each row: name, cost
 * badge, neighborhood link (the bridge to neighborhood pages) + city, amenity
 * tags, house-voice intro, and the source link — the honesty anchor for hours
 * and exact dates.
 */
export function PlacesList({ places }: { places: Place[] }) {
  return (
    <ol className="places-list">
      {places.map((p, i) => {
        const hood = p.neighborhood ? neighborhoodByKey(p.neighborhood) : null;
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
                {hood && (
                  <>
                    <a href={`/neighborhoods/${p.neighborhood}`}>{hood.label}</a>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                <span>{p.city}</span>
              </div>
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
