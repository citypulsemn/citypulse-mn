import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/events";
import { getCollection, selectCollection } from "@/lib/collections";
import { EventDayCard } from "@/components/EventDayCard";
import { FeedSubscribe } from "@/components/FeedSubscribe";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { dayItemListJsonLd, jsonLdSafe } from "@/lib/seo/event-jsonld";
import { SITE_URL } from "@/lib/seo/site";
import { dkey, evDate } from "@/lib/dates";
import { longDate } from "@/lib/event-view";
import type { EventRecord } from "@/lib/types";

export const revalidate = 300;

// Render on-demand, not at build. Collection pages read from the database, and
// prerendering all of them in parallel at build time exhausted Vercel's DB
// connection limit (each build render timed out). Returning no params means each
// page is generated on first request and then cached for `revalidate` seconds —
// same speed and SEO for visitors, without the build-time database stampede.
// (dynamicParams defaults to true, so any valid slug still renders.)
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: "Collection not found — City Pulse MN" };

  const title = `${collection.title} | City Pulse MN`;
  const path = `/collections/${collection.slug}`;
  return {
    title,
    description: collection.tagline,
    alternates: { canonical: path },
    openGraph: { title, description: collection.tagline, url: path, type: "website", siteName: "City Pulse MN" },
    twitter: { card: "summary_large_image", title, description: collection.tagline },
  };
}

/** Group events by day, preserving chronological order. */
function groupByDay(events: EventRecord[]): { key: string; events: EventRecord[] }[] {
  const groups: { key: string; events: EventRecord[] }[] = [];
  const index = new Map<string, EventRecord[]>();
  for (const e of events) {
    const k = dkey(evDate(e));
    if (!index.has(k)) {
      const arr: EventRecord[] = [];
      index.set(k, arr);
      groups.push({ key: k, events: arr });
    }
    index.get(k)!.push(e);
  }
  return groups;
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const events = await getEvents();
  const selected = selectCollection(events, collection, new Date());
  const groups = groupByDay(selected);

  return (
    <>
      {selected.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdSafe(dayItemListJsonLd(selected, { baseUrl: SITE_URL })),
          }}
        />
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/collections">
            ← All collections
          </a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Collection</div>
          <h1 className="dayhdr-title">{collection.title}</h1>
          <p className="coll-tagline">{collection.tagline}</p>
          <FeedSubscribe slug={collection.slug} />
          <div className="dayhdr-count">
            {selected.length === 0
              ? "Nothing here right now — check back soon."
              : `${selected.length} event${selected.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {groups.length > 0 ? (
          groups.map((g) => (
            <section key={g.key} className="coll-daygroup">
              <h2 className="coll-dayhead">{longDate(g.key)}</h2>
              <div className="day-list">
                {g.events.map((e) => (
                  <EventDayCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="day-empty">
            No events match this collection yet — new events land with every Monday refresh.
            <br />
            <a className="more-day-all" href="/">
              Browse the full calendar →
            </a>
          </div>
        )}

        <SiteFooter source="collection" />
      </main>
    </>
  );
}
