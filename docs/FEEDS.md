# iCal feeds (roadmap 6.1)

Any slice of the calendar as a subscribable iCalendar feed: paste the URL into
Apple Calendar (File → New Calendar Subscription), Google Calendar (Other
calendars → From URL), or Outlook, and the events keep arriving. No login, no
email — the no-login philosophy, extended.

## URL shapes

`https://www.citypulsemn.com/feeds/<slug>`, one namespace:

| Slug | Feed |
|---|---|
| `this-weekend` | The weekend selection (weekend days, span-aware) |
| `music` `sports` `family` `arts` `food` `festival` `unique` | Categories (`unique` is the public name for the internal `weird` key) |
| `live-music`, `free-this-week`, `date-night`, … | Collections — their filters, the feed's window |
| `venue-<slug>` e.g. `venue-first-avenue` | One venue's events (registry alias matching) |
| `uptown`, `como`, `northeast`, … | Neighborhoods (nearest-center geo rule) |

Unknown slug → 404. `allFeedSlugs()` in `lib/feeds.ts` enumerates every valid
slug; a drift-guard test asserts they all resolve and never collide.

## Semantics

- **Window:** rolling 30 days (`FEED_WINDOW_DAYS`), TRUE-SPAN intersection
  (Engineering rule 5): an ongoing festival mid-run is in the feed. Collection
  feeds apply the collection's *filters* but the feed's window — a feed is a
  subscription, not a page snapshot, so `free-this-week` the feed looks 30
  days out while the page keeps its 7.
- **Emission:** `feedICS()` in `lib/ics.ts` — one VCALENDAR, `X-WR-CALNAME`
  carrying the brand, VEVENTs shared byte-for-byte with the single-event
  download via `eventVEventLines()`. All-day events keep `VALUE=DATE`
  handling (banner rendering, exclusive DTEND).
- **Caching:** on-demand + `revalidate = 3600`. Calendar apps poll on their
  own schedule (hours); data changes mostly weekly. Never build-time (rule 2).

## Surfaces

`components/FeedSubscribe.tsx` renders the "📅 Subscribe to this calendar"
line on: `/this-weekend`, venue pages, collection pages, neighborhood pages —
each linking to its own slice's feed.

## Files

`lib/feeds.ts` (slug registry + selection, pure, tested) ·
`lib/ics.ts` (`eventVEventLines`, `feedICS`) ·
`app/feeds/[slug]/route.ts` · `components/FeedSubscribe.tsx` ·
tests in `lib/__tests__/feeds.test.ts`.
