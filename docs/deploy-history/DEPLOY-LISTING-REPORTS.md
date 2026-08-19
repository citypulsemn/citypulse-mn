# Deploy — Report a listing: removal & correction requests (Taren item 2)

*Aug 19, 2026. The site had **no** contact, report, or takedown channel of any kind
— verified by repo-wide grep, not even a `mailto:`. A venue that cancelled an event
had literally no way to tell us, and a stale listing could only be caught by the
weekly verify pass. This adds the channel, the moderation queue, and a weekly
backstop so a report can't sit unseen.*

## What shipped

**Public side**
- **`/report?event=<id>`** ([app/report/page.tsx](../../app/report/page.tsx)) — shows
  the listing read-only so the reporter can confirm they've got the right one, then
  the form. `noindex`, and deliberately **not** in the sitemap.
- **`components/ReportForm.tsx`** — what's wrong (cancelled / wrong details /
  duplicate / remove / other), a required explanation, an optional evidence link,
  optional role + email. Reuses the existing `.submit-form` CSS, so no new styles.
- **Entry points:** a quiet "Cancelled or wrong? Tell us →" under every listing's
  CTAs — placed in `components/EventDetailBody.tsx` so the **modal and the
  shareable `/event/[id]` page can't drift** — plus "Report a listing" in the footer.

**Data + server**
- **`event_reports`** ([db/schema.sql](../../db/schema.sql)) — additive and
  idempotent, RLS on with **no anon policy**; `db/verify-rls.sql` asserts anon sees
  zero rows. A **new table, not a discriminator** on `event_submissions`: the two
  rows share almost no columns, and reusing it would pollute the approve mapper and
  the existing queue with null columns.
- **`lib/event-reports.ts`** — `validateReport` (pure, golden-tested) + DB helpers.
- **`lib/report-actions.ts`** — honeypot **first**, then a per-IP cap
  (`reportPerIp`, 5/hr — tighter than submissions), then validate + insert.

**Admin**
- **`/admin/reports`** — one card per open report with the reason beside the live
  listing's details, and three actions: **Mark cancelled** (primary), **Hide the
  listing**, **Dismiss — no change**.
- `setStatus`'s union widened to include `'cancelled'` — the **first
  operator-settable cancellation** in the codebase (until now only the weekly
  pipeline and the evidence-gated verify pass wrote it).

**Notification backstop**
- A **Queue** section in the weekly ops digest reporting open submissions + reports
  with a link to each. An empty queue is **never an alert** (that would destroy the
  subject-line signal every quiet week); the one alert is a report older than
  `STALE_REPORT_DAYS` (3), because a cancelled event still live is precisely the
  honest-data failure this project exists to avoid. A failed gather degrades to
  "unavailable", never a fake zero.

## The honesty rules baked in
- **A report is a tip, never an instruction.** Event ids are public UUIDs and "I'm
  the organizer" is a text field, so the form is trivially scriptable. **Nothing is
  ever auto-applied** — a person decides every outcome. This mirrors `lib/verify.ts`,
  where a cancel verdict without evidence is downgraded to a flag.
- **Nothing is deleted.** Only status changes, all reversible from the Events tab.
- **`archived` is deliberately not offered** here: the event page hardcodes archived
  to "This event has already happened," which would be factually false for an event
  pulled next Tuesday at an organizer's request.
- **No form we couldn't save.** Without a valid `?event=`, the page shows guidance
  instead of a form — `event_id` is `not null`, so an unattached report can't be
  stored, and a form that fails on submit would be a lie.
- **`outcome` is nullable with a CHECK** so "not yet decided" stays distinguishable
  from "decided: no change". The outcome is recorded on the **report row**, because
  `admin_audit` has no read path in the app.

## Verification (observed, not intended)
- **Rendered HTML** (dev server): the listing carries
  `<a href="/report?event=f12c…">Cancelled or wrong? Tell us →</a>`; `/report?event=`
  renders "You're reporting", the hidden `eventId`, the honeypot (`class="hp"`), the
  kind options and the submit button; **`/report` with no event renders the guidance
  and no `<form>`**; the footer carries "Report a listing".
- **Build:** `/report` and `/admin/reports` both compile as **ƒ (dynamic)** — no
  build-time DB reads (ENGINEERING rule 2).
- **Tests +27** (1220 total): validateReport (junk/SQL-ish event ids rejected,
  reason required + capped, kinds closed, email optional-but-sane, unknown role
  degrades to blank, bare evidence domains normalized); wiring tripwires (sealed
  idempotent schema, no anon policy, RLS check extended, **honeypot before rate
  limit**, entry points, noindex + absent from sitemap, no form without an event,
  admin actions go through `setStatus`/`refresh`, **nothing deletes an event**); and
  the Queue section (empty ≠ alert, stale report = alert, failure ≠ fake zero).
- Gate: `tsc` clean · 1220/1220 · `npm run build` clean · `npm audit` 0.

### A build failure worth recording
The first build **failed**: `ReportForm` (a client component) imported its label
constants from `lib/event-reports.ts`, which imports `sql` from `lib/db` — dragging
`postgres` into the browser bundle (`Can't resolve 'net'`). Fixed by moving the
shared vocabulary into the DB-free `lib/report-types.ts`, and pinned with a guard
test so it can't come back.

## Deploy steps
1. **Apply the schema first** — `db/schema.sql` is idempotent, so running it whole is
   safe: it creates `event_reports` + its two indexes and enables RLS. **The feature
   cannot work until this runs**; the insert will error and the report is lost.
2. Merge to `main`; Vercel auto-deploys.
3. Optionally run `db/verify-rls.sql` and confirm `report_rows_visible_to_anon` is 0.
4. Smoke on production: open any event → "Cancelled or wrong?" → submit a test
   report → confirm it appears in **Admin → Reports** → **Dismiss** it.

**Not smoke-tested end-to-end locally, on purpose:** local dev points at the
production database, so actually submitting would have written a junk row to prod —
and the table doesn't exist there until step 1 anyway. The write path is covered by
unit tests and the schema-drift guard; step 4 is the real end-to-end check.

## Follow-ups
- **Instant notification** (item 3) — a transactional email per submission/report
  with a phone-push webhook behind an env var. The digest Queue block is the
  backstop that makes that safe to fail.
- `docs/ADMIN.md` is stale (documents 4 of what is now 10 tabs) — worth a refresh
  rather than appending another orphaned section.
- No automatic reply to reporters today, and the email is optional by design.

## Rollback
`git revert`. The table is additive and unreferenced by any read path once the code
is gone; leaving it in place is harmless (drop it separately if desired). The
`'cancelled'` widening on `setStatus` is inert without the report actions.
