import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { PlacesDiscover } from "@/components/PlacesDiscover";
import { PLACES } from "@/lib/places";

// Static registry (no DB) — safe to prerender.
//
// NEVER REVALIDATE, same reasoning as the place detail pages. The "open this
// season" filter this comment used to cite is CLIENT-side: `PlacesDiscover`
// evaluates `openNow` in the browser against the reader's own clock, which is
// both cheaper and more correct than a server render frozen at revalidate time.
// Nothing in this page's server output depends on the date.
export const revalidate = false;

const TAGLINE =
  "Every Twin Cities spot in one place — filter by free, indoor, and near you, across pools, museums, parks, dog parks, and more.";

export const metadata: Metadata = {
  title: "Find a Place — Free, Indoor & Family Spots Near You | City Pulse MN",
  description: TAGLINE,
  alternates: { canonical: "/places/discover" },
  openGraph: {
    title: "Find a Place | City Pulse MN",
    description: TAGLINE,
    url: "/places/discover",
    type: "website",
    siteName: "City Pulse MN",
  },
};

export default function PlacesDiscoverPage() {
  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · find a place</div>
          <h1 className="dayhdr-title">Find a Place</h1>
          <div className="dayhdr-count">{TAGLINE}</div>
        </div>

        <PlacesDiscover places={PLACES} />

        <SiteFooter source="places" />
      </main>
    </>
  );
}
