import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { FOR_VENUES } from "@/lib/editorial";

/**
 * /for-venues (roadmap 4.4) — the free half of the venue relationship,
 * stated in writing before money ever enters the conversation. Static;
 * copy lives in lib/editorial.ts where Taren edits freely.
 */

export const metadata: Metadata = {
  title: "For Venues — Get Your Events Listed Free | City Pulse MN",
  description:
    "How Twin Cities venues get their events on City Pulse MN: a weekly sweep, a verify pass, and a submit form. Free. No pay-to-list, no pay-to-rank, ever.",
  alternates: { canonical: "/for-venues" },
  openGraph: {
    title: "For Venues | City Pulse MN",
    description: "Get your Twin Cities events listed — free. No pay-to-list, ever.",
    url: "/for-venues",
    type: "website",
    siteName: "City Pulse MN",
  },
};

export default function ForVenuesPage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/venues">
            ← Venues
          </a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · for venues</div>
          <h1 className="dayhdr-title">Get your events listed</h1>
          <p className="coll-tagline">{FOR_VENUES.tagline}</p>
        </div>

        <section className="forv-section">
          <h2 className="coll-dayhead">How listings happen</h2>
          <p className="page-intro">{FOR_VENUES.how}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">What qualifies</h2>
          <p className="page-intro">{FOR_VENUES.qualifies}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">Missed something?</h2>
          <p className="page-intro">
            {FOR_VENUES.missing} <a href="/submit">Submit an event →</a>
          </p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">The rules</h2>
          <p className="page-intro">{FOR_VENUES.rules}</p>
        </section>

        <SiteFooter source="for-venues" />
      </main>
    </>
  );
}
