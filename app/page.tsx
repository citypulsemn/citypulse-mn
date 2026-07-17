import { getEvents } from "@/lib/events";
import { EventsExplorer } from "@/components/EventsExplorer";
import { TrendingStrip } from "@/components/TrendingStrip";
import { getTrendingEvents } from "@/lib/trending";
import { CollectionsStrip } from "@/components/CollectionsStrip";
import { SiteFooter } from "@/components/SiteFooter";

// Re-render at most every 5 minutes (events also revalidate at the data layer).
// 1.2 — the homepage is the site's most important URL; it gets an explicit
// canonical like every other page type (Search Console judges this). Title and
// description inherit from the root layout.
export const metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 300;

export default async function Home() {
  const events = await getEvents();
  // Trending (5.2): resilient by contract — [] on any failure, and the strip
  // renders nothing until enough events genuinely qualify.
  const trending = await getTrendingEvents();
  // Server computes "now" once so SSR and hydration agree; the client refines it on mount.
  const nowISO = new Date().toISOString();
  return (
    <>
      <EventsExplorer events={events} nowISO={nowISO} />
      <TrendingStrip trending={trending} />
      <CollectionsStrip />
      <SiteFooter source="home" />
    </>
  );
}
