# City Pulse MN — Roadmap v3 (post-4.5 audit)

*Written after a second full audit of the live site and codebase: homepage, collections, collection pages, event detail pages, plus a formatting/copy/visual pass.*

---

## The single most important finding

**The code is at 4.5. The data is still at 3.3.**

The live collections page today reads exactly like it did in the first audit: Live Music **0** ("See what's coming"), Family Fun **0**, Festivals **69**, This Weekend 3, Free 13, Arts 20, Unique 11. Chaska River City Days still sits on the calendar three times (Jul 23–25).

That's because Phase 4 shipped in two halves, and only one half has run:

| Piece | Code deployed | Data operation | Status |
|---|---|---|---|
| 4.1 Classification | ✓ | `reclassify-events.sql` in Supabase | **NOT RUN** |
| 4.2 Venue sweeps | ✓ | Executes on the Monday pipeline run | **Hasn't happened yet** (next run: tomorrow, Mon Jul 13) |
| 4.4 Multi-day collapse | ✓ | Collapse step 3 | **NOT RUN** — good thing, see below |
| 4.3 Coverage / 4.5 Verify | ✓ | Automatic on their schedules | Will report starting this week |

Nothing new to build fixes this — the roadmap's next step is **operational**, and it's in the checklist at the end.

## What this audit caught (and I've already fixed, in this zip)

**1. A critical bug in 4.4 that would have destroyed real events.** Your live calendar shows *St. Paul Saints vs. Columbus Clippers* on July 21, 22, 23, 24, 25, 26, and 27 — a seven-game homestand. Same title, same city, consecutive days: exactly the shape the multi-day collapse treats as "one festival stored as seven rows." Running step 3 would have **archived six of seven real games** (plus both Twins homestands and the back-to-back Lynx home games). The golden tests covered festivals and weekly series but missed the third consecutive-day pattern: sports.

Fixed: sports events can now only cluster same-day (a true duplicate of one game — still merged); a next-day sports row is always a new game. Eight new tests, including the literal Saints ×7 case. **Deploy this zip before running the collapse.**

**2. Long-span events render nonsense.** The Ramsey County Fair detail page reads "Wednesday, July 15 · **7 PM – 6 PM**" — a single row with `end_at` 13 days out, formatted as a same-day time range. Fixed: an event whose `end` lands on a later date is now treated as a multi-day span everywhere (badge, "Jul 15 – 29" label, appears on every day it runs) — with a **late-night rule** so a 9 PM show ending at 1 AM doesn't become a "two-day festival."

**3. Logo accessibility.** The stylized letterforms read as "CITY PULSEM N" to screen readers and crawlers (visible in every page fetch). The link now carries `aria-label="City Pulse MN — home"` and the letterforms are presentation-only.

**4. Footer stair-step.** A legacy global `footer { text-align: center }` rule was centering the wrapped newsletter description under a left-aligned heading. Scoped fix; verified in a render.

## Formatting / copy audit — the rest of the punch list

What's genuinely good: the design system is consistent (eyebrow · title · count pattern on every page header; uppercase letterspaced form labels; sentence-case helper copy with periods; title-case buttons). The submit page is clean. Collection cards are uniform. No consistency drift between pages — unusual for a project this size, worth protecting.

What needs work, in priority order — these are **data problems wearing formatting costumes**, which is why they're roadmap items (4.6/4.7) rather than CSS fixes:

1. **Impossible start times.** "5 AM Minneapolis Aquatennial," "5 AM Minnehaha Falls Art Fair," "7 AM Minnesota Lynx vs. Phoenix Mercury" (a WNBA game at breakfast). The Ramsey fair's Google Calendar link exposes the cause: `20260716T000000Z` — **times are being stored/interpreted as UTC when they're local**, shifting everything by 5–6 hours. This corrupts calendar placement, .ics exports, and "happening now" logic. → **4.6, the top build priority.**
2. **Title noise.** "Utepils Brewing Free Meat & Cheese Raffle **(Weekly Tuesdays)**", "Marketfest at Manitou Days **— Weekly Thursdays (July 16)**", "In the Heights **(Artistry / Bloomington Center for the Arts)**", "Trail of Small Wonders **(Exhibition)**", "Twins vs. LA Angels **– Beach Tote Bag Giveaway**". Venue, schedule, format, and promo metadata embedded in titles — with inconsistent em/en-dash/parens. Titles should carry the event name; structured fields carry the rest. → **4.7.**
3. **City display inconsistency.** "Saint Paul" and "St Paul" both appear on the same collection page. One canonical display form (recommend "St. Paul"). → part of 4.7.
4. **Vague sports titles.** "Minnesota Lynx Home Game" (no opponent) ×3 — the research agent couldn't find the matchup. Either resolve the opponent at verification time (4.5 already visits sources weekly) or drop such placeholders. → part of 4.6/4.7 cleanup.
5. **Price strings.** "Free (parking $10)" works but is drifting toward prose; keep an eye on it when 4.7 normalizes fields.

## Phase 4 — remaining (revised)

### 4.6 Time integrity ⚠️ next build item
Find and fix the UTC/local confusion at ingestion (agent output → `toIsoWithOffset` → storage), backfill-correct the obviously shifted events (5 AM festivals, 7 AM ball games), and add a pipeline guard that flags "improbable hour" starts (a sports/music event starting 12 AM–7 AM) the same way coverage flags thin weeks. All-day events should display "All day," not a fake clock time.

### 4.7 Title & field hygiene
An ingest-time cleaner that moves parenthetical venue/schedule/format/promo noise out of titles (structured fields already exist for all of it), normalizes dashes, and canonicalizes city display names. Golden-set tested like the classifier, using the live titles above as the fixture.

## Phase 5 — stickiness (unchanged order, one addition)

- **5.1 First-party analytics (`event_stats`)** — still the opener; the feedback loop everything else feeds on.
- **5.2 Trending** · **5.3 Personalized digest** · **5.4 Saved-list durability (magic link)** · **5.5 Neighborhoods** — as v2.
- **5.6 (new) Ops digest**: fold the coverage report, verification flags, and pipeline counters into one weekly email to you. The instruments now exist (4.3/4.5) but they live in an admin you have to remember to open; the failure mode of unwatched dashboards is well established by this very audit.

## Phases 6–8 — unchanged
Venue pages and neighborhood pages (6) become genuinely attractive once 4.2's registry has run for a few weeks and titles are clean; revenue (7) stays parked until coverage is honest and traffic exists; platform (8) after that. Curation is never for sale.

---

## Do-this-now checklist (operations, ~15 minutes, in order)

1. **Deploy this zip first** — it contains the sports-collapse fix. Do not run the collapse on the old code.
2. **Run `reclassify-events.sql`** in Supabase (from the 4.1 session — still valid, still unapplied). Live Music goes 0 → 16 immediately.
3. **Run `db/schema.sql`** in Supabase if you haven't since 4.4/4.5 (adds `multi_day_end`, `verified_at` — idempotent).
4. **Collapse the duplicates**: either `npm run collapse -- --dry-run` then apply, or send me the export (`id, title, city, category, start` for published/draft) and I'll generate paste-ready SQL like last time.
5. **Tomorrow's Monday run** exercises the venue sweeps for the first time — check the Actions log for `venue sweep` lines and the end-of-run coverage grades.
6. **Thursday**: trigger *Verify Upcoming Events* once with dry-run to watch it work.

After steps 1–5, re-check `/collections`: Live Music and Family Fun populated, Festivals deflated, Chaska showing once with a run badge. That's Phase 4 actually *arriving* on the site — and it's the moment the roadmap was built for.
