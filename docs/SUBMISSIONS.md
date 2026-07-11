# Submit an event (community submissions)

Roadmap 3.2. A public **Submit an event** form lets the community and organizers surface events. Nothing publishes automatically — every submission lands in a moderation queue, and an admin approves (which creates a published event) or rejects. Curation stays editorial.

## Flow

1. Someone fills out `/submit` (title, category, date/time, venue, city, optional address, price, link, description, and an optional contact email).
2. The `submitEventAction` server action validates (honeypot + `validateSubmission`) and inserts into `event_submissions` through the owner connection.
3. In **Admin → Submissions**, each pending item shows its details with **Approve & publish** / **Reject**.
4. **Approve** geocodes the venue/address (`lib/geocode`, falling back to downtown Minneapolis), builds a real event via the shared `submissionToDbEvent` mapper — correct Central→UTC instant (`toIsoWithOffset`), dedup `event_key` (`computeEventKey`), price tier (`normalizeTier`) — and upserts it (`upsertEvents`, status `published`). The submission is marked approved and audited.
5. **Reject** marks it rejected with an optional internal note.

## Pieces

- **`lib/submissions.ts`** (pure + DB): `validateSubmission` (required fields, valid/near-future date, known category, URL/email format, length caps) and `submissionToDbEvent` (the pure approve mapper) are unit-tested; the DB helpers (`addSubmission`, `getPendingSubmissions`, `getPendingSubmissionCount`, `getSubmissionById`, `markSubmissionReviewed`) use the owner connection.
- **`lib/submit-actions.ts`** — public `submitEventAction` (honeypot + validate + insert).
- **`lib/submission-actions.ts`** — admin `approveSubmission` / `rejectSubmission` (assertAdmin + audit).
- **`components/SubmitForm.tsx`** — the public form (useActionState, inline field errors, success state).
- **`app/submit/page.tsx`** — the public page; **`app/admin/submissions/page.tsx`** — the moderation queue.

## Data & safety

- `event_submissions` (see `db/schema.sql`) is **sealed**: RLS enabled, no anon policy. The public REST API can't read or write it — writes go only through the server action on the owner connection, exactly like the subscribers table.
- Abuse is handled by a honeypot field, strict server-side validation, and the fact that **nothing goes live without review**. (A rate limiter could be added later if volume warrants; the moderation gate makes it low-risk for now.)
- Approving is idempotent on `event_key` — if the same event was already found by the weekly pipeline, approval updates in place rather than duplicating.

## Notes

- Approved events get a map pin from geocoding; if geocoding is unavailable (no Mapbox token), they default to the metro center and can be nudged later with the event editor (1.5).
- The form is linked from the site footer and listed in the sitemap.
