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
| 5 | ~~**Parking affiliate** (SpotHero)~~ → **shipped as a Google Maps parking link**, B3 | **$0** (no documented deep link to tag) | **0 — genuinely useful** | S ✅ |
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

---

# The build queue

Quick wins first. Two lanes run in parallel: the **owner lane** (sales, accounts,
decisions — no code, Taren's) and the **build lane** (one item per session, the
working agreement in CLAUDE.md). Vector numbers in brackets point back to the map.

**How this is ordered.** Effort is the primary sort, because every $ figure above
is small and uncertain at this size — so the cheapest *true* thing wins before the
cleverest. Disruption is a **veto, not a weight**: a vector scoring 2 or 3 does not
get in at any value. Value breaks ties among the cheap. And an item that *unblocks*
another outranks its own return, which is why B1 — worth $0 by itself — goes first.

## Hard prerequisites

**P1 — `DIGEST_POSTAL_ADDRESS` is unset.** Every weekly send goes out without the
physical address CAN-SPAM requires and stamps `NO POSTAL ADDRESS IN FOOTER` in its
own record (`docs/HANDOFF.md` open item 1). **Nothing may be sold into the
newsletter until this is set** — not vector 2, not 26. One GitHub Actions secret,
and the plumbing is already fixed. This is the cheapest blocker on the page and it
gates the only revenue surface that is fully built.

**P2 — the gate split** (finding 3). B1, C1, C2 and all of lane D sit inside the
proposed venue-side tier. Under the current single gate they are formally closed
until 500 subscribers. Taren's call; the queue below assumes the split is adopted
and says so rather than quietly proceeding.

## Lane O — owner, zero build, available now

| | Item | Why now |
|---|---|---|
| **O1** | **Email the ten operators in finding 2** [10] | The only pitch that does not need the audience to grow. Wait for B1 so it is a screenshot, not a SQL query |
| **O2** | **Ask one seasonal operator for a sponsored collection** [16] | Mechanism built (`25e16f7`). Halloween is ending — the orchards, haunts and Restaurant Week publisher are the warm list |
| **O3** | **Open a payment destination** (Stripe payment link or Ko-fi) | Unblocks B2. No integration needed, just an account and a URL |
| **O4** | **Decide P1 and P2** | P1 is a secret paste. P2 is a product call |

## Lane B — quick builds (all S, all disruption 0)

### B1 — Ticket clicks by venue on `/admin/stats`  ✅ SHIPPED
**Why:** O1 is the highest-value action available and today it needs a hand-written
SQL join to answer "how many buyers did we send you?". `getTicketClicksByVendor`
already answers it by *host*, which is the wrong axis for an email to a venue —
and finding 1 is the standing proof that the wrong axis sends you after the wrong
party. Worth $0 directly; it is first because it unblocks the thing worth the most.
**Design:** `getTicketClicksByVenue(days)` in [lib/stats.ts](../lib/stats.ts),
mirroring `getTicketClicksByVendor` exactly — same 1–90 day clamp, same
`America/Chicago` date window, same never-break contract (`[]` on any failure,
ENGINEERING rule 1), grouped on `events.venue` instead of the URL host.
**Build:** the function + a second table in
[app/admin/stats/page.tsx](../app/admin/stats/page.tsx) beside the existing
"Ticket clicks by vendor" block.
**Tests:** no pure logic to golden-test — say so rather than invent one. The check
is the resilience contract in `lib/__tests__/stats-resilience.test.ts` (returns
`[]` with no database) plus a smoke of the page.
**Size** S · **Depends** nothing · **Return** $0, unblocks O1.
**Shipped** 29 Oct 2026 — `deploy-history/DEPLOY-CLICKS-BY-VENUE.md`. The venue
table renders above the vendor one, which gained a sentence recording that the
affiliate question measured 1.9% and is closed. **O1 is now unblocked.**

### B2 — The supporter link  [4]  ✅ SHIPPED (dark until O3)
**Why:** the reader-funded story is worth starting early and costs nothing to run.
**Design:** an external payment URL (O3) — **no** Stripe API, no webhook, no table,
no amounts in code. One line in [components/SiteFooter.tsx](../components/SiteFooter.tsx)
beside "Submit an event", and one in the digest footer in
[lib/digest.ts](../lib/digest.ts) next to the unsubscribe line (both the HTML and
the plain-text footer — the plain-text one is the half that gets forgotten).
A `/support` page only if the payment host's own page reads badly.
**Tests:** the footer copy if it becomes config; otherwise visual.
**Size** S · **Depends** O3 · **Return** $0–30/mo.
**Shipped** 29 Oct 2026 — `deploy-history/DEPLOY-SUPPORT-LINK-AND-PARKING.md`.
`SUPPORT` in `lib/editorial.ts` is null, so it renders nowhere; set the object
when the payment page exists and both surfaces light up together.

### B3 — "Parking near here" on venue pages  [5]  ✅ SHIPPED (earns $0)
**Why:** useful to a reader on the night, with or without a commission — which is
why it survives the disruption veto that kills the rest of category D.
**Design:** a link on `app/venues/[slug]` built from `venue_coords`. **Verify the
deep-link shape first** (a lat/lng search URL that actually resolves); if it cannot
be deep-linked honestly, fall back to a venue-name search, and if that reads badly,
**cut the item** rather than ship a guessed URL. Honest-empty when the venue has no
coords. Any affiliate id later goes in `AFFILIATE` in `lib/outbound.ts`, which
already exists for exactly this — it just stays empty for ticket hosts.
**Tests:** golden tests on the URL builder (coords → URL, missing coords → null).
**Size** S · **Depends** nothing · **Return** ~~$5–20/mo once tagged~~ → **$0**.
**Shipped** 29 Oct 2026 — `deploy-history/DEPLOY-SUPPORT-LINK-AND-PARKING.md`.
SpotHero publishes no documented lat/lng deep link, so per this spec's own
instruction the item was not built on a guessed URL. It ships as a Google Maps
parking search — the pattern the Directions link beside it already used, and
where SpotHero inventory surfaces anyway. Reader value, no revenue. The $5–20
line was a forecast of a thing that turned out not to be buildable, and is
corrected rather than left standing.

### B4 — Partner one-pager for the feed  [13]
**Why:** vector 13 is the second-highest value in the document and the thing it
needs is not code — the iCal/JSON feeds already ship (`app/feeds/[slug]`, 6.1).
What is missing is a page a hotel, chamber or newsroom can read and act on.
**Design:** a section on [/for-venues](../app/for-venues/page.tsx) or a sibling
`/for-partners`: what the feed contains, how it is verified, the attribution terms,
who to contact. Copy, in the voice rules — no brochure sentences.
**Size** S · **Depends** nothing · **Return** unblocks a $100–500/mo conversation.

### B5 — Grant evidence pack  [32]
**Why:** the largest absolute figure in the document and the only one that does not
need the audience to grow. A docs file, not a feature.
**Design:** assemble what already exists into one readable piece — the verification
discipline (`docs/VERIFICATION.md`, `docs/REPORT-CHECKS.md`), the coverage method,
the live numbers above, and the two fabrication incidents *with what we built in
response*. For a grant reader those incidents are evidence of method, not
embarrassment. Name the funders to approach; do not draft the application.
**Size** S · **Depends** nothing · **Return** $2k–15k, one-time, slow.

## Lane C — the unlock (M)

### C1 — Venue dashboard  [9]
**Why:** turns O1 from ten hand-written emails into something that keeps working,
and is the proof-of-value that sells vectors 1, 2 and 16. Nothing else in the
document creates a reason for a business to open a page of ours every month.
**Design:** magic-link, no login, no account. Do not invent signing — four modules
already establish the pattern (`lib/unsubscribe-token.ts`, `report-token.ts`,
`restore-token.ts`, `confirm-token.ts`, all HMAC over an `envOr` secret with a dev
fallback); add `lib/venue-token.ts` in the same shape, keyed on venue slug. Shows
that venue's listings, views and ticket clicks over 30/90 days. Read-only in v1.
**Gotcha:** `.env.local` carries no `UNSUBSCRIBE_SECRET`, so links minted locally
are signed with the dev fallback and production rejects them as expired
(`docs/HANDOFF.md`). Test the token logic in unit tests, not by clicking a link.
**Watch:** the dashboard must never imply we can move their ranking.
**Size** M · **Depends** B1 (the query), P2 (the gate) · **Return** $0 direct.

### C2 — Enhanced venue profile  [12]
Presentation only — logo, photos, links. **Never placement.** The principle line
above is the whole spec. **Size** M · **Depends** C1.

## Lane D — real money, later (L)

**D1** self-serve promote-your-event with Stripe [11] · **D2** data/feed licensing
once B4 produces a conversation [13] · **D3** syndication with mspmag.com, to whom
we already send 565 clicks a month [15] · **D4** CVB and tourism budgets [18].
All gated on P2 and on at least one completed sale from lane O — we do not build
checkout for a hypothesis.

## Lane E — closed, on purpose

Display ads [23, 24], solo email sends [26], ticket affiliate [3, 19, 20], Groupon
and Amazon [21, 22], membership and paid newsletters [27, 28]. Each is closed by a
measured number or by the disruption veto, not by taste. **The affiliate seam stays
dormant** — the report it produced is what told us to stop, which is the best
return any item in the shipped ledger has delivered.

## The first three sessions

1. ~~**B1**~~ ✅ **shipped** 29 Oct. Then Taren sends the ten emails (**O1, still open**).
2. ~~**B2 + B3**~~ ✅ **shipped** 29 Oct. B2 is dark until O3 produces a payment URL.
3. **C1** — a full session, and the first one that needs P2 answered. **Next.**

Remaining in lane B: **B4** (partner one-pager) and **B5** (grant evidence pack),
both still S, both unblocked, neither dependent on C1.

Re-read the gate tracker before session 4. If O1 produces a reply, that reply
reorders this queue — a real buyer outranks anything written here.

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
