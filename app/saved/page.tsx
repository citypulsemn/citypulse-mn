import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SavedList } from "@/components/SavedList";
import { getSaverToken } from "@/lib/saver";
import { getSavedEvents } from "@/lib/saved";

// Per-visitor content: never cached, never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Events | City Pulse MN",
  description: "The Twin Cities events you've saved.",
  robots: { index: false, follow: false },
};

export default async function SavedPage() {
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

        <SavedList events={events} />

        <SiteFooter source="saved" />
      </main>
    </>
  );
}
