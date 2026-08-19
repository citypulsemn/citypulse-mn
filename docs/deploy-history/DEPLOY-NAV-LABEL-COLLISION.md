# Deploy — Nav labels no longer impersonate the date presets

*Aug 19, 2026. Follow-up to the view-toggle fix. On the homepage, "This Week" and
"This Weekend" appeared **twice, one row apart**, doing two different things.*

## The collision
- **Date presets** inside the explorer (`components/ControlBar.tsx`): Today /
  This Weekend / This Week / This Month. These **filter the calendar in place** —
  the view toggle stays put.
- **Section nav** one row above (`lib/nav-sections.ts`): "This Week", "This
  Weekend", … These **navigate away** to a curated page.

Same words, one row apart, different behaviour. That ambiguity is what produced the
original "the toggle disappeared" report — tapping the wrong row silently changed
surface.

## The fix, and why these words
The nav labels were also **already wrong about their own destinations**:
`/this-week`'s `<h1>` has always read **"This Week's Best"**, and its tagline calls
it "the week's best … the same shortlist we email every Thursday." So this isn't
invented copy — the nav now says what the page already calls itself:

| | before | after |
|---|---|---|
| nav → `/this-week` | This Week | **This Week's Best** |
| nav → `/this-weekend` | This Weekend | **This Weekend's Best** |
| presets | *(unchanged)* | Today · This Weekend · This Week · This Month |

The **presets** were deliberately left alone: Today/Weekend/Week/Month is a coherent
date vocabulary, and renaming it would break its internal logic. The nav was the
side that mismatched.

The footer was updated to match, so **one page has one name sitewide**.

**Keyword anchor text is preserved** — "This Week's Best" still contains "This
Week", and "This Weekend's Best" still contains "This Weekend". This mattered:
`/this-weekend` is the one page GSC confirmed is actually indexed, so its sitewide
anchor text was not something to throw away for the sake of a snappier label.

## Verification (observed, not intended)
Rendered homepage HTML, the two rows side by side:
- nav: **This Week's Best · This Weekend's Best** · Ongoing · Collections · Places ·
  Venues · Neighborhoods · Cities
- presets: Today · **This Weekend · This Week** · This Month

No overlap. Footer renders "This Week's Best" / "This Weekend's Best".

**Tests +4** (1238 total), in `topbar.test.ts` — a real drift guard, not a snapshot:
it parses the labels out of **both** source files and asserts the two sets are
**disjoint**, so re-introducing any collision (not just these two words) fails the
build. Plus a meta-test that both regexes still match, so the guard can't silently
stop guarding, and a check that the footer uses the same names.

Gate: `tsc` clean · 1238/1238 · `npm run build` clean · `npm audit` 0.

## Deliberately not changed
`/this-weekend`'s `<h1>` still reads "This Weekend" (its sibling already reads "This
Week's Best"). Nav→destination agreement is nice-to-have, but that page is the one
confirmed-indexed URL on the site and its H1 is an on-page SEO signal — not worth
touching as a side effect of a label cleanup. Easy to align later if desired.

## Rollback
`git revert`. Labels are display strings; no routes, hrefs, or data change.
