import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/events";
import { dayKeyOf } from "@/lib/event-view";
import { COLLECTIONS } from "@/lib/collections";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { VENUE_PAGES } from "@/lib/venue-pages";
import { matchCitySlug } from "@/lib/cities";
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
    // 6.3 — the evergreen weekend page: the highest-intent URL on the site.
    { url: `${SITE_URL}/this-weekend`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/ongoing`, changeFrequency: "daily", priority: 0.6 },
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
    // 6.2 — city landing pages: ONLY cities with published events go in the
    // sitemap (the thin-content rule) — ~110 suburbs exist; empty pages are
    // spam, not SEO. Recomputed hourly with the rest of this file.
    { url: `${SITE_URL}/cities`, changeFrequency: "daily", priority: 0.6 },
    ...[...new Set(
      events
        .filter((e) => {
          // upcoming (or still running) only — a city of past events is an
          // empty page, and empty pages don't belong in a sitemap.
          const start = new Date(e.start).getTime();
          const end = e.multiDayEnd ? new Date(e.multiDayEnd).getTime() : start;
          return !Number.isNaN(start) && Math.max(start, end) >= Date.now();
        })
        .map((e) => matchCitySlug(e.city))
        .filter((s): s is string => Boolean(s)),
    )].map(
      (slug) => ({
        url: `${SITE_URL}/cities/${slug}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }),
    ),
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
    { url: `${SITE_URL}/for-venues`, changeFrequency: "monthly", priority: 0.4 },
    ...collectionUrls,
    ...dayUrls,
    ...eventUrls,
  ];
}
