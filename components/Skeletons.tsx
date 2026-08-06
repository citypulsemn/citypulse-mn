import { Logo } from "./Logo";

/**
 * Route-level loading skeletons (UX2). App-Router `loading.tsx` renders these
 * as the Suspense fallback while a DB-backed page (all `revalidate = 300`)
 * resolves on the server — so tapping an event or "This Weekend" on mobile data
 * shows structure immediately instead of a frozen old page then a blank flash.
 *
 * The shimmer is pure CSS (`.skel`) and is globally disabled under
 * prefers-reduced-motion (the site-wide reset), so it degrades to a static
 * placeholder. aria-busy + a visually-hidden label keep it honest for SR users.
 *
 * SCOPE (learned in prod verification): these live on LEAF SERVER pages
 * (event, day, venues, collections) only — NOT at the app root. A root
 * loading.tsx wraps the homepage's client explorer (which itself uses a
 * `dynamic(MapView, { ssr:false })` boundary), and the two Suspense layers
 * don't reconcile — the skeleton sticks. The homepage is the entry point and
 * doesn't need a route skeleton anyway.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
        </div>
      </header>
      <main className="wrap page" aria-busy="true">
        <span className="sr-only">Loading…</span>
        {children}
      </main>
    </>
  );
}

/** A list-shaped placeholder — day pages, venues, collections, etc. */
export function ListSkeleton() {
  return (
    <Shell>
      <div className="skel skel-title" />
      <div className="day-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel skel-row" />
        ))}
      </div>
    </Shell>
  );
}

/** A single-card placeholder — the event detail page. */
export function CardSkeleton() {
  return (
    <Shell>
      <div className="skel skel-hero" />
      <div className="skel skel-line" style={{ width: "70%" }} />
      <div className="skel skel-line" style={{ width: "45%" }} />
      <div className="skel skel-line" style={{ width: "55%" }} />
      <div className="skel skel-cta" />
    </Shell>
  );
}
