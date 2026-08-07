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

        {kinds.length === 0 ? (
          <div className="day-empty">Nothing mapped yet — these pages light up as the registry grows.</div>
        ) : (
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
          </div>
        )}

        <SiteFooter source="places" />
      </main>
    </>
  );
}
