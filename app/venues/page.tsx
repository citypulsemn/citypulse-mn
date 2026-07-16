import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getEvents } from "@/lib/events";
import { VENUE_PAGES, matchVenueSlug } from "@/lib/venue-pages";

export const revalidate = 300;

const TAGLINE = "The Twin Cities rooms worth knowing — schedules, addresses, and what's coming up at each.";

export const metadata: Metadata = {
  title: "Venues | City Pulse MN",
  description: TAGLINE,
  alternates: { canonical: "/venues" },
  openGraph: { title: "Venues | City Pulse MN", description: TAGLINE, url: "/venues", type: "website", siteName: "City Pulse MN" },
};

/**
 * Venue index (roadmap 6.1). Venues with upcoming events lead, grouped by
 * city with counts; the rest of the registry follows as a compact link list —
 * every venue page stays reachable (and crawlable) even in a quiet week.
 */
export default async function VenuesPage() {
  const events = await getEvents();
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.status !== "published") continue;
    const start = new Date(e.start).getTime();
    const end = e.multiDayEnd ? new Date(e.multiDayEnd).getTime() : start;
    if (Number.isNaN(start) || Math.max(start, end) < now) continue;
    const slug = matchVenueSlug(e.venue);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const active = VENUE_PAGES.filter((v) => (counts.get(v.slug) ?? 0) > 0);
  const quiet = VENUE_PAGES.filter((v) => (counts.get(v.slug) ?? 0) === 0);
  const cities = [...new Set(active.map((v) => v.city))].sort();

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
          <div className="dayhdr-eyebrow">Twin Cities · by room</div>
          <h1 className="dayhdr-title">Venues</h1>
          <div className="dayhdr-count">{TAGLINE}</div>
        </div>

        {active.length === 0 ? (
          <div className="day-empty">Nothing on the calendar at tracked venues right now.</div>
        ) : (
          cities.map((city) => (
            <section key={city} className="nbhd-section">
              <h2 className="nbhd-city">{city}</h2>
              <div className="nbhd-grid">
                {active
                  .filter((v) => v.city === city)
                  .map((v) => (
                    <a key={v.slug} className="nbhd-card" href={`/venues/${v.slug}`}>
                      <div className="nbhd-name">{v.name}</div>
                      <div className="nbhd-count">
                        {counts.get(v.slug)} upcoming event{counts.get(v.slug)! > 1 ? "s" : ""} →
                      </div>
                    </a>
                  ))}
              </div>
            </section>
          ))
        )}

        {quiet.length > 0 && (
          <section className="nbhd-section">
            <h2 className="nbhd-city">Also tracked</h2>
            <p className="venue-quiet">
              {quiet.map((v, i) => (
                <span key={v.slug}>
                  {i > 0 && " · "}
                  <a href={`/venues/${v.slug}`}>{v.name}</a>
                </span>
              ))}
            </p>
          </section>
        )}

        <SiteFooter source="venues" />
      </main>
    </>
  );
}
