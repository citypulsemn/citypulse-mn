# First-party analytics

Roadmap 5.1. The feedback loop: which events people view, click through, save, and put on their calendars — counted in our own database, joinable against our own data, not locked in a vendor dashboard.

## Privacy by schema

`event_stats` holds one counter per **(event, Chicago-day, action)**. No user identifiers, no IPs, no cookies. The table cannot answer "who did what" — only "how many" — so there is nothing to leak or comply about. This is the design, not a policy layered on top.

## The four actions and their write paths

| Action | Counted where | Why there |
|---|---|---|
| `view` | client beacon on the event detail page | client-side, so prefetches and non-JS crawlers don't inflate it |
| `ticket_click` | client beacon in TicketButton (alongside the vendor `track()` seam) | the click ends on an external page; `sendBeacon` survives navigation |
| `calendar` | **server-side** in the `.ics` download route; client beacon for the Google Calendar link | the route *is* the download → exact count; Google is an external URL |
| `save` | **server-action only** (`toggleSaveAction`, adds only) | deliberately NOT accepted by the public beacon — the one metric tied to real user state shouldn't be inflatable with a curl loop |

## The beacon endpoint

`POST /api/beacon` with `{id, action}`. `parseBeacon` (pure, tested) accepts exactly a UUID plus an allow-listed public action; everything else is dropped. The endpoint **always answers 204** — a beacon must never surface an error to a page, and a uniform response gives probes nothing to learn from. Unknown-but-valid UUIDs die silently on the foreign key. `recordStat` swallows every failure by contract: analytics must never break the feature it measures.

Honest limitation: the public actions (`view`, `ticket_click`, `calendar`) *can* be inflated by a determined script — first-party beacons always can. Counts are directional instruments for editorial decisions, not billing records.

## Reading it

**Admin → Stats** now ends with the Engagement section: totals (views, ticket clicks, view→ticket CTR, saves, calendar adds), top events, and a by-day table, over a 7d/30d toggle. `getEngagement()` in `lib/stats.ts` is the query if you want it elsewhere (it's what 5.2 trending will build on).

Vendor analytics (Vercel, via the `lib/track.ts` seam) still exists for site-wide vitals and search events; 5.1 doesn't replace that seam — it adds the per-event data that's ours.
