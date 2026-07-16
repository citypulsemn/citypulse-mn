import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { EventDayCard } from "@/components/EventDayCard";
import { getEvents } from "@/lib/events";
import { selectWeekend, weekendDays, weekendLabel } from "@/lib/weekend";
import { SITE_URL } from "@/lib/seo/site";

export const revalidate = 300;

// EVERGREEN by design: the title and URL never carry dates — this page IS
// "things to do this weekend" forever; only the content rolls with the clock.
const TITLE = "Things to Do in the Twin Cities This Weekend | City Pulse MN";
const TAGLINE =
  "What's actually worth leaving the house for in Minneapolis & St. Paul this weekend — concerts, festivals, food, and family picks, updated all week.";

export const metadata: Metadata = {
  title: TITLE,
  description: TAGLINE,
  alternates: { canonical: "/this-weekend" },
  openGraph: { title: TITLE, description: TAGLINE, url: "/this-weekend", type: "website", siteName: "City Pulse MN" },
  twitter: { card: "summary_large_image", title: TITLE, description: TAGLINE },
};

/**
 * /this-weekend (roadmap 6.3) — one permanent URL, the Instagram bio link,
 * the highest-intent search in local events. Day-grouped: "Happening all
 * weekend" (ongoing runs) on top, then Friday / Saturday / Sunday sections
 * that fall away as the weekend progresses (lib/weekend.ts is the clock).
 */
export default async function ThisWeekendPage() {
  const events = await getEvents();
  const now = new Date();
  const sections = selectWeekend(events, now);
  const days = weekendDays(now);
  const total = sections.reduce((n, s) => n + s.events.length, 0);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Things to do in the Twin Cities this weekend",
    itemListElement: sections
      .flatMap((s) => s.events)
      .slice(0, 20)
      .map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.title,
        url: `${SITE_URL}/event/${e.id}`,
      })),
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">← All events</a>
        </div>
      </header>

      <main className="wrap page">
        {total > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
          />
        )}

        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · {weekendLabel(days)}</div>
          <h1 className="dayhdr-title">This Weekend</h1>
          <div className="dayhdr-count">
            {total === 0
              ? TAGLINE
              : `${total} event${total > 1 ? "s" : ""} worth leaving the house for`}
          </div>
        </div>

        {total === 0 ? (
          <div className="day-empty">
            The weekend list is refilling — the weekly sweep lands every Monday.{" "}
            <a href="/">Browse the full calendar →</a>
          </div>
        ) : (
          sections.map((s) => (
            <section key={s.key} className="wknd-section">
              <h2 className="wknd-day">{s.heading}</h2>
              <div className="day-list">
                {s.events.map((e) => (
                  <EventDayCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))
        )}

        <SiteFooter source="this-weekend" />
      </main>
    </>
  );
}
