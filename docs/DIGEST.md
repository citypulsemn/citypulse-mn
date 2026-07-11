# Weekly email digest

Roadmap 3.1. Every Thursday morning, confirmed subscribers get a branded email with the week's best events — the payoff for the 2.2 subscriber list, and the loop that pulls people back to the site. It also completes the unsubscribe flow the subscribers schema anticipated.

## Pieces

- **`lib/digest.ts`** (pure, unit-tested): `digestEvents(events, now)` curates ~8 events (family + unique + top regulars, deduped, chronological) by reusing the 2.1 `weeklyPicks` engine; `renderDigestEmail({events, weekLabel, unsubscribeUrl, siteUrl})` → `{subject, html, text}`. The HTML is deliberately email-safe: one 600px centered table, inline styles only, no external CSS/webfonts, `<meta charset>` declared, brand navy/gold, and a plain-text alternative.
- **`lib/unsubscribe-token.ts`** (pure, unit-tested): stateless HMAC-SHA256 tokens over the subscriber id — unforgeable without `UNSUBSCRIBE_SECRET`, nothing extra to store, and the id (not the email) rides in the URL.
- **`lib/digest-send.ts`**: `sendWeeklyDigest({dryRun})` — selects events, renders one message per subscriber (each with its own unsubscribe link + `List-Unsubscribe` header), and sends via the **Resend batch API** (plain `fetch`, no SDK, so `npm audit` stays clean) in chunks of 100. Without a key or in dry-run it logs instead. Every run writes a `digest_sends` row.
- **`app/unsubscribe/route.ts`**: verifies the token, marks the subscriber unsubscribed, and returns a branded confirmation. Handles `GET` (link click) and `POST` (RFC 8058 one-click).
- **`scripts/send-digest.ts`** + **`.github/workflows/weekly-digest.yml`**: `npm run digest` on a Thursday cron (with a `dry_run` dispatch input), mirroring the research pipeline pattern.
- **`app/admin/digest`**: live email preview (iframe), this week's subject, confirmed-subscriber count, and recent sends.

## Data

`digest_sends` (id, sent_at, recipients, ok, note) — send observability. Sealed like other internal tables: RLS enabled, no anon policy. The `subscribers` table's `status`/`unsubscribed_at` columns (from 2.2) are now driven by the unsubscribe flow.

## Sending safely

Real sending needs a Resend account, a **verified sending domain**, and these env vars/secrets: `RESEND_API_KEY`, `DIGEST_FROM`, `UNSUBSCRIBE_SECRET`, `SITE_URL`, `DATABASE_URL`. Until those are set the job is a safe no-op (logs only). See the deploy guide for setup. Test locally with `npm run digest -- --dry-run`.

## Notes

- Deliverability: per-recipient `List-Unsubscribe` + `List-Unsubscribe-Post` headers and a text part are included; a verified domain with SPF/DKIM (Resend walks you through it) is what actually keeps you out of spam.
- If a week has no upcoming events the job skips (records a note) rather than sending an empty email.
- Each week's digest is essentially the "this week" collection delivered to the inbox — same curation philosophy as 2.4.
