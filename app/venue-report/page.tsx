import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { getEvents } from "@/lib/events";
import { getVenueStats, ctr } from "@/lib/stats";
import { aggregateVenueStats, findVenueReport, venueReportKey } from "@/lib/venue-report";
import { venuePageBySlug } from "@/lib/venue-pages";
import { verifyVenueToken, venueReportSecret, VENUE_REPORT_TTL_DAYS } from "@/lib/venue-token";
import { isUpcoming, shortDate, timeLabel } from "@/lib/dates";

/**
 * /venue-report — one venue's own numbers, behind a signed link (C1).
 *
 * No login, no account, no table. The URL is the credential
 * (lib/venue-token.ts), minted from the venue table on /admin/stats and pasted
 * into an email. Read-only in v1: there is nothing on this page a venue can
 * change, which is why a GET can safely render it (compare report-action,
 * where a GET had to be inert because mail scanners follow links).
 *
 * WHAT IT MUST NEVER SAY. We do not sell placement and cannot move anyone's
 * ranking, so this page states that in writing rather than leaving a business
 * to wonder what the next email offers. It is also honest about what the
 * numbers are: pageview-scale counts from our own table, not unique readers —
 * we have no verified unique-reader figure and must not imply one
 * (ENGINEERING rule 6, and the measurement caveat in ROADMAP-MONETIZATION.md).
 */

export const dynamic = "force-dynamic"; // a signed link per venue — never cached, never prerendered

export const metadata: Metadata = {
  title: "Your listings on City Pulse MN",
  robots: { index: false, follow: false },
};

const WINDOWS = [30, 90] as const;

export default async function VenueReportPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; exp?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const key = (sp.v ?? "").trim();
  const exp = Number(sp.exp ?? "");
  const token = (sp.t ?? "").trim();

  if (!verifyVenueToken(key, exp, token, venueReportSecret())) {
    return <Plain title="This link has expired">
      <p className="page-intro">
        Venue report links last {VENUE_REPORT_TTL_DAYS} days. Email{" "}
        <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a> and we will send a new one.
      </p>
    </Plain>;
  }

  // Both windows in one pass. Two grouped queries, and the page is low-traffic
  // by construction — only someone holding a signed link can reach it.
  const [stats30, stats90] = await Promise.all(WINDOWS.map((d) => getVenueStats(d)));
  const r30 = findVenueReport(aggregateVenueStats(stats30), key);
  const r90 = findVenueReport(aggregateVenueStats(stats90), key);

  const all = await getEvents();
  const mine = all.filter((e) => e.status === "published" && venueReportKey(e.venue) === key);
  const now = new Date();
  const upcoming = mine.filter((e) => isUpcoming(e, now)).sort((a, b) => a.start.localeCompare(b.start));

  // The name, in order of how well we know it: the stats rows (which carry the
  // curated registry name or the venue's own top spelling), then the registry
  // itself, then any listing we hold. The smoke caught the gap: a quiet
  // registry venue with no stats and no live listings printed its own URL slug
  // as a headline — "cabooze". If every source is empty we say nothing rather
  // than print a slug or title-case one into a name the venue never used.
  const name = r90?.name ?? r30?.name ?? venuePageBySlug(key)?.name ?? mine[0]?.venue ?? null;

  return (
    <Plain title={name ?? "Your listings on City Pulse MN"}>
      <p className="page-intro">
        What your listings did on City Pulse MN. Nothing here is for sale and nothing you do
        on this page changes how your events are ordered on the site — we have never sold
        placement and are not going to.
      </p>

      <section className="forv-section">
        <h2 className="coll-dayhead">People who looked, and people who clicked through</h2>
        <div className="cov-scroll">
          <table className="cov-table">
            <thead>
              <tr><th>Window</th><th>Listing views</th><th>Clicks to your tickets</th><th>Click rate</th></tr>
            </thead>
            <tbody>
              {WINDOWS.map((d, i) => {
                const r = i === 0 ? r30 : r90;
                return (
                  <tr key={d}>
                    <td>Last {d} days</td>
                    <td>{r ? r.views : 0}</td>
                    <td>{r ? r.clicks : 0}</td>
                    <td>{r ? `${ctr(r.views, r.clicks)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!r90 && (
          <p className="page-intro">
            No views or ticket clicks recorded for your listings in the last 90 days. That is the
            real number, not a missing one.
          </p>
        )}
        <p className="page-intro admin-dim">
          These are counts of page views and link clicks from our own database — no cookies, no
          user tracking, no identifiers of any kind. They are not unique visitors: one person
          looking twice counts twice, and we have no verified unique-reader figure to give you.
          Clicks are counted when someone taps through to your ticket or info link; what happens
          after that is on your side and we cannot see it.
        </p>
      </section>

      <section className="forv-section">
        <h2 className="coll-dayhead">
          {/* "Your 0 upcoming listings" is what the obvious version printed, and the
              zero case is the COMMON one here: a seasonal operator's report gets
              read the week after its season ends. The heading drops the count
              when there is nothing to count. */}
          {upcoming.length === 0
            ? "Upcoming listings"
            : upcoming.length === 1
              ? "Your one upcoming listing"
              : `Your ${upcoming.length} upcoming listings`}
        </h2>
        {upcoming.length === 0 ? (
          <p className="page-intro">
            We have nothing upcoming for you right now. If that is wrong,{" "}
            <a href="/submit">send it to us</a> — listing is free and always will be.
          </p>
        ) : (
          <ul className="page-intro">
            {upcoming.slice(0, 40).map((e) => (
              <li key={e.id}>
                <a href={`/event/${e.id}`}>{e.title}</a> · {shortDate(new Date(e.start))} · {timeLabel(e)}
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 40 && (
          <p className="page-intro admin-dim">Showing the next 40 of {upcoming.length}.</p>
        )}
      </section>

      <section className="forv-section">
        <h2 className="coll-dayhead">Something wrong?</h2>
        <p className="page-intro">
          A date we got wrong, a show that moved, an event that should not be listed at all:{" "}
          <a href="/report">report the listing</a> or email{" "}
          <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a>. Venue staff are the
          people who know first, and a correction from you goes to the front of the queue.
        </p>
        <p className="page-intro">
          <a href="/for-venues">How listings work →</a>
        </p>
      </section>
    </Plain>
  );
}

/** The page frame. No TopBar and no subscribe band — this is a report for one
 *  business, not a reader page, and the standing rule is one subscribe band per
 *  reader page, never a pitch where it was not asked for. */
function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">City Pulse MN · venue report</div>
          <h1 className="dayhdr-title">{title}</h1>
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
