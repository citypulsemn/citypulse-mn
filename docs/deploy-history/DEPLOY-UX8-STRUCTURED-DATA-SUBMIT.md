# Deploy UX8 — structured-data & submit-data correctness

*August 2026. UX roadmap item 8, opening Tier 3. Two data-honesty fixes that a
user never clicks but Google and every submitter feel: the JSON-LD we hand
Google's "events near me" surface, and the shape of the dates/links we accept on
the public submit form.*

## Why these two together

Both are the same bug class the R2.5 ICS work already fixed in one place and
never carried to the others: **a date that lies about span or type**. R2.5 fixed
the `.ics` files; the JSON-LD emitter and the submit validator still had the old
behavior. UX8 finishes the sweep.

## What shipped

**1 — JSON-LD dates that match reality**
([lib/seo/event-jsonld.ts](../../lib/seo/event-jsonld.ts))

- **All-day events now emit schema.org DATE values** (`"2026-07-20"`), not a
  fabricated `…T00:00:00-05:00`. A midnight time renders as "12:00 AM" in a rich
  result — wrong and ugly for a street festival. Gated on `event.allDay`.
- **`endDate` follows the TRUE span** (rule 5) via `spanEnd()` — a multi-day
  festival stored with `multiDayEnd` (or a genuinely-later `end`) now tells
  Google it runs `Jul 20 → Jul 28`, instead of collapsing to day one. The
  emitter previously read only `event.end`, so every collapsed run looked
  single-day to search.
- A single-day timed event is unchanged (start/end datetimes with offset); a
  late-night `9pm–1am` show still carries its real end time, not a fake span.

**2 — submit form accepts what people actually paste**
([lib/submissions.ts](../../lib/submissions.ts))

- **Bare domains are accepted.** People paste `powderhornartfair.com` or
  `facebook.com/events/123`, not `https://…`. `normalizeUrl()` prepends the
  scheme they omit, then validates. A stray word with no dot (`notaurl`) is
  still rejected — the dotted-host check in `isHttpUrl` is what tells a real
  bare domain from a typo.
- **Past-midnight end times roll to the next day.** A `9pm–1am` show was stored
  with `end_local` pinned to the *start* date — a backwards, negative-duration
  span, common for this metro's nightlife. `endLocal()` rolls the end to the
  next calendar day when the end time is strictly before the start
  (noon-UTC-anchored, DST-safe).

## Verification (observed, not intended)

- **Tests +13 (854/854):** JSON-LD — all-day single-day emits a DATE start and
  no endDate; all-day multi-day emits DATE start + DATE endDate from the span;
  timed multi-day uses `multiDayEnd` for endDate, not the day-one end. Submit —
  bare domain stored with scheme; bare domain + path accepted; bare word still
  rejected; past-midnight end rolls to the next day (incl. a month boundary).
  Plus direct `normalizeUrl`/`endLocal` unit cases.
- **The existing `notaurl` → rejected test still passes** — tightening
  `isHttpUrl` to require a dotted host is what keeps normalizeUrl from turning
  garbage into a valid-looking URL.
- **Gate:** `tsc` clean · 854/854 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Pure `lib/` logic + tests — no schema, no component, no env.

## Verify checklist

- [ ] View source on a multi-day festival event page → the `application/ld+json`
      block shows `startDate` and an `endDate` on the festival's LAST day.
- [ ] An all-day event's JSON-LD `startDate` is a bare `YYYY-MM-DD` (no `T…`).
- [ ] Submit form: paste `powderhornartfair.com` in the ticket link → accepted.
- [ ] Submit an event running e.g. 9:00 PM–1:00 AM → the stored end is the next
      day (spot-check in `event_submissions`, or after approval the event page
      shows the correct end, not "9 PM – 1 AM" backwards).
- [ ] (Optional) Google Rich Results Test on a multi-day event URL → dates valid.

## Rollback

`git revert`. Pure functions + tests; nothing else depends on the new exports
(`normalizeUrl`, `endLocal` are additive; the JSON-LD change is internal to
`eventJsonLd`).
