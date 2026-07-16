import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { EventDayCard } from "@/components/EventDayCard";
import { getEvents } from "@/lib/events";
import { cityBySlug, matchCitySlug } from "@/lib/cities";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { daysSpanned } from "@/lib/dates";

export const revalidate = 300;

// NO generateStaticParams — the recorded rule (5.5 build incident): build-time
// prerenders of DB-backed pages stampede the connection pool. On-demand ISR.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = cityBySlug(slug);
  if (!c) return {};
  const title = `Things to Do in ${c.name}, MN | City Pulse MN`;
  const description = `Upcoming events in ${c.name} — concerts, festivals, family outings, and more, updated weekly.`;
  return {
    title,
    description,
    alternates: { canonical: `/cities/${c.slug}` },
    openGraph: { title, description, url: `/cities/${c.slug}`, type: "website", siteName: "City Pulse MN" },
  };
}

/**
 * One city's upcoming events (roadmap 6.2), soonest first, multi-day aware.
 * The two core cities also cross-link DOWN into their neighborhoods (only
 * districts with something coming up — the 5.5 honesty rule).
 */
export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = cityBySlug(slug);
  if (!c) notFound();

  const now = Date.now();
  const events = (await getEvents())
    .filter((e) => e.status === "published" && matchCitySlug(e.city) === c.slug)
    .filter((e) => {
      const start = new Date(e.start).getTime();
      const spanEnd = daysSpanned(e).at(-1);
      const end = spanEnd ? new Date(`${spanEnd}T23:59`).getTime() : start;
      return !Number.isNaN(start) && Math.max(start, end) >= now;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  // Core cities: which of their districts have something coming up?
  const districtCounts = new Map<string, number>();
  for (const e of events) if (e.neighborhood) {
    districtCounts.set(e.neighborhood, (districtCounts.get(e.neighborhood) ?? 0) + 1);
  }
  const districts = NEIGHBORHOODS.filter(
    (n) => n.city === c.name && (districtCounts.get(n.key) ?? 0) > 0,
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/cities">← Cities</a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · city</div>
          <h1 className="dayhdr-title">{c.name}, MN</h1>
          <div className="dayhdr-count">
            {events.length === 0
              ? "Nothing on the calendar right now"
              : `${events.length} upcoming event${events.length > 1 ? "s" : ""}`}
          </div>
          {districts.length > 0 && (
            <div className="city-districts">
              By neighborhood:{" "}
              {districts.map((n, i) => (
                <span key={n.key}>
                  {i > 0 && " · "}
                  <a href={`/neighborhoods/${n.key}`}>{n.label}</a>
                </span>
              ))}
            </div>
          )}
        </div>

        {events.length === 0 ? (
          <div className="day-empty">
            Nothing on the calendar in {c.name} right now.{" "}
            <a href="/cities">Browse other cities →</a>
          </div>
        ) : (
          <div className="day-list">
            {events.map((e) => (
              <EventDayCard key={e.id} event={e} />
            ))}
          </div>
        )}

        <SiteFooter source={`city-${c.slug}`} />
      </main>
    </>
  );
}
