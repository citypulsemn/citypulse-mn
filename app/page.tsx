import { getEvents } from "@/lib/events";
import { EventsExplorer } from "@/components/EventsExplorer";
import { CollectionsStrip } from "@/components/CollectionsStrip";
import { SiteFooter } from "@/components/SiteFooter";

// Re-render at most every 5 minutes (events also revalidate at the data layer).
export const revalidate = 300;

export default async function Home() {
  const events = await getEvents();
  // Server computes "now" once so SSR and hydration agree; the client refines it on mount.
  const nowISO = new Date().toISOString();
  return (
    <>
      <EventsExplorer events={events} nowISO={nowISO} />
      <CollectionsStrip />
      <SiteFooter source="home" />
    </>
  );
}
