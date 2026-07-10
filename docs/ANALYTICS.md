# Analytics

Roadmap 1.4. City Pulse uses **Vercel Analytics** (page views + custom events) and **Vercel Speed Insights** (Web Vitals). Both are cookieless and privacy-friendly — **no cookie-consent banner required**.

## Architecture

- `app/layout.tsx` mounts `<Analytics />` and `<SpeedInsights />` — this is the entire traffic + Web-Vitals layer.
- Every custom event goes through **one wrapper**: `lib/track.ts` → `track(name, props)`. Components never import the vendor directly, so Vercel can be swapped for Plausible/umami/first-party later without touching a single call site.
- The wrapper no-ops on the server, never throws, and forwards only primitive properties (Vercel's requirement).

## Custom events

| Event | Where | Properties |
|---|---|---|
| `ticket_click` ⭐ | ticket CTA (modal + event page) | `id`, `category`, `title` |
| `event_open` | opening the detail modal | `id`, `category`, `surface` (`calendar` \| `map`) |
| `share_click` | Share button | `id`, `title` |
| `search` | search box (debounced) | `q`, `results` |
| `chip_toggle` | category chip | `category` |
| `preset_select` | range preset | `preset` |
| `price_toggle` | price filter (2.5) | `tier` |
| `area_toggle` | area filter (2.5) | `area` |

`ticket_click` is the **north-star metric** — it's the proof-of-value number for the Phase-4 venue pitch ("we drove N ticket clicks for your events").

`ics_download` (add-to-calendar) — live as of roadmap 2.3 (`target: ics | google`).

## Viewing the data

In the **Vercel dashboard → your project → Analytics**:
- **Web Analytics** tab: page views, top pages (event/day pages included), referrers, countries, devices.
- **Custom Events** section: counts per event name; click an event to break down by its properties (e.g. `ticket_click` by `title`, `search` by `q`). This answers "top events by ticket clicks this week" and "what are people searching."
- **Speed Insights** tab: Core Web Vitals per route.

## Enabling (one-time)

Analytics only collects once enabled on the project (see the deploy guide): Vercel dashboard → project → **Analytics** → enable **Web Analytics** and **Speed Insights**. Data appears within a few minutes of real traffic on the production deployment. Locally and in preview, `track()` safely no-ops.

## Later

Roadmap **5.4 (Trending & related)** introduces a first-party `event_stats` table — a server-side dual-write so the engagement data becomes queryable *product* fuel (trending strips, the admin snapshot in 1.5). That's when analytics stops being just a dashboard and starts driving on-site features. Until then, the Vercel dashboard is the source of truth.
