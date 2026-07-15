import type { Metadata } from "next";
import { getEvents } from "@/lib/events";
import { COLLECTIONS, selectCollection } from "@/lib/collections";
import { getTrendingEvents } from "@/lib/trending";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

// Render on-demand rather than prerendering at build. Like the slug pages, this
// index reads from the database (to show per-collection counts); keeping it off
// the build-time render path avoids the DB stampede that failed the build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections — Twin Cities Events by Theme | City Pulse MN",
  description:
    "Curated Twin Cities event collections — this weekend, free events, live music, family fun, date night, arts, festivals, and the uniquely Minnesotan.",
  alternates: { canonical: "/collections" },
  openGraph: {
    title: "Collections | City Pulse MN",
    description: "Curated Twin Cities events by theme.",
    url: "/collections",
    type: "website",
    siteName: "City Pulse MN",
  },
};

export default async function CollectionsIndex() {
  const events = await getEvents();
  const now = new Date();
  const cards = COLLECTIONS.map((c) => ({
    ...c,
    count: selectCollection(events, c, now).length,
  }));

  // Trending (5.2) leads the list — but only once it has earned its place
  // (rankTrending's all-or-nothing rule). Before that, the index is unchanged.
  const trending = await getTrendingEvents();
  if (trending.length > 0) {
    cards.unshift({
      slug: "trending",
      title: "Trending Now",
      tagline: "What the Twin Cities is actually clicking on this week.",
      count: trending.length,
    });
  }

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
          <div className="dayhdr-eyebrow">Twin Cities · by theme</div>
          <h1 className="dayhdr-title">Collections</h1>
          <p className="coll-tagline">
            Hand-picked views of what&apos;s happening across the metro.
          </p>
        </div>

        <div className="coll-grid">
          {cards.map((c) => (
            <a key={c.slug} className="coll-card" href={`/collections/${c.slug}`}>
              <div className="coll-card-title">{c.title}</div>
              <div className="coll-card-tag">{c.tagline}</div>
              <div className="coll-card-count">
                {c.count > 0 ? `${c.count} event${c.count > 1 ? "s" : ""} →` : "See what's coming →"}
              </div>
            </a>
          ))}
        </div>

        <SiteFooter source="collections" />
      </main>
    </>
  );
}
