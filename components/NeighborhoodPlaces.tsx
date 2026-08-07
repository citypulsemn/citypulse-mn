import { placesByNeighborhood, groupPlacesByKind, openNow } from "@/lib/places";

/**
 * "Places in {label}" — the P2.2 cross-link strip on a neighborhood page. Lists
 * the evergreen spots (beaches, splash pads, …) that sit in this district,
 * grouped by kind, each linking into its kind page (anchored to the entry). This
 * is the neighborhood→Places direction; the Places→neighborhood link already
 * lives in PlacesList. Honest emptiness: renders nothing when the district has
 * no registry places (most suburbs and outlying districts).
 */
export function NeighborhoodPlaces({ neighborhoodKey, label }: { neighborhoodKey: string; label: string }) {
  const places = placesByNeighborhood(neighborhoodKey);
  if (places.length === 0) return null;

  const now = new Date();
  const groups = groupPlacesByKind(places);

  return (
    <section className="nbhd-places">
      <h2 className="nbhd-places-h">Places in {label}</h2>
      {groups.map(({ meta, places: items }) => (
        <div key={meta.kind} className="nbhd-places-group">
          <div className="nbhd-places-kind">{meta.plural}</div>
          <ul className="nbhd-places-list">
            {items.map((p) => (
              <li key={p.slug}>
                <a href={`/places/${p.kind}#${p.slug}`}>{p.name}</a>
                {!openNow(p, now) && <span className="nbhd-places-closed"> · seasonal</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
