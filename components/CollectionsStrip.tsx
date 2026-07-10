import { COLLECTIONS } from "@/lib/collections";

/** A discoverable strip of curated collections for the homepage. */
export function CollectionsStrip() {
  return (
    <section className="collstrip">
      <div className="collstrip-head">
        <span className="collstrip-title">Browse by collection</span>
        <a className="collstrip-all" href="/collections">
          See all →
        </a>
      </div>
      <div className="collstrip-row">
        {COLLECTIONS.map((c) => (
          <a key={c.slug} className="collstrip-pill" href={`/collections/${c.slug}`}>
            {c.title}
          </a>
        ))}
      </div>
    </section>
  );
}
