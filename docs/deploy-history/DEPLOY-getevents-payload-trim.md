# Deploy — trim the getEvents payload (cap description in list reads)

*Aug 15, 2026. Egress / page-weight reduction (Roadmap v6 Tier 0.1).*

## What & why

`getEvents()` ships every column of ~953 events (~0.7 MB) — to the Vercel data cache
on each fill AND to every homepage visitor's browser (the explorer is client-side).
A per-column measurement showed **`description` is ~193 KB — about half the text
payload** (avg 203 chars, max 406); `image` is empty for all 953 rows.

`description` can't just be dropped — client `search` matches it and the quick-look
modal shows it — but the list surfaces (cards / calendar / map) don't need the full
text, and a modal is a *preview*. So the three **list reads** now cap it to a
**180-char preview** (with `…`); the **detail page keeps the full text**.

- `readAllPublished` (getEvents), `readEventsForDay` (getEventsForDay), `getEventsByIds`
  (saved): `case when length(description) > 180 then left(description,179) || '…' else description end`.
- `getEvent` (the `/event/[id]` detail page) is **unchanged** — full description.

## Impact

- **~33 KB saved per payload** (description 193 KB → 160 KB; 17% of the field, ~5% of
  the ~0.7 MB total). Modest — descriptions cluster near the cap, so there's no big
  tail to cheaply cut. Applies to both the DB→cache read and the per-visitor client
  download.
- **UX:** near-zero. Most descriptions (≤180) are unchanged; only long ones get a `…`
  in the list/modal. The full text is one click away on the detail page. Search now
  matches the first 180 chars (the key terms are early in almost every description).

## Honest note

This is a real but small reduction — the payload's bulk is inherent (description +
the ~20 JSON keys/event + the URL fields). The larger egress levers remain the cache
TTLs (shipped) and, above all, the **Supabase egress cap** (the Tier 0.1 decision).

## Verification

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0 · `npm test` 1049.
- `events-read` tripwire: exactly 3 capped list selects, `getEvent` keeps the full
  read. Measured savings confirmed against live data (33 KB).
- Sample-fallback path (`!sql`) is un-truncated, so search/detail tests are unaffected.

## Rollback

Revert this commit (restores full description in the list reads).
