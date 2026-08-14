# City Pulse MN — Roadmap v5, Repair & Ripen Edition

*July 20, 2026. Supersedes Roadmap v4 (whose ungated items are all shipped as of today) and the circulating "v5" file that was identical to v4. This document comes out of a full-codebase audit: three independent review passes over lib/, app/, components/, and scripts/, verified against the live site. Quality gate at time of audit: tsc clean · 589/589 tests · build deps clean · npm audit 0. Every bug below is a logic bug the test suite does not currently cover; every file:line reference was verified by hand against the code, and the flagship bug (R0.1) was confirmed rendering wrong on citypulsemn.com during the audit.*

**Strategic context, in three sentences.** v4's thesis held: the cockpit sends, the index is being earned, everything ungated shipped. The audit found the new gap is *correctness under UTC*: the site's wall-clock-Chicago convention is enforced in some modules (`weekend.ts`, `feeds.ts`, `trending.ts` — all correct) but not others, and on Vercel's UTC servers that means evening events silently vanish from collections, related strips, digests, and event-page status every afternoon — the exact hours people plan their night. Therefore: repair before ripening — two repair sprints, then return to the v4 ripening schedule (4.1 → 4.2 → 4.3, Phase 5 gates) on time in mid-August.

**How this document is organized.** Part 1 is bugs, grouped into three repair sprints by theme (R0 data-loss and trust · R1 the Chicago clock · R2 hardening), each item with evidence, failure scenario, fix, and tests, in the house per-item format. Part 2 is features: the v4 items that ripen on schedule, plus new proposals the audit motivated. Part 3 is data operations and owner checks (no code). Sequencing at the end.

**Standing engineering rules (unchanged from v4, plus one new):**
- Quality gate per item: pure logic in `lib/` with golden tests · idempotent additive `db/schema.sql` · tsc clean · build clean · `npm audit` 0 · one live smoke cycle · deploy guide.
- Analytics/aux paths carry the never-break contract; DB-backed pages never prerender at build; true spans, never capped expansions; honest emptiness; verify the artifact and the read-back; rule 9 (`::text::timestamp at time zone 'America/Chicago'` on parameterized wall-time writes).
- **Proposed rule 10 (comes out of this audit): a naive wall-time string may never be compared against a real instant.** `new Date(wallString).getTime()` vs `Date.now()` is the bug class behind six findings below. All "is it past?"/window logic goes through the shared Chicago clock (R1.1) — comparisons happen in day-keys or wall-clock strings, never mixed frames.

---

## Part 1 — Bugs

### Sprint R0 — Stop the bleeding (data loss + user trust; target: this week, before the Jul 27 pipeline run)

#### R0.1 Event pages call live events "already happened" — CONFIRMED LIVE TODAY
**Where:** `lib/event-view.ts:15-18` (`isEnded`), rendered by `app/event/[id]/page.tsx:67`.
**Bug:** `isEnded` does `new Date(event.end || event.start)` on a naive Chicago wall-time string. On Vercel (UTC) that parses 7:00 PM Chicago as 7:00 PM UTC — five/six hours early. It also never looks at `multiDayEnd`, so a collapsed run is judged by day 1's end.
**Confirmed live (Jul 20, ~2 PM CT):** the Minnehaha Falls Art Fair page (`/event/d8b5d142-…`) shows **"This event has already happened."** on the fair's own final day — while the homepage Ongoing strip simultaneously (and correctly) lists it as ending today. Beyond multi-day runs: every single-evening event's shareable page flips to "already happened" from ~1–2 PM CT onward — the exact hours people check tonight's plans, on the pages Instagram and shares point to.
**Fix:** compare in the Chicago frame (use the R1.1 clock helper, or interim: build "now" as a Chicago wall string via the `Intl` pattern already in `trending.ts:133` and compare strings), and use `multiDayEnd ?? end ?? start`, treating date-only values as end-of-day.
**Tests (~6):** evening event at afternoon-UTC boundary (the 2 PM CT / 7 PM UTC case) · multi-day run mid-run → not ended · run's final day → not ended until end of day · all-day single event on its own day → not ended · genuinely past → ended · DST week variant.
**Verify:** the Minnehaha page class of URL (any last-day multi-day event, any same-evening event fetched mid-afternoon) shows no banner.
**Size: S.** Depends: nothing (R1.1 makes it cleaner but don't wait for it).

#### R0.2 `archivePastEvents` ignores `multi_day_end` — the weekly pipeline will archive festivals mid-run
**Where:** `lib/upsert.ts:103-112`; runs every pipeline via `scripts/run-pipeline.ts` (immediately *after* `collapseMultiDayRuns`).
**Bug:** `where status='published' and coalesce(end_at, start_at) < now()`. A collapsed run's surviving row keeps day 1's `end_at` (or null) — the true span lives in `multi_day_end`, which this predicate never reads. The codebase already knows the right pattern: `lib/trending.ts:116` uses `coalesce(e.multi_day_end, e.end_at, e.start_at) >= now()`.
**Failure scenario:** State Fair collapsed to one card (Aug 21 start, `multi_day_end` Sep 1). The first pipeline run after Aug 21 evening archives it — the fair vanishes with ~8 days left. This is not hypothetical-someday: **Ramsey County Fair (thru Jul 29), Aquatennial (thru Jul 26), and Leprechaun Days (thru Jul 25) are all live collapsed runs today, and the next pipeline run is Mon Jul 27** — Ramsey County Fair gets archived two days early on that run. Secondary: an all-day event (`start_at` midnight, no end) is archived on the morning of its own day.
**Fix:** `coalesce(multi_day_end, end_at, start_at)` plus end-of-day grace for date-only values (e.g. `+ interval '1 day'` on the date-only branch, or compare against Chicago end-of-day).
**Tests (~5):** golden rows for mid-run collapsed event · final-day event (kept through its last day) · all-day today (kept) · genuinely past single event (archived) · null-end past event.
**Verify:** after the Jul 27 run, Ramsey County Fair still published; ops digest archive count sane.
**Size: S.** **This is the most urgent item in the document.**

#### R0.3 Near-duplicate dedupe clusters by UTC date — can merge two different games (sports-rule violation)
**Where:** `lib/upsert.ts:152` (`dedupeNearDuplicates`), same predicate in the admin dup-review query `lib/admin.ts:172`.
**Bug:** `a.start_at::date = b.start_at::date` casts timestamptz using the DB session timezone (UTC on Supabase — nothing in `lib/db.ts` or the schema sets it). Any Chicago event at/after 7 PM CDT lands on the *next* UTC date.
**Failure scenario:** Twins Mon 7:10 PM (stored `Tue 00:10Z`) and Twins Tue 1:10 PM day game (`Tue 18:10Z`) share UTC date Tuesday: identical titles (similarity 1.0), same stadium (<250 m) → one real game archived. Direct violation of the sports rule ("never merge games across different days"), running weekly. Symmetric miss: genuine same-day duplicates listed 5 PM vs 8 PM straddle the UTC boundary and are never caught. Bonus defect in the same function: the doc comment promises "earliest-seen row is kept," but the join orders random UUIDs (`a.id < b.id`) — survivor is a coin flip, and chained pairs can archive a row >250 m from the actual survivor.
**Fix:** `(a.start_at at time zone 'America/Chicago')::date = (b.start_at at time zone 'America/Chicago')::date` in both files; order survivorship on `created_at` (or richness) and anchor the join to the kept row.
**Tests:** hard to unit-test SQL without a DB — encode as a probe script per the rule-9 pattern (literal fixtures round-tripped against prod-shaped DB in the Supabase editor), plus a drift-guard test asserting the query text contains the `at time zone` cast (cheap tripwire).
**Verify:** run the admin duplicates view before/after on a week with an evening game + next-day game; confirm zero cross-day pairs listed.
**Size: S code, M verification.**

#### R0.4 Magic-link restore 500s in its flagship case — wrong column name, no test
**Where:** `lib/saved-restore.ts:84-89` (`mergeAndRestore`); caller `app/saved/restore/route.ts` has no try/catch.
**Bug:** the merge branch inserts/selects `saved_events.saver_token` — the column is `user_token` (`db/schema.sql:227`; every query in `lib/saved.ts` agrees). Postgres error 42703 → unhandled throw → Next.js 500 page.
**Failure scenario:** user opens their emailed restore link on a browser that already has a `cpid` cookie with a different token — *exactly* the advertised merge-don't-lose case — and gets an error page instead. Only fresh-browser restores (merge branch skipped) work, which is why it's survived: the happy path demos fine. The docs' explicit "never an error page" promise is broken. No test covers `mergeAndRestore` (only `restore-token.test.ts` exists).
**Fix:** `user_token` in both spots · wrap the route so unexpected throws degrade to `?restore=invalid` · add the merge-branch test. Consider the R2.6 drift guard so query column names are checked against `schema.sql` mechanically.
**Verify:** two-browser live test: save on A, request link, save something else on B, open link on B → merged list, no 500.
**Size: S.**

#### R0.5 Re-subscribing never works after unsubscribe (or after keep-list), and the UI claims it did
**Where:** `lib/subscribe.ts:60-67` (`addSubscriber`); surfaced by `lib/subscribe-actions.ts` ("You're already subscribed 🎉"); `app/unsubscribe/route.ts` explicitly promises "You can resubscribe anytime at the bottom of the site."
**Bug:** `on conflict (email) do update set saver_token = …` never touches `status`, and nothing else in the codebase ever sets `status` back to `'subscribed'` (only `markUnsubscribed` writes it). The digest mails only `status='subscribed'`.
**Failure scenario:** (a) unsubscribe → resubmit footer form → told "already subscribed" → never mailed again, forever, silently. (b) A keep-my-list user (row created `status='pending'` by `lib/saved-restore.ts:45`) later subscribes on purpose → same lie, no digest. For a product whose core asset is the weekly email, this quietly caps list growth and breaks a printed promise.
**Fix:** promote status in the conflict update (`unsubscribed`→`subscribed` on explicit resubscribe, `pending`→`subscribed`), clear `unsubscribed_at`, and return a value that distinguishes *resubscribed* so the UI is honest. Decide policy explicitly in the deploy guide (this intersects the deferred double-opt-in item in `docs/EMAIL.md` — see F-NEW.3).
**Tests (~5):** fresh insert · already-subscribed no-op · unsubscribed→resubscribe · pending→subscribe · saver_token still coalesced correctly.
**Verify:** live round-trip with a test address: subscribe → unsubscribe → resubscribe → appears in `getSubscribedRecipients` count.
**Size: S.**

#### R0.6 Stored XSS on public pages via JSON-LD (`</script>` breakout)
**Where:** `lib/seo/event-jsonld.ts` output rendered with `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}` on five surfaces: `app/event/[id]/page.tsx:86`, `app/day/[date]/page.tsx:50`, `app/collections/[slug]/page.tsx:81`, `app/this-weekend/page.tsx:68`, `app/venues/[slug]/page.tsx:112`.
**Bug:** `JSON.stringify` escapes quotes but not `<` or `/`. A title/description/venue containing `</script><img src=x onerror=…>` terminates the script block and executes in every visitor's browser.
**Failure scenario:** event content is *not* trusted input — the weekly pipeline auto-publishes scraped agent output, and community submissions become events on approval; neither path strips markup (`validateSubmission` only length-checks). One malicious or merely weird upstream listing = live XSS on citypulsemn.com. The codebase already escapes `<` in the two other HTML-injection sinks (`lib/digest.ts:77`, `components/MapView.tsx:154`) — JSON-LD is the one that forgot.
**Fix:** one shared `jsonLdSafe(obj)` = `JSON.stringify(obj).replace(/</g, "\\u003c")` (harmless to parsers, standard Next.js practice), used by all five surfaces.
**Tests (~3):** `</script>`-bearing title round-trips inert · output still valid JSON (`JSON.parse`) · venue/address fields covered.
**Verify:** view-source on one live event page → `<` present for a crafted draft event; Google Rich Results test still passes.
**Size: S.**

---

### Sprint R1 — One clock (the wall-time/UTC unification; target: next week)

The theme: six modules compare naive Chicago wall-strings against real UTC instants. `weekend.ts`, `feeds.ts`, `ongoing.ts`, and `trending.ts` already do it right (Intl-based Chicago day-keys). R1 gives the correct pattern a name and a home, then converts the six offenders. **Fixing R1.1 first makes every subsequent item a mechanical edit.**

#### R1.1 `lib/clock.ts` — the shared Chicago clock (new module, keystone)
**Design:** tiny pure module, no deps: `chiNow(): string` (wall-clock now as `YYYY-MM-DDTHH:MM` via the `Intl` en-CA/en-GB trick already proven in `trending.ts:133`) · `chiTodayKey(): string` · `isPastWall(wallString, nowWall)` · `wallToInstant(wallString): Date` (attaches the real offset via the existing `chicagoOffset` from `lib/seo/event-jsonld.ts` — move it here, re-export from the old site for compat). Every "is it past?"/window comparison in the codebase goes through this module — rule 10.
**Tests (~8):** CDT and CST cases · DST transition days (spring-forward, fall-back — including the small-hours case from the current `chicagoOffset` noon-probe limitation, fixed here by probing the actual hour) · day-key boundaries at 11 PM CT / 5 AM UTC.
**Size: S.** Everything below in R1 depends on it.

#### R1.2 Collections drop tonight's events every afternoon
**Where:** `lib/collections.ts:85-124` (`selectCollection`, `collectionWindow`); server-rendered with `new Date()` by `app/collections/[slug]/page.tsx:73` and `app/collections/page.tsx:29`.
**Bug:** `evDate(e).getTime()` (naive wall-string → fake-UTC epoch) compared against real `now.getTime()` as the window start; from ~1–2 PM CT onward every evening event fails `t >= start`. Verified by execution: a 7 PM CT show is absent from "Free This Week" rendered at 2:30 PM CT. Additionally `collectionWindow`'s weekend math runs `getDay()`/`setHours` in the server-local (UTC) frame: Sunday evening CT, the "weekend" window jumps to *next* weekend.
**Failure scenario:** Date Night / Live Music / Free This Week silently thin out every afternoon; index-page counts undercount; Sunday-evening weekend collections show the wrong week. Fix via R1.1: window in Chicago day-keys/wall strings (mirror `weekend.ts`'s approach), compare walls to walls.
**Tests (~6):** afternoon-UTC boundary inclusion · Sunday-evening weekend window · week/month windows spanning DST · count parity between index and detail page.
**Size: S** after R1.1.

#### R1.3 "More at this venue" hides tonight's shows
**Where:** `lib/related.ts:25-28`; called with `new Date()` from `app/event/[id]/page.tsx:140`.
**Bug/fix:** same fake-UTC vs real-now mismatch; verified a 7 PM First Avenue show excluded at 2:30 PM CT (strip renders null). Convert to wall-frame comparison. **Tests (~3).** **Size: XS** after R1.1.

#### R1.4 Digest windows drop send-day afternoon events
**Where:** `lib/content/weekly-picks.ts:48-56`, `lib/digest-personal.ts:32-47`, driven by `now = new Date()` in `lib/digest-send.ts:42`; digest sends Thu 15:00 UTC (10 AM CT) from Actions.
**Bug:** same frame mismatch on the Actions UTC runner: everything today between ~10 AM and ~3 PM CT wall time is treated as past and vanishes from weekly picks *and* the personalized "you saved these — happening this week" block on send morning.
**Fix:** window from `chiNow()` walls. **Tests (~4):** send-morning boundary · saved-reminder inclusion · +7d end unchanged · empty-degradation unchanged. **Size: S** after R1.1.

#### R1.5 /this-weekend drops long self-spanned runs (the cap leak the comment claims is fixed)
**Where:** `lib/weekend.ts:110` (`selectWeekend`).
**Bug:** for a single row whose span comes from its own `end_at` (no `multi_day_end`) and exceeds `EXPAND_MAX_DAYS`, `daysSpanned` returns `[startDay]` → `endDay < firstDay` → skipped. Verified: a Jul 1→31 exhibition yields zero weekend sections while the this-weekend *ICS feed* (`feeds.ts:114`, `spansDay`) correctly includes it — the page disagrees with its own feed. Rule 5 (true spans, never capped expansions), fixed in v4 for the `multiDayEnd` source only.
**Fix:** `const end = spanEnd(e); const endDay = end ? dayOf(end) : startDay;`. **Tests (~3):** the 31-day case as regression · page/feed parity fixture. **Size: XS.**

#### R1.6 Verification window skew (latent — fires when verify moves to CI)
**Where:** `lib/verify.ts:96-97` + SQL prefilter in `scripts/verify-events.ts:33-34`.
**Bug:** naive-parse vs real-now shifts the 7-day verify window ~6 h on a UTC runner: tonight's 7 PM show drops out of verification after ~1 PM CT; events just past day 7 sneak in. Currently masked because the verify pass runs on the local (Chicago) machine — but `verify-events.yml` runs Thu 16:00 UTC in Actions, so the CI leg of this is live already.
**Fix:** wall-frame comparisons via R1.1. **Tests (~3).** **Size: XS** after R1.1.

#### R1.7 Small clock cleanups (bundle into one patch)
- **`lib/horizon.ts:43-46`** — `addDaysISO` mixes local `setDate` with `toISOString()` (UTC read): evening local runs start the research window a day late. Build day keys from one frame. *(XS)*
- **`lib/events.ts:170-171` vs `lib/dates.ts:181`** — expansion cap off-by-one: SQL allows 15-day spans, client expands ≤14 → a 15-day run appears on server day pages but not the SPA day panel. Align SQL to `<= 13` diff. *(XS)*
- **`lib/seo/event-jsonld.ts:10-21`** — `chicagoOffset` probes noon, wrong for small-hours times on DST transition days (one hour off in JSON-LD/ICS twice a year). Solved properly in R1.1's `wallToInstant`. *(absorbed by R1.1)*
- **Product call for Taren, not a silent fix:** the calendar "Weekend" preset (`lib/dates.ts:66-77`, test-blessed) jumps to *next* weekend on Sundays, while `/this-weekend` insists "Sunday → it's still the weekend." Pick one philosophy; the fix is three lines whichever way. *(XS)*

---

### Sprint R2 — Hardening (trust, abuse, and honest instruments; target: within two weeks)

#### R2.1 Rate limiting on public write paths (the email-bomb hole is the forcing reason)
**Where:** `lib/saved-restore.ts:31-61` (`requestSavedLink` — sends Resend email to any typed address, gated only by a honeypot field), `lib/subscribe-actions.ts`, `lib/submit-actions.ts`, `app/api/beacon/route.ts`.
**Failure scenario:** a script POSTs the keep-list form with a victim's email in a loop → the victim's inbox fills with "Your saved events on City Pulse MN," the subscribers table fills with `pending` rows, and the Resend quota burns. Subscribe/submit allow unbounded row creation the same way.
**Design:** no new infra — a Postgres counter table (`rate_events(bucket text, window_start timestamptz, n int)`, additive schema) with a pure `allow(bucket, limit, windowMinutes)` helper; buckets per-IP (from `x-forwarded-for`) and per-target-email for the email-sending path (e.g. 3 sends/address/hour, 10 writes/IP/hour). Fail-open on DB error (never-break: a rate-limit outage must not take down subscribing), fail-closed on limit. Beacon stays honest-but-cheap: per-IP cap only (its inflatability is an accepted design note in the code).
**Tests (~6):** window roll-over · per-email cap · fail-open path · honeypot still short-circuits before counting. **Size: M.**

#### R2.2 A missing `RESEND_API_KEY` must turn the digest workflow red
**Where:** `lib/digest-send.ts:97-102` + `scripts/send-digest.ts`.
**Bug:** missing key is folded into the dry-run branch: `ok: true`, a `digest_sends` row with `ok=true`, exit 0, green workflow — zero subscribers mailed, for as many weeks as it takes someone to notice a side note in the ops digest. The repo itself codifies this exact lesson elsewhere (`send-ops-digest.ts` exits 1 on the same condition; the Jul 15 incident comment in `saved-restore.ts`).
**Fix:** when `dryRun` is false and the key is absent → `ok: false`, exit 1. **Tests (~2).** **Size: XS.**

#### R2.3 Ops digest: colliding error keys and zero-poisoning (two small honesty bugs in the new cockpit)
**Where:** `scripts/send-ops-digest.ts:62,89,103` + `lib/ops-digest.ts:120,154,244`; `lib/stats.ts:138-146`.
**Bugs:** (a) the WoW-baseline read, last-digest-note read, and prev-sitemap read reuse the section keys `engagement`/`subscribers`/`index` — a transient failure on an *auxiliary* read renders the whole healthy section "unavailable," discarding good data, contradicting the module's own independence rule. (b) `getEngagement` swallows failure into zeros: one DB blip on send morning prints "views 0" as fact *and* writes a zero WoW baseline, making next week's deltas read "new" — two weeks of dead instrumentation from one blip, the precise failure class 2.1 was built against.
**Fix:** distinct aux keys (`engagement_prev`, `digest_note`, `index_prev`) degrading to "first report"/omitted-line; thread engagement through the `wrap()` mechanism (or an error flag) so failure renders "unavailable" and skips the baseline write. **Tests (~5)** on golden compose inputs. **Size: S.**

#### R2.4 Escape the ops digest HTML
**Where:** `lib/ops-digest.ts:196,213,284,288,289`.
**Bug:** scraped event titles ("most viewed," trending top-3) and raw error strings interpolate into HTML with no `esc()` — the subscriber digest already has the helper (`lib/digest.ts:74-80`); the operator email forgot it. A title like `Beauty & the Beast <Preview>` breaks the section; a DB error containing markup injects into your inbox.
**Fix:** apply `esc()` at every interpolation. **Tests (~2** golden). **Size: XS.**

#### R2.5 Calendar-export correctness (spans and the Google button)
**Where:** `lib/ics.ts:48-52,87,133-144`.
**Bugs:** (a) timed collapsed runs export DTEND from day 1's `end_at` — `multiDayEnd` is consulted only in the all-day branch, so a 12-day run lands in subscribers' calendars as one day (verified by execution). (b) `googleCalendarUrl` ignores `allDay` entirely: an all-day fair becomes a 12:00–2:00 AM appointment in Google while the .ics branch does it right. (c) `foldLine` folds at 75 UTF-16 code units, not octets, and can split surrogate pairs — titles with emoji (venue listings have them) serialize as invalid bytes mid-emoji.
**Fixes:** use `spanEnd()` in `endStamp` · emit `YYYYMMDD/YYYYMMDD` (end-exclusive) for all-day Google links · fold on code points/bytes (`Array.from`). **Tests (~6),** including a node-ical round-trip with an emoji title and a multi-day timed run. **Size: S.**

#### R2.6 Schema drift guard (the test that would have caught R0.4)
**Design:** a vitest that parses `db/schema.sql` for table→column sets and greps `lib/**` SQL template literals for `table (col, …)` / `where col =` references against known tables — assert every referenced column exists. Deliberately dumb and conservative (allowlist for dynamic fragments); its only job is to make a `saver_token`-vs-`user_token` class of typo fail CI instead of 500ing a user. Follows the existing drift-guard convention (`related.test.ts`, `feeds.test.ts`).
**Size: S.**

#### R2.7 Housekeeping batch (bundle; each XS)
- `next.config.ts:13-15` — image `remotePatterns: https://**` lets a crafted `event.image` URL aim the server-side optimizer anywhere (SSRF surface; the comment already says "tighten for production"). Restrict to the known venue/CDN hosts seen in real data (query distinct image hosts first), or drop the optimizer for remote images.
- `ops-digest.yml` hardcodes `SITE_URL: https://www.citypulsemn.com` (www) vs canonical apex in `lib/seo/site.ts` — works only via redirect; align it.
- `digest_sends` bookkeeping: `recipients` column stores `result.sent` (partial failures under-record `attempted`); dry runs insert rows, so the ops digest's "last digest" note can describe a dry run; `getSubscriberStats` counts `pending` in "total" while only `subscribed` get mailed — three small honesty fixes.
- `List-Unsubscribe` headers ride Resend's **batch** endpoint, which has historically dropped per-message custom headers — verify one delivered digest's raw headers (Gmail "show original"); if absent, switch to per-recipient `/emails` or set at domain level. (Deliverability, so worth the five minutes: it's a Gmail/Yahoo bulk-sender requirement.)
- Keep-list token overwrite (`lib/saved-restore.ts:45-51`): entering your email on a *new* device with 1 save repoints your subscriber row at the 1-save token; the 100-save laptop list still exists but nothing references it, and personalization follows the wrong identity. Product call (merge-on-request vs keep-larger), then a small fix.

---

## Part 2 — Features

### F1 — Ripening on schedule (unchanged from v4; the repair sprints do not move these)
- **F1.1 (v4 4.1) Evidence-based coverage** — demand column on Admin → Coverage (events published vs views vs ticket clicks per category, 30 days). **Mid-August**, when `event_stats` has ~4 weeks of depth. Size S.
- **F1.2 (v4 4.2) Trending calibration** — replay a real week through `scoreRows`/`rankTrending` offline; tune `TREND_HALF_LIFE_DAYS`, `TREND_MIN_SCORE`, weights; consider "Most saved this week" in the digest. **After F1.1.** Size S.
- **F1.3 (v4 4.3) "For you" ordering** — affinity-ordered category chips + collection strip for returning savers via client-side `/api/affinity` (ISR preserved); calendar stays chronological truth. **After F1.2** confirms save volume. Size M. *Note: R0.4/R0.5 are prerequisites in spirit — personalization leans on the saver-token identity being restorable and the subscriber link being honest.*
- **F1.4 Phase 5 (revenue) gates unchanged** — eight consecutive green weeks readable from the ops digest: coverage floors green · pipeline healthy · Search Console impressions trending up · subscribers ≥ your bar. The clock legitimately starts with tomorrow's (Jul 21) first fully-correct digest. Order when unlocked: featured placement → venue dashboards → sponsored collection → newsletter slot → affiliate ticketing. Curation is never for sale.
- **F1.5 (v4 6.2/6.3/6.4)** — public read API (only on demonstrated demand), semantic search (real project, spec when reached), multi-city (an attention decision, not a code decision). All still parked.

### F2 — New proposals motivated by the audit (slot after R2, before/alongside F1)

#### F2.1 "Happening now / starts in N hours" on event pages (S)
R0.1's fix makes event-page time-state trustworthy for the first time — spend it. Replace the binary ended/not with three honest states: *Starts in 2 hours* / *Happening now* (between start and effective end) / *This event has already happened*. Pure function beside `isEnded` (`eventTimeState(event, nowWall)`), one line in the detail body. The shareable page becomes better than a listing precisely when shared ("we should go — it's on now"). Tests ride R0.1's fixtures.

#### F2.2 Last-chance surface (S)
`selectOngoing` already sorts by ending-soonest; the data model owns true spans. Add a "Last chance" row: ongoing items whose `multi_day_end` is within 7 days, surfaced as the top slice of `/ongoing` and an optional homepage strip label swap ("Ends this week"). Honest-emptiness rule applies (hide under 3). Near-free reuse of `lib/ongoing.ts` + one selector + tests. SEO bonus: "last weekend for X" is a query people actually type.

#### F2.3 Resubscribe + double opt-in decision (S–M)
R0.5 fixes the mechanics; this item is the deliberate policy layer that `docs/EMAIL.md` deferred: send a confirmation email on resubscribe-after-unsubscribe (protects sender reputation and consent honesty), and decide whether new subscribers confirm (double opt-in) now that the schema (`status`, `confirmed_at`) has carried the fields since day one. With R2.1's rate limiting and R2.7's List-Unsubscribe verification, this completes the deliverability story before the list is big enough for mistakes to be expensive.

#### F2.4 Search Console indexed-count automation (S, after ~Jul 27 data exists)
The ops digest's Index line is manual-first by design. Once the first Pages numbers land (~Jul 27), wire the Search Console API (service-account JSON in Actions secrets, one `searchanalytics`/index-coverage read) into `gatherOpsInputs` behind the never-break wrapper — the Phase 5 impressions gate then reads itself. Keep the manual field as fallback.

#### F2.5 Feed adoption affordances (XS–S)
6.1 shipped the feeds; nothing yet measures or markets them. Add `source`-tagged copy-link buttons on venue/collection pages ("Add to your calendar app"), count clicks via the existing beacon (never-break), and report a "feeds" line in the ops digest. Cheap, and it tells you whether 6.2 (public API) ever deserves to exist.

#### F2.6 Pipeline observability follow-through (S)
R0.2/R0.3 both live in the weekly pipeline's blast radius, and the collapse rewrite is one day old. Add to the pipeline log + ops digest: per-stage counts *with diffs vs last run* (upserted/collapsed/deduped/archived), and a tripwire line when `archived > N` or `deduped > N` in one run (a stampede of archives is how R0.2 would have announced itself). Pure additions to `composeOpsDigest` inputs; tests golden.

---

## Part 3 — Data operations & owner checks (no code)

1. **Tomorrow, Jul 21 (watch-list, unchanged):** pipeline + first fully-correct ops digest — check `folded N sub-event group(s)`, festivals one card each, real WoW percentages, sitemap count in the Index line. **Add one check: Ramsey County Fair / Aquatennial / Leprechaun Days still published after the run** (they survive Jul 21 because none has fully started-and-passed yet under the buggy predicate — R0.2's first real bite is Jul 27; landing the fix this week makes the question moot).
2. **Admin-edited times spot-check (rule 9 backfill, still pending from Jul 20):** any event hand-edited in admin before Jul 20 may sit +5/6 h late. One SQL in the Supabase editor: `select id, title, to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD HH24:MI') from events where status='published' and (extract(hour from start_at at time zone 'America/Chicago') < 6 or extract(hour from start_at at time zone 'America/Chicago') >= 23) order by 3;` — improbable hours are the tell; fix rows via admin (post-fix it writes correctly).
3. **Sever's true end date** — extend `multi_day_end`; the two Oct weekend rows fold automatically next run.
4. **Taren, anytime (carried):** subscribe one feed in a real calendar app · Instagram bio link → `/this-weekend` · paste a real IG card to lock `formatCard` · phone checks · reword `FOR_VENUES` to taste.
5. **~Jul 27:** first Search Console Pages numbers → seed the Index line; F2.4 becomes buildable.
6. **Docs tidy (fold into the next PR):** `ops/README.md` still marks COLLAPSE-1.1 "pending" (it ran Jul 16) · `docs/HANDOFF.md` "there is no v5" line → point it at this file · add rule 10 to `docs/ENGINEERING.md` when R1.1 lands.

---

## Sequencing at a glance

```
THIS WEEK  → R0.2 archive fix (before Jul 27 pipeline!) → R0.1 ended-banner → R0.3 dedupe TZ
           → R0.4 restore column → R0.5 resubscribe → R0.6 JSON-LD escape
NEXT WEEK  → R1.1 lib/clock.ts → R1.2 collections → R1.3 related → R1.4 digest windows
           → R1.5 weekend cap leak → R1.6 verify window → R1.7 cleanups (+ Weekend-preset product call)
WEEK 3     → R2.1 rate limits → R2.2 red-digest → R2.3/R2.4 ops-digest honesty → R2.5 ICS spans
           → R2.6 drift guard → R2.7 housekeeping batch
MID-AUG    → F1.1 demand column → F1.2 trending tune → F1.3 for-you   (v4 schedule, unmoved)
ALONGSIDE  → F2.1 happening-now (rides R0.1) → F2.2 last chance → F2.3 opt-in policy
           → F2.4 GSC automation (post-Jul 27) → F2.5 feed affordances → F2.6 pipeline tripwires
GATED      → Phase 5 after eight green weeks (clock starts Jul 21) → 6.2/6.3/6.4 parked
```

**If you fix one thing: R0.2, before Monday Jul 27** — it's the difference between the Ramsey County Fair being on the site or not for its final two days, and the same story for every festival after it. **If you fix two: R0.1** — it's wrong on the live site right now, every afternoon, on the exact pages you share.

*Provenance: three independent code-review passes (core data/time logic · app/components/security · growth/email/ops) + live-site verification, Jul 20, 2026. All file:line references checked against the working tree at commit state of Jul 20 EOD. Bugs verified by hand where claimed "verified by execution"; R0.1 confirmed rendering on production. Nothing in this document was reported without a concrete failure scenario.*
