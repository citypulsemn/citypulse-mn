# Deploy Guide — Roadmap 3.2: Content Depth (real words on the money pages)

**Internal links are the cheapest ranking signal; actual paragraphs are the second cheapest.** The venue and neighborhood pages were data with a map on top — now they read like a person made them, and event pages cross-link into the venue fleet. This is the exact lever `docs/INDEXING.md` prescribes when GSC shows "Crawled — currently not indexed" on money pages.

**Code-only deploy. No database step, no new secrets.**

---

## What shipped

**1. Editorial intros — written, not placeholdered (your call, so I wrote them).** `lib/editorial.ts` holds two plain-string maps you can edit anytime: **17 venue intros** (First Avenue through the Lake Harriet Bandshell) and **all 16 neighborhoods**. The style rules I held myself to: concrete facts over adjectives (the stars on First Ave's wall and which one's gold; the Palace's deliberately half-crumbled ceiling; Fitzgerald complaining about Summit Avenue "beautifully"), local shorthand (Nordeast, the Wonderwall, Eat Street), varied sentence rhythm, the occasional practical aside (mezzanine rail "if your knees have opinions"), and a standing ban on brochure-speak — no "vibrant," no "nestled," no "whether you're X or Y." The file header carries the editing rule: *if it sounds like a brochure, cut the sentence.* Venues without an intro simply render nothing.

**2. The "More at this venue" strip** on every event page: up to 4 upcoming events at the same venue — matched through the **same alias machinery the venue pages use**, so a show filed under "7th St Entry" appears on a First Avenue event's strip — soonest first, self excluded, with a "See all →" into the venue page. Venue empty? Falls back to the event's neighborhood. Neither? Renders nothing (honest emptiness).

**3. The drift guard.** A test asserts every intro key resolves against the live registries — and it caught me within one minute of existing: four venue slugs I'd guessed wrong (`the-armory` vs the real `armory`, etc.) were flagged before they could ship as dead data. All 16 neighborhoods are additionally asserted *covered*, so a future 17th district can't silently launch introless.

## Quality bar (all green)
- **553 tests (7 new):** alias-machinery selection, soonest-first cap, neighborhood fallback, honest-null, draft exclusion, the drift guards, intro length bounds (no stubs, no essays).
- **Live smoke:** first-avenue and uptown render their actual copy; a venue without an intro (331 Club) stays clean; event pages mount the strip with no error and correctly hide it on past-dated sample data.
- **Direct render proof:** the strip server-rendered with future-dated events — heading resolves "First Ave" → the First Avenue page, order and see-all link verified in the emitted markup.
- tsc clean · build clean · 0 vulnerabilities · **archive parity 247=247** (rule 8 — which mattered: this build's packaging was interrupted twice, and the parity check is what certified the final zip).

Honest ledger: the first wiring attempt died on a bad assumption (`venueBySlug` didn't exist; the event page had no full-event fetch) — caught by the gate, rebuilt with per-step verification.

---

## Deploy

Unzip over the repo (per rule 8 the zip is parity-verified), commit (`Content depth: editorial intros + More-at-venue strip (roadmap 3.2)`) → push.

## Verify

- [ ] `citypulsemn.com/venues/first-avenue` — the intro sits under the header ("…each one a name that's played here since 1970 — Prince's is painted gold.").
- [ ] `/neighborhoods/northeast` — the Nordeast paragraph.
- [ ] Open any event at a covered venue — "More at …" lists the next shows; tap through to one.
- [ ] Read three intros as a local. **Anything that rings false or flat, tell me which — they're plain strings in `lib/editorial.ts`, editable in one line each.** Your voice beats mine wherever you want to overwrite it.
- [ ] Over the coming weeks: this is the lever for the "Crawled — not indexed" rows in GSC; watch the Pages report per the INDEXING.md table.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## The board

3.1 ✓ · **3.2 ✓** — the site now *reads* like it's made by someone. Next: **3.3 OG images** (social cards via `next/og` for this-weekend, venues, collections — navy and gold, so links stop unfurling as blank rectangles), then 3.4 puts the subscribe band where the readers actually are.
