import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SavedList } from "@/components/SavedList";
import { getSaverToken } from "@/lib/saver";
import { getSavedEvents } from "@/lib/saved";
import { KeepListForm } from "@/components/KeepListForm";

// Per-visitor content: never cached, never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Events | City Pulse MN",
  description: "The Twin Cities events you've saved.",
  robots: { index: false, follow: false },
};

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ restored?: string; restore?: string }>;
}) {
  const sp = await searchParams;
  const token = await getSaverToken();
  const events = token ? await getSavedEvents(token) : [];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">
            ← All events
          </a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · your list</div>
          <h1 className="dayhdr-title">Saved events</h1>
          <div className="dayhdr-count">
            {events.length === 0
              ? "Nothing saved yet"
              : `${events.length} event${events.length > 1 ? "s" : ""} saved`}
          </div>
        </div>

        {sp.restored === "1" && (
          <div className="restore-banner ok" role="status">
            Your list is back — this device now carries your saved events, merged with
            anything you&apos;d saved here already.
          </div>
        )}
        {sp.restore === "invalid" && (
          <div className="restore-banner bad" role="alert">
            That link has expired or isn&apos;t valid. Request a fresh one below — links
            last 7 days.
          </div>
        )}

        <SavedList events={events} />

        {/* Roadmap 5.4 — only offer to keep a list that exists. */}
        {events.length > 0 && <KeepListForm />}

        <SiteFooter source="saved" />
      </main>
    </>
  );
}
