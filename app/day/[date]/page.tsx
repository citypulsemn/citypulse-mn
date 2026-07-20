import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventsForDay } from "@/lib/events";
import { EventDayCard } from "@/components/EventDayCard";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { dayItemListJsonLd, jsonLdSafe } from "@/lib/seo/event-jsonld";
import { SITE_URL } from "@/lib/seo/site";
import { isValidDayKey, longDate } from "@/lib/event-view";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDayKey(date)) return { title: "Day not found — City Pulse MN" };

  const pretty = longDate(date);
  const title = `Things to do ${pretty} in the Twin Cities | City Pulse MN`;
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

  const events = await getEventsForDay(date);

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
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">
            ← All events
          </a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · one day</div>
          <h1 className="dayhdr-title">{longDate(date)}</h1>
          <div className="dayhdr-count">
            {events.length === 0
              ? "No events listed for this day yet."
              : `${events.length} event${events.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {events.length > 0 ? (
          <section className="day-list">
            {events.map((e) => (
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

        <SiteFooter source="day" />
      </main>
    </>
  );
}
