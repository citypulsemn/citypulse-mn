# Instagram content generator (the flywheel)

Roadmap 2.1. Turns the live event database into the week's Instagram kit — branded cards + ready-to-paste captions — so posting is copy, download, done. This closes the loop: DB → IG post → citypulsemn.com → back into the feed.

## Where it lives

`/admin/content` (behind the admin login). Each week it shows:
- **This Week — roundup**: a multi-event card + caption listing the week's picks.
- **Family pick** and **Uniquely MN pick**: the locked recurring formats.
- **On the radar**: the top general events, one per venue, spread across days.

Each block has a **1080×1350 card preview**, a **Download card** button, and a **Copy caption** button.

## How the picks are chosen

`lib/content/weekly-picks.ts` (pure, unit-tested):
- Window: published events starting in the next 7 days.
- Score (`scoreEvent`): rewards a ticket link, a real description, an image, weekend dates, and free events (no popularity data yet — that arrives with 5.4).
- `family` = top-scored `family` event; `unique` = top-scored `weird` event.
- `regular` = the next best, **excluding** the family/unique picks, capped at one per venue and two per day, up to five.

## Captions

`lib/content/templates.ts` (pure, unit-tested): a hook line by format, then title / 📅 date / 📍 venue / 💵 price, the `citypulsemn.com` CTA, and hashtags (base Twin Cities tags + per-category tags + a suburb tag when relevant, deduped and capped).

## Cards

Rendered on demand with `next/og` at 1080×1350, in the same brand as the site and OG images (navy field, gold double-border frame, Oswald type, skyline, wordmark), using the shared embedded font `lib/brand/oswald-font.ts`:
- `/content/card/[id]?label=family|unique|regular` — single event.
- `/content/week` — the roundup.

These routes are public (they only render **published** events — no private data), so previews and downloads work straight from the admin page without auth juggling.

## Notes

- Everything regenerates from live data — edit an event in the Events tab and the card/caption update.
- The selection is deterministic: same data in, same feed out, for a consistent weekly rhythm.
- Future: a scheduled job could pre-render and push these; for now it's a pull tool you open on Sunday.
