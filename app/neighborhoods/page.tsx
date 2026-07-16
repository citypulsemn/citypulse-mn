import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getEvents } from "@/lib/events";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";

export const revalidate = 300;

const TAGLINE = "Twin Cities events by the places locals actually say — Uptown, Northeast, Lowertown, and the rest.";

export const metadata: Metadata = {
  title: "Neighborhoods | City Pulse MN",
  description: TAGLINE,
  alternates: { canonical: "/neighborhoods" },
  openGraph: { title: "Neighborhoods | City Pulse MN", description: TAGLINE, url: "/neighborhoods", type: "website", siteName: "City Pulse MN" },
};

/**
 * Neighborhood index (roadmap 5.5). Only neighborhoods with UPCOMING events
 * appear — an empty district card is a broken promise. Counts are computed
 * from the same read path the rest of the site uses.
 */
export default async function NeighborhoodsPage() {
  const events = await getEvents();
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.status !== "published" || !e.neighborhood) continue;
    const start = new Date(e.start).getTime();
    const end = e.multiDayEnd ? new Date(e.multiDayEnd).getTime() : start;
    if (Number.isNaN(start) || Math.max(start, end) < now) continue;
    counts.set(e.neighborhood, (counts.get(e.neighborhood) ?? 0) + 1);
  }

  const live = NEIGHBORHOODS.filter((n) => (counts.get(n.key) ?? 0) > 0);
  const cities = ["Minneapolis", "St. Paul"] as const;

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
          <div className="dayhdr-eyebrow">Twin Cities · by place</div>
          <h1 className="dayhdr-title">Neighborhoods</h1>
          <div className="dayhdr-count">{TAGLINE}</div>
        </div>

        {live.length === 0 ? (
          <div className="day-empty">
            Nothing mapped yet — neighborhood pages light up as geocoded events arrive.
          </div>
        ) : (
          cities.map((city) => {
            const list = live.filter((n) => n.city === city);
            if (list.length === 0) return null;
            return (
              <section key={city} className="nbhd-section">
                <h2 className="nbhd-city">{city}</h2>
                <div className="nbhd-grid">
                  {list.map((n) => (
                    <a key={n.key} className="nbhd-card" href={`/neighborhoods/${n.key}`}>
                      <div className="nbhd-name">{n.label}</div>
                      <div className="nbhd-blurb">{n.blurb}</div>
                      <div className="nbhd-count">
                        {counts.get(n.key)} upcoming event{counts.get(n.key)! > 1 ? "s" : ""} →
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <SiteFooter source="neighborhoods" />
      </main>
    </>
  );
}
