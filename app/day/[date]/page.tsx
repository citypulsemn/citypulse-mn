import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventsForDay } from "@/lib/events";
import { orderDayEvents, splitDayEvents } from "@/lib/day-order";
import { EventDayCard } from "@/components/EventDayCard";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeBand } from "@/components/SubscribeBand";
import { dayItemListJsonLd, jsonLdSafe } from "@/lib/seo/event-jsonld";
import { SITE_URL } from "@/lib/seo/site";
import { isValidDayKey, longDate, adjacentDayKeys } from "@/lib/event-view";

export const revalidate = 1800; // 30 min — a day's slate changes weekly; admin edits bust it (lib/admin-actions).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDayKey(date)) return { title: "Day not found — City Pulse MN" };

  const pretty = longDate(date);
  // "Minneapolis" in the title matches the winning query pattern (GSC: the day
  // pages rank for "events in minneapolis [date]/tomorrow"); the old title said
  // only "Twin Cities" while the demand searches Minneapolis by name.
  const title = `Things to Do in Minneapolis–St. Paul, ${pretty} | City Pulse MN`;
  const description = `Events across the Minneapolis–St. Paul metro on ${pretty} — music, sports, family, arts, food, festivals and the wonderfully unique.`;
  const path = `/day/${date}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: "City Pulse MN" },
    twitter: { card: "summary", title, description },
  };
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDayKey(date)) notFound();

  // Order spans-first then chronological by start time, shared with the DayPanel
  // via orderDayEvents so the page and the homepage panel agree (U2). Reorder before
  // the JSON-LD too, so ItemList position matches the visible order.
  const events = orderDayEvents(await getEventsForDay(date), date);
  // Rendered as two groups so the leading run of already-running events is
  // explained rather than just looking out of clock order.
  const { ongoing, timed } = splitDayEvents(events, date);
  const { prev, next } = adjacentDayKeys(date);

  return (
    <>
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdSafe(dayItemListJsonLd(events, { baseUrl: SITE_URL })),
          }}
        />
      )}
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · one day</div>
          <h1 className="dayhdr-title">{longDate(date)}</h1>
          <div className="dayhdr-count">
            {events.length === 0
              ? "No events listed for this day yet."
              : `${events.length} event${events.length > 1 ? "s" : ""}`}
          </div>
          {/* UX9 — step to the neighbouring day; a day page is no longer a
              dead-end when someone arrives on it from search or a share. */}
          <nav className="day-nav" aria-label="Nearby days">
            <a className="day-nav-link" href={`/day/${prev}`} rel="prev">
              ← {longDate(prev)}
            </a>
            <a className="day-nav-link" href={`/day/${next}`} rel="next">
              {longDate(next)} →
            </a>
          </nav>
        </div>

        {events.length > 0 ? (
          <section className="day-list">
            {ongoing.length > 0 && (
              <>
                <h2 className="day-group-head">Already running</h2>
                {ongoing.map((e) => (
                  <EventDayCard key={e.id} event={e} />
                ))}
                {timed.length > 0 && <h2 className="day-group-head">Starting today</h2>}
              </>
            )}
            {timed.map((e) => (
              <EventDayCard key={e.id} event={e} />
            ))}
          </section>
        ) : (
          <div className="day-empty">
            Nothing on the calendar here yet — new events land with every Monday refresh.
            <br />
            <a className="more-day-all" href="/">
              Browse the full calendar →
            </a>
          </div>
        )}

        {/* Amplify-what-ranks: day pages are the discovery surface that already
            ranks for "events in minneapolis [date]/tomorrow", but they had no
            subscribe ask and didn't link to the curated shortlist. These onward
            links route that discovery traffic to the shop-window /this-week(end)
            AND pass internal-link equity to those pages, which rank for nothing. */}
        <nav className="onward" aria-label="More to explore">
          <a className="day-nav-link" href="/this-week">
            See this week&rsquo;s hand-picked best →
          </a>
          <a className="day-nav-link" href="/this-weekend">
            This weekend →
          </a>
        </nav>

        <SubscribeBand
          source="day"
          heading="Never miss a day like this"
          sub="One email every Thursday — the week's best across Minneapolis & St. Paul, hand-picked. Free, no spam, unsubscribe anytime."
        />

        <SiteFooter source="day" />
      </main>
    </>
  );
}
