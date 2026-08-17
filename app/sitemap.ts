import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/events";
import { dayKeyOf } from "@/lib/event-view";
import { COLLECTIONS } from "@/lib/collections";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { VENUE_PAGES } from "@/lib/venue-pages";
import { matchCitySlug } from "@/lib/cities";
import { kindsWithPlaces, PLACES } from "@/lib/places";
import { chiDayKey } from "@/lib/clock";
import { SITE_URL } from "@/lib/seo/site";

// Refresh hourly so newly-published events get crawled quickly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents(); // published only
  const days = new Set(events.map(dayKeyOf));

  // A DAY-STABLE "last modified" for the evergreen browse surfaces. Their content
  // is event-derived and genuinely rolls every day, so a fresh daily lastmod is
  // both honest and the freshness signal Google uses to schedule (re)crawls. The
  // sitemap previously carried NO <lastmod> at ALL — which is why brand-new pages
  // like /places and /this-week sat "URL is unknown to Google" for weeks despite
  // being listed here, internally linked, and robots-allowed (GSC URL Inspection,
  // Aug 16). Day-granular (parsed from the Chicago day key), so it doesn't thrash
  // every hour and Google can trust it.
  const today = new Date(chiDayKey(new Date()));

  const dayUrls: MetadataRoute.Sitemap = [...days].map((d) => ({
    url: `${SITE_URL}/day/${d}`,
    lastModified: today,
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
    { url: `${SITE_URL}/this-weekend`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    // G1.1 — the weekly-email shop window: this week's hand-picked shortlist.
    { url: `${SITE_URL}/this-week`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/ongoing`, lastModified: today, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/collections`, lastModified: today, changeFrequency: "daily", priority: 0.6 },
    // 5.5 + 6.1 — the evergreen browse surfaces (venue pages are the "first
    // avenue schedule" searches; neighborhood pages the "things to do in
    // uptown" ones).
    { url: `${SITE_URL}/neighborhoods`, lastModified: today, changeFrequency: "daily", priority: 0.6 },
    ...NEIGHBORHOODS.map((n) => ({
      url: `${SITE_URL}/neighborhoods/${n.key}`,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    // 6.2 — city landing pages: ONLY cities with published events go in the
    // sitemap (the thin-content rule) — ~110 suburbs exist; empty pages are
    // spam, not SEO. Recomputed hourly with the rest of this file.
    { url: `${SITE_URL}/cities`, lastModified: today, changeFrequency: "daily", priority: 0.6 },
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
        lastModified: today,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }),
    ),
    { url: `${SITE_URL}/venues`, lastModified: today, changeFrequency: "daily", priority: 0.6 },
    ...VENUE_PAGES.map((v) => ({
      url: `${SITE_URL}/venues/${v.slug}`,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  // Places (evergreen) — the /places index, the cross-kind finder, one page per
  // seeded kind, AND one page per individual place. Static registry, so no DB
  // pressure; higher priority as they're built to rank.
  const placeUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/places`, lastModified: today, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/places/discover`, lastModified: today, changeFrequency: "weekly", priority: 0.7 },
    ...kindsWithPlaces(new Date()).map((k) => ({
      url: `${SITE_URL}/places/${k.meta.kind}`,
      lastModified: today,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Per-place detail pages — stable registry content, so lastmod is the place's
    // own `verifiedAt` (an honest freshness signal), not the daily-rolling `today`.
    ...PLACES.map((p) => ({
      url: `${SITE_URL}/places/${p.kind}/${p.slug}`,
      lastModified: new Date(p.verifiedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [
    { url: SITE_URL, lastModified: today, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/submit`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/for-venues`, changeFrequency: "monthly", priority: 0.4 },
    ...collectionUrls,
    ...placeUrls,
    ...dayUrls,
    ...eventUrls,
  ];
}
