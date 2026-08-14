import { getEvents } from "@/lib/events";
import { getFeatured } from "@/lib/featured";
import { EventsExplorer } from "@/components/EventsExplorer";
import { FeaturedRow } from "@/components/FeaturedRow";
import { TrendingStrip } from "@/components/TrendingStrip";
import { OngoingStrip } from "@/components/OngoingStrip";
import { selectOngoing } from "@/lib/ongoing";
import { getTrendingEvents } from "@/lib/trending";
import { CollectionsStrip } from "@/components/CollectionsStrip";
import { SubscribeBand } from "@/components/SubscribeBand";
import { SiteFooter } from "@/components/SiteFooter";

// Re-render at most every 30 minutes. The shared events cache (lib/events) is
// the real DB-freshness floor; admin edits bust both the cache and the pages.
// 1.2 — the homepage is the site's most important URL; it gets an explicit
// canonical like every other page type (Search Console judges this). Title and
// description inherit from the root layout.
export const metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 1800;

export default async function Home() {
  const events = await getEvents();
  // Trending (5.2): resilient by contract — [] on any failure, and the strip
  // renders nothing until enough events genuinely qualify.
  const trending = await getTrendingEvents();
  // Featured (R2.2): paid, labeled, capped at 2, ABOVE the organic list — and
  // empty (invisible) until a venue buys. Never-break: [] on any failure.
  const featured = await getFeatured("home", events);
  // Server computes "now" once so SSR and hydration agree; the client refines it on mount.
  const nowISO = new Date().toISOString();
  return (
    <>
      <FeaturedRow items={featured} />
      <EventsExplorer events={events} nowISO={nowISO} />
      <TrendingStrip trending={trending} />
      <OngoingStrip ongoing={selectOngoing(events, new Date())} now={new Date()} />
      {/* G1.1 — one inline subscribe ask, mid-flow between editorial strips (not
          stacked on the footer's form). One band, no popup — the house rule.
          Copy is homepage-specific (this is the ~60% conversion surface) and
          Taren-editable — plain strings, edit freely. */}
      <SubscribeBand
        source="home"
        heading="Every Thursday: the week's best, hand-picked"
        sub="Skip the scroll — one email a week with the concerts, games, and weekend plans worth your time, chosen from everything here. Free, unsubscribe anytime."
      />
      <CollectionsStrip />
      <SiteFooter source="home" />
    </>
  );
}
