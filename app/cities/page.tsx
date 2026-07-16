import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getEvents } from "@/lib/events";
import { CITY_PAGES, matchCitySlug, areaLabel } from "@/lib/cities";
import type { AreaKey } from "@/lib/areas";

export const revalidate = 300;

const TAGLINE = "Twin Cities events by city — from the downtowns to the suburbs.";

export const metadata: Metadata = {
  title: "Cities | City Pulse MN",
  description: TAGLINE,
  alternates: { canonical: "/cities" },
  openGraph: { title: "Cities | City Pulse MN", description: TAGLINE, url: "/cities", type: "website", siteName: "City Pulse MN" },
};

/**
 * City index (roadmap 6.2). THIN-CONTENT RULE: only cities with upcoming
 * events appear — the metro map holds ~110 suburbs and most are quiet most
 * weeks; a wall of empty links helps no one. Grouped by area, the two core
 * cities first.
 */
export default async function CitiesPage() {
  const events = await getEvents();
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.status !== "published") continue;
    const start = new Date(e.start).getTime();
    const end = e.multiDayEnd ? new Date(e.multiDayEnd).getTime() : start;
    if (Number.isNaN(start) || Math.max(start, end) < now) continue;
    const slug = matchCitySlug(e.city);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const active = CITY_PAGES.filter((c) => (counts.get(c.slug) ?? 0) > 0);
  const AREA_ORDER: AreaKey[] = ["mpls", "stpaul", "north", "south", "east", "west", "other"];
  const groups = AREA_ORDER.map((a) => ({
    area: a,
    cities: active
      .filter((c) => c.area === a)
      .sort((x, y) => (counts.get(y.slug) ?? 0) - (counts.get(x.slug) ?? 0)),
  })).filter((g) => g.cities.length > 0);

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
          <div className="dayhdr-eyebrow">Twin Cities · by city</div>
          <h1 className="dayhdr-title">Cities</h1>
          <div className="dayhdr-count">{TAGLINE}</div>
        </div>

        {groups.length === 0 ? (
          <div className="day-empty">Nothing on the calendar right now.</div>
        ) : (
          groups.map((g) => (
            <section key={g.area} className="nbhd-section">
              <h2 className="nbhd-city">{areaLabel(g.area)}</h2>
              <div className="nbhd-grid">
                {g.cities.map((c) => (
                  <a key={c.slug} className="nbhd-card" href={`/cities/${c.slug}`}>
                    <div className="nbhd-name">{c.name}</div>
                    <div className="nbhd-count">
                      {counts.get(c.slug)} upcoming event{counts.get(c.slug)! > 1 ? "s" : ""} →
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))
        )}

        <SiteFooter source="cities" />
      </main>
    </>
  );
}
