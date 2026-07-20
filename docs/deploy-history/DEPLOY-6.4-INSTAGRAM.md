# Deploy Guide — Roadmap 6.4: Instagram Card Generator

**Phase 6 closes with the Monday research session, generated.** Admin → **Instagram** now builds the week's three card variants — Regular, Family, Weird — from live event data, under your locked content rules, with captions that point the bio link at `/this-weekend`. Copy buttons on everything. What took a research session becomes a review.

**Code-only deploy. No database step, no new secrets.**

---

## Your locked rules, now enforced by tests instead of memory

| Locked rule | How it's enforced |
|---|---|
| **Exactly five events per card** | `CARD_SIZE = 5`. A thin lane shows an *incomplete* warning ("only 3 of 5 — do not pad") — the generator never pads with off-variant or rule-breaking events. |
| **No overlap between variants** | Family draws only from the family category, Weird from weird, Regular from music/festival/food/arts/sports — disjoint by construction, with an ID guard on top. Regular also caps any single category at 2 for variety. |
| **No drag or political events** | Word-boundary rules *with the homonym exceptions that matter*: "Drag Racing" and "Drag Strip" (motorsports) pass, "Drag Brunch" doesn't; "Rallycross" and "Rally Car Show" pass, "Rally for X" doesn't; "March Madness" passes, "March for Science" doesn't. All golden-tested — 13 tricky titles. |
| **Transparency** | Nothing is silently dropped. An **"Excluded by the rules"** table lists every filtered event with its reason, linked, so you review the filter's work every week. |

Verified end-to-end on realistic data: a Regular card of exactly five with the diversity cap working, **"Lawnmower Drag Racing" surviving the motorsports exception on the Weird card** while "Drag Brunch" and "Rally for the River" land in the exclusion report with reasons.

## What's on the page

- **Two windows**: next 7 days (default) or this weekend (the 6.3 clock).
- Per variant: the **card copy** in a code block with a copy button, and a **caption** (variant hook + hashtag set + *"link in bio → citypulsemn.com/this-weekend"*) with its own copy button.
- The exclusion report, and thin-week warnings that tell you a lane is short rather than quietly padding it.

## Scope boundary — deliberate

Pexels b-roll and your ISO-week shot/audio rotation stay in your video workflow; this generates **copy only**. And one honest unknown: your exact two-line card format wasn't in my notes beyond "two lines per event." The default is:

```
FRI 7/17 · Trampled by Turtles
First Avenue · 8 PM · $45
```

The format lives in **one function** (`formatCard` in `lib/instagram.ts`). **If your locked format differs, paste one real card from a past week and I'll match it exactly** — it's a one-place change guarded by a test.

## Quality bar (all green)
- **516 tests (22 new)** — the exclusion homonyms, exactly-five, zero-overlap, lane discipline, the diversity cap, incomplete-not-padded, the transparency report, window filtering, and the two-line format.
- Live smoke: page renders under admin auth, both windows work, exclusion report and thin-lane warnings verified, screenshot inspected.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Instagram card generator (roadmap 6.4)`) → push.

## Verify — next Monday's session

- [ ] Admin → Instagram: three cards populate from live data, five each.
- [ ] The exclusion table looks *right* to your editorial eye — if anything is wrongly caught or wrongly passed, name it; the rules are word-boundary patterns in one place.
- [ ] Copy a card + caption into your Reels workflow — if the two-line format needs to match your locked template, paste one real card back to me.
- [ ] The caption's bio-link line matches the `/this-weekend` URL now in your bio.

## Rollback
Roll back the deploy. Admin-only feature; nothing public changes.

---

## The board

**Phase 6 — Growth — is complete**: 6.1 venues ✓ · 6.2 cities ✓ · 6.3 this-weekend ✓ · 6.4 Instagram ✓. Remaining before Phase 7 (revenue): **5.6 the ops digest** (coverage + verify flags + pipeline health emailed to you weekly — the site now has a lot of instruments and no cockpit), **5.7 the Ongoing strip**, and the standing **multi-day collapse** export — the State Fair is still four cards, and it's one paste away from being one.
