# Deploy — Instant operator notifications (Taren item 3)

*Aug 19, 2026. "A better way to be notified of a submission, edit, or removal
request — maybe an email, but something better than having to go to the admin page
daily." The real problem wasn't missing email; it was **pull instead of push**. This
adds the push, on top of the weekly Queue backstop that shipped with item 2.*

## What shipped
- **`lib/notify-send.ts`**
  - `renderNotifyEmail(item, siteUrl)` — pure and golden-tested. Subject reads
    `New listing report: Gothic Market` / `New event submission: <title>`; the body
    carries a detail line and a button straight to the queue that can act on it.
  - `sendOperatorNotification(item)` — Resend REST call copied from
    `lib/confirm-send.ts` (no SDK, so `npm audit` stays 0), plus an **optional**
    webhook hop.
- **Wired into both paths** — `lib/submit-actions.ts` (after `addSubmission`) and
  `lib/report-actions.ts` (after `addReport`). The report notification looks up the
  event title first, so the alert is triageable at a glance rather than saying
  "a listing"; that lookup is guarded and degrades to the report kind.
- **Phone push, pre-wired but off.** If `NOTIFY_WEBHOOK_URL` is set, the same event
  also POSTs a one-line JSON body shaped to satisfy Discord / Slack / ntfy at once
  (`content` / `text` / `title` / `message`). Unset = nothing happens, no error, no
  log noise. Turning it on later is pasting one URL into Vercel — no code change.
- **`.env.example`** documents `NOTIFY_TO` and `NOTIFY_WEBHOOK_URL`.

## The never-break contract (ENGINEERING rule 1)
This is the part that matters. The row is **already committed** before we notify, so:
- `sendOperatorNotification` wraps its whole body in try/catch and returns a
  boolean. It cannot throw into a form submission.
- Callers `await` it (there is no `waitUntil`/`after()` anywhere in this repo — a
  fire-and-forget promise in a server action can be killed when the function
  returns), then **only `console.warn` on failure**. A notification outage never
  turns a successful submission into an error for the user.
- Deliberately **not** the subscribe pattern, where the send's boolean gates the
  response — there the email *is* the product. Here it is an instrument, and the
  weekly digest Queue section is the panel that keeps working when it breaks.
- Tests pin all three: the try/catch shape, that callers log rather than error, and
  that the notify call comes **after** the insert in both files.

## Two smaller decisions worth recording
- **A single global send cap** (`notify:operator`, 20/hour), not per-IP. `rateAllow`
  fails **open** on database trouble by design, and `submitPerIp` is per-address, so
  neither bounds a distributed flood — this caps the blast radius on our side and
  protects the Resend quota. Hitting it is not a user error; the digest still
  reports the item.
- **Public input is escaped before it reaches the inbox.** A report reason is a
  stranger's text landing in an HTML email; every dynamic value goes through `esc`
  from `lib/digest.ts`. Verified by rendering a payload containing
  `<script>` and confirming the raw tag is absent and the escaped form present.

## Verification (observed, not intended)
- **Rendered the real email** via `tsx`: subject `New listing report: Gothic Market
  <script>bad</script>`, readable text part, link
  `https://citypulsemn.com/admin/reports` — with a **trailing slash on SITE_URL**
  correctly collapsed (no `com//admin`). HTML body: raw `<script>bad` absent,
  `&lt;script&gt;bad` present.
- **Tests +14** (1234 total): subject/link/trailing-slash/escaping/"nothing has been
  applied yet" copy; and the contract guards above, plus the global cap, the
  optional-and-silent webhook, the `NOTIFY_TO ?? OPS_DIGEST_TO` fallback, honest
  logging of a missing key, and both vars documented in `.env.example`.
- Gate: `tsc` clean · 1234/1234 · `npm run build` clean · `npm audit` 0.

**Not sent a real email from local dev, on purpose:** local env has no
`RESEND_API_KEY` and there is no test inbox. The composition is unit-tested and
rendered; delivery was verified on production instead — see below.

### Verified on production (Aug 19)
Two test reports submitted through the live form on a real listing:
- the row landed correct each time (`status=pending`, `outcome=NULL`, optional fields
  empty, joined to the right event);
- the honeypot was exercised live — a filled `company` field returned the cheerful
  fake success and stored **zero** rows;
- **the operator email arrived** after the redeploy.

A useful forensic detail for next time: `rateAllow` records the `notify:operator`
bucket in `rate_events` **immediately before** the Resend fetch, so that row proves
whether a send was *attempted* — which is how the failure was isolated to config
rather than code without any access to Vercel logs.

**Correction to an earlier draft of this guide:** it stated `RESEND_API_KEY` was
"already live" in Vercel, inferred from docs rather than observed (and flagged as
unverified at the time). That inference happened to be correct — the successful send
confirms it — but it should not have been written as settled fact.

## Deploy steps — one thing Taren must do
1. **Set `NOTIFY_TO` in Vercel** (Production scope) to the address that should get
   alerts. **`OPS_DIGEST_TO` is only a GitHub Actions secret — the site cannot read
   it**, so without `NOTIFY_TO` the fallback finds nothing and the notification logs
   an honest error instead of sending. Nothing else breaks.
2. **Then REDEPLOY.** ⚠️ This is not optional and it cost a full debug cycle on the
   first run: **Vercel env-var changes do not apply to deployments that are already
   running.** The variable was set correctly and the send still failed, because the
   live deployment had been built before it existed. One click on
   Deployments → ⋯ → Redeploy fixes it.
3. Merge to `main`; Vercel auto-deploys.
4. Smoke: submit a test report from any listing → an email should arrive within
   seconds → confirm the item is in Admin → Reports → dismiss it.
5. *Optional, later:* set `NOTIFY_WEBHOOK_URL` for phone push. ntfy.sh needs no
   account (`https://ntfy.sh/<a-secret-topic-you-choose>`); a private Discord
   channel webhook also works.

## Rollback
`git revert`. The module is additive; without it both actions return exactly as
before, and the weekly Queue section still surfaces everything.
