# Report a listing (removal & correction requests)

The public **"Cancelled or wrong? Tell us"** channel. Before this the site had no contact, report, or takedown path of any kind — not even a `mailto:` — so a venue that cancelled an event had literally no way to reach us, and a stale listing could only be caught by the weekly verify pass. Nothing here is applied automatically: a report is a **tip to check**, never an instruction to execute.

## Flow

1. Someone opens an event and clicks **"Cancelled or wrong? Tell us →"** at the bottom of the listing (or **Report a listing** in the footer), landing on `/report?event=<id>`.
2. The page shows the listing read-only, so they can confirm they're flagging the right one, then `components/ReportForm.tsx` collects: what's wrong (cancelled / wrong details / duplicate / remove / other), a required sentence of explanation, an optional evidence link, and an optional role + email.
3. `submitReportAction` runs the **honeypot first**, then the per-IP rate limit (`reportPerIp`, 5/hour — tighter than submissions), validates, and inserts into `event_reports` through the owner connection.
4. In **Admin → Reports**, each open report shows the reason beside the live listing's title/venue/date and current status.
5. The operator picks one of three, each of which records the outcome **on the report row**:
   - **Mark cancelled** → event status `cancelled`. The page survives with the red banner, JSON-LD emits `EventCancelled`, the `.ics` emits `STATUS:CANCELLED` so calendars that already imported it get the update, and it drops off every list, feed, digest and the sitemap.
   - **Hide the listing** → status `draft`. The URL 404s and it vanishes. Right when something should never have been listed.
   - **Dismiss — no change** → report `declined` with an optional internal note; the event is untouched.

## Pieces

- **`lib/event-reports.ts`** (pure + DB): `validateReport` (real event UUID, required reason with a 1000-char cap, known kind, optional-but-sane email, unknown role degrades to blank) plus the DB helpers `addReport`, `getPendingReports`, `getPendingReportCount`, `getOldestPendingReportDays`, `markReportReviewed`. `REPORT_KIND_LABELS` / `REPORTER_ROLE_LABELS` are the one source for the form and the queue, so they can't drift.
- **`lib/report-actions.ts`** — the public `submitReportAction`; **`lib/report-types.ts`** — the shared state type (a `"use server"` file may export only async actions).
- **`lib/admin-actions.ts`** — `cancelReportedEvent` / `hideReportedEvent` / `dismissReport`. The first two go through `setStatus`, whose `refresh()` clears **both** the events data cache and the page cache — a bare `revalidatePath` would leave the removed event live on city/venue/day pages for up to an hour.
- **`app/report/page.tsx`** (public, `noindex`, not in the sitemap) and **`app/admin/reports/page.tsx`** (the queue).

## Data & safety

- `event_reports` (see `db/schema.sql`) is **sealed**: RLS enabled, no anon policy — it carries reporter emails and unverified claims, so it's as locked down as the audit log. `db/verify-rls.sql` asserts anon sees zero rows.
- **Every claim is unverified by construction.** Event ids are public UUIDs, so the form is trivially scriptable against any listing, and "I'm the organizer" is a text field, not a fact. This mirrors the house rule in `lib/verify.ts`, where a cancel verdict *without evidence* is downgraded to a flag rather than applied. Nothing is ever auto-actioned.
- Abuse is handled by the honeypot (silent fake-success, so bots learn nothing), a per-IP cap that returns an **honest** error to real people, strict server-side validation, and the fact that a human decides every outcome.
- **Nothing is ever deleted.** The only levers are status changes, all reversible from the Events tab. `archived` is deliberately *not* offered here: the event page hardcodes archived to "This event has already happened," which would be factually false for an event pulled at an organizer's request.
- `outcome` is nullable *with* a CHECK — the one such column in the schema — so "not yet decided" stays distinguishable from "decided: no change."

## Being told about it

Two layers, so one can fail:

- **Backstop (shipped here):** the weekly ops digest's **Queue** section reports open submissions and reports with a link to each queue. An empty queue is never an alert — that would destroy the subject-line signal every quiet week. The one alert is a report older than `STALE_REPORT_DAYS` (3), because a cancelled event still showing on the site is exactly the honest-data failure this project exists to avoid. A failed gather degrades to "unavailable", never a fake zero.
- **Instant (shipped):** `lib/notify-send.ts` emails the operator the moment a submission or report lands, linking straight to the queue that can act on it. Notification failure never breaks a user's submission — the row is already committed, so `sendOperatorNotification` catches everything, returns a boolean the caller only logs, and the digest catches whatever the email missed. Public input (a stranger's reason text) is escaped before it reaches the inbox. A single **global** hourly cap sits on outbound notifications, because `rateAllow` fails open on DB trouble and a per-IP cap wouldn't bound a distributed flood. Set `NOTIFY_WEBHOOK_URL` to also get it on a phone lock screen (Discord/Slack/ntfy) — unset is a silent no-op.

## Notes

- `/report` is `noindex` and deliberately **absent from `app/sitemap.ts`** — a utility form with no search value that shouldn't compete with the event pages it serves.
- Without a valid `?event=`, the page shows guidance instead of a form: a report is stored against an event (`event_id` is `not null`), so an unattached one couldn't be saved, and showing a form that fails on submit would be dishonest.
- Reporters get **no automatic reply** today, and the email is optional — it exists so an operator can follow up by hand on a "this is my event, take it down" claim.
