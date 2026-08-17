import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { PlacesMapInteractive } from "@/components/PlacesMapInteractive";
import { PlacesBrowser } from "@/components/PlacesBrowser";
import {
  KIND_META,
  placesByKind,
  placesSeasonBanner,
  kindsWithPlaces,
  relatedKinds,
  KIND_EVENT_COLLECTION,
  type PlaceKind,
} from "@/lib/places";
import { getCollection } from "@/lib/collections";
import { PLACES_KIND_INTRO } from "@/lib/editorial";

// Static registry (no DB) — so build-time prerender is SAFE here: ENGINEERING
// rule 2 (no build-time DB prerenders) is about database-backed pages, and this
// reads none. revalidate keeps the open/closed season banner fresh.
export const revalidate = 3600;

export function generateStaticParams() {
  return kindsWithPlaces(new Date()).map((k) => ({ kind: k.meta.kind }));
}

function kindOf(kind: string): PlaceKind | null {
  const meta = KIND_META[kind as PlaceKind];
  return meta && placesByKind(kind as PlaceKind).length > 0 ? (kind as PlaceKind) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  const k = kindOf(kind);
  if (!k) return { title: "Not found — City Pulse MN" };

  const meta = KIND_META[k];
  const title = `${meta.plural} in the Twin Cities, Mapped | City Pulse MN`;
  const description = `${meta.blurb} A hand-checked, mapped list across the Minneapolis–St. Paul metro — locations, cost, and the details that matter.`;
  const path = `/places/${k}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: "City Pulse MN" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PlacesKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const k = kindOf(kind);
  if (!k) notFound();

  const meta = KIND_META[k];
  const places = placesByKind(k);
  const now = new Date();
  const banner = placesSeasonBanner(places, now);
  const intro = PLACES_KIND_INTRO[k] ?? meta.blurb;
  const related = relatedKinds(k);
  const eventCollSlug = KIND_EVENT_COLLECTION[k];
  const eventColl = eventCollSlug ? getCollection(eventCollSlug) : undefined;

  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · places</div>
          <h1 className="dayhdr-title">{meta.plural}</h1>
          <div className="dayhdr-count">
            {places.length} across the Twin Cities metro
          </div>
        </div>

        {banner && <div className="places-banner">{banner}</div>}

        <p className="page-intro places-intro">{intro}</p>

        {eventColl && (
          <p className="places-event-link">
            <a href={`/collections/${eventColl.slug}`}>
              See what&apos;s happening: {eventColl.title} on the calendar →
            </a>
          </p>
        )}

        <PlacesMapInteractive places={places} />
        <PlacesBrowser places={places} plural={meta.plural} />

        {related.length > 0 && (
          <nav className="related-guides" aria-label="More place guides">
            <h2 className="related-guides-title">More Twin Cities guides</h2>
            <div className="related-guides-links">
              {related.map((rk) => (
                <a key={rk} href={`/places/${rk}`} className="related-guide-link">
                  {KIND_META[rk].plural}
                </a>
              ))}
            </div>
          </nav>
        )}

        <SiteFooter source="places" />
      </main>
    </>
  );
}
