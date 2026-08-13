import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, getEvents, getEventsForDay } from "@/lib/events";
import { MoreAtVenue } from "@/components/MoreAtVenue";
import { EventDetailBody } from "@/components/EventDetailBody";
import { StatBeacon } from "@/components/StatBeacon";
import { EventDayCard } from "@/components/EventDayCard";
import { ShareButton } from "@/components/ShareButton";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeBand } from "@/components/SubscribeBand";
import { eventJsonLd, jsonLdSafe } from "@/lib/seo/event-jsonld";
import { SITE_URL } from "@/lib/seo/site";
import {
  dayKeyOf,
  eventMetaDescription,
  staticMapUrl,
  directionsUrl,
  longDate,
} from "@/lib/event-view";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found — City Pulse MN" };

  const title = `${event.title} — ${event.venue} | City Pulse MN`;
  const description = eventMetaDescription(event);
  const path = `/event/${event.id}`;

  // og:image / twitter:image are provided automatically by opengraph-image.tsx.
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      siteName: "City Pulse MN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  // UX1 — the cancelled/time-state banner and the dead-event action gating now
  // live inside EventDetailBody, so the page and the in-app modal never drift.
  const dayKey = dayKeyOf(event);
  const all = await getEvents();
  const siblings = (await getEventsForDay(dayKey))
    .filter((e) => e.id !== event.id)
    .slice(0, 3);

  const mapUrl = staticMapUrl(event.lat, event.lng, process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  // UX5 — tapping the venue map should get you THERE (native maps directions),
  // not dump you on the site-wide map of every event.
  const directions = directionsUrl(event);

  const imageUrl = event.image?.startsWith("http")
    ? event.image
    : `${SITE_URL}/event/${event.id}/opengraph-image`;
  const jsonLd = eventJsonLd(event, { baseUrl: SITE_URL, imageUrl });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <TopBar />

      <main className="wrap page">
        <article className="marquee page-card">
          {/* First-party view counter (roadmap 5.1): client-side so
              prefetches and non-JS crawlers do not inflate the numbers. */}
          <StatBeacon eventId={event.id} action="view" />
          <EventDetailBody
            event={event}
            actions={<ShareButton url={`/event/${event.id}`} title={event.title} eventId={event.id} />}
          />
          {mapUrl && (
            <a
              className="evt-map"
              href={directions ?? "/?view=map"}
              aria-label={directions ? `Get directions to ${event.venue}` : "Open the map view"}
              {...(directions ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapUrl}
                alt={`Map showing ${event.venue}`}
                width={720}
                height={280}
                loading="lazy"
              />
            </a>
          )}
        </article>

        {/* G1.1 — one inline subscribe ask at peak intent: right after the event
            content, above the onward-discovery strips. One band, no popup. */}
        <SubscribeBand source="event" />

        {siblings.length > 0 && (
          <section className="more-day">
            <h2 className="more-day-h">More on {longDate(dayKey)}</h2>
            <div className="more-day-list">
              {siblings.map((e) => (
                <EventDayCard key={e.id} event={e} />
              ))}
            </div>
            <a className="more-day-all" href={`/day/${dayKey}`}>
              See the full day →
            </a>
          </section>
        )}

        <MoreAtVenue all={all} current={event} now={new Date()} />

        <SiteFooter source="event" />
      </main>
    </>
  );
}
