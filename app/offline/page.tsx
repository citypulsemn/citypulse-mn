import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

/**
 * The offline fallback, precached by the service worker and shown ONLY when a
 * page navigation can't reach the network.
 *
 * It exists because we deliberately never cache event pages: a cached event is
 * a wrong event — stale start times, a show that has since been cancelled, a
 * festival that already ended. Honest emptiness applies offline too. Better to
 * say "you're offline" than to quietly serve yesterday's calendar.
 */
export const metadata: Metadata = {
  title: "Offline — City Pulse MN",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">No connection</div>
          <h1 className="dayhdr-title">You&apos;re offline</h1>
        </div>
        <div className="day-empty">
          City Pulse needs a connection to show event times — we don&apos;t keep a
          cached copy of the calendar, because a cached event is usually a wrong
          event. Reconnect and this page will work again.
          <p style={{ marginTop: 18 }}>
            <a href="/">Try again →</a>
          </p>
        </div>
      </main>
    </>
  );
}
