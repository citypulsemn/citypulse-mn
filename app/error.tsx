"use client";

import { useEffect } from "react";
import { Logo } from "@/components/Logo";

/**
 * Root error boundary (UX2). App-Router error boundaries must be client
 * components. Before this, a transient data failure (e.g. a Supabase blip in
 * getEvents) fell through to Next's branding-less "Application error" screen.
 * Now it wears the chrome and offers a retry — `reset()` re-renders the
 * segment, which re-runs the failed server fetch.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it for logs/observability; never breaks the boundary itself.
    console.error("[app] render error:", error);
  }, [error]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Something went wrong</div>
          <h1 className="dayhdr-title">That didn&apos;t load</h1>
        </div>
        <div className="day-empty">
          A hiccup on our end — usually momentary. Try again, or head back to the
          calendar.
          <p style={{ marginTop: 18 }}>
            <button type="button" className="retry-btn" onClick={() => reset()}>
              Try again
            </button>
            <a href="/" style={{ marginLeft: 16 }}>
              Back to the calendar →
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
