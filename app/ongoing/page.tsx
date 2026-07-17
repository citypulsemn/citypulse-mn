import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { EventDayCard } from "@/components/EventDayCard";
import { getEvents } from "@/lib/events";
import { selectOngoing, throughLabel } from "@/lib/ongoing";

export const revalidate = 300;

const TITLE = "Ongoing in the Twin Cities — Exhibitions, Fairs & Long Runs | City Pulse MN";
const TAGLINE =
  "Everything running right now in Minneapolis & St. Paul — exhibitions, fairs, and long-run shows, sorted by closing date so you catch them before they're gone.";

export const metadata: Metadata = {
  title: TITLE,
  description: TAGLINE,
  alternates: { canonical: "/ongoing" },
  openGraph: { title: TITLE, description: TAGLINE, url: "/ongoing", type: "website", siteName: "City Pulse MN" },
};

/**
 * /ongoing (roadmap 2.2) — evergreen URL for the long runs, ending soonest
 * first. Small SEO bonus: "exhibitions in minneapolis right now".
 */
export default async function OngoingPage() {
  const events = await getEvents();
  const now = new Date();
  const ongoing = selectOngoing(events, now);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">← All events</a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · running now</div>
          <h1 className="dayhdr-title">Ongoing</h1>
          <div className="dayhdr-count">
            {ongoing.length === 0
              ? "Nothing long-running right now"
              : `${ongoing.length} long run${ongoing.length > 1 ? "s" : ""} · sorted by closing date`}
          </div>
        </div>

        {ongoing.length === 0 ? (
          <div className="day-empty">
            No exhibitions or long runs at the moment.{" "}
            <a href="/this-weekend">See what's on this weekend →</a>
          </div>
        ) : (
          <div className="day-list">
            {ongoing.map(({ event, endDay }) => (
              <div className="ongoing-item" key={event.id}>
                <div className="ongoing-through">{throughLabel(endDay, now)}</div>
                <EventDayCard event={event} />
              </div>
            ))}
          </div>
        )}

        <SiteFooter source="ongoing" />
      </main>
    </>
  );
}
