import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * TERMS OF USE.
 *
 * Same rule as the privacy page: describe what this site actually is. The
 * accuracy disclaimer is the load-bearing part — listings are researched with
 * AI and have been wrong, which is a fact we know from measuring it, and
 * pretending otherwise in the one document meant to set expectations would be
 * the wrong way round.
 */
export const metadata: Metadata = {
  title: "Terms of Use | City Pulse MN",
  description:
    "The terms for using City Pulse MN — what we promise about listing accuracy, what we ask of you, and what happens with submitted events.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Use | City Pulse MN",
    description: "The terms for using City Pulse MN.",
    url: "/terms",
    type: "website",
    siteName: "City Pulse MN",
  },
};

// Not exported: an App Router page may only export a fixed set of names
// (default, metadata, revalidate…), and anything else fails the build's
// generated type check. lib/__tests__/legal-pages.test.ts reads it from source.
const LAST_UPDATED = "11 September 2026";

export default function TermsPage() {
  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">City Pulse MN · legal</div>
          <h1 className="dayhdr-title">Terms of use</h1>
          <p className="coll-tagline">
            Last updated {LAST_UPDATED}. City Pulse MN is a free events calendar for the
            Minneapolis&ndash;St. Paul metro. Using the site means you&rsquo;re fine with what
            follows.
          </p>
        </div>

        <section className="legal-body">
          <h2>What this site is, and what it isn&rsquo;t</h2>
          <p>
            We list events other people are putting on. We don&rsquo;t run them, sell tickets
            for them, or have any part in them. Your ticket, refund, entry and safety are
            between you and the organiser.
          </p>

          <h2>Accuracy &mdash; read this one</h2>
          <p>
            Listings are researched with the help of AI and checked against the
            organiser&rsquo;s own calendar where we can. <strong>They are still sometimes
            wrong.</strong> We have found and corrected listings with the wrong date, the wrong
            venue, and events that turned out not to be happening at all. We expect to find
            more.
          </p>
          <p>
            <strong>
              Before you travel, confirm the details on the organiser&rsquo;s own page.
            </strong>{" "}
            Every listing links to it. We publish this site as-is and we can&rsquo;t promise
            any listing is correct, current, or complete &mdash; and we&rsquo;re not
            responsible for a wasted trip, a missed event, or money spent on the strength of a
            listing here.
          </p>
          <p>
            If you find something wrong, the &ldquo;Cancelled or wrong? Tell us&rdquo; link on
            every listing reaches a person. Readers have caught real errors that way, and
            it&rsquo;s the fastest way to get one fixed.
          </p>

          <h2>Submitting an event</h2>
          <p>
            Anyone can submit an event. By submitting one you&rsquo;re telling us it&rsquo;s
            real, that the details are right, and that you have the right to share any text you
            include. We review submissions, we publish the ones that fit, and we may edit them
            for length, house style or accuracy. We&rsquo;re not obliged to publish anything,
            and we can take a listing down at any time.
          </p>

          <h2>Using the site</h2>
          <p>Please don&rsquo;t:</p>
          <ul>
            <li>scrape it wholesale or re-publish the calendar as your own;</li>
            <li>submit things that aren&rsquo;t real events, or that you know to be wrong;</li>
            <li>
              try to break the site, work around the rate limits, or get at data that
              isn&rsquo;t yours.
            </li>
          </ul>
          <p>
            Linking to us, quoting a listing with credit, and using the calendar feeds are all
            fine and encouraged.
          </p>

          <h2>What belongs to whom</h2>
          <p>
            Our editorial writing, page design and the way this calendar is put together belong
            to City Pulse MN. Event names, descriptions, images and logos belong to their
            organisers and venues, and appear here to tell you what&rsquo;s on. If
            you&rsquo;re an organiser and want a listing changed or removed, write to us and
            we&rsquo;ll sort it.
          </p>

          <h2>The email</h2>
          <p>
            The weekly email is free. Every issue has a one-click unsubscribe at the bottom and
            it works immediately &mdash; no login, no confirmation step, no retention offer.
            How we handle your address is in the{" "}
            <a href="/privacy">privacy policy</a>.
          </p>

          <h2>Links out</h2>
          <p>
            We link to venues, ticket sellers and organisers constantly. We don&rsquo;t control
            those sites and aren&rsquo;t responsible for what&rsquo;s on them or what happens
            when you buy something there.
          </p>

          <h2>Liability</h2>
          <p>
            City Pulse MN is provided as-is, with no warranty of any kind. To the extent the
            law allows, we&rsquo;re not liable for any loss arising from using the site or
            relying on a listing. Some places don&rsquo;t allow those limits to be excluded, in
            which case they apply to you only as far as that law permits.
          </p>

          <h2>Changes</h2>
          <p>
            These terms may change; the date at the top moves when they do. Minnesota law
            governs them.
          </p>

          <h2>Contact</h2>
          <p>
            <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a>.
          </p>
        </section>

        <SiteFooter source="terms" />
      </main>
    </>
  );
}
