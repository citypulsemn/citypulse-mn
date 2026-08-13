# ROADMAP — Monetization

*Retro + plan, 13 August 2026. This doc operationalizes **Phase 5 — Revenue** in
[ROADMAP.md](ROADMAP.md); it does not replace it. The permanent exclusions and
the gate discipline there still bind. What this adds: a data-grounded read of
where we actually are, the cheap no-regret work we can do before the gates open,
and the honest conclusion that **growth is the monetization work right now.***

## The honest state (live data, 13 Aug 2026)

| Signal | Reality | Implication |
|---|---|---|
| Subscribers | **5**, all-time (the weekly digest reaches 5 people) | Phase-5 gate is ≥500 → we are at **1%** |
| Traffic (30d) | ~1,009 event views · 193 ticket clicks (~**19% CTR**) · 6 saves | Real intent, small scale |
| Calendar adds (30d) | **1,420** — more than views | Implausible ordering → metric integrity check needed |
| Events | 953 published, **100%** carry a ticket link | Supply is complete |
| Ticket-link supply | Only ~14% point to affiliate-able platforms (Ticketmaster 66, MLB/Twins 27, SeatGeek 25, AXS 14 of 953) | Thin affiliate surface |
| Ticket-click demand | The clicked links are festivals, Como Zoo, local theaters, restaurant weeks, content sites | **Almost none are affiliate-able** |

### Two findings that set the whole strategy

**1. The affiliate playbook doesn't pay here yet.** The obvious move — tag the
ticket links — nets pennies today. Not only is the affiliate-able *supply* thin
(~14%), the *demand* is worse: the events people actually click to buy run
through the non-affiliate long tail (a festival's own site, the zoo, Theatre in
the Round). Affiliate is worth **building as a seam** (turnkey, and it finally
gives us clicks-by-vendor), not worth **counting on** until the click mix shifts
or volume grows.

**2. The blocker is audience, not features.** Phase 5 is already a sound plan,
correctly gated. We are nowhere near the gates, and the binding number is **5
subscribers against ~1,000 monthly views** — a conversion failure, not merely a
scale one. The weekly email, the most sellable future asset, has 5 readers.
Nothing else in this doc matters as much as fixing that.

**Conclusion:** there is no meaningful *direct* revenue to switch on at this
size, and forcing it (ads on ~1k views, affiliate on non-affiliate clicks) would
earn cents while spending the clean-UX trust that is the actual moat. So the
near-term monetization work is **growth + cheap no-regret seams**, staged so
revenue turns on the moment the audience crosses the gates.

## Principles (non-negotiable — inherited, restated)

- **Permanently excluded** (from Phase 5): pay-to-be-listed, pay-to-rank,
  undisclosed placement, anything that makes the calendar a function of who paid.
- **No dark patterns.** One subscribe band per page, never a popup. Growth means
  a *better* single ask, not more asks.
- **Honest metrics before honest money.** We do not sell numbers we haven't
  verified. The calendar-metric oddity (M0.2) is a prerequisite for any
  value-story we ever hand a sponsor or venue (ENGINEERING rule 6).
- **Curation is never for sale.** Featured/sponsored surfaces are always labeled,
  capped, and never reorder the organic list.

## The Phase 5 gate tracker (check monthly from the ops digest)

| Gate | Target | Current (13 Aug 2026) | Status |
|---|---|---|---|
| Coverage floors green | all categories ≥ floor, 8 wks | Unique breach just fixed (watch Mon runs) | ⚠️ improving |
| Pipeline healthy | green weekly | ~460 upserts/wk, stampede tripwire calm | ✅ |
| GSC impressions trending up | up, 8 wks | sitemap +9% WoW; impressions manual (F2.4 parked) | ◐ partial |
| Subscribers | ≥ 500 (owner's bar) | **5** | ❌ the binding gate |

Until all four hold for eight consecutive weeks, Tier 3 stays closed. Everything
in Tiers 0–2 is either pre-gate-safe (no trust cost) or growth toward the gates.

---

## Tier 0 — Truth & no-regret seams (cheap, build now)

### M0.1 — Outbound ticket-link tagging seam
**Why:** Every ticket click today hands a vendor a buyer and captures $0. The
dollars are thin now (see finding 1), but the *seam* is the point: build it once
so revenue turns on the day we join a program, and get clicks-by-vendor reporting
as a free byproduct.
**Design:** a pure `lib/outbound.ts` — `outboundTicketUrl(event) → string`. A
config map keyed by host (`ticketmaster.com`, `seatgeek.com`, `axs.com`, …) whose
value knows how to append that program's affiliate params; unknown hosts pass
through **unchanged**. Idempotent, preserves any existing query string, never
rewrites the destination host (trust: we tag, we don't redirect). Affiliate IDs
are non-secret config (env or constant), not committed secrets.
**Build:** `lib/outbound.ts` + golden tests (each program's URL shape, passthrough
for non-affiliate hosts, idempotency, existing-query preservation, malformed URL
→ original). Wire into [TicketButton.tsx](../components/TicketButton.tsx) `href`.
Add a clicks-by-vendor line to Admin → Stats (join `event_stats` ticket_click to
`events.ticket_url` host). **Honest ROI note in the deploy guide:** near-zero
today; instruments and future-proofs. Size **S**. Depends: nothing.

### M0.2 — Engagement-metric integrity (calendar > views)
**Why:** 1,420 calendar adds vs 1,009 views in 30 days is implausible for honest
human order (you view before you add). Either the calendar beacon over-counts or
views under-count. We must not build product decisions — or a future sponsor
value-story — on a number we can't defend.
**Design:** audit the `calendar` beacon firing conditions in
[AddToCalendar.tsx](../components/AddToCalendar.tsx) — does it fire on both the
.ics AND Google paths for one add? on render/prefetch? Establish the honest
definition (one count per human add), fix the over-fire, and confirm against a
fresh session. Note whether views legitimately undercount (adds can happen from
card surfaces without an event-detail view) so we don't "fix" a real signal.
**Build:** likely a small change in the beacon trigger + a stats note; a source
tripwire test. Size **S**. Depends: nothing.

## Tier 1 — Grow the sellable audience (the real unlock)

### G1.1 — Subscriber-conversion overhaul  ⭐ flagship
**Why:** 5 subscribers against ~1k monthly views is the highest-leverage problem
on this page. The list gates newsletter revenue and is the retention asset;
every future dollar scales with it.
**Design (within the no-dark-pattern rule — a better single ask, not more asks):**
- **Sharpen the one band.** Concrete value-prop copy over generic ("Every
  Thursday: the week's best, hand-picked" beats "Subscribe for updates"), and
  audit placement/friction on the [SubscribeBand](../components/SubscribeBand.tsx).
- **A public sample-digest landing** (`/digest/sample` or `/this-week`): last
  send rendered as an indexable web page — a shareable, SEO-earning proof of what
  you get, ending in the subscribe ask. Doubles as a growth surface and a content
  page. (Strongest single idea here.)
- **Contextual, honest asks at high intent** without a second band: fold a
  "want these by email?" line into the existing `FirstSaveNudge` (a saver is the
  warmest lead), and consider a subscribe line in the digest footer for
  forward-to-a-friend.
**Build:** copy + placement; the sample-digest route (reuses the digest renderer,
no new email logic); nudge copy. **Tests:** sample-page selection (latest send,
honest-empty when none), any pure copy/config. Size **M**. Depends: nothing.

### G1.2 — Keep compounding SEO (ongoing stance, not a discrete build)
Places is already growing the evergreen sitemap (+9% WoW). Continue: more Places
kinds/entries, the cross-linking that feeds internal link equity. This is the
organic top-of-funnel that feeds G1.1. No new spec; a priority reminder.

## Tier 2 — Revenue mechanisms built ahead of the gate (dormant until sold)

### R2.1 — Newsletter sponsor slot (Phase 5.4)
One clean, clearly-labeled "Presented by ___" slot in the digest template, one
sponsor per send, admin-set, **dark when unsold**. Cheap to build now; selling it
waits on list size. Build in the digest renderer + a small sponsors config/table.
Size **S–M**. Depends: nothing to build; G1.1 to sell.

### R2.2 — Featured-placement framework (Phase 5.1)
The labeled, capped, no-reorder mechanism: `featured(event_id, starts_at,
ends_at, label)`, admin-managed, renders a visually-labeled "Featured" card,
capped (1 per collection page, 2 homepage), never touches organic ranking. Build
the framework when a venue is ready to pay; the trust rules are the spec. Size
**M**. Depends: a willing venue; trust rules above.

## Tier 3 — Gated (per ROADMAP.md Phase 5 — closed until 8 green weeks)

- **5.2 Venue dashboards** — magic-link venue view of their listings + stats.
- **5.3 Sponsored collection** — "Free This Week, presented by X."
- **Scaled affiliate** — once the click mix or volume justifies M0.1's seam.
- **Display ads** — only if ever, and only if it can be done without junking the
  UX; at current traffic it earns cents and costs trust. Default: no.

---

## Recommended sequence

1. **G1.1 subscriber conversion** (flagship — attacks the binding gate).
2. **M0.1 affiliate seam + M0.2 metric fix** (cheap, honest, parallelizable —
   good "one item" sessions).
3. **R2.1 / R2.2** built ahead of demand, dormant.
4. **Tier 3** only when the gate tracker shows four greens for eight weeks.

**If we do one thing: G1.1.** The site doesn't have a monetization problem yet —
it has an audience problem, and the audience problem is fixable.
