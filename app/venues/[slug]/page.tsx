import { VENUE_INTROS } from "@/lib/editorial";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeBand } from "@/components/SubscribeBand";
import { EventDayCard } from "@/components/EventDayCard";
import { FeedSubscribe } from "@/components/FeedSubscribe";
import { getEvents } from "@/lib/events";
import {
  venuePageBySlug,
  matchVenueSlug,
  dominantCoords,
  dominantAddress,
  staticMapUrl,
} from "@/lib/venue-pages";
import { neighborhoodOf } from "@/lib/neighborhoods";
import { daysSpanned } from "@/lib/dates";
import { SITE_URL } from "@/lib/seo/site";

export const revalidate = 300;

// NO generateStaticParams — the recorded rule from the 5.5 build incident:
// build-time prerenders of DB-backed pages stampede the connection pool.
// On-demand ISR: first visit renders, cached 5 minutes.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const v = venuePageBySlug(slug);
  if (!v) return {};
  const title = `${v.name} — Schedule & Upcoming Events | City Pulse MN`;
  const description = `What's coming up at ${v.name} in ${v.city} — dates, times, and tickets, updated weekly.`;
  return {
    title,
    description,
    alternates: { canonical: `/venues/${v.slug}` },
    openGraph: { title, description, url: `/venues/${v.slug}`, type: "website", siteName: "City Pulse MN" },
  };
}

/**
 * One venue's page (roadmap 6.1): the schedule people actually search for
 * ("first avenue schedule"), plus the address, a map, and Place JSON-LD.
 * Coordinates and address are derived from the venue's own events — see
 * dominantCoords: the mode is the building.
 */
export default async function VenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = venuePageBySlug(slug);
  if (!v) notFound();

  const all = (await getEvents()).filter(
    (e) => e.status === "published" && matchVenueSlug(e.venue) === v.slug,
  );

  const now = Date.now();
  const upcoming = all
    .filter((e) => {
      const start = new Date(e.start).getTime();
      const spanEnd = daysSpanned(e).at(-1);
      const end = spanEnd ? new Date(`${spanEnd}T23:59`).getTime() : start;
      return !Number.isNaN(start) && Math.max(start, end) >= now;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  // Derived facts about the room (from ALL its events, past included —
  // history knows where the building is even in a quiet week).
  const coords = dominantCoords(all);
  const address = dominantAddress(all);
  const nbhd = coords ? neighborhoodOf(coords.lat, coords.lng) : null;
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapUrl = coords && mapToken ? staticMapUrl(coords.lat, coords.lng, mapToken) : null;
  const directions = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.city} MN`)}`;

  const placeJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: v.name,
    url: `${SITE_URL}/venues/${v.slug}`,
    address: {
      "@type": "PostalAddress",
      ...(address ? { streetAddress: address } : {}),
      addressLocality: v.city,
      addressRegion: "MN",
      addressCountry: "US",
    },
    ...(coords ? { geo: { "@type": "GeoCoordinates", latitude: coords.lat, longitude: coords.lng } } : {}),
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/venues">← Venues</a>
        </div>
      </header>

      <main className="wrap page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
        />

        <div className="dayhdr">
          <div className="dayhdr-eyebrow">{v.city} · venue</div>
          <h1 className="dayhdr-title">{v.name}</h1>
          <div className="dayhdr-count">
            {address ? `${address}, ${v.city}, MN` : `${v.city}, MN`}
            {nbhd && (
              <span className="nbhd-chip">
                <a href={`/neighborhoods/${nbhd.key}`}>{nbhd.label}</a>
              </span>
            )}
            {" · "}
            <a href={directions} target="_blank" rel="noopener noreferrer">Directions ↗</a>
          </div>
          {VENUE_INTROS[v.slug] && <p className="page-intro">{VENUE_INTROS[v.slug]}</p>}
        </div>

        {mapUrl && (
          <img
            className="venue-map"
            src={mapUrl}
            alt={`Map showing ${v.name} in ${v.city}`}
            width={1280}
            height={400}
            loading="lazy"
          />
        )}

        {upcoming.length === 0 ? (
          <div className="day-empty">
            Nothing on the calendar here right now — the weekly sweep checks this room
            every Monday. <a href="/venues">Browse other venues →</a>
          </div>
        ) : (
          <>
            <div className="venue-count">
              {upcoming.length} upcoming event{upcoming.length > 1 ? "s" : ""}
            </div>
            <div className="day-list">
              {upcoming.map((e) => (
                <EventDayCard key={e.id} event={e} />
              ))}
            </div>
          </>
        )}

        <FeedSubscribe slug={`venue-${v.slug}`} />

        <SubscribeBand
          source="venue-page"
          heading="Never miss a show here"
          sub={`The week’s best Twin Cities events, including what’s coming to ${v.name}, every Thursday.`}
        />

        <SiteFooter source={`venue-${v.slug}`} />
      </main>
    </>
  );
}
