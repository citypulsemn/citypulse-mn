import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { EventDayCard } from "@/components/EventDayCard";
import { getEvents } from "@/lib/events";
import { neighborhoodByKey } from "@/lib/neighborhoods";
import { daysSpanned } from "@/lib/dates";

export const revalidate = 300;

// NO generateStaticParams — deliberately. Prerendering all 16 districts at
// build time meant 16 concurrent full getEvents() queries from parallel build
// workers, which stampeded the database connection pool on Vercel: every page
// waited past the 60-second prerender limit, retries piled on more load, and
// the build died (Jul 15). On-demand ISR renders each district on its first
// visit and caches it for 5 minutes — identical behavior for users, zero
// database dependency at build time.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const n = neighborhoodByKey(slug);
  if (!n) return {};
  const title = `Things to Do in ${n.label} | City Pulse MN`;
  const description = `Upcoming events in ${n.label}, ${n.city} — ${n.blurb}`;
  return {
    title,
    description,
    alternates: { canonical: `/neighborhoods/${n.key}` },
    openGraph: { title, description, url: `/neighborhoods/${n.key}`, type: "website", siteName: "City Pulse MN" },
  };
}

/**
 * One neighborhood's upcoming events (roadmap 5.5), soonest first, multi-day
 * aware (an ongoing run in the district still shows). Same read path as
 * everything else — clean titles, honest times.
 */
export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n = neighborhoodByKey(slug);
  if (!n) notFound();

  const now = Date.now();
  const events = (await getEvents())
    .filter((e) => e.status === "published" && e.neighborhood === n.key)
    .filter((e) => {
      const start = new Date(e.start).getTime();
      const spanEnd = daysSpanned(e).at(-1);
      const end = spanEnd ? new Date(`${spanEnd}T23:59`).getTime() : start;
      return !Number.isNaN(start) && Math.max(start, end) >= now;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/neighborhoods">← Neighborhoods</a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">{n.city} · neighborhood</div>
          <h1 className="dayhdr-title">{n.label}</h1>
          <div className="dayhdr-count">
            {n.blurb}
            {events.length > 0 &&
              ` — ${events.length} upcoming event${events.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {events.length === 0 ? (
          <div className="day-empty">
            Nothing on the calendar here right now.{" "}
            <a href="/neighborhoods">Browse other neighborhoods →</a>
          </div>
        ) : (
          <div className="day-list">
            {events.map((e) => (
              <EventDayCard key={e.id} event={e} />
            ))}
          </div>
        )}

        <SiteFooter source={`neighborhood-${n.key}`} />
      </main>
    </>
  );
}
