import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/events";
import { dayKeyOf } from "@/lib/event-view";
import { COLLECTIONS } from "@/lib/collections";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { VENUE_PAGES } from "@/lib/venue-pages";
import { SITE_URL } from "@/lib/seo/site";

// Refresh hourly so newly-published events get crawled quickly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents(); // published only
  const days = new Set(events.map(dayKeyOf));

  const dayUrls: MetadataRoute.Sitemap = [...days].map((d) => ({
    url: `${SITE_URL}/day/${d}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  const eventUrls: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${SITE_URL}/event/${e.id}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const collectionUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/collections`, changeFrequency: "daily", priority: 0.6 },
    // 5.5 + 6.1 — the evergreen browse surfaces (venue pages are the "first
    // avenue schedule" searches; neighborhood pages the "things to do in
    // uptown" ones).
    { url: `${SITE_URL}/neighborhoods`, changeFrequency: "daily", priority: 0.6 },
    ...NEIGHBORHOODS.map((n) => ({
      url: `${SITE_URL}/neighborhoods/${n.key}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/venues`, changeFrequency: "daily", priority: 0.6 },
    ...VENUE_PAGES.map((v) => ({
      url: `${SITE_URL}/venues/${v.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/submit`, changeFrequency: "monthly", priority: 0.4 },
    ...collectionUrls,
    ...dayUrls,
    ...eventUrls,
  ];
}
