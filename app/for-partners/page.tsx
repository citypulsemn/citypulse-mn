import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { FOR_PARTNERS } from "@/lib/editorial";

/**
 * /for-partners (Monetization B4) — the sibling of /for-venues for the other
 * side of the relationship: not "get your events listed" but "put our calendar
 * on your screen". Static; copy lives in lib/editorial.ts where Taren edits
 * freely, and the limits paragraph there is load-bearing (see its comment).
 *
 * Deliberately NOT a feed index: the slug list belongs on the pages that own
 * each slice, where FeedSubscribe already renders a real, non-empty URL. 18 of
 * the 79 slugs carry no events in a given 30-day window (measured 29 Oct 2026),
 * so a bare list of all 79 would hand a partner a dead feed and call it an
 * offer — honest emptiness applies to what we advertise, not just what we show.
 */

export const metadata: Metadata = {
  title: "For Partners — The Twin Cities Calendar as a Feed | City Pulse MN",
  description:
    "Subscribe to any slice of the City Pulse MN events calendar as an iCalendar feed — categories, venues, neighborhoods, this weekend. Free, with attribution.",
  alternates: { canonical: "/for-partners" },
  openGraph: {
    title: "For Partners | City Pulse MN",
    description: "The Twin Cities calendar as a subscribable feed. Free, with attribution.",
    url: "/for-partners",
    type: "website",
    siteName: "City Pulse MN",
  },
};

export default function ForPartnersPage() {
  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · for partners</div>
          <h1 className="dayhdr-title">The calendar, as a feed</h1>
          <p className="coll-tagline">{FOR_PARTNERS.tagline}</p>
        </div>

        <section className="forv-section">
          <h2 className="coll-dayhead">What it is</h2>
          <p className="page-intro">{FOR_PARTNERS.what}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">The feeds</h2>
          <p className="page-intro">{FOR_PARTNERS.shapes}</p>
          {/* Point at the pages that own each slice rather than listing slugs
              here: those pages render a live subscribe affordance, and a slug
              that is empty this month is visibly empty there. */}
          <p className="page-intro">
            The subscribe link sits on the page for each slice —{" "}
            <a href="/venues">venues</a>, <a href="/neighborhoods">neighborhoods</a>,{" "}
            <a href="/collections">collections</a> and{" "}
            <a href="/this-weekend">this weekend</a>. Some rooms are quiet in a given
            month, and their feed is correspondingly empty.
          </p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">What arrives, and what doesn&rsquo;t</h2>
          <p className="page-intro">{FOR_PARTNERS.limits}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">How good is the data?</h2>
          <p className="page-intro">{FOR_PARTNERS.honesty}</p>
          <p className="page-intro">
            Found something wrong? <a href="/report">Report a listing →</a>
          </p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">Using it</h2>
          <p className="page-intro">{FOR_PARTNERS.terms}</p>
          <p className="page-intro">{FOR_PARTNERS.cost}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">What we don&rsquo;t promise</h2>
          <p className="page-intro">{FOR_PARTNERS.stability}</p>
        </section>

        <section className="forv-section">
          <h2 className="coll-dayhead">Ask for a slice, or opt out</h2>
          <p className="page-intro">
            {FOR_PARTNERS.contact}{" "}
            <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a>
          </p>
          <p className="page-intro">
            Run a venue instead? <a href="/for-venues">For venues →</a>
          </p>
        </section>

        <SiteFooter source="for-partners" />
      </main>
    </>
  );
}
