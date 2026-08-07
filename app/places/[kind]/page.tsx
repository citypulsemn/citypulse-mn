import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { PlacesMap } from "@/components/PlacesMap";
import { PlacesList } from "@/components/PlacesList";
import {
  KIND_META,
  placesByKind,
  placesSeasonBanner,
  kindsWithPlaces,
  type PlaceKind,
} from "@/lib/places";
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
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

        <PlacesMap places={places} token={token} />
        <PlacesList places={places} />

        <SiteFooter source="places" />
      </main>
    </>
  );
}
