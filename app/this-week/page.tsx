import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeBand } from "@/components/SubscribeBand";
import { EventDayCard } from "@/components/EventDayCard";
import { getEvents } from "@/lib/events";
import { digestEvents, digestWeekLabel } from "@/lib/digest";
import { groupEventsByDay } from "@/lib/list-view";
import { dkey } from "@/lib/dates";
import { longDate } from "@/lib/event-view";
import { SITE_URL } from "@/lib/seo/site";
import { jsonLdSafe } from "@/lib/seo/event-jsonld";

export const revalidate = 1800; // 30 min — the week's picks are day-granular; admin edits bust it (lib/admin-actions).

// EVERGREEN by design (like /this-weekend): the URL never carries a date — this
// page IS "the weekly shortlist" forever; only the content rolls with the clock.
// G1.1 — it's the public shop window for the Thursday email: the exact set a new
// subscriber's first issue leads with, rendered as a shareable, indexable page
// that ends in the one subscribe ask. Growth surface first, SEO second.
const TITLE = "Things to Do This Week in the Twin Cities | City Pulse MN";
const TAGLINE =
  "The week's best across Minneapolis & St. Paul, hand-picked — the same shortlist we email every Thursday. Concerts, family outings, and the genuinely odd.";

export const metadata: Metadata = {
  title: TITLE,
  description: TAGLINE,
  alternates: { canonical: "/this-week" },
  openGraph: { title: TITLE, description: TAGLINE, url: "/this-week", type: "website", siteName: "City Pulse MN" },
  twitter: { card: "summary_large_image", title: TITLE, description: TAGLINE },
};

export default async function ThisWeekPage() {
  const events = await getEvents();
  const now = new Date();
  const picks = digestEvents(events, now);
  const weekLabel = digestWeekLabel(now);
  const groups = groupEventsByDay(picks, dkey(now));

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Things to do in the Twin Cities this week",
    itemListElement: picks.slice(0, 20).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.title,
      url: `${SITE_URL}/event/${e.id}`,
    })),
  };

  return (
    <>
      <TopBar />

      <main className="wrap page">
        {picks.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdSafe(itemList) }}
          />
        )}

        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · this week</div>
          <h1 className="dayhdr-title">This Week&rsquo;s Best</h1>
          <div className="dayhdr-count">
            {picks.length === 0
              ? TAGLINE
              : `${picks.length} hand-picked for ${weekLabel}`}
          </div>
        </div>

        <p className="page-intro">
          This is the shortlist we send by email every Thursday morning — the best
          of the Twin Cities in one place. Here&rsquo;s this week&rsquo;s;
          subscribe to get the next one in your inbox.
        </p>

        {picks.length === 0 ? (
          <>
            <div className="day-empty">
              This week&rsquo;s shortlist is refilling — the weekly sweep lands
              every Monday. <a href="/">Browse the full calendar →</a>
            </div>
            <SubscribeBand
              source="this-week"
              heading="Get this shortlist every Thursday"
              sub="One email a week — the week's best, hand-picked. Free, no spam."
            />
          </>
        ) : (
          <>
            {groups.map((g) => (
              <section className="wknd-section" key={g.key}>
                <h2 className="wknd-day">{longDate(g.key)}</h2>
                <div className="day-list">
                  {g.events.map((e) => (
                    <EventDayCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            ))}
            {/* One band, after the shortlist: hook (intro) → proof (list) → ask. */}
            <SubscribeBand
              source="this-week"
              heading="Get this shortlist every Thursday"
              sub="One email a week — the week's best, hand-picked. Free, no spam."
            />
          </>
        )}

        <SiteFooter source="this-week" />
      </main>
    </>
  );
}
