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

**Tests +5** (1239 total), in `topbar.test.ts` — a real drift guard, not a snapshot:
it parses the labels out of **both** source files and asserts the two sets are
**disjoint**, so re-introducing any collision (not just these two words) fails the
build. Plus a meta-test that both regexes still match, so the guard can't silently
stop guarding, and a check that the footer uses the same names.

Gate: `tsc` clean · 1238/1238 · `npm run build` clean · `npm audit` 0.

## Follow-up, same day: the `/this-weekend` H1 aligned too
Taren asked for it, so `/this-weekend`'s `<h1>` now reads **"This Weekend's Best"**,
matching its sibling and the nav link that points at it. The keyword "This Weekend"
is still inside the H1, so the on-page signal on the site's one confirmed-indexed
URL is preserved rather than replaced.

Pinned by an extra test: it extracts each curated page's `<h1>`, normalizes
`&rsquo;` to the curly apostrophe the nav uses, and asserts the H1 is **exactly a
nav label** — so a visitor can never land on a page titled differently from the
link they tapped, in either direction.

## And the OG share cards
Both social cards now read **"This Week's Best" / "This Weekend's Best"** too, so the
page has one name in every surface: nav, footer, `<h1>`, and the image people see
when the link is shared.

**The apostrophe was the actual risk here.** `next/og` (satori) draws the title
string straight into the PNG, so `&rsquo;` would have rendered as the literal
characters `&rsquo;` in the image — and a curly apostrophe missing from the
base64-embedded Oswald would have drawn a tofu box. Neither is catchable by a unit
test. So both cards were **rendered and looked at**: the curly apostrophe draws
correctly and both titles still fit on one line with room to spare (the font is the
full Oswald-SemiBold TTF, not a subset, which is why U+2019 is present).

## Rollback
`git revert`. Labels are display strings; no routes, hrefs, or data change.
