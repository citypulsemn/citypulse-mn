import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/events";
import { dayKeyOf } from "@/lib/event-view";
import { COLLECTIONS } from "@/lib/collections";
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
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    ...collectionUrls,
    ...dayUrls,
    ...eventUrls,
  ];
}
