import { VENUE_INTROS } from "@/lib/editorial";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
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
import { matchCitySlug } from "@/lib/cities";
import { isUpcoming } from "@/lib/dates";
import { SITE_URL } from "@/lib/seo/site";
import { jsonLdSafe } from "@/lib/seo/event-jsonld";

export const revalidate = 3600; // 1 hr — structural page; content changes weekly, admin edits bust it (lib/admin-actions).

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

  const now = new Date();
  const upcoming = all
    .filter((e) => isUpcoming(e, now)) // UX9 — same predicate as the index count
    .sort((a, b) => a.start.localeCompare(b.start));

  // UX9 — cross-link the venue's city to its city page (when one exists), the
  // sibling of the neighborhood link that was already here.
  const citySlug = matchCitySlug(v.city);

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
      <TopBar />

      <main className="wrap page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(placeJsonLd) }}
        />

        <div className="dayhdr">
          <div className="dayhdr-eyebrow">{v.city} · venue</div>
          <h1 className="dayhdr-title">{v.name}</h1>
          <div className="dayhdr-count">
            {address ? `${address}, ` : ""}
            {citySlug ? <a href={`/cities/${citySlug}`}>{v.city}</a> : v.city}
            {", MN"}
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

        <FeedSubscribe slug={`venue-${v.slug}`} source="venue" />

        <p className="feed-subscribe">
          <a href="/for-venues">Is this your venue? Get your events listed — free →</a>
        </p>

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
