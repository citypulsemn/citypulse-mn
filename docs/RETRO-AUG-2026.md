# Retro — August 2026 (post-Places / post-G1.1 session)

Four retros run after a large session (monetization M0.1–R2.2, the G1.1 conversion
pass, the Places expansion to ~474 places / 16 kinds, and the Supabase security
fixes). Verdicts and backlogs below.

---

## 1. Security posture audit — ✅ clean, one hardening applied

Triggered by the Supabase advisor catching `event_stats` missing RLS. Swept the
whole live schema (not just source).

**Findings (live DB):**
- **RLS: all 13 tables have it enabled, 0 unsealed.** The `event_stats` fix holds;
  every table is sealed from the anon REST API. (13, not 12 — see the backup table
  below.)
- **`published_events` view: `security_invoker=on`** — the SECURITY DEFINER fix holds.
- **RLS policies (2, both correct & intentional):**
  - `events / events_public_read` — anon+authenticated may `SELECT` **only**
    `status='published'`. Correct: published events are public content; drafts,
    archived, and cancelled stay hidden.
  - `saved_events / saved_events_owner` — `ALL` commands gated on
    `user_token = current_setting('request.saver_token')`. Token-scoped and
    **fails closed** (no token → null → no rows). Correct.
- **Functions:** 31 of 32 are `pg_trgm` extension functions (not ours). The one
  project function, `set_updated_at()`, had a **mutable `search_path`** — the
  advisor's `function_search_path_mutable` WARN.

**Actions taken:**
- ✅ **Applied `set search_path = ''` to `set_updated_at()`** (source + prod).
  `now()` still resolves via pg_catalog; closes the WARN.

**Resolved:**
- ✅ **Dropped `collapse_backup_20260716`** (Aug 14, Taren-authorized). It was a
  narrow snapshot (`id, status, start_at, multi_day_end`) of the 254 events the
  July multi-day-collapse touched — a rollback safety net, long since verified.
  Looked before dropping (columns + count; live `events` = 2,402 rows, intact),
  then `drop table if exists` and confirmed gone. Never in `db/schema.sql`, so no
  schema change.

**Verdict:** the security posture is sound. No exposed data. Re-running the advisor
should now show 0 critical + 0 of the function-search-path warning.

---

## 2. Places data-quality / verify pass — ✅ ~94% official, small backlog

474 curated entries across 16 kinds. Audited source-URL quality by domain.

**Findings:**
- **~94% use official primary sources** — city/county `.gov`, park districts
  (minneapolisparks.org 52, threeriversparks.org 42), stpaul.gov 25,
  ramseycountymn.gov 20, DNR, MNHS, or the venue's own site.
- **~27 entries (~6%) use aggregator/secondary sources** — the verify backlog,
  concentrated in two kinds:
  - **golf-course ×9** — ExploreMinnesota (6) + GolfPass (3): public courses with
    no official page found. Swap to the course's own site or its city page.
  - **farmers-market ×~10** — Meet Minneapolis (3), MN Grown (4, semi-official),
    NFMD (2), a newspaper (swcrier ×2), Facebook (1). Swap to the operator or city.
  - **disc-golf ×4** — PDGA (3) + DGCourseReview (1): **acceptable** per the
    established method (authoritative disc-golf directories when no official page).
- **Coordinate accuracy** — most coords are address/park-level; the beach set and
  some suburban entries are geography-derived (~100–300 m). A geocoding-refinement
  pass is deferred until a geocoding token is in `.env.local`.

**Backlog — ✅ knocked out (see DEPLOY-VERIFY-PASS-SOURCES.md):**
1. ✅ **golf-course ×8** → official venue sites (arborpointegolfclub.com,
   richvalleygc.com, fountainvalleygolf.com, parkviewgolfclub.com,
   ridgesatsandcreek.com, pheasantacresgolf.com, vvgolf.com,
   eaglevalleygc.com). Country Air stays on ExploreMN — **no official site
   exists** (confirmed open; best-available).
2. ✅ **park/pool ×2** → Crosby Farm → stpaul.gov; Bunker Beach → anokacountyparks.com.
3. ✅ **farmers-market ×2** with official pages → Victoria (victoriamn.gov),
   Linden Hills (Neighborhood Roots). The other ~7 small markets **have no own
   site**; the MDA MN Grown directory (semi-official) or the market's own Facebook
   page is the honest best-available source — left as-is by design.
4. **Data-integrity win:** two courses flagged "closed" by aggregators (Valley
   View, Country Air) were **verified still open** — nothing wrongly removed.
5. Beach + geography-derived coordinate refinement — still deferred (needs a
   geocoding token in `.env.local`).
6. disc-golf PDGA ×4 → acceptable as-is (authoritative DG directory).

**Verdict:** honest-data stance well held; **12 entries upgraded to official
sources**, the residual are places without official web pages (an honest floor).

---

## 3. Audience-growth measurement — baseline set, judge in ~4 weeks

The session's two big bets (Places SEO + the G1.1 conversion pass) both target the
binding constraint: **audience (5 subscribers)**. Baseline captured today.

**Baseline (Aug 14, 2026):**
- **Subscribers: 5** (Homepage 3 / 60%, Cities 1, Event pages 1). 4 of 5 within
  the last 30 days. `/this-week`: **0** (its conversion changes just shipped).
- **Published events: 953** (834 upcoming).
- **Places: ~474 across 16 kinds**; this session added 7 new `/places/[kind]`
  indexable pages (dog-park, disc-golf, nature-center, garden, ski-hill, museum,
  orchard) plus sitewide `/this-week` linking.

**What "working" looks like (define now, read later):**
- **Leading indicator — traffic:** GSC impressions for `/places/*` and `/this-week`
  trending up over 4–8 weeks (the SEO thesis). NOTE: F2.4 GSC automation is parked,
  so this is a **manual** GSC check.
- **Funnel:** subscriber sources diversifying — specifically `/this-week` starting
  to convert (0 → N), while home/event hold.
- **The number that matters:** total subscribers moving off 5. 5 → ~15 in a month
  would validate the engine.
- **Caveat:** at n=5, week-to-week signal is noise. Don't over-interpret; read the
  trend at ~4 weeks.

**Watch surfaces (already built):** Admin → Stats "Where subscribers come from"
(cumulative) + the ops digest's weekly `bySource7`. **Schedule: revisit ~Sep 11.**

**Verdict:** premature to conclude anything; correctly instrumented. This retro's
value is the baseline + the leading-indicator definition. A monetization revisit
should wait until this shows movement.

---

## 4. Engineering-process — lessons to keep

Reusable patterns and pitfalls from the session (most already in memory; pinned
here for the record):

- **Schema-apply-via-client pattern** — apply prod DDL through a one-off `tsx`
  script using `lib/db`'s `sql.unsafe(...)`, verify via a follow-up query, delete
  the script. Used for the featured table, the RLS/view security fixes, and the
  `search_path` hardening. Clean and repeatable; no `psql` needed on Windows.
- **Verification pitfall — stale browser console.** `read_console_messages` retains
  messages across dev-server restarts in the reused tab. The **authoritative**
  "current" signal is `preview_logs` for the *current* `serverId`. A `featured`
  error lingered in the console after the fix was live; server logs were clean.
- **Drift guards earn their keep across kinds.** Adding the Arboretum as a `garden`
  tripped the unique-slug guard because it already existed as a `park`. Lesson:
  before adding a marquee place, check whether it's already seeded under another
  kind — then **move** it, don't duplicate.
- **"New kind = data only" held for 7 new kinds** — union + KIND_META + editorial
  intro + rows + the `kindsWithPlaces` exact-list test; zero page/route code every
  time. The architecture is proven.
- **Research at scale, main-loop fallback.** Parallel no-delegation agents work well
  until the account session limit bites mid-run; when it does, finish in the main
  loop via WebSearch/WebFetch against official pages (reliable, keeps sourcing high).
- **grep formatting gotcha.** `admin_audit  enable row level security` (double
  space) was missed by a single-space regex during the audit — nearly a false
  "missing RLS" finding. Verify grep patterns against the file's actual whitespace.

**Verdict:** no process incidents; the standing patterns held. Recommend folding
the schema-apply pattern and the stale-console pitfall into `docs/ENGINEERING.md`
the next time it's touched.

---

## 5. Event data integrity — ✅ clean (sibling to the Places audit)

The core product. Audited all 2,402 live events for the "honest data" stance
(never invent/mislead on events or dates).

**Findings:**
- **Clean where it matters most:** 0 published events missing title/start/venue-or-
  city; **0 near-duplicates** (same title|venue|date — the dedup + collapse work
  holds); 0 suspicious far-future dates; healthy archive ratio (1,449 archived /
  953 published — events are archived, never deleted).
- **Category coverage (upcoming):** music 202, arts 169, family 157, sports 92,
  festival 90, food 81, weird 43. Weird has grown a lot (was ~6 at F1.1); music
  still leads. A supply observation, not an integrity issue.
- ⚠️ **19 dead-but-published** — events whose true span ended >2 days ago, awaiting
  the next Monday archive (~15 genuine one-offs like Uptown Art Fair + a Twins
  game; ~4 recurring-series past instances). **Not a violation:** default listings
  filter them out by date-range, and detail pages show the honest UX1 "ended"
  banner with gated CTAs. It's the inherent weekly-archive lag, bounded at ~7 days.
- ⚠️ **3 backwards-span events (`end_at < start_at`) — all ARCHIVED**, so not
  user-facing: "In the Heights" (theater run) and two Saints games where the source
  fed an `end_at` before `start_at`. Historical bad source data.

**Recommendations:**
1. ✅ **DONE** — added `guardEndAt()` (pure, tested) to `lib/upsert.ts`: nulls a
   scraped `end_at` that falls before `start_at`, applied in `upsertEvents`.
   Prevents future backwards spans at ingest. Also nulled the 3 existing archived
   ones in prod (0 remaining). A genuine late-night (9 PM→1 AM) has its end on the
   next day, so it's untouched.
2. Optional: a more frequent archive pass would trim the ≤7-day dead-event lag, but
   UX1 already makes it honest, so this is polish, not a fix. (Left as-is.)

**Verdict:** the events data is clean and honest — no fabricated data, no
duplicates, no missing fields. The only items are 3 archived historical errors and
the expected weekly-archive lag. Both minor; one small preventive guard recommended.

---

## 6. Dependency / supply-chain health — ✅ healthy; safe updates applied

**Findings:**
- ✅ **`npm audit`: 0 vulnerabilities** (the standing requirement). Lean tree —
  9 prod deps, 8 dev. Lockfile present. The security override pins
  (`postcss ^8.5.26`, `sharp ^0.35.3`, from earlier libvips/SSRF advisories) are
  intact.
- ✅ **Applied all safe in-range updates** (`npm update`) — react/react-dom
  19.2.7→.8, next 15.5.22→.23, **mapbox-gl 3.24→3.28**, tsx 4.22→4.23, vitest
  4.1.8→.10, papaparse 5.5→5.6, node-ical .27.0→.1, @types patches. Gate stayed
  green (1010 tests, build clean, audit 0).
- ⚠️ **Deliberate major holds** (migration projects, NOT routine bumps — left put):
  - **Next 15 → 16** — a major with breaking changes; upgrade as its own project.
  - **TypeScript 5.9 → 7.0** — the new native/Go compiler ("tsgo"), bleeding-edge;
    stay on stable 5.x.
  - **@types/node 22 → 26** — keep at 22 to match Vercel's Node-22 runtime (the
    dev machine happens to run Node 26 — see below).
- ✅ **@anthropic-ai/sdk 0.106 → 0.117.1 — DONE.** The only usage is
  `lib/agents/research-agent.ts` (`messages.stream` → `finalMessage`, with the
  web-search tool loosely typed). `tsc` clean after the bump confirms the type
  surface (`messages.stream`, `finalMessage`, `Anthropic.Tool`/`TextBlock`) is
  intact. **Not runtime-tested** — a live pipeline run hits the paid web-search
  API, so the real-world validation is the next Monday `npm run pipeline`. Low
  risk: the high-level streaming path and the `web_search_20250305` tool id
  (API-side, SDK-independent) are stable.
- ✅ **`engines.node` pinned to `22.x` — DONE.** Matches Vercel's Next-15 runtime
  and flags the dev machine's Node-26 drift (a harmless `EBADENGINE` warning
  locally, not an error).
- ℹ️ npm's allow-scripts flagged `esbuild`'s postinstall (a supply-chain guard).
  esbuild is a trusted build dep (via tsx/vitest) — informational, no action.

**Verdict:** supply chain is healthy — zero vulnerabilities, lean, pinned. Routine
updates are now applied; the remaining gaps are deliberate majors + the SDK bump,
each better handled as its own considered change.

---

## 7. Performance & accessibility — ✅ healthy; one homepage a11y gap fixed

### Performance (production bundle sizes — the reliable signal; dev timings aren't representative)
- ✅ **Lean bundles.** 103 kB First-Load JS shared baseline; homepage **128 kB**
  (heaviest — and **Mapbox GL is lazy-loaded, NOT in First Load**, so UX10's
  lazy-map work holds); every content page 103–108 kB; `/places/[kind]` 107 kB
  (interactive map also lazy). No page is bloated.
- ✅ ISR windows intact (30 m / 1 h / 5 m — the egress-cache work).
- ⚠️ **Field Core Web Vitals** (LCP/CLS/INP) can't be measured here — dev is
  unrepresentative and real vitals are field data. **Recommend checking Vercel →
  Analytics** for the actual numbers.

### Accessibility (DOM-level — identical in dev and prod)
- ✅ **Standard content pages are clean** (verified on `/this-week`; event/places
  share the layout): a `<main>` landmark, exactly one `<h1>`, one footer, no
  missing `alt`, all buttons/links have accessible names, `lang="en"`, no heading
  skips, no positive `tabindex`, no duplicate ids, real inputs labeled (the
  honeypots are `aria-hidden`, correctly excluded).
- ⚠️→ ✅ **FIXED — the homepage's custom `EventsExplorer` layout** was the one
  outlier: **no `<main>` landmark, no `<h1>`, and a duplicate `<footer>`** (a
  "Twin Cities metro · City Pulse MN" tagline mis-marked as a second `contentinfo`).
  On the highest-traffic page. Fixed: promoted the content `<div className="wrap">`
  to `<main>`, added a visually-hidden (`sr-only`) `<h1>` ("This week in the Twin
  Cities — events, concerts & things to do") for screen readers + SEO, and demoted
  the tagline to `<div className="explorer-tagline">` (moved its CSS off the broad
  bare `footer{}` selector). Browser-verified: main 1, h1 1, footers 1, no visual
  change; the `<header>` stays a sibling banner (not inside `<main>`).

**Recommendation:** check the field Core Web Vitals in Vercel Analytics — the one
perf dimension not measurable from here.

**Verdict:** performance is healthy (lean bundles, lazy map) and accessibility was
already strong on the templated pages; the single real gap — the homepage's
landmarks and heading — is now closed.
