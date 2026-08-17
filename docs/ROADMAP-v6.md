# City Pulse MN — Roadmap v6, Growth & Consolidation Edition

*August 14, 2026. This is the canonical plan. It supersedes and consolidates six
overlapping roadmap files (v4 `ROADMAP.md`, v5 `ROADMAP-v5.md`, the two Places
roadmaps, the UX roadmap, and the Monetization roadmap) into one priority order,
reconciled against what is **actually shipped in the working tree today** — not
what the older docs still describe as pending. The domain deep-dives that remain
useful (`ROADMAP-MONETIZATION.md`, `ROADMAP-PLACES.md`) are kept as reference and
pointed to from the items below; the older numbered roadmaps are now history.*

---

## Rebaseline — Aug 17, 2026 (read this first; supersedes everything below)

A long build session shipped the entire Places winning-detail program and confirmed
the whole UX2 batch is already live. **Reconciled against the working tree today, the
buildable roadmap is essentially exhausted — what remains is measurement and audience,
which are owner-gated, not code.** Do not build the next Places feature on faith; the
instrument (Search Console) now outranks every demand-column judgment.

- **UX2 (`ROADMAP-UX2.md`) — ✅ ALL SEVEN SHIPPED, that doc is now history.** U1 map
  popup contrast (`8edd8cb`), U2 day chronological order (`7bd3860`), U3 homepage
  Places/Collections discovery (`59980cc`), U4 official-link-first (`7ab2b13`), U5
  mobile calendar→list flash (`1c2e9b7`), U6a/U6b desktop multi-column + side-by-side
  map/list (`28a46f4`/`6894146`), U7 near-me location filter (`003cf62`). (The Aug 16
  note below still lists U1/U3 as top build items — stale; they were done Aug 14.)
- **Places — the winning-detail moat + its SEO payoff + a cross-kind finder — ✅
  SHIPPED, far past Tier 1.2 "Wave 1" (`2535c60`…`a9d088b`).** **13 kinds** now carry
  source-verified detail badges — ski-hill, rink, splash-pad, pool, dog-park,
  playground, orchard, nature-center, indoor-playground, trampoline-climbing, museum,
  disc-golf, garden — each with per-kind filter chips, a filter-reactive map, and
  near-me sort (one kind-agnostic layer; each kind was data + a schema line, never new
  UI). Every fact is traceable to an official source (research-agent verified,
  `yes→badge`/`unknown→no badge`); the audit passes flipped or dropped ~20 mistagged
  claims (e.g. Arlington-Arkwright "unfenced"→fenced, Hansen "18-hole"→12, Cowles
  "Conservatory"→open-air pavilion, vending-machines≠café). On top: **schema.org
  `amenityFeature` JSON-LD + fact-rich meta descriptions** on every kind page
  (`79ca608`), and a **cross-kind "Find a Place" finder** at `/places/discover` that
  pools all ~500 places and filters on the axes that span kinds (`a0aa69f`). The moat
  is complete — the remaining kinds (golf 85, farmers-market 72, park 21, sledding 11)
  are large/generic/schedule-shaped, where curated boolean facts don't differentiate.
- **Tier 0 (egress/lights-on), 1.3 (digest depth), 1.4 (opt-in policy) — closed** (as
  of the Aug 16 note).

**What is genuinely left is NOT code — it's two owner-gated reads + one blocked chain:**
1. **GSC indexation re-check ⭐ — the single highest-leverage action on the board.**
   The Aug 16 finding stands until re-measured: `/places` + `/this-week` were "URL is
   unknown to Google" (never discovered). The *content signal* is now maximal (moat +
   amenityFeature JSON-LD), but it ranks nothing until the pages are crawled. **Owner:**
   GSC → URL Inspection → Request Indexing for `/places`, `/places/discover`, and the
   top kind pages; confirm the sitemap is "Success"; then re-run `gsc-report` and read
   whether "unknown" flipped to discovered/indexed. **This governs whether the entire
   Places investment pays off.**
2. **1.1 conversion read (~early Sept) — the ⭐ funnel gating signal (unchanged).**
   Pull signups by source + `/this-week` traffic once ~4 weeks of post-overhaul data
   exists. Is the number off 5? This decides Tier 1 ordering.
3. **2.2 "for-you" personalization — still BLOCKED on save volume (~1/week, flat).**

**If building anyway** (all lower-leverage, and indexation-gated for real payoff):
per-place detail pages `/places/[kind]/[slug]` (a dedicated URL per place lets each
Place JSON-LD stand alone instead of nested in an ItemList — the biggest remaining SEO
lever); discover polish (a filtered-results map, one-tap chip presets like "Free &
indoor"); or moat-fed IG/digest content. None move the binding constraint on their own.

**The one number is unchanged: ~5 subscribers against the 500 gate. Growth is the
work — and the levers are now measurement + distribution, not more features.**

---

## Rebaseline — Aug 16, 2026 (superseded by Aug 17 above)

Two build sessions landed since this doc was written (Aug 14). Reconciled against
the working tree today, **the entire growth/repair spine is shipped** — the tiers
below still describe several done items as open. Current truth:

- **Tier 0 — closed.** 0.1 egress: Supabase **Pro upgraded** + cache/TTL fixes
  shipped (`79ae905`, `bd87a63`, `855db98`); no 402s. 0.2 metric integrity: M0.2
  de-dup + the calendar-beacon dig done; adds-vs-views now sane. 0.3 Monday watch
  is standing.
- **Tier 1 — essentially done.** 1.1 read: G1.1 **converted +1 this week** (event
  band) but the funnel is transactional (confirmed by GSC — see below); audience/
  composition is the constraint. 1.2 **winter Places wave shipped** (indoor
  playgrounds, ice rinks expand, ski/tubing, trampoline/climbing; +dog-park,
  disc-golf). 1.3 digest depth **✅ SHIPPED Aug 16** (`DEPLOY-1.3-DIGEST-DEPTH`) —
  place-of-the-week + most-saved. 1.4 resubscribe/opt-in policy **already shipped**
  (F2.3 mechanics + Taren's single-opt-in call).
- **Tier 2 — 2.1 done, 2.2 still blocked.** 2.1 trending calibration shipped
  (F1.2, `DEPLOY-F1.2-TRENDING-CALIBRATION`). 2.2 "for you" ordering **remains
  gated on save volume** (~1/wk, flat) — the one real dependency still unmet; 1.3's
  most-saved is dark for the same reason. Fix the saves trend before building 2.2.
- **F2.4 — ✅ RESOLVED + LIVE Aug 15** (was Tier 4, "blocked by org policy"). The
  org policy was cleared org-admin-side; GSC impressions now auto-report in the ops
  digest. First read: **4,732 impressions / 182 clicks (7d)**. Only the raw
  *indexed-count* stays manual (not an API bulk read, by design).

**What's genuinely open + unblocked:** another **1.2 Places kind** (rolling — but
"measure before Wave 2" now has GSC data to reorder by), and **P4.3 open-now/free
filters** (small, low priority). **What's blocked:** 2.2 (save volume). **The
governing number is unchanged: subscribers ~5 → 500.**

### The GSC "what's ranking" read (Aug 16) — and the pivot it forced
Built a reusable `gsc-report` diagnostic (`scripts/gsc-report.ts` + manual
workflow) on the F2.4 credential. First 28-day breakdown:
- **88.5% of impressions are `/event/[id]` pages** (transactional — top queries
  are specific event names). **`/places` ranks for ~nothing** — the "proven
  organic lever" isn't ranking yet (hard SERP, months-young). So **"pick the next
  Places kind by observed demand" is impossible — there's no signal**, and
  building kind #17 blind is unvalidated effort.
- **Day pages are the working discovery surface** ("events in minneapolis
  tomorrow/[date]", pos 5–7, good CTR); **`/this-week` + `/this-weekend` — the
  conversion shop-windows — rank for nothing** (which is *why* `/this-week` has
  converted 0). Clear demand cluster: **food-truck & cultural festivals**.
- **Pivot (Taren's call): "amplify what ranks."** SHIPPED **Discovery routing**
  (`DEPLOY-DISCOVERY-ROUTING`): subscribe band on day pages + onward links from
  event/day pages → `/this-week(end)` (routes the 88% traffic AND passes
  internal-link equity to the pages that most need it), + a Minneapolis-forward
  day-page title. Real proof is slow — re-run `gsc-report` in ~3–4 wks for
  `/this-week(end)` impressions.
- **Next candidates** (not yet built): a demand-validated **food-truck/cultural
  festivals** evergreen; diagnose **Places indexation** before more kinds. The
  next non-code lever remains *discovery-intent distribution* (audience).

---

## Strategic context, in five sentences

Everything ungated across v4 (cockpit + index), v5 (the R0/R1/R2 repair sprints),
and the entire UX roadmap (UX1–UX11) has **shipped and is live** — the site is
feature-complete for its stage. The one number that governs everything is
**audience: ~5 subscribers against the 500-subscriber revenue gate** (1%), so
*growth is the monetization work* and there is no direct revenue worth switching
on at this size. Two growth engines are proven, cheap, and on-brand: the
conversion funnel (G1.1, just overhauled — now it must be *measured*) and
compounding Places SEO (16 kinds live, sitemap +9% WoW). One operational risk —
Supabase egress overage threatening 402s — outranks every feature this week,
because a site returning 402 grows nothing. Therefore v6 orders strictly: **keep
the lights on → prove the funnel converts → feed the funnel (SEO + retention) →
unlock the personalization chain the data now finally supports → hold the
revenue frameworks dormant behind their gates.**

**Standing engineering rules are unchanged** (see `docs/ENGINEERING.md`, rules
1–10): pure logic in `lib/` with golden tests · additive idempotent schema · tsc
clean · `npm test` green · `npm run build` clean · `npm audit` 0 · one live smoke
· deploy guide. Never-break contract on aux paths; no build-time DB prerenders;
true spans; honest emptiness; one Chicago clock (`lib/clock.ts`).

---

## Tier 0 — Keep the lights on (this week; mostly owner action, not code)

### 0.1 Supabase egress — resolve the overage before it 402s  ⚠️ most time-critical
**Why:** the egress cache fix shipped (`79ae905`, `4108d5d`) but the account was
over its free-tier egress ceiling; per the live-ops watch, **402s were expected
~Aug 15** absent a Pro upgrade, which is owner-pending. A site that returns 402
converts zero visitors — this sits above every build item until it's closed.
**Do (owner):** confirm the Pro upgrade is applied (or decide against it and
confirm the cache fix alone keeps egress under the ceiling). **Verify:** watch the
egress trend in the Supabase dashboard for one week after the cache fix + ISR
window raises; it should be flat/declining. **Size:** owner decision + a dashboard
read. No code unless the trend is still bad, in which case the next lever is
longer ISR windows on the hot read paths.

### 0.2 Engagement-metric integrity read (calendar adds > views)
**Why:** 30-day data showed **1,420 calendar adds vs 1,009 views** — implausible
human ordering (you view before you add). M0.2 shipped a per-visit de-dup of the
`calendar` beacon (`3ab9205`); this item is the *read-back*: confirm the ratio
sane on fresh post-fix data. We do not build product decisions — or ever hand a
sponsor a value-story — on a number we can't defend (ENGINEERING rule 6).
**Do:** one Admin → Stats / SQL read of adds-vs-views over the last 14 days (post
`3ab9205`); if still inverted, audit the remaining fire conditions. **Size:** S,
mostly a read. Spec: `ROADMAP-MONETIZATION.md` M0.2.

### 0.3 Monday pipeline + digest watch (standing, ~10 min)
Weekly: pipeline green, festivals one card each, WoW percentages real, stampede
tripwire calm, `weird ≥ 1` on the Monday run, `rate_events` human-sized. This is
the cockpit doing its job — the watch is the work.

---

## Tier 1 — Prove and feed the funnel (the growth quarter — the real work)

> **Companion: `docs/ROADMAP-UX2.md`** — a 7-item UX/discovery/feature batch (map
> popup contrast, day ordering, surfacing Places/Collections on the homepage,
> official-link-first, mobile & desktop polish, and a zip/city location feature),
> each recon'd against the code. It's conversion/retention quality that supports
> this tier. Highest-leverage items: U1 (map popup, XS) and U3 (homepage section
> discovery — the funnel win).

### 1.1 Read whether G1.1 actually converted  ⭐ gating signal
**Why:** the entire strategy rests on the conversion overhaul working. We shipped
all of it — `/this-week` shop-window, sharpened bands site-wide, warm-lead
surfaces, source attribution (`f3bcded`…`1009f90`, `9940152`…`b99a61c`) — but
"shipped" is not "worked." The subscriber count and the by-source breakdown are
now instrumented (Admin → Stats); we need the *read*.
**Do:** ~4 weeks after the overhaul (early Sept), pull signups by source and
`/this-week` traffic. Which surface converts? Is the number moving off 5 at all?
**This read decides Tier 1's ordering** — if a surface works, double down; if none
do, the problem is upstream (traffic), which points back to 1.2. **Size:** S, a
read + a one-paragraph finding. Depends: ~4 weeks of post-overhaul data.

### 1.2 Keep compounding Places SEO  — the one proven organic lever
**Why:** Places is the evergreen top-of-funnel that *feeds* 1.1 — a splash-pad
page ranks and keeps ranking, and the family searcher is exactly who should meet
the subscribe band. Sitemap is already +9% WoW off this work. 16 kinds are live
(splash pads, beaches, pools, parks, playgrounds, rinks, sledding, golf, disc
golf, dog parks, farmers markets, gardens, museums, orchards, nature centers, ski
areas) with an interactive clustered map.
**The cadence rule that sets order:** *pages take months to index, so guides ship
one season ahead.* **Winter is the current build window** (ship Sep–Oct to rank by
December). Highest-value unbuilt/under-built winter kinds, in order: **indoor
playgrounds & play cafés** (high Sep–Apr parent demand, not yet built) · **ice
skating rinks** (expand the 8→~25 with outdoor neighborhood rinks) · **ski/
snowboard/tubing** (expand the initial 4) · **trampoline/ninja/climbing gyms**.
Plus continued neighborhood ↔ place cross-linking for internal link equity.
**Standing rules per guide:** ≥8 verified entries or don't ship · every entry a
real `sourceUrl` + `verifiedAt` · house voice · the distribution ritual (Google
Maps list mirror + digest mention + IG slot). **Size:** M per kind (data is the
bulk), rolling — one kind per session. Spec: `ROADMAP-PLACES.md` Wave 1.
**Measure before locking Wave 2:** once ~4 weeks of Search Console data exists per
guide, reorder remaining kinds by *observed* demand — the instrument outranks the
demand-column judgment.

### 1.3 Digest depth — make the one email worth staying for (retention)
**Why:** the weekly email is the retention asset and the future revenue surface;
right now it's picks + personalization. Two cheap, high-warmth additions:
- **"Most saved this week"** — a single query + one render block in `lib/digest.ts`
  (byte-identical-when-empty rule applies). Not yet built. Doubly useful: it also
  exercises the save data that 2.2 depends on.
- **Seasonal "Place of the week"** — one hand-picked registry entry per send, tied
  to the season (a sledding hill in January). Reuses the Places registry; near-free.
**Size:** S each. Depends: nothing (save volume for "most saved" is a nice-to-have,
degrades honestly to omitted when thin). Spec: `ROADMAP-PLACES.md` P3.3.

### 1.4 Resubscribe + double opt-in policy layer (F2.3)
**Why:** R0.5 fixed the *mechanics* (resubscribe after unsubscribe now works and
the UI is honest); this is the deliberate *policy* layer `docs/EMAIL.md` deferred:
send a confirmation on resubscribe-after-unsubscribe (sender-reputation + consent
honesty), and decide whether new subscribers double-opt-in now that the schema has
carried `status`/`confirmed_at` since day one. With R2.1 rate-limiting and the
R2.7 List-Unsubscribe verification already done, this completes the deliverability
story **before the list is big enough for a mistake to be expensive** — which is
exactly the window 1.1/1.2 are trying to open. **Size:** S–M. Product call for
Taren embedded (opt-in yes/no). Spec: `ROADMAP-v5.md` F2.3.

---

## Tier 2 — Unlock the personalization chain (the data finally supports it)

*This chain was gated on "≥4 weeks of `event_stats`" (now satisfied) and on save
volume (UX3 shipped save-from-anywhere to unlock it — check the saves trend before
building 2.2).*

### 2.1 Trending calibration (v4 4.2 / v5 F1.2)
**Why:** the trending constants (`TREND_HALF_LIFE_DAYS`, `TREND_MIN_SCORE`,
weights) were set by judgment; there are now enough weeks of real `event_stats` to
check them. **Do:** replay a real week through `scoreRows`/`rankTrending` offline
(tsx harness), tune against editorial feel. **Size:** S, mostly analysis. Depends:
real data volume (now present).

### 2.2 "For you" ordering on the site (v4 4.3 / v5 F1.3)  — strategic keystone
**Why:** the digest personalizes; the site can too, gently, for returning savers —
no accounts. **This is genuinely unbuilt** (there is no `/api/affinity` route;
only the digest-side `categoryAffinity` exists). Reorders *only* the explorer's
category chips + the "browse by collection" strip — never the calendar (that's
chronological truth). Client-side affinity fetch keeps the homepage ISR-cacheable
(the core design constraint). **Size:** M. Depends (in spirit): 2.1 confirms the
signal, and save volume must have grown — UX3 unlocked saving; if the saves trend
is still flat, fix the front door before personalizing an empty signal. Spec:
`ROADMAP.md` 4.3 / `ROADMAP-v5.md` F1.3.

---

## Tier 3 — Revenue frameworks: built, dormant, do nothing until the gate

The mechanisms already exist in code and render dark:
- **Newsletter "Presented by" sponsor slot** (R2.1, `cc5c248`) — one labeled slot,
  dark when unsold.
- **Featured-placement framework** (R2.2, `25e16f7`, schema applied `a921110`) —
  labeled, capped, never reorders organic.

**There is nothing to build here.** The gate is **eight consecutive green weeks**
readable from the ops digest — coverage floors green · pipeline healthy · GSC
impressions trending up · **subscribers ≥ 500** — and the binding one is
subscribers, currently ~5 (1%). When the gate opens, the trust-preserving order is
fixed: featured placement → venue dashboards → sponsored collection → newsletter
slot → scaled affiliate. **Permanently excluded:** pay-to-be-listed, pay-to-rank,
undisclosed placement, anything that makes the calendar a function of who paid.
Full gate tracker: `ROADMAP-MONETIZATION.md`.

---

## Tier 4 — Parked, with explicit reasons (revisit on a trigger, not a schedule)

- **F2.4 Search Console indexed-count automation** — **blocked by org policy** on
  the service-account credential in Actions. The ops-digest Index line stays a
  manual field. Revisit if the policy changes.
- **Places P4.1 detail pages** — gated on kind pages earning impressions first
  (INDEXING.md). Not yet.
- **Places P4.3 "open now / free only" filters** — the ≥4-kinds gate is now *long*
  satisfied (16 kinds); this is a small, optional client-side add whenever a kind
  page feels list-heavy. Low priority, unblocked.
- **6.2 public read API** — only on demonstrated demand (watch F2.5 feed-adoption
  clicks as the signal). **6.3 semantic search** — a real project (pgvector +
  embedding pipeline); spec when reached. **6.4 multi-city** — an attention/
  editorial decision funded by Phase 5 revenue, not a code decision.

---

## What has already shipped (the consolidation ledger — nothing here is open)

So the priority list above is trusted, here is the reconciled done-pile across all
six source docs:

- **v4 Phases 1–3 (cockpit + index):** ops digest, ongoing strip, OG images,
  digest growth loop, content depth, canonicals, iCal feeds (6.1), /for-venues
  (4.4). **v4 4.1 demand column** → shipped as `assessDemand`.
- **v5 repair sprints:** R0 (ended-banner, archive predicate, dedupe frame,
  restore column, resubscribe, JSON-LD escape, sports-span) · R1 (`lib/clock.ts`
  + all six wall-time offenders) · R2 (rate limits, red-digest, ops-digest honesty
  + escaping, ICS correctness, schema drift guard, housekeeping).
- **v5 F2 proposals:** F2.1 happening-now time-states (`eventTimeState`) · F2.2
  last-chance surface (`selectLastChance`) · F2.5 feed-adoption affordances
  (`FeedSubscribe` + beacon) · F2.6 pipeline tripwires (stampede guard). **Open
  from F2: F2.3 policy layer (→ 1.4), F2.4 (parked).**
- **UX roadmap: all of UX1–UX11** (dead-event honesty, app-shell boundaries,
  save-from-anywhere, mobile list view, directions, section nav, a11y/touch,
  structured-data, wayfinding, perceived speed, URL state).
- **Monetization: M0.1** affiliate seam · **M0.2** metric de-dup · **G1.1** full
  conversion overhaul · **R2.1/R2.2** dormant revenue frameworks.
- **Places:** 16 kinds, ~470+ entries, interactive clustered map (P4.2),
  neighborhood cross-linking (P2.2), venue bridge (P2.3), the Aug data-quality
  verify pass (≥94% official-sourced).
- **Aug 2026 retros:** security, data-quality, audience-measurement, process,
  event-integrity, dependency, perf/a11y — `docs/RETRO-AUG-2026.md`.

---

## Sequencing at a glance

```
THIS WEEK   → 0.1 egress/Pro upgrade (owner, before 402s) → 0.2 metric-integrity read
              → 0.3 Monday watch (standing)
EARLY SEP   → 1.1 read whether G1.1 converted (gates Tier 1's ordering)
SEP–OCT     → 1.2 winter Places kinds (indoor playgrounds → ice rinks expand →
              ski/tubing → gyms) — ship ahead of December demand
              → 1.3 digest depth (most-saved + place-of-the-week)
              → 1.4 resubscribe/opt-in policy
THEN        → 2.1 trending calibration → 2.2 for-you ordering (if saves grew)
GATED       → Tier 3 revenue: nothing until 8 green weeks / 500 subs (now ~5)
PARKED      → F2.4 (org policy) · P4.1/P4.3 · 6.2/6.3/6.4
```

**If you do one thing:** resolve **0.1 egress** — a 402ing site grows nothing.
**If you do one *build* thing:** **1.2, a winter Places kind** — it's the only
proven growth lever, and winter guides must be indexed before the snow. **The
number that governs the whole document is subscribers (~5 → 500);** every Tier 0–2
item is either keeping the site alive or moving that number.

*Provenance: full read of all six roadmap docs + HANDOFF + the live commit log,
reconciled against the working tree (greps confirmed 4.1/F2.1/F2.2/F2.5 shipped
despite stale doc text, and 4.2/4.3/most-saved/opt-in-policy genuinely open).
Aug 14, 2026.*
