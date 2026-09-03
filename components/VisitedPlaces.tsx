import { progressLine, type VisitedKindGroup } from "@/lib/place-progress";
import { PLACE_VISIT_COPY } from "@/lib/editorial";

/**
 * "Places you've been" on /saved (Places P5). Server-rendered from the
 * visitor's token (the page is force-dynamic already): one block per kind
 * with the honest progress line and the places as plain links. Renders
 * nothing at zero — the section simply isn't there.
 */
export function VisitedPlaces({ groups }: { groups: VisitedKindGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="visited-places" aria-labelledby="visited-places-h">
      <h2 id="visited-places-h" className="visited-places-title">
        {PLACE_VISIT_COPY.savedHeading}
      </h2>
      {groups.map((g) => (
        <div key={g.meta.kind} className="visited-kind">
          <div className="visited-kind-head">
            <a className="visited-kind-name" href={`/places/${g.meta.kind}`}>
              {g.meta.plural}
            </a>
            <span className="visited-kind-line">{progressLine(g.progress)}</span>
          </div>
          <ul className="visited-kind-list">
            {g.places.map((p) => (
              <li key={p.slug}>
                <a href={`/places/${p.kind}/${p.slug}`}>{p.name}</a>
                <span className="visited-kind-city"> · {p.city}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
