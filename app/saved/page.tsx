import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SavedList } from "@/components/SavedList";
import { getSaverToken } from "@/lib/saver";
import { getSavedEvents } from "@/lib/saved";
import { getVisitedSlugsSafe } from "@/lib/place-visits";
import { visitedByKind } from "@/lib/place-progress";
import { VisitedPlaces } from "@/components/VisitedPlaces";
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
  // Both lists ride the same anonymous identity (Places P5). The visits read
  // is wrapped (rule 1): a failure there must not take the saved list down.
  const [events, visitedSlugs] = token
    ? await Promise.all([getSavedEvents(token), getVisitedSlugsSafe(token)])
    : [[], []];
  const visitedGroups = visitedByKind(new Set(visitedSlugs));

  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · your list</div>
          <h1 className="dayhdr-title">Saved events</h1>
          <div className="dayhdr-count">
            {events.length === 0
              ? visitedGroups.length > 0
                ? "No events saved yet"
                : "Nothing saved yet"
              : `${events.length} event${events.length > 1 ? "s" : ""} saved`}
          </div>
        </div>

        {sp.restored === "1" && (
          <div className="restore-banner ok" role="status">
            Your list is back — this device now carries your saved events and the places
            you&apos;ve checked off, merged with anything you&apos;d saved here already.
          </div>
        )}
        {sp.restore === "invalid" && (
          <div className="restore-banner bad" role="alert">
            That link has expired or isn&apos;t valid. Request a fresh one below — links
            last 7 days.
          </div>
        )}

        <SavedList events={events} />

        {/* Places P5 — "Places you've been"; renders nothing at zero. */}
        <VisitedPlaces groups={visitedGroups} />

        {/* Roadmap 5.4 — only offer to keep a list that exists (events OR check-offs). */}
        {(events.length > 0 || visitedSlugs.length > 0) && <KeepListForm />}

        <SiteFooter source="saved" />
      </main>
    </>
  );
}
