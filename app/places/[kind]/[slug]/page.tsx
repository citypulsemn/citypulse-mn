import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeBand } from "@/components/SubscribeBand";
import { VisitButton } from "@/components/VisitButton";
import {
  KIND_META,
  placeForKindSlug,
  placesByKind,
  relatedKinds,
  kindsWithPlaces,
  PLACE_DETAIL_LABELS,
  type Place,
  type PlaceCost,
  type PlaceDetails,
  type PlaceKind,
} from "@/lib/places";
import { neighborhoodByKey } from "@/lib/neighborhoods";
import { placeDetailJsonLd } from "@/lib/seo/places-jsonld";
import { jsonLdSafe } from "@/lib/seo/event-jsonld";
import { staticMapUrl } from "@/lib/event-view";
import { SITE_URL } from "@/lib/seo/site";

// Static registry (no DB) — build-time prerender is SAFE (ENGINEERING rule 2 is
// about DB-backed pages).
//
// NEVER REVALIDATE. This page renders from `lib/places.ts` and nothing else:
// no database, no clock, no `openNow`. Its output cannot change until someone
// edits the registry, which requires a deploy, which rebuilds it anyway.
//
// It said `revalidate = 3600` with a comment about keeping "the open/closed
// season note fresh". There is no season note on this page — the open-now
// filter lives in the client components on the kind and discover pages. So all
// 519 of these re-rendered hourly, on demand, to produce byte-identical HTML.
// Measured 26 Aug 2026: 80,539 ISR writes in 30 days against 3,464 human page
// views, and Fluid Active CPU 4h16m over a 4h allowance. Crawlers walk the long
// tail about once a day, and a 1-hour TTL means every one of those visits paid
// for a full re-render.
//
// dynamicParams = false so a slug outside the registry is a static 404 at the
// CDN rather than a function invocation that calls notFound(). Together these
// take this route — the largest single block of URLs on the site — to zero
// function invocations.
export const revalidate = false;
export const dynamicParams = false;

const COST_LABEL: Record<PlaceCost, string> = { free: "Free", paid: "Paid", donation: "Donation" };

export function generateStaticParams() {
  return kindsWithPlaces(new Date()).flatMap(({ meta }) =>
    placesByKind(meta.kind).map((p) => ({ kind: meta.kind, slug: p.slug })),
  );
}

function resolve(kind: string, slug: string): { k: PlaceKind; place: Place } | null {
  if (!KIND_META[kind as PlaceKind]) return null;
  const place = placeForKindSlug(kind as PlaceKind, slug);
  return place ? { k: kind as PlaceKind, place } : null;
}

/** The verified detail facts, as [key, label] pairs in render order. */
function detailBadges(details: PlaceDetails | undefined): [string, string][] {
  if (!details) return [];
  return (Object.keys(PLACE_DETAIL_LABELS) as (keyof PlaceDetails)[])
    .filter((key) => details[key] === true)
    .map((key) => [key, PLACE_DETAIL_LABELS[key]!]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string; slug: string }>;
}): Promise<Metadata> {
  const { kind, slug } = await params;
  const r = resolve(kind, slug);
  if (!r) return { title: "Not found — City Pulse MN" };

  const { k, place } = r;
  const meta = KIND_META[k];
  const title = `${place.name} — ${meta.label} in ${place.city} | City Pulse MN`;
  const description = place.intro;
  const path = `/places/${k}/${place.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: place.name, description, url: path, type: "website", siteName: "City Pulse MN" },
    twitter: { card: "summary", title: place.name, description },
  };
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ kind: string; slug: string }>;
}) {
  const { kind, slug } = await params;
  const r = resolve(kind, slug);
  if (!r) notFound();

  const { k, place } = r;
  const meta = KIND_META[k];
  const hood = place.neighborhood ? neighborhoodByKey(place.neighborhood) : null;
  const badges = detailBadges(place.details);
  const related = relatedKinds(k);

  const mapUrl = staticMapUrl(place.lat, place.lng, process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const directions =
    Number.isFinite(place.lat) && Number.isFinite(place.lng) && !(place.lat === 0 && place.lng === 0)
      ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.city} MN`)}`;

  return (
    <>
      <TopBar />

      <main className="wrap page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(placeDetailJsonLd(place, k, { baseUrl: SITE_URL })) }}
        />

        <div className="dayhdr">
          <div className="dayhdr-eyebrow">
            <a href={`/places/${k}`}>{meta.plural}</a> · Twin Cities
          </div>
          <h1 className="dayhdr-title">{place.name}</h1>
          <div className="dayhdr-count">
            <span className={`place-cost cost-${place.cost}`}>{COST_LABEL[place.cost]}</span>
            {" · "}
            {place.address ? `${place.address}, ` : ""}
            {place.city}
            {", MN"}
            {hood && (
              <span className="nbhd-chip">
                <a href={`/neighborhoods/${place.neighborhood}`}>{hood.label}</a>
              </span>
            )}
            {" · "}
            <a href={directions} target="_blank" rel="noopener noreferrer">Directions ↗</a>
            {/* "Been there" (P5) — a client island; the page itself stays static. */}
            <VisitButton slug={place.slug} kind={k} />
          </div>
          <p className="page-intro">{place.intro}</p>
        </div>

        {mapUrl && (
          <img
            className="venue-map"
            src={mapUrl}
            alt={`Map showing ${place.name} in ${place.city}`}
            width={1440}
            height={560}
            loading="lazy"
          />
        )}

        {badges.length > 0 && (
          <div className="place-details place-details-lg">
            {badges.map(([key, label]) => (
              <span key={key} className="place-detail">
                {label}
              </span>
            ))}
          </div>
        )}

        {place.tags.length > 0 && (
          <div className="place-tags">
            {place.tags.map((t) => (
              <span key={t} className="place-tag">
                {t.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}

        <p className="place-source place-source-lg">
          <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
            Official page — hours &amp; details ↗
          </a>
        </p>

        <SubscribeBand
          source="place-page"
          heading="Twin Cities, worth leaving the house for"
          sub="The week’s best events and outings — concerts, festivals, and places like this — every Thursday."
        />

        {related.length > 0 && (
          <nav className="related-guides" aria-label="More place guides">
            <h2 className="related-guides-title">More Twin Cities guides</h2>
            <div className="related-guides-links">
              <a href={`/places/${k}`} className="related-guide-link">
                All {meta.plural}
              </a>
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
