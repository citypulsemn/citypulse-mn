import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

/**
 * Branded 404 (UX2). Before this, `notFound()` — called by every slug route
 * (event, day, venue, neighborhood, collection, city) — rendered a bare white
 * Next.js default. The most common way to hit it is a SHARED or EMAILED link to
 * an event that has since been archived, i.e. exactly the site's flagship
 * share-and-email surface. So it must wear the chrome and offer a way back.
 */
export const metadata: Metadata = {
  title: "Not found — City Pulse MN",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">404</div>
          <h1 className="dayhdr-title">We couldn&apos;t find that</h1>
        </div>
        <div className="day-empty">
          This page or event isn&apos;t here — it may have ended and been archived,
          or the link may be off. The calendar is where everything lives.
          <p style={{ marginTop: 18 }}>
            <a href="/">Back to the calendar →</a>{" "}
            <a href="/this-weekend" style={{ marginLeft: 14 }}>
              What&apos;s on this weekend →
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
