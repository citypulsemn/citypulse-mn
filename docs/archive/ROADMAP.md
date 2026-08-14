# City Pulse MN — Roadmap v4, Build Edition (post-Phase-6)

*July 16, 2026. Phases 1–6 of the previous numbering are complete (516 tests, 0 vulnerabilities); this document renumbers the remaining work from 1.0 and expands every item into a buildable spec: design decisions, files, schema, tests, verification, and deploy shape. Module references are checked against the codebase as of today.*

**Strategic context, in three sentences.** The v2/v3 corrections landed: the taxonomy stopped lying (music 0 → 144), and the feedback loop exists at every layer (coverage floors, weekly verification, first-party engagement, trending). The new gap is distribution: citypulsemn.com does not yet surface in web search even for its own name, while incumbents (Eventbrite, mspmag, familyfuntwincities, City Cast's daily events email) own the query space Phase 6 built ~120 pages for. Therefore: finish the cockpit (Phase 2), then earn the index (Phase 3) before constructing anything new.

**Standing engineering rules (apply to every item below):**
- Quality gate per item: pure logic in `lib/` with golden-set tests from real data · idempotent additive `db/schema.sql` · tsc clean · build clean · `npm audit` 0 · one live smoke cycle · deploy guide.
- Analytics/aux reads and writes carry the never-break contract (try/catch → empty/no-op, logged).
- DB-backed pages never prerender at build (`generateStaticParams` needs a positive reason); on-demand ISR is the default.
- The dev container has no database and an old rendering engine — production-only paths ship pre-wrapped in resilience, and user-reported visual bugs are verified on the axis reported.

---

## Phase 1 — Operations (no code; ~30 minutes total; do before anything else)

### 1.1 Multi-day collapse — the last Phase-4 data op
**Why:** The State Fair still renders as four cards; title-duplicate runs crowd the calendar and the collections counts.
**Do:** In Supabase SQL Editor run the export:
```sql
select id, title, city, category,
       to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD"T"HH24:MI') as start
from events where status in ('published','draft')
order by title, start;
```
Paste the output to me → I return transaction-wrapped, per-cluster-commented SQL (RUN vs DUP decisions), same as the time backfill. Sports never collapse across days (the Saints ×7 guard is already in `lib/multiday.ts` and tested).
**Verify:** `/collections` festival count deflates; State Fair shows once with a run badge; no sports game disappeared (spot-check a Twins homestand).
**Rollback:** the generated SQL archives (never deletes); an un-archive statement ships alongside it.

### 1.2 Google Search Console
**Do:** Verify the domain (DNS TXT via your registrar or the Vercel integration) → submit `https://citypulsemn.com/sitemap.xml`. **Highest-leverage ten minutes available** — 42 venue + 16 neighborhood + active-city + `/this-weekend` URLs are waiting.
**Verify:** Within ~a week, Pages report shows discovery; note the indexed count (item 2.1 will start reporting it weekly).

### 1.3 Instagram bio link
**Do:** Set @CityPulseMpls bio to `citypulsemn.com/this-weekend`. Captions from the 6.4 generator already reference it.

### 1.4 Lock the card format
**Do:** Paste one real card from a past Reel. I match `formatCard` in `lib/instagram.ts` exactly (single function, test-guarded). Until then the default two-line format stands.

### 1.5 Deployed-fix spot check (phone)
Background seam gone on a long page · venue map full-width with centered pin · admin tab strip clean · magic-link email arrives (Vercel `RESEND_API_KEY` confirmed working Jul 15).

---

## Phase 2 — The Cockpit

### 2.1 Ops digest ⚠️ keystone of v4
**Why:** The site has coverage grades, verify flags, pipeline health, engagement, trending, and subscriber stats — spread across an admin you must remember to open. Unwatched dashboards are this project's documented failure mode (v3 exists because deployed code sat unexercised for a week).

**Design decisions:**
- **One email, Monday, after the pipeline run** (the GitHub Actions digest workflow pattern: a new `ops-digest` job triggered on completion of the pipeline workflow, plus a manual dispatch). Reports on fresh data or reports the run's failure — either way you learn something.
- **Recipient:** `OPS_DIGEST_TO` env (your email), sent via the existing Resend fetch pattern from `lib/digest-send.ts`. Never touches subscribers.
- **Sections & sources (all existing):**
  1. *Pipeline:* last `pipeline_runs` row — ok/error, upserted/cancelled/archived/collapsed counts, duration; kill signature (`finished_at` null) called out.
  2. *Coverage:* `assessCoverage()` + `formatCoverageAlerts()` from `lib/coverage.ts` — the 4-week grid summarized, floor breaches in red-equivalent text.
  3. *Verification:* count of events flagged by the Thursday verify pass since last digest (query `admin_audit` for verify actions, or the verify flags table 4.5 writes).
  4. *Engagement:* `getEngagement(7)` from `lib/stats.ts` — totals + week-over-week delta (store last week's totals in a new `ops_digest_runs` row to diff against).
  5. *Trending:* lit or dark (`getTrendingEvents().length`), top 3 titles when lit.
  6. *Subscribers:* count + 7-day delta from `lib/subscribe.ts` stats; `N personalized` from the last digest send (`getDigestSends(1)`).
  7. *(after 3.1)* Indexed-page count, manual field until the Search Console API is wired (optional; keep manual).
- **Resilience:** every section independently wrapped — a failed section renders "section unavailable: <reason>", never kills the email. The email must send even when the news is bad; *especially* then.

**Build:** `lib/ops-digest.ts` (pure: `composeOpsDigest(inputs) → {subject, html, text}` with section renderers; db: `gatherOpsInputs()`), `scripts/send-ops-digest.ts` (+ `npm run ops-digest`, `--dry-run`), `.github/workflows/ops-digest.yml` (workflow_run on pipeline completion + workflow_dispatch), schema: `ops_digest_runs(id, sent_at, totals jsonb)` for week-over-week diffs. Admin → a "Send ops digest (dry-run)" note on the Pipeline tab is optional; skip UI.
**Tests (~12):** section renderers with golden inputs (healthy week, failed pipeline, coverage breach, dark trending); the never-break wrapper (a throwing gatherer yields the unavailable line, email still composes); week-over-week math incl. first-run (no prior row → "first report"); subject forms ("✅ all green" vs "⚠️ 2 alerts").
**Verify:** dry-run locally prints the composed email; render HTML to PNG for a visual; live: manual dispatch once, confirm arrival.
**Deploy:** schema step (one table) + zip + add `OPS_DIGEST_TO` to GitHub Actions env (Resend key already there). Size: **M**. Depends: nothing.

### 2.2 Ongoing strip
**Why:** Runs longer than `EXPAND_MAX_DAYS` (14) deliberately appear only on their start day in the calendar — correct for the grid, but it means a 3-week exhibition is nearly invisible mid-run. `/this-weekend` already solves this locally ("Happening all weekend"); generalize it.

**Design decisions:**
- **Definition (pure, `lib/ongoing.ts`):** `selectOngoing(events, now)` → published events where `startDay < todayKey` AND `endDay ≥ todayKey` AND total span > 3 days (short runs don't need a strip), sorted by `endDay` ascending (**ending soonest first — urgency is the editorial angle: "last chance"**), capped at 12. Reuse `daysSpanned`, `spanEnd` from `lib/multiday.ts`, and the true-span intersection lesson from `lib/weekend.ts` (do NOT rely on capped `daysSpanned` for the end day).
- **Surfaces:** homepage strip below TrendingStrip ("Ongoing — catch these before they close", each card showing "through Aug 2"); an `/ongoing` page mirroring the trending-collection pattern (evergreen URL, small SEO bonus: "exhibitions in minneapolis right now"). Strip self-hides under 3 qualifying events (the trending honesty rule).
- EventDayCard already renders run labels via `multiDayLabel` — reuse; no new card component.

**Build:** `lib/ongoing.ts` + tests · `components/OngoingStrip.tsx` · `app/ongoing/page.tsx` (revalidate 300, prerender OK — single query like homepage) · homepage wiring · footer + sitemap entries.
**Tests (~8):** boundary days (ends today → included; ended yesterday → out; starts today → out, it's not "ongoing" yet); the >3-day floor; ending-soonest ordering; cap; the 17-day-fair case from the weekend bug as a regression.
**Verify:** smoke homepage (strip hidden in past-dated sample data) + `/ongoing` empty state; one populated render via the tsx demo pattern.
**Deploy:** code-only. Size: **S**. Depends: nothing.

### 2.3 Codify the incident rules
**Do:** `docs/ENGINEERING.md` — the standing rules block from this document's header, expanded with the four incident case studies (admin-stats 500, build stampede, venue-map axes, background seam), the container's blind-spot list, smoke conventions (one `next start` cycle; RSC `<!-- -->` grep gotcha; wkhtmltoimage CSS limits), and the restore/re-zip commands. Pure writing; **S**; do it inside the next build's PR rather than as its own deploy.

---

## Phase 3 — Earn the Index (distribution, not construction)

### 3.1 Indexing loop
**Why:** Pages that aren't indexed don't exist. The loop: submit → measure → react.
**Design:** Manual-first (the API can wait): a weekly glance at Search Console's Pages + Performance reports, recorded as one line in the 2.1 ops digest (manual field or skip until stable). Add `robots.txt` check + ensure every page type carries a canonical (audit: event, day, collection, venue, neighborhood, city, this-weekend, ongoing — most already do from their builds; fix stragglers).
**Build:** audit pass + at most small metadata patches. **Tests:** none beyond existing metadata assertions. **Verify:** `curl -s <page> | grep canonical` across one page per type on the live site. Size: **S**. Depends: 1.2.

### 3.2 Content depth on the money pages
**Why:** Internal links + real sentences are the cheapest ranking signal, and they help humans.
**Design decisions:**
- **Editorial paragraphs, written by you, stored as data:** extend `NEIGHBORHOODS[].blurb` usage with an optional `intro` field (2–3 sentences) rendered on the district page; add a parallel `VENUE_INTROS: Record<slug, string>` map in `lib/venue-pages.ts` for the top ~15 venues. Your voice, my plumbing — I ship the fields with placeholders flagged `TODO(taren)`, you fill them in one commit.
- **"More at this venue" strip on event pages:** in `EventDetailBody`'s parent (server side), when `matchVenueSlug(event.venue)` hits, query the venue's next 4 upcoming events (excluding self) via `getEvents()` filter — render compact links under the detail card, linking also to the venue page. Same-neighborhood fallback when the venue has nothing else.
**Build:** field additions + one server component `MoreAtVenue` + detail-page wiring. **Tests (~5):** selection (excludes self, upcoming only, cap 4, venue match via alias), fallback path. **Verify:** smoke an event page; populated demo via tsx. **Deploy:** code-only. Size: **S–M**. Depends: nothing.

### 3.3 Social cards (OG images)
**Why:** Every share currently falls back to a bare preview; branded cards make each Instagram story, text, and Slack paste an ad.
**Design decisions:**
- **Vercel OG (`next/og`) image routes** — `app/this-weekend/opengraph-image.tsx`, `app/venues/[slug]/opengraph-image.tsx`, `app/collections/[slug]/opengraph-image.tsx`, plus a default site card. Brand: navy field, gold Oswald title, the eyebrow pattern ("TWIN CITIES · JULY 17–19"), event-count line. **No live-DB dependency inside the image route where avoidable** (title/label from params + registry; counts optional) — the build/runtime rules apply here too.
- Weekend card shows the current `weekendLabel()` — acceptable dynamic (edge runtime, cached like the page).
**Build:** 3–4 `opengraph-image.tsx` routes + a tiny shared style helper. **Tests:** none automatable meaningfully; **Verify:** fetch each `/opengraph-image` URL in smoke (200 + `content-type: image/png`), view one render, then validate live with an OG debugger after deploy. **Deploy:** code-only. Size: **M**. Depends: nothing.

### 3.4 Digest growth loop
**Why:** The digest is the retention asset and City Cast proves the market; today the only subscribe surface is the footer.
**Design decisions:**
- **Placements:** `/this-weekend` — a slim inline subscribe band after the first day section ("Get this in your inbox every week"); venue pages — after the event list. Reuse the existing subscribe form component with a new `source` value per placement (`this-weekend`, `venue-page`) — **the `subscribers.source` column already exists, so conversion by placement is measurable from day one** (report it in 2.1's subscriber section: signups by source, 7-day).
- Keep it quiet: one band per page, no popups, ever — the no-dark-patterns stance is brand.
**Build:** `components/SubscribeBand.tsx` (wraps the existing form), two wirings, ops-digest source breakdown (one query). **Tests (~3):** source propagation through `subscribeAction` (already parameterized), band renders with correct source. **Verify:** smoke both pages; check a test signup's `source` row. **Deploy:** code-only. Size: **S**. Depends: 2.1 for the reporting line (placement itself independent).

### 3.5 Vitals pass
**Do:** Lighthouse on homepage, event page, `/this-weekend`, one venue page. Fix the cheap findings only: explicit image dimensions where missing, font `display=swap` check, preconnects for Mapbox static. Timebox: one session. **Verify:** before/after scores recorded in the PR. Size: **S**.

---

## Phase 4 — Let the Data Drive

### 4.1 Evidence-based coverage
**Why:** Coverage floors (`WEEKLY_FLOORS` in `lib/coverage.ts`) were set by judgment; six-plus weeks of `event_stats` can now check them against demand.
**Design:** A quarterly-ish analysis view, not automation: Admin → Coverage gains a "demand" column — per category over 30 days: events published vs views vs ticket clicks (join `event_stats` to `events.category`; one SQL, resilience-wrapped). The human reads it and adjusts `WEEKLY_FLOORS` / venue-registry sweep budgets by hand — **judgment stays in charge; the data advises.**
**Build:** one query in `lib/coverage.ts` (`categoryDemand(days)`), one table section on the coverage page. **Tests (~4):** shaping + the never-break wrapper. **Verify:** smoke admin page. **Deploy:** code-only. Size: **S**. Depends: ≥4 weeks of 5.1 data (mid-August).

### 4.2 Trending calibration
**Do:** After 4–6 weeks of stats: pull a week of `event_stats`, replay through `scoreRows`/`rankTrending` offline (the tsx harness from the 5.2 build), and tune the named constants (`TREND_HALF_LIFE_DAYS`, `TREND_MIN_SCORE`, weights) against editorial feel. Consider adding a "Most saved this week" section to the subscriber digest (one query + one render block in `lib/digest.ts`, byte-identical-when-empty rule applies). Size: **S**, mostly analysis. Depends: real data volume.

### 4.3 Taste on the site ("For you" ordering)
**Why:** The digest personalizes; the site can, gently, for returning savers — no accounts, no creepiness.
**Design decisions:** When the request carries a saver token with ≥3 saves, compute `categoryAffinity` (exists in `lib/digest-personal.ts`) server-side and pass an optional `affinityOrder` to `EventsExplorer` — **reordering only the explorer's category chip order and the "browse by collection" strip, never the calendar itself** (the calendar is chronological truth; taste touches navigation, not facts). A small "ordered for you · reset" affordance keeps it legible. Cookie read makes the homepage per-user → route stays `revalidate` for anonymous, personalization applied client-side from a tiny `/api/affinity` endpoint (never-break contract, returns [] fast) to preserve ISR. That decision — client-side affinity fetch to keep the homepage cacheable — is the item's core design constraint.
**Build:** `/api/affinity` route + `lib` affinity reuse + explorer prop + reset affordance. **Tests (~6):** affinity endpoint contract (no token → [], <3 saves → []), ordering stability, calendar untouched. **Verify:** smoke with seeded cookie via curl; populated demo. **Deploy:** code-only. Size: **M**. Depends: nothing technically; better after 4.2 confirms save volume.

### 4.4 Submissions flywheel
**Why:** Venue relationships are Phase 5 groundwork and coverage insurance today.
**Design:** `/for-venues` static page ("Get your events listed — free"): what qualifies, how the weekly sweep works, the submit form link, and a plain statement of the editorial rules (no pay-to-list, ever). Linked from every venue page footer line ("Is this your venue?"). Submissions inbox already exists (3.2 of the old numbering) — no backend change.
**Build:** one static page + venue-page link line. **Tests:** none. **Verify:** smoke. Size: **S**.

---

## Phase 5 — Revenue (parked behind explicit gates; curation is never for sale)

**5.0 The gates — all readable from the 2.1 ops digest, checked over eight consecutive weeks:** coverage floors green · pipeline runs healthy · Search Console impressions trending up · subscribers ≥ 500 (set your own bar). Until all four: build nothing in this phase.

Then, in trust-preserving order (each gets its own spec when unlocked — summaries here are commitments of shape, not build docs):
- **5.1 Featured placement** — a venue pays to *highlight* an event that already qualifies. Never buys inclusion; never reorders organic lists; always visually labeled ("Featured"); capped (1 per collection page, 2 homepage). Schema sketch: `featured(event_id, starts_at, ends_at, label)`; admin-managed; no self-serve initially.
- **5.2 Venue dashboards** — the 4.4 flywheel page grows a login-lite venue view (magic-link auth reusing the 5.4 token pattern, scoped per venue): their listings + their `event_stats` slice. Sells convenience and insight, not editorial.
- **5.3 Sponsored collection** — "Free This Week, presented by X." Contents stay editorial; sponsorship is a label + link.
- **5.4 Newsletter sponsorship** — one clean slot in the digest, clearly marked, once the list justifies it.
- **5.5 Affiliate ticketing** — swap ticket links where affiliate programs exist; least intrusive, only worth it at volume.

**Permanently excluded:** pay-to-be-listed, pay-to-rank, undisclosed placement, anything that makes the calendar a function of who paid.

---

## Phase 6 — Platform & Scale

### 6.1 iCal feeds
**Why:** "Subscribe to Live Music in Minneapolis in your own calendar" — cheap, differentiating, deepens the no-login philosophy, and creates recurring pull with zero email.
**Design decisions:** Feed routes `app/feeds/[slug]/route.ts` producing `text/calendar` with a rolling 30-day window: slugs for each category, each collection, `/feeds/this-weekend`, each venue (`/feeds/venue-first-avenue`), each neighborhood. Reuse `eventToICS` from `lib/ics.ts` (VALUE=DATE all-day handling already correct, node-ical-verified in 4.6); wrap in a VCALENDAR with `X-WR-CALNAME`. **On-demand + `revalidate` caching; no build-time generation** (the standing rule). Feed URLs advertised on the matching pages ("📅 Subscribe to this calendar").
**Build:** `lib/feeds.ts` (slug registry + selection reusing collections/venue/neighborhood matchers; pure + tested) · the route · page affordances · docs. **Tests (~8):** slug resolution across all feed types, window filter, calendar envelope validity (node-ical round-trip like 4.6), all-day events, unknown slug → 404. **Verify:** smoke-fetch two feeds, validate with node-ical; subscribe one in a real calendar app after deploy. **Deploy:** code-only. Size: **M**.

### 6.2 Public read API
Keyed, read-only JSON (`/api/v1/events?category=&from=&to=`), rate-limited (per-key counter table), OpenAPI doc page. Ships only if someone asks for it or 6.1 adoption suggests demand. Size: **M**. Not before Phase 5 opens.

### 6.3 Semantic search / recommendations
Embeddings over title+description for "more like this" on event pages and better on-site search. Requires an embedding pipeline step + pgvector. Real project; spec when reached. Size: **L**.

### 6.4 Multi-city
The honest constraint is editorial, not code: `areas`, `venues`, `neighborhoods`, `cities` are the only city-bound layers, but the research pipeline's quality is the product, and quality is attention. Decision point, not a build item — revisit when Phase 5 revenue funds the attention.

---

## Sequencing at a glance

```
NOW → 1.1–1.5 (ops, 30 min)
    → 2.1 ops digest (M)  → 2.2 ongoing strip (S) → 2.3 rules doc (S, folded in)
    → 3.2 content depth (S–M) → 3.3 OG images (M) → 3.4 digest loop (S) → 3.1/3.5 (S, ongoing)
AUG → 4.1 demand column (S) → 4.2 trending tune (S) → 4.3 for-you (M) → 4.4 flywheel (S)
GATED → Phase 5 (eight green weeks) → Phase 6 (6.1 iCal any time after Phase 3; it's cheap and on-brand)
```

**If you build one thing: 2.1.** If you do one non-build thing: 1.1 + 1.2 this week.
