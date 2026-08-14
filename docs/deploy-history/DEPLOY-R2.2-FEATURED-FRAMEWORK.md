# Deploy — R2.2 featured-placement framework

*August 2026. Monetization Tier 2 (Revenue). Schema + code. Built dormant.*

## What shipped

The labeled, capped, no-reorder paid-placement mechanism — the framework a venue
buys into. Built **dormant**: the table is empty, so every surface renders exactly
as it does today until an admin adds a placement.

- **Schema — [`featured`](../../db/schema.sql)** (additive, idempotent):
  `id, event_id → events(id) on delete cascade, label, starts_at, ends_at,
  created_at`, plus a window index. One row per booking. RLS on like every table.
- **[lib/featured.ts](../../lib/featured.ts)** — the trust rules **in code**:
  - `selectFeatured(placements, events, {now, surface})` — pure. Returns a
    **separate** array of `{event, label}` to render ABOVE the organic list;
    **never mutates or reorders** the events it was handed (no-reorder rule, with
    a golden test asserting the pool is untouched).
  - **Capped**: `FEATURED_CAP = { home: 2, collection: 1 }`.
  - **Windowed + honest**: only placements active *now* and whose event is present
    in the pool passed in (live/public — and, on a collection page, a member of
    that collection) are shown. Expired or archived placements silently drop.
  - `getFeatured(surface, events)` — DB read with the **never-break contract**:
    `[]` on any failure, including the table not existing yet. (Verified in this
    build: before the schema was applied, the homepage render logged
    `relation "featured" does not exist` and rendered normally — zero featured.)
- **[FeaturedRow.tsx](../../components/FeaturedRow.tsx)** — a clearly-**labeled**
  band ("Featured" eyebrow + a gold "Featured" chip on every card + a "Paid
  placement — kept separate from the listings below" note). Renders `null` when
  empty. Honest disclosure = the no-dark-patterns rule made literal.
- **Wiring** (thin): homepage above `EventsExplorer` (cap 2, pool = all events);
  collection pages above the day groups (cap 1, pool = that collection's own
  selected events, so a placement stays on-topic).

## Why these choices

- **Placements are global, capped per surface** — exactly the spec
  (`featured(event_id, starts_at, ends_at, label)`, no surface column). Relevance
  on collection pages comes for free: the collection's own event list is the pool,
  so an unrelated featured event simply isn't eligible there.
- **Additive band, never a rerank** — the organic ranking is the product's
  integrity. Featured sits above it, labeled; it never reorders or displaces a
  listing.

## Deploy steps

1. **Apply the schema** (idempotent — safe to re-run):
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
   or paste the `featured` block into the Supabase SQL editor. This stops the
   caught "relation does not exist" log and creates the (empty) table.
2. Push to `main`. Nothing visible changes — the table is empty.

> **✅ APPLIED (Aug 14, 2026).** The `featured` table now exists in production
> Supabase — created via the project's own `postgres` client against
> `DATABASE_URL` (the three idempotent statements from the block below). Verified:
> all 6 columns present with correct types, 0 rows, RLS enabled; the homepage's
> caught `relation "featured" does not exist` log is gone (confirmed on a fresh
> render). The framework is now armed but dormant — no placement rows yet.

## How to sell one (later, admin, when a venue pays)

Insert a row for the paid window:
```sql
insert into featured (event_id, label, starts_at, ends_at)
values ('<event-uuid>', 'Featured', now(), now() + interval '7 days');
```
It appears (labeled, capped) within the page's revalidate window (≤30 min). Delete
the row or let `ends_at` pass to end it. A self-serve admin UI is a later add — the
framework and trust rules are the deliverable here.

## Verify checklist

- [ ] After schema apply, homepage + a collection page render unchanged (table empty).
- [ ] Insert a test placement for a live event → a labeled "Featured" card appears
      above the organic list on the homepage; the listings below are unchanged and
      in the same order. Delete the row after.
- [ ] Feature an event NOT in a given collection → it does **not** appear on that
      collection page (relevance).

## Rollback

`git revert` the code. The `featured` table is harmless left in place (empty, RLS
on); no need to drop it. Reverting the code removes the band entirely.
