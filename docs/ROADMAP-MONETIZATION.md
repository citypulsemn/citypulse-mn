# ROADMAP — Monetization

*Rewritten 29 October 2026, replacing the 13 August version. Every headline number
in that version had moved, and one number it never had — **where the ticket clicks
actually go** — inverts part of its conclusion. This doc still operationalizes
**Phase 5 — Revenue** in [ROADMAP-v6.md](ROADMAP-v6.md) Tier 3; the permanent
exclusions and the gate discipline there still bind.*

## The honest state (live queries, 29 Oct 2026)

| Signal | 13 Aug | 29 Oct | Read |
|---|---|---|---|
| Event views / 30d | 1,009 | **6,073** | 6× in eleven weeks |
| Ticket clicks / 30d | 193 | **1,444** (23.8% CTR) | 7.5×; real commercial intent |
| Active subscribers | 5 | **47** | 9×, but still small |
| Weekly send | 5 | **45** (37 → 40 → 44 → 45) | growing every week |
| Saves / 30d | 6 | 24 | thin |
| Calendar adds / 30d | 1,420 (over-counting) | **9** | M0.2 fixed the beacon; the old number was never real |
| Published upcoming | 953 | 617 | tighter calendar |
| Places | ~500 | **569** | the evergreen SEO asset |

Traffic source, last 30 days: direct 2,201 · Google 1,663 · internal 932 · Bing 552 ·
DuckDuckGo 387 · Yahoo 220 · Android Gmail 36 · Nextdoor 21 · Ecosia 15 · MPR 4.
**Search is the engine** (~47% of visits). Social is noise — Nextdoor sent 21, and
the Instagram retro (`RETRO-INSTAGRAM-OCT-2026.md`) explains why that channel is
not coming back.

**Measurement caveat, stated before anything is sold on these numbers:** event
views (6,073) and total visits from `referrer_stats` (~6,042) are near-identical,
so a visit averages about one event page. These are pageview-scale counts, not
unique readers. We do not have a verified unique-reader number and must not quote
one to a sponsor (ENGINEERING rule 6).

## The three findings that set the strategy

### 1. Affiliate is not thin — it is dead. About $6/month, measured.

The August doc said affiliate "nets pennies today" and was worth building as a
seam. The seam shipped (M0.1) and gave us the clicks-by-vendor report it was built
for. That report now answers the question:

| Of 1,444 ticket clicks in 30 days | |
|---|---|
| Distinct destination hosts | **119** |
| Clicks to *any* affiliate-able host (TM, Live Nation, SeatGeek, AXS, StubHub, NHL, MLB, Vivid, Etix, Eventbrite) | **28 — 1.9%** |
| Ticketmaster | 12 |
| NHL | 7 |
| Eventbrite | 5 |
| AXS · Live Nation · SeatGeek | 2 · 1 · 1 |

28 clicks × ~10% conversion × ~$70 ticket × ~3% commission = **about six dollars a
month.** Not "pennies someday" — single digits now, against the real cost of
applying to programs, maintaining tags and carrying the disclosure.
**Decision: leave `AFFILIATE` in [lib/outbound.ts](../lib/outbound.ts) empty and
dormant.** Do not apply to
programs. Revisit only if the clicks-by-vendor report crosses ~15% affiliate-able,
and let that report be the trigger rather than a calendar reminder.

Note the trap this avoided: listing counts say the opposite. First Avenue has
**160 upcoming listings** — the most of any host — and received **14 clicks**.
Ticketmaster has 41 listings and 12 clicks. Supply is not demand, and any pitch
built on listing counts is built on the wrong number.

### 2. Demand is seasonal and civic, and one listing carries 39% of it.

The top ticket-click destinations in 30 days:

| Destination | Clicks | What it is |
|---|---|---|
| mspmag.com | **565** | one listing — Restaurant Week, "Metro-wide (multiple restaurants)" |
| stpaul.gov | 75 | city parks and rec |
| fergusonsorchard.com | 47 | seasonal attraction |
| minneapolisparks.org | 47 | city parks |
| threeriversparks.org | 44 | park district |
| trailofterrormn.com | 40 | Halloween attraction |
| blacklagoonpopup.com | 39 | seasonal popup bar |
| screamtown.com | 32 | Halloween attraction |
| mnzoo.org | 29 | the Zoo |
| pryesbrewing.com | 29 | brewery |

Top 10 hosts take **947 of 1,444 clicks (66%)**; the single top listing takes
**39%**. Two consequences:

- **The sellable unit is the seasonal campaign, not the venue slot.** Restaurant
  Week, Halloween attractions, orchards, parks programming. These are also exactly
  the operators who already buy local advertising.
- **mspmag.com is a relationship, not a competitor to ignore.** We send
  Mpls.St.Paul Magazine 565 buyers a month off one listing. That is a syndication
  or co-marketing conversation (vector 15), and it is the strongest outbound lead
  we have.

The venues worth emailing are therefore the mid-size seasonal operators and public
agencies on this list — not the arenas.

### 3. The gate is measuring the wrong thing for half the plan.

Phase 5 is gated on **≥500 subscribers**, set in August when the binding problem
was audience. That gate is right for *newsletter* revenue and wrong for
*venue-side* revenue, which is gated on the traffic we hand to businesses — and
that went **193 → 1,444 clicks/month, 7.5×, while nothing watched it as a gate.**

Featured placement, venue dashboards, sponsored collections and the data feed are
all sitting behind a number that does not govern them. **This is a product call,
so it is Taren's, not a code decision:**

> **Open decision.** Split the Phase 5 gate in two — a **venue-side tier** gated on
> ticket-click volume (proposed: ≥1,000 clicks/month sustained 8 weeks, already
> met at 1,444) and a **newsletter tier** that keeps the ≥500-subscriber gate.
> Everything in the venue-side tier is already built and labeled; nothing about it
> touches organic ranking. The alternative is to hold all of Tier 3 closed until
> 500 subscribers, which on the current curve (+10/month) is about four years away.

## Principles (non-negotiable — inherited, restated)

- **Permanently excluded:** pay-to-be-listed, pay-to-rank, undisclosed placement,
  anything that makes the calendar a function of who paid.
- **No dark patterns.** One subscribe band per page, never a popup. Growth means a
  *better* single ask, not more asks.
- **Honest metrics before honest money.** We do not sell numbers we have not
  verified — see the measurement caveat above.
- **Curation is never for sale.** Featured surfaces are always labeled, capped, and
  never reorder the organic list.
- **Pay for presentation, never for placement.** The line that keeps vector 12
  honest and vector 25 excluded.

## The gate tracker (read from `/admin/ops`, monthly)

| Gate | Target | 29 Oct 2026 | Status |
|---|---|---|---|
| Coverage floors green | all categories ≥ floor, 8 wks | read the ops tiles — left unquoted here rather than guessed | — |
| Pipeline healthy | green weekly | tripwire calm, 0 pending inbox | ✅ |
| GSC impressions trending up | up, 8 wks | search = 47% of visits and growing; indexed count still manual (F2.4 parked) | ◐ partial |
| Subscribers | ≥ 500 | **47** | ❌ binding for the newsletter tier |
| **Ticket clicks / month** | **≥ 1,000 (proposed)** | **1,444** | ✅ **met — gates the venue tier if the split is adopted** |

---

# The vector map

Every monetization vector considered, grouped. **$ now** is a realistic monthly
figure at today's 6k views / 47 subscribers — not a ceiling at scale.
**Disruption**: 0 invisible → 3 degrades the product. **Effort**: S hours ·
M a session · L multi-session or ongoing sales.

## A. Already built and sitting dark — sales, not code

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 1 | **Featured placement** (`25e16f7`, schema `a921110`) — labeled, capped, never reorders. [lib/featured.ts](../lib/featured.ts) | $0 → **$200–400/mo on one sale** | 1 | 0 code · L sales |
| 2 | **Newsletter "Presented by" slot** (`cc5c248`) | $0–50/send at 45 readers | 1 | 0 code · L sales |
| 3 | **Affiliate tagging seam** (`60e9325`) — map is empty by design | **~$6/mo** | 0 | S — **do not** |

## B. Zero or near-zero build

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 4 | **Supporter / tip link** — one line in the footer and the digest, no popup | $0–30/mo | 0 | S |
| 5 | **Parking affiliate** (SpotHero ~2.4% via Rakuten/FlexOffers) on venue pages | $5–20/mo | **0 — genuinely useful** | S |
| 6 | **Restaurant reservations** (OpenTable/Resy) — "dinner before the show" | $5–25/mo | 0–1 | M |
| 7 | **Experiences affiliate** (Viator/GetYourGuide) on the 569 Places pages | $10–40/mo | 1 | M |
| 8 | **Hotel affiliate** on big-draw events | $0–20/mo | 1 | M |

Vectors 5–8 are the honest version of affiliate: they attach to *Places* and venue
context, where there is evergreen search traffic, rather than to ticket links,
where finding 1 says the money is not.

## C. Venue / B2B — the latent asset

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 9 | **Venue dashboard** — magic-link "we sent you N clicks" | $0 direct, **unlocks 1, 2, 16** | 0 | M |
| 10 | **"Here's your traffic" email** to the ten operators in finding 2 — manual, no build | $0 | 0 | S |
| 11 | **Self-serve promote-your-event** (Stripe + the featured mechanism) | $50–200/mo | 1 | L |
| 12 | **Enhanced venue profile** — logo, photos, links. Presentation only, never placement | $25–100/mo | 1 | M |
| 13 | **Data / feed licensing** — 617 verified upcoming events to local media, hotels, chambers | **$100–500/mo per customer** | 0 | L |
| 14 | **Embeddable calendar widget** — free with attribution (backlinks → SEO), paid to de-brand | $0–100/mo + SEO | 0 | M |
| 15 | **Syndication / co-marketing** — starting with mspmag.com, to whom we send 565 clicks/mo | $0–200/mo | 0 | L |
| 16 | **Sponsored seasonal collection** — "Halloween in the Metro, presented by X" | **$100–300/mo** | 1 | S (built) |
| 17 | **Sponsored Place of the Week** | $25–100/mo | 1 | S |
| 18 | **CVB / tourism partnership** — Meet Minneapolis, Visit Saint Paul (visitsaintpaul.com already takes 15 clicks/mo) | $0 now, real budgets | 0 | L |

## D. Affiliate on ticket links — measured, not estimated

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 19 | **Primary ticketing** (Ticketmaster ~1–4%, SeatGeek ~1–5%, Live Nation) | **~$6/mo** | 0 | S — **no** |
| 20 | **Resale marketplaces** (StubHub ~7–9%) | ~$18/mo at best | **2 — markup, trust cost** | S — no |
| 21 | **Groupon / deals** | $5–20/mo | 2 | S |
| 22 | **Amazon Associates** (gear lists) | <$10/mo | 2 — off-brand | M |

Rates are from third-party affiliate directories and conflict with each other;
they are not quoted from the programs' own current terms. It does not matter —
finding 1 disqualifies the category on volume, not on rate.

## E. Advertising

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 23 | **AdSense / Ezoic** — 6k views × ~$8 RPM | $25–75/mo | **3** | S |
| 24 | **Mediavine / Raptive** | $0 — needs ~50k sessions | 3 | — |
| 25 | **One "Supported by" strip**, a single local partner, no ad network | **$100–300/mo** | 1 | S + sales |
| 26 | **Dedicated / solo email send** | $50–150 | **3** | S |

Vector 23 is the trap: it earns roughly what *one* featured-placement sale earns
and spends the clean UX that is the actual moat. **Default: no**, as Tier 3 already
says. Vector 25 is the version that survives the principles — one partner, one
strip, labeled, no network, no tracking.

## F. Reader payments

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 27 | **Membership tier** ($4/mo: saved-events sync, early digest, a no-ads promise) | $0–20/mo | 1 | L |
| 28 | **Paid second newsletter** | $0 | 1 | L |
| 29 | **Patreon / Substack** | $0–20/mo | 0 | S |
| 30 | **Paid concierge** — a custom weekend plan, ~$25, does not scale | $0–100/mo | 0 | S |
| 31 | **Seasonal PDF guide** ($5 — or free, as a lead magnet) | $0–50/mo | 0 | M |

47 subscribers cannot float a membership, and the engagement data argues against it
independently: **24 saves and 9 calendar adds in 30 days against 6,073 views.**
There is no measured return-visit loyalty to sell a subscription to yet. Vector 31
is worth more as a **subscriber lead magnet** than as a product.

## G. Non-product money

| # | Vector | $ now | Disr. | Effort |
|---|---|---|---|---|
| 32 | **Civic-info / local journalism grants** (LION, Knight, Minnesota funders) | **$2k–15k one-time** | 0 | L — application |
| 33 | **License the pipeline to other cities** — the verification stack is the real IP | $0 now | 0 | L |
| 34 | **Multi-city expansion** (6.4) | — | 0 | L |

Vector 32 is the largest absolute figure in this document and **the only one that
does not require the audience to grow first.** A verified, fabrication-checked
civic events calendar with a published verification discipline
(`docs/VERIFICATION.md`, `docs/REPORT-CHECKS.md`) is close to what those funders
describe. The two fabrication incidents and what we built in response are, for a
grant reader, evidence rather than embarrassment.

## H. Excluded on principle, or not worth it

- **Pay-to-be-listed · pay-to-rank · promoted search results · undisclosed
  placement** — permanently excluded, and correctly.
- **Email list rental · push-notification ads · selling venue leads** — no.
  Privacy, and `docs/PRIVACY-OPS.md`.
- **A paid "verified" badge** — corrupts the one thing that makes the data worth
  anything.
- **Instagram sponsorship** — 8 followers after 96 reels. Dead channel.
- **Merch · becoming a ticket seller · a job board** — distraction.

---

## The ranked answers

**By value today:** 32 (grants) → 13 (data licensing) → 1 (featured) → 16
(seasonal collection) → 25 (one partner strip) → 11 (self-serve) → 23 (ads) → 4
(tips) → 19 (affiliate, last).

**By value per unit of disruption:** 32 → 13 → 1 → 10 → 4 → 5 → 9. Ads, resale
affiliate and solo sends fall off the bottom.

**By feasibility this week:** 10 (ten emails, zero code) → 4 (tip link, one line)
→ 16 and 1 (built, need a buyer) → 9 (a session) → 32 (an application).

## Recommended sequence

1. **Vector 10 — email the ten operators in finding 2.** Manual, no code, true, and
   the only pitch here that does not depend on the audience getting bigger. Lead
   with the click count we actually sent them.
2. **Vector 9 — the venue dashboard**, which turns that email into something
   self-serve and is the proof-of-value that sells 1, 2 and 16.
3. **Vector 16 — sell one seasonal sponsored collection.** The mechanism is built;
   finding 2 says the seasonal campaign is the unit people want.
4. **Vector 32 — one grant application.** Worth more than every passive vector in
   this document combined for the next twelve months.
5. **Vector 4 — the supporter link.** One line, zero disruption, establishes the
   reader-funded story early.
6. **Vectors 5–7** when a Places or venue page is being touched anyway.
7. **Everything in E and F** stays closed. **Vector 3/19 stays dormant** — the
   report it produced is what told us to stop.

**Blocked on Taren:** the gate split in finding 3. Steps 1–3 are inside the
venue-side tier, and under the current single gate they are formally closed until
500 subscribers.

---

## Shipped ledger

| Item | Commit | What it is |
|---|---|---|
| M0.1 Outbound affiliate seam | `60e9325` | `lib/outbound.ts`, pure and idempotent, `AFFILIATE` empty by design. Its clicks-by-vendor report produced finding 1 — which is the whole return on it |
| M0.2 Engagement-metric integrity | `3ab9205` | the calendar beacon over-fired; 1,420/30d became 9/30d. The August doc's engagement numbers were partly fiction |
| G1.1 Subscriber conversion | `f3bcded`, `7de1174`, `1dd4b43`, `5045069` | sharpened band, `/this-week` public sample digest, save-nudge ask, attribution. 5 → 47 |
| R2.1 Newsletter sponsor slot | `cc5c248` | one labeled slot, dark when unsold |
| R2.2 Featured-placement framework | `25e16f7`, `a921110` | labeled, capped, never reorders organic |
| G1.2 SEO compounding | ongoing | 569 Places; search is now 47% of visits |

**What the ledger says about the method:** two of the five shipped items paid off by
*correcting a number* rather than earning one — M0.2 deleted a fictional engagement
metric, M0.1 proved its own category worthless. Both were cheap. Both prevented a
pitch built on a wrong number. That is the pattern worth repeating before the next
build: **measure the demand, then decide whether to build for it.**
