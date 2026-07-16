import type { Metadata } from "next";
import { getTrendingEvents } from "@/lib/trending";
import { EventDayCard } from "@/components/EventDayCard";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

// Trending is volatile by nature — short cache, regenerated on demand.
export const revalidate = 300;

const TITLE = "Trending Now | City Pulse MN";
const TAGLINE = "What the Twin Cities is actually clicking on this week.";

export const metadata: Metadata = {
  title: TITLE,
  description: TAGLINE,
  alternates: { canonical: "/collections/trending" },
  openGraph: { title: TITLE, description: TAGLINE, url: "/collections/trending", type: "website", siteName: "City Pulse MN" },
  twitter: { card: "summary_large_image", title: TITLE, description: TAGLINE },
};

/**
 * The trending collection (roadmap 5.2). Unlike the declarative collections,
 * this one is ranked by the first-party stats feedback loop: recent
 * engagement, weighted by intent, with a 3-day half-life. When not enough
 * events genuinely qualify (the all-or-nothing rule in rankTrending), the
 * page says so plainly instead of dressing up noise as a trend.
 */
export default async function TrendingPage() {
  const trending = await getTrendingEvents();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="topnav">
            <a className="backlink" href="/collections">← Collections</a>
          </nav>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Collection</div>
          <h1 className="dayhdr-title">Trending Now</h1>
          <p className="coll-tagline">{TAGLINE}</p>
          <div className="dayhdr-count">
            {trending.length === 0
              ? "Measured, not curated — check back soon."
              : `${trending.length} event${trending.length > 1 ? "s" : ""} with real momentum`}
          </div>
        </div>

        {trending.length === 0 ? (
          <div className="day-empty">
            Nothing has broken out yet — trending is measured, not curated, and it only
            appears when enough events have real momentum.
            <br />
            <a href="/this-weekend">Browse this weekend&apos;s picks →</a>
          </div>
        ) : (
          <div className="day-list">
            {trending.map(({ event }) => (
              <EventDayCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter source="collection-trending" />
    </>
  );
}
