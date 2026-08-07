import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { kindsWithPlaces } from "@/lib/places";

// Static registry (no DB) — revalidate keeps the open/closed season state fresh.
export const revalidate = 3600;

const TAGLINE =
  "The Twin Cities' go-to spots — beaches, splash pads, and the places worth taking the kids on a day with nothing on the calendar.";

export const metadata: Metadata = {
  title: "Places — Twin Cities Parks, Beaches & Splash Pads | City Pulse MN",
  description: TAGLINE,
  alternates: { canonical: "/places" },
  openGraph: { title: "Places | City Pulse MN", description: TAGLINE, url: "/places", type: "website", siteName: "City Pulse MN" },
};

export default function PlacesIndexPage() {
  const kinds = kindsWithPlaces(new Date());

  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · where to go</div>
          <h1 className="dayhdr-title">Places</h1>
          <div className="dayhdr-count">{TAGLINE}</div>
        </div>

        <div className="nbhd-grid">
          {kinds.map(({ meta, count, open }) => (
            <a key={meta.kind} className="nbhd-card" href={`/places/${meta.kind}`}>
              <div className="nbhd-name">{meta.plural}</div>
              <div className="nbhd-blurb">{meta.blurb}</div>
              <div className="nbhd-count">
                {count} spot{count === 1 ? "" : "s"}
                {open ? "" : " · seasonal, closed now"} →
              </div>
            </a>
          ))}
          {/* P2.3 — venues already have their own browse (/venues, with live
              schedules). Places points there rather than duplicating the list. */}
          <a className="nbhd-card" href="/venues">
            <div className="nbhd-name">Venues</div>
            <div className="nbhd-blurb">
              The metro&apos;s concert halls, clubs, theaters, and arenas — each with its full upcoming schedule.
            </div>
            <div className="nbhd-count">Browse all venues →</div>
          </a>
        </div>

        <SiteFooter source="places" />
      </main>
    </>
  );
}
