# Deploy — cut Supabase egress with a shared events cache

*August 2026. Operational fix, not a roadmap item — response to the Supabase
fair-use egress alert (12.58 GB against a 5.5 GB cap, 3-day grace). No schema
change, no visible site change; a caching layer under the events read path.*

## The problem (live)

Supabase flagged the org for egress overage. Because the site uses Supabase
purely as **Postgres** (no Storage, no image hosting — see [lib/db.ts](../../lib/db.ts)),
that egress is entirely **database read bandwidth**: event rows shipped to Vercel
on every render.

**Root cause — the whole table, once per route, per visitor.** Nearly every
route calls `getEvents()` ([lib/events.ts](../../lib/events.ts)) — the full
published table, all columns — and filters it in JS: the home page,
`/this-weekend`, `/ongoing`, and the per-city / per-neighborhood / per-collection
/ per-venue pages. Worst of all, **every `/event/[id]` page** pulls the entire
table for its one "more at this venue" strip. There are ~950 event pages, so a
single crawler sweep of the sitemap moved **~0.7 GB** on its own (953 events ×
778 bytes ≈ 0.7 MB per full read, once per page). Multiply by real crawler +
reader traffic across a growing sitemap and you get 12.6 GB/month.

## The fix

Put a **shared, time-based cache** under the read path with Next's
`unstable_cache`. The DB is now hit **at most once per 30-minute window,
globally shared across every route and request** — instead of once per route per
visitor. The full payload is **0.707 MB for all 953 events**, comfortably under
Vercel's **2 MB data-cache-entry ceiling**, so it caches for real (measured
against the live DB before choosing this approach).

Changes, all in the read layer:

1. **`getEvents()` / `getEventsForDay()`** ([lib/events.ts](../../lib/events.ts))
   are now `unstable_cache` wrappers (TTL 1800 s, tag `"events"`) over the raw
   reads. `unstable_cache` keys `getEventsForDay` by its `dayKey` automatically,
   so each day caches independently.
2. **Uncached escapes** — `getEventsUncached` / `getEventsForDayUncached` are
   exported for the two contexts that must NOT use the request cache: the weekly
   **digest script** (runs outside a Next request; wired in
   [lib/digest-send.ts](../../lib/digest-send.ts)) and the **unit tests**
   ([lib/__tests__/events-read.test.ts](../../lib/__tests__/events-read.test.ts)).
   Both always read fresh.
3. **Tag-busting on admin edits** ([lib/admin-actions.ts](../../lib/admin-actions.ts))
   — `refresh()` now calls `revalidateTag("events")`. This is a correctness fix,
   not just speed: with a data cache in place, `revalidatePath` alone would
   regenerate the HTML but re-read the *stale cached array*, so a
   hidden/archived/edited event would linger on public pages for up to the TTL.
   Busting the tag drops it immediately.

`getEvent()` (single row, by id) is left uncached — it's cheap and per-id
caching buys little.

## Freshness semantics (what changed for real)

- **Admin moderation** (hide / archive / edit): immediate on public pages, via
  the tag bust. Same as before.
- **The weekly pipeline** writes straight to Postgres out-of-band. Its new events
  appear on the next TTL refresh — i.e. within 30 min of first request, versus
  the old per-route ISR window of 5 min. A wider staleness window, but the
  pipeline runs weekly, so this is invisible in practice.
- **The digest** reads uncached — always the live table.

## Verification (observed, not intended)

Gate: `tsc` clean · **939/939** tests · `npm run build` clean · `npm audit` 0.

**Runtime proof** — a temporary DB-read probe was added to the raw read, then the
prod-shaped dev server was hit repeatedly and the probe counted in the server
logs (probe removed before commit):

- **14 aggregate page loads across 8 distinct routes** (home, this-weekend,
  ongoing, collections, neighborhoods, cities, venues — including the
  force-dynamic `/collections`) → **3 DB reads total**, all during cold-start
  route compilation. Every load after the cache warmed added **zero**.
- **3 `/event/[id]` pages** (each formerly a full-table pull for "more at this
  venue") → **zero** additional DB reads; they read the shared cache.

So 17 renders that each used to ship ~0.7 MB collapsed to 3 reads during warm-up
and 0 thereafter within the window. A full crawler sweep of the 953 event pages
now costs ~1 shared read (~0.7 MB) instead of 953 (~667 MB).

**Honest limit:** the definitive proof is the **Supabase usage dashboard trend**
over the next few days — watch daily egress fall sharply. This lands the site
well under the free 5.5 GB cap on the mechanics, but the Pro upgrade (separate,
owner action) is still the right home for a production site and removes the
Aug 15 deadline regardless.

## The 2 MB ceiling — the one thing to watch as the table grows

Vercel's data cache silently refuses entries over 2 MB (it logs a warning and
just re-runs the query — back to per-route reads, no crash). Today's payload is
0.7 MB / 953 events (~778 bytes each), so headroom is ~1,700 more events before
it matters. If the events table roughly triples, the next lever is a **narrow
"card" projection** — drop `description` (26% of the payload), `source_url`,
`ticket_url`, `image`, `address` from the list reads, keeping the full record
only for `getEvent()` detail pages.

## Deploy steps

Push to `main`. Config/logic only — no migration, no env change. Vercel
auto-deploys; the cache begins on the first request after deploy.

## Verify checklist

- [ ] Site renders normally after deploy (home, an event page, a city page).
- [ ] Supabase **Usage → Egress** trends down over the next 1–3 days.
- [ ] Admin: hide an event → it disappears from the public home immediately
      (tag bust working).
- [ ] Monday's digest still sends the full current slate (uncached path intact).

## Follow-up — raised ISR windows (same workstream)

A second commit widened the page-level `revalidate` on the hot pages. With the
shared data cache already governing DB reads, this is mostly a **Vercel**
regeneration + tiny-uncached-read trim, not the main Supabase lever — but it's
sound hygiene and complements the cache.

Windows chosen by time-sensitivity:

- **1800 s (30 min)** — home, `/this-weekend`, `/ongoing`, `/day/[date]`,
  `/collections/[slug]`. Home's time labels are client-refined on mount; the
  others are day-granular (weekend membership, closing dates, a day's slate).
- **3600 s (1 hr)** — the structural pages `/cities`(+`[slug]`),
  `/neighborhoods`(+`[slug]`), `/venues`(+`[slug]`). Content changes weekly.
- **300 s (unchanged)** — `/event/[id]` (its "Starts in N minutes" banner is
  minute-granular and **server-baked** on the standalone page, so it must stay
  fresh) and `/collections/trending` (volatile by design — a deliberate note in
  the file).

**The data-cache clamp (why the static pages read 30m in the build table).**
Next sets a static page's effective `revalidate` to the *minimum* of the page
window and any `unstable_cache` TTL used while rendering. Every hot page reads
`getEvents()` (data cache TTL 1800 s), so the static index pages (`/`, `/cities`,
`/neighborhoods`, `/venues`, `/ongoing`, `/this-weekend`) show **30m** in the
build output even where the page constant says 3600 — the data cache is the
real freshness floor. The 1-hour window still applies to the on-demand dynamic
detail pages (`ƒ` in the route table), which don't render at build. This is
correct and intended, not a misconfiguration.

**Moderation stays instant.** Longer windows would let an admin-hidden event
linger on the secondary pages until their window expired, so
[lib/admin-actions.ts](../../lib/admin-actions.ts) `refresh()` now clears the
whole public tree: `revalidateTag("events")` (data) + `revalidatePath("/",
"layout")` (all page HTML). Admin edits are rare, so a full-tree revalidation is
cheap and keeps hides/archives/edits visible everywhere immediately.

Verification: build route table shows the new Revalidate column (`/` 30m,
structural indexes 30m via the clamp, trending 5m unchanged); `tsc` clean, 939
tests, build clean, audit 0.

## Rollback

`git revert` the commit(s). Pure caching + ISR-window config — reverting
restores the direct per-request reads and 5-minute windows; no data or schema
implications.
