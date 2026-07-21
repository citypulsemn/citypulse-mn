# Deploy F2.2 — the "Last chance" surface

*July 21, 2026 (morning). Roadmap v5, second F2 feature. Near-free by design:
`selectOngoing` already sorts ending-soonest and the data model owns true
spans — this gives the urgency a name.*

## What shipped

**[lib/ongoing.ts](../../lib/ongoing.ts):** `selectLastChance(ongoing, now)` —
the ongoing runs whose TRUE final day lands within `LAST_CHANCE_DAYS` (7,
today inclusive). Because the input is already sorted by closing date, the
result is always a **prefix** of it — so "the rest" is a plain slice and no
card can ever render twice. Plus `ongoingStripPlan`, the pure decider for the
homepage strip.

**[/ongoing](../../app/ongoing/page.tsx):** when ≥ `MIN_LAST_CHANCE` (3) runs
close within the week, the page splits: gold **"Last chance — closing within a
week"** on top, "Also running" below. Under the floor it renders exactly as
before (honest emptiness — no sad one-item section).

**Homepage strip ([OngoingStrip.tsx](../../components/OngoingStrip.tsx)):**
same trigger swaps the labels to **"Last chance / Ends this week"** — and the
swapped strip shows ONLY genuinely closing runs, never padding an urgent label
with a November exhibition. Below the trigger, the strip is unchanged.

## Design notes

- Honesty twice over: the section needs 3+ real members to exist, and once it
  wears the urgent label, every item in it is urgent.
- The window is `endDay ≤ today + 6` — "this week" as a human means it.
- SEO angle rides for free: "last weekend for X" queries land on /ongoing,
  whose top section now says exactly that.

## Verification (observed, not intended)

- **Live dev server, real prod data, Jul 21:** /ongoing split into
  LAST CHANCE (7 runs, Jul 22–26 — Aquatennial and Leprechaun Days among
  them, the watch-list festivals) and ALSO RUNNING (Ramsey County Fair,
  Jul 29, correctly below the fold). Homepage strip read "Last chance / Ends
  this week" with 6 cards, computed DOM check: every card's through-date
  within the week.
- Tests +6 (698/698): window boundary (today in, today+6 in, today+7 out) ·
  prefix property (rest = slice, no double cards) · strip swap at exactly 3 ·
  swapped strip never padded · cap 6 · empty-in/empty-out.
- Gate: tsc clean · 698/698 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only; /ongoing and the homepage revalidate within
5 minutes.

## Verify checklist

- [ ] citypulsemn.com/ongoing — gold "Last chance" section on top (this week
      it will be there: Aquatennial closes Sunday).
- [ ] Homepage — the Ongoing strip reads "Last chance / Ends this week".

## Rollback

`git revert` — the single-list /ongoing and plain strip come back exactly.
