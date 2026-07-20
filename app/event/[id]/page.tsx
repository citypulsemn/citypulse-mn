import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, getEvents, getEventsForDay } from "@/lib/events";
import { MoreAtVenue } from "@/components/MoreAtVenue";
import { EventDetailBody } from "@/components/EventDetailBody";
import { StatBeacon } from "@/components/StatBeacon";
import { EventDayCard } from "@/components/EventDayCard";
import { ShareButton } from "@/components/ShareButton";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { eventJsonLd, jsonLdSafe } from "@/lib/seo/event-jsonld";
import { SITE_URL } from "@/lib/seo/site";
import {
  dayKeyOf,
  isEnded,
  eventMetaDescription,
  staticMapUrl,
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

  const now = new Date();
  const cancelled = event.status === "cancelled";
  const ended = !cancelled && (event.status === "archived" || isEnded(event, now));

  const dayKey = dayKeyOf(event);
  const all = await getEvents();
  const siblings = (await getEventsForDay(dayKey))
    .filter((e) => e.id !== event.id)
    .slice(0, 3);

  const mapUrl = staticMapUrl(event.lat, event.lng, process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

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
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">
            ← All events
          </a>
        </div>
      </header>

      <main className="wrap page">
        <article className="marquee page-card">
          {cancelled && (
            <div className="evt-banner cancelled">This event has been cancelled.</div>
          )}
          {ended && (
            <div className="evt-banner ended">This event has already happened.</div>
          )}
          {/* First-party view counter (roadmap 5.1): client-side so
              prefetches and non-JS crawlers do not inflate the numbers. */}
          <StatBeacon eventId={event.id} action="view" />
          <EventDetailBody
            event={event}
            actions={<ShareButton url={`/event/${event.id}`} title={event.title} eventId={event.id} />}
          />
          {mapUrl && (
            <a className="evt-map" href="/?view=map" aria-label="Open the map view">
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
