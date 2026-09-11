import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * PRIVACY POLICY.
 *
 * Written from what the code actually does, not from a template — every claim
 * below is checkable against db/schema.sql, lib/saver.ts, lib/rate-limit.ts and
 * lib/stats.ts. That is the point: a policy describing data we do not hold, or
 * omitting data we do, is worse than none.
 *
 * If you change what the site collects, change this page in the same commit.
 * `lib/__tests__/legal-pages.test.ts` pins the specific claims that would go
 * stale first.
 */
export const metadata: Metadata = {
  title: "Privacy Policy | City Pulse MN",
  description:
    "What City Pulse MN collects, why, who it goes to, and how to get it deleted. Written from what the site actually does.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | City Pulse MN",
    description: "What we collect, why, and how to have it deleted.",
    url: "/privacy",
    type: "website",
    siteName: "City Pulse MN",
  },
};

// Not exported: an App Router page may only export a fixed set of names
// (default, metadata, revalidate…), and anything else fails the build's
// generated type check. lib/__tests__/legal-pages.test.ts reads it from source.
const LAST_UPDATED = "11 September 2026";

export default function PrivacyPage() {
  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">City Pulse MN · legal</div>
          <h1 className="dayhdr-title">Privacy policy</h1>
          <p className="coll-tagline">
            Last updated {LAST_UPDATED}. The short version: we collect an email address if you
            ask for the newsletter, and we keep one cookie so your saved events survive a
            refresh. We don&rsquo;t sell anything, we don&rsquo;t run advertising trackers, and
            we don&rsquo;t build a profile of you.
          </p>
        </div>

        <section className="legal-body">
          <h2>What we collect</h2>

          <h3>Your email address, if you give it to us</h3>
          <p>
            There are three ways we end up with your email, and all three are things you
            choose to do:
          </p>
          <ul>
            <li>
              <strong>Subscribing to the weekly email.</strong> We store the address, the date,
              and which page you subscribed from &mdash; the last so we know which parts of the
              site are useful.
            </li>
            <li>
              <strong>Submitting an event.</strong> Optional. If you include it, we use it to
              ask you questions about your submission.
            </li>
            <li>
              <strong>Reporting a wrong listing.</strong> Also optional, also only used to
              follow up.
            </li>
          </ul>

          <h3>One cookie, so the site remembers your saved events</h3>
          <p>
            When you save an event or check off a place you&rsquo;ve been, we set a cookie
            containing a random identifier &mdash; not your name, not your email. It lets us
            store your saved list against that identifier so it&rsquo;s still there next time.
            The cookie is <code>httpOnly</code> (JavaScript on the page cannot read it) and
            lasts a year.
          </p>
          <p>
            We should be straight about what this means: the saved-events and been-there lists
            are tied to a persistent identifier, so they are pseudonymous rather than anonymous.
            We have no way to connect that identifier to your name, and we don&rsquo;t try.
          </p>

          <h3>Counts of what gets clicked</h3>
          <p>
            We record that an event page was viewed, that a ticket link was clicked, or that a
            calendar file was downloaded. These are stored as{" "}
            <strong>daily totals per event</strong> &mdash; a number that goes up &mdash; with
            no row per person and nothing tying a click to you. We do this so we can tell which
            listings are worth the work.
          </p>

          <h3>IP addresses, briefly</h3>
          <p>
            To stop one machine from flooding a form or a counter, we keep a short-lived
            counter keyed to your IP address (and, on the forms, to the email address you
            typed). These records are{" "}
            <strong>deleted automatically after two days</strong> and are used for nothing
            else.
          </p>

          <h2>What we don&rsquo;t do</h2>
          <ul>
            <li>We don&rsquo;t sell or rent your data. There is no advertising on this site.</li>
            <li>
              We don&rsquo;t run advertising or cross-site tracking pixels &mdash; no Meta
              pixel, no Google Ads tag.
            </li>
            <li>We don&rsquo;t accept file uploads, so we&rsquo;re not holding any.</li>
            <li>We don&rsquo;t ask for or store payment details. Everything here is free.</li>
            <li>
              We don&rsquo;t knowingly collect anything from children under 13. If you think we
              have, write to us and we&rsquo;ll delete it.
            </li>
          </ul>

          <h2>Who else touches it</h2>
          <p>
            Running the site means using a handful of companies. They act on our instructions
            and we don&rsquo;t authorise them to use your data for their own purposes:
          </p>
          <ul>
            <li>
              <strong>Vercel</strong> &mdash; hosting. Serves every page, and keeps standard
              server logs.
            </li>
            <li>
              <strong>Supabase</strong> &mdash; the database where the above is stored.
            </li>
            <li>
              <strong>Resend</strong> &mdash; sends the weekly email. Subscriber addresses are
              shared with them so the email can be delivered.
            </li>
            <li>
              <strong>Mapbox</strong> &mdash; the map images on event and place pages.
            </li>
            <li>
              <strong>Anthropic</strong> &mdash; the AI used to research listings (see below).
              Your personal data is not sent to it.
            </li>
            <li>
              <strong>Google Search Console</strong> &mdash; tells us which searches bring
              people here. We see aggregate queries and counts, never individuals.
            </li>
          </ul>

          <h2>How we use AI, and its limits</h2>
          <p>
            Listings on this site are researched with the help of AI, then checked against the
            organiser&rsquo;s own calendar before we publish where we can. It is not perfect.
            We have found and corrected listings with the wrong date, the wrong venue, and in a
            few cases events that were not happening at all.
          </p>
          <p>
            So: <strong>check with the venue before you drive.</strong> Every listing links to
            the organiser&rsquo;s own page for exactly that reason, and every listing has a
            &ldquo;Cancelled or wrong? Tell us&rdquo; link. Reports go to a human.
          </p>
          <p>
            Your email address, your saved events and your reports are not used to train any AI
            model.
          </p>

          <h2>How long we keep things</h2>
          <ul>
            <li>
              <strong>Subscriber email:</strong> until you unsubscribe or ask us to delete it.
            </li>
            <li>
              <strong>Saved events and been-there list:</strong> as long as the cookie lasts (a
              year), or until you ask us to clear it.
            </li>
            <li>
              <strong>Submissions and reports:</strong> kept as a record of what was changed
              and why.
            </li>
            <li>
              <strong>Rate-limit records (IP, email):</strong> two days, automatically.
            </li>
            <li>
              <strong>Click counts:</strong> kept indefinitely, because they are totals with no
              person attached.
            </li>
          </ul>

          <h2>Your choices</h2>
          <p>
            <strong>Stop the emails.</strong> Every email has a one-click unsubscribe link at
            the bottom. One click, no login, no &ldquo;are you sure&rdquo;. It takes effect
            immediately.
          </p>
          <p>
            <strong>Clear your saved events.</strong> Delete this site&rsquo;s cookies in your
            browser and the link between you and that list is gone from your end. To have the
            stored rows deleted as well, ask us.
          </p>
          <p>
            <strong>See it, correct it, or delete it.</strong> Email{" "}
            <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a> and say what you
            want. We&rsquo;ll do it, and we&rsquo;ll reply to tell you it&rsquo;s done. You
            don&rsquo;t need to cite a law or live anywhere in particular &mdash; we&rsquo;d
            rather just honour the request.
          </p>

          <h2>Changes</h2>
          <p>
            If what we collect changes, this page changes with it and the date at the top moves.
          </p>

          <h2>Contact</h2>
          <p>
            <a href="mailto:hello@citypulsemn.com">hello@citypulsemn.com</a>. City Pulse MN
            covers the Minneapolis&ndash;St. Paul metro and is run from Minnesota.
          </p>
        </section>

        <SiteFooter source="privacy" />
      </main>
    </>
  );
}
