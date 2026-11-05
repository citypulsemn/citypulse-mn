import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventsForDay, getAlsoRunningForDay } from "@/lib/events";
import { alsoRunningPlan } from "@/lib/ongoing";
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
  // Two reads, in parallel. The second is a SEPARATE query on purpose: the day
  // query's R1.7b cap is pinned by a source tripwire and stays byte-identical.
  const [dayRows, longRunRows] = await Promise.all([
    getEventsForDay(date),
    getAlsoRunningForDay(date),
  ]);
  const events = orderDayEvents(dayRows, date);
  // Rendered as two groups so the leading run of already-running events is
  // explained rather than just looking out of clock order.
  const { ongoing, timed } = splitDayEvents(events, date);
  // The long runs the day query cannot show. Until 5 Nov 2026 this page printed
  // "Nothing on the calendar here yet" on days when an exhibition, a play and a
  // flower show were all open — rule 6, on the page that ranks for
  // "things to do in minneapolis <date>".
  const alsoRunning = alsoRunningPlan(longRunRows, date);
  // The ItemList normally describes the day's own slate, and deliberately leaves
  // the shelf out: the same ~30 standing runs across 365 day pages would make
  // every day's structured list near-identical. But on a day whose slate is
  // EMPTY the page would ship six visible cards and no structured data at all,
  // so the shelf stands in — the case this feature exists for (19 Jan 2027).
  const jsonLdEvents = events.length > 0 ? events : alsoRunning.items.map((o) => o.event);
  const { prev, next } = adjacentDayKeys(date);

  return (
    <>
      {jsonLdEvents.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdSafe(dayItemListJsonLd(jsonLdEvents, { baseUrl: SITE_URL })),
          }}
        />
      )}
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · one day</div>
          <h1 className="dayhdr-title">{longDate(date)}</h1>
          <div className="dayhdr-count">
            {events.length === 0 && alsoRunning.total === 0
              ? "No events listed for this day yet."
              : [
                  events.length > 0
                    ? `${events.length} event${events.length > 1 ? "s" : ""}`
                    : null,
                  alsoRunning.total > 0 ? `${alsoRunning.total} also running` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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

        {events.length > 0 && (
          <section className="day-list">
            {ongoing.length > 0 && (
              <>
                <h2 className="day-group-head">Already running</h2>
                {ongoing.map((e) => (
                  <EventDayCard key={e.id} event={e} dayKey={date} />
                ))}
                {timed.length > 0 && <h2 className="day-group-head">Starting today</h2>}
              </>
            )}
            {timed.map((e) => (
              <EventDayCard key={e.id} event={e} dayKey={date} />
            ))}
          </section>
        )}

        {/* ALSO RUNNING — the long runs the day query refuses, from the same
            planner the homepage day panel uses (lib/ongoing alsoRunningPlan).
            Capped and ending-soonest-first: a 233-day exhibition is not news on
            day 180, but "last day" is. Deliberately NOT in the ItemList JSON-LD
            above — the same ~30 standing runs on all 365 day pages would make
            every day's structured list near-identical, and each already has its
            own event page carrying its own schema. */}
        {alsoRunning.total > 0 && (
          <section className="day-list day-also">
            <h2 className="day-group-head">Also running</h2>
            {alsoRunning.items.map(({ event }) => (
              <EventDayCard key={event.id} event={event} dayKey={date} />
            ))}
            {/* NOT "See all {total}" — /ongoing is TODAY-relative and capped at 12
                (lib/ongoing.ts selectOngoing), so on any other day page that number
                is a promise it cannot keep. The honest total is in the header count
                line above; this is just the onward path. */}
            {alsoRunning.total > alsoRunning.items.length && (
              <a className="more-day-all" href="/ongoing">
                More ongoing runs →
              </a>
            )}
          </section>
        )}

        {events.length === 0 && alsoRunning.total === 0 && (
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

        <SiteFooter source="day" subscribe={false} />
      </main>
    </>
  );
}
