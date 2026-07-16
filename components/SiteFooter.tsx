import { SubscribeForm } from "./SubscribeForm";

export function SiteFooter({ source = "site" }: { source?: string }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="sf-pitch">
          <div className="sf-title">The week ahead, in your inbox</div>
          <div className="sf-sub">
            A weekly rundown of the best Twin Cities events. No spam, unsubscribe anytime.
          </div>
        </div>
        <SubscribeForm source={source} />
      </div>
      <div className="site-footer-links">
        <a href="/this-weekend">This Weekend</a>
        <span aria-hidden="true">·</span>
        <a href="/collections">Collections</a>
        <span aria-hidden="true">·</span>
        <a href="/cities">Cities</a>
        <span aria-hidden="true">·</span>
        <a href="/neighborhoods">Neighborhoods</a>
        <span aria-hidden="true">·</span>
        <a href="/venues">Venues</a>
        <span aria-hidden="true">·</span>
        <a href="/saved">Saved</a>
        <span aria-hidden="true">·</span>
        <a href="/submit">Submit an event</a>
      </div>
      <div className="sf-brand">City Pulse MN · the pulse of the Twin Cities</div>
    </footer>
  );
}
