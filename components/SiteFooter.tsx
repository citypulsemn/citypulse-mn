import { SubscribeForm } from "./SubscribeForm";
import { SUPPORT } from "@/lib/editorial";

/**
 * `subscribe={false}` on any page that already renders a SubscribeBand: the
 * house rule is one subscribe ask per page, and the band (placed at peak
 * intent, with page-specific copy) is the better of the two.
 *
 * Links are three short columns rather than one 13-link row, which read as a
 * sitemap dump. Written out as literal JSX on purpose — several tripwire tests
 * read this file for `href="/…"`.
 */
export function SiteFooter({ source = "site", subscribe = true }: { source?: string; subscribe?: boolean }) {
  return (
    <footer className="site-footer">
      {subscribe && (
        <div className="site-footer-inner">
          <div className="sf-pitch">
            <div className="sf-title">The week ahead, in your inbox</div>
            <div className="sf-sub">
              The Twin Cities&rsquo; best events, hand-picked and sent every Thursday. No spam, unsubscribe anytime.
            </div>
          </div>
          <SubscribeForm source={source} />
        </div>
      )}
      <nav className="site-footer-links" aria-label="Site">
        <div className="sf-col">
          <div className="sf-col-title">Calendar</div>
          <a href="/this-week">This Week&rsquo;s Best</a>
          <a href="/this-weekend">This Weekend&rsquo;s Best</a>
          <a href="/ongoing">Ongoing</a>
          <a href="/collections">Collections</a>
        </div>
        <div className="sf-col">
          <div className="sf-col-title">Explore</div>
          <a href="/places">Places</a>
          <a href="/cities">Cities</a>
          <a href="/neighborhoods">Neighborhoods</a>
          <a href="/venues">Venues</a>
          <a href="/saved">Saved</a>
        </div>
        <div className="sf-col">
          <div className="sf-col-title">Help us</div>
          <a href="/submit">Submit an event</a>
          <a href="/report">Report a listing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          {/* B2 — renders nothing until a payment page exists (lib/editorial.ts SUPPORT). */}
          {SUPPORT && (
            <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer">{SUPPORT.label}</a>
          )}
        </div>
      </nav>
      <div className="sf-brand">City Pulse MN · the pulse of the Twin Cities</div>
    </footer>
  );
}
