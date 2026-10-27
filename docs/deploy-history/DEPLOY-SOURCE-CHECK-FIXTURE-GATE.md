# Deploy — the fixture gate, and the retraction that produced it

**27 Oct 2026.** Code only. No schema change, no secret, no migration.

## The retraction first

Asked to "do the 348" — the listings I had reported as sitting on
JavaScript-drawn calendars, six times the blocked count, the real ceiling on the
source check — I measured before building. **There is no 348.**

That figure came from probing **one page per host** across 97 hosts and
attributing each host's whole listing count to the verdict of the page sampled.
`first-avenue.com` has 170 upcoming listings; exactly one cites
`/venue/first-avenue/`, which really is a JavaScript calendar. The other 163
pages on that host are each a listing's own event page, and every one carries
its title plainly. That single sampling error invented about sixty unverifiable
listings that verify fine.

Measured per **listing** instead — all 387 cited pages fetched, all 642 upcoming
listings scored with the sweep's own function:

| verdict | listings |
|---|---|
| **present** — the page names it | **465** |
| not an index, so the page cannot convict | 86 |
| unreachable (403 · 429 · redirect loop · 404) | 76 |
| day not covered, partial match, thin page, weak title | 15 |
| **absent** | **0** |

So 72% of the calendar was already verifiable from plain HTML. The real
remainder is **177** — which is, with some irony, the number I first reported
and also got wrong, now arrived at honestly.

**Playwright is not worth it, and now there is a number saying so.** Of the 86
listings on pages that cannot convict, almost none carry a client-side payload.
They are team schedules, aggregator pages and single-event pages.

## What shipped

The 86 are not one problem. The largest slice is **33 listings citing team
schedule pages**, and the schedule was in the HTML all along, written in a shape
nothing here knew how to read. A team's own schedule page never repeats the home
team:

```
our title   Minnesota Gophers Men's Basketball vs. Western Illinois
the page    vs / Western Illinois / The Barn… / TV: BTN / Nov 16 (Mon)
```

2 of 6 distinctive words, on a page with 31 dated entries — under the 50-entry
index bar. Neither confirmable nor convictable, permanently.

`lib/source-presence.ts` gains:

- **`opponentSegment(title)`** — what follows `vs.`, with our decoration
  stripped (`(Game 2)`, `– Gold Out`, `[Sold Out]`). **`vs` only, never
  ` at `**: " at " is how half this calendar is titled, so *Holiday Market at
  Union Depot* would otherwise let a venue name standing near the right date
  confirm an event the page never names.
- **`fixtureRow(entries, i, opp)`** — is this entry a fixture row, and if so
  which entry carries its block's date and how far does the block run? Two
  shapes are accepted and nothing else: the date immediately before the
  opponent (`gopherpucklive.com`), or a home/away marker immediately before it
  with the date further down the block (`gophersports.com`). In the second
  shape the date is found by scanning **forward to the next marker**, never by
  proximity. An away marker — `at`, `@`, on the row or on the bare line before
  it — refuses the row outright.
- **`venueMarks(venue)`** — the words that identify a building, with the ones
  every athletics page carries dropped (`arena`, `center`, `stadium`…), because
  every block says "Game Center" and a Target Center listing would otherwise
  match any Gophers fixture on that one word.
- **the gate**, between the `no-date-given` return and the index gate, plus
  `venue?: string` on `PresenceOptions`. Five things must agree: a row naming
  the opponent and nothing else; that row proving itself a fixture row; a home
  marker; a date belonging to that block; and the block naming the venue the
  listing claims. It can only ever return `present`.
- **`via: "fixture"`** on the `present` verdict, so the note reads
  `present:fixture` rather than `present:0.333` — the score is the full title's
  and stays below `presentAt`, which is the whole reason the gate exists. One
  query now finds everything the gate confirmed, which matters if it ever proves
  too loose.

`scripts/check-sources.ts` passes `venue: row.venue`, which it already had.

Also: `const entries = pageEntries(text)` is hoisted above the scoring loop and
the later duplicate declaration removed — the gate reuses the same array rather
than splitting the page a second time.


## Decisions that were each the second attempt

- **The row must name the opponent and nothing else**, not score well against
  it. Scoring gives "Michigan" a perfect 1.0 against a *Michigan State* row.
  Pinned by a test that asserts both directions.
- **Punctuation normalised on both sides.** The row says `Alaska-Anchorage`
  where we say `Alaska Anchorage`.
- **Proximity was the first draft of rule 4 and it was wrong** — see the review
  section, which broke it with two extra lines in a block.
- **Token overlap was the first idea for telling one team's page from its
  sibling's, and it was measured rather than trusted.** It does not work: a
  bogus *Gophers Volleyball vs. Western Illinois* scores 1.00 against the men's
  basketball page because the site's navigation names every sport, higher than
  the real title's 0.75. The venue requirement replaced it.
## It found a wrong listing on its first run

We publish **Gophers Men's Basketball vs. Western Illinois on 12 Nov 2026**. The
official schedule puts Western Illinois on the **16th** — which we also carry,
separately — and **Southern** on the 12th:

```
vs / Southern          / The Barn… / Radio: KTLK      / Nov 12 (Thu)
vs / Western Illinois  / The Barn… / TV: BTN          / Nov 16 (Mon)
```

The gate declined to confirm the 12th. **Nothing was changed in the database** —
a wrong opponent on a real game night is a data call, not a sweep decision.
Options are in the report that accompanies this deploy; the listing is currently
unverified, so it carries no stamp it has not earned.

## Measured, live

- 93 fixture-titled listings across 23 pages. 66 now `present` (40 by full
  title, **26 by this gate**), 18 still not, 9 unreachable.
- All 26 are on `gophersports.com` (15) and `gopherpucklive.com` (11). **No
  other host changed** — the regression check that mattered, since the gate
  confirms rather than convicts.
- The seven Gophers listings it leaves alone fail legibly: three volleyball
  titles carry a nickname the page omits, three sit on a schedule-announcement
  article where dates run in prose on both sides of the team name, one is the
  wrong listing above.

## Known limits

- A nickname our title carries and the page omits (*Penn State Nittany Lions*
  against a page saying *Penn State*) stays unchecked. A miss, not an
  accusation.
- **A listing with no venue gets no venue check.** Rule 5 is skipped when the
  caller passes nothing, and the gate then confirms on the first four rules
  alone — which is the weaker form the review broke. The sweep always passes
  `row.venue` and every Gophers listing has one, but a listing with an empty
  venue falls back to that weaker test.
- **A watch party** titled "… vs. Purdue" on the real game's date, *at the
  arena*, would still be confirmed. Held at a bar, the venue check refuses it —
  a side benefit of rule 5 rather than something it was built for.
- **A row carrying no year still cannot tell 2026 from 2027.** Most of
  `gophersports.com` is written that way (`Nov 16 (Mon)`), so the year rule only
  bites on pages that print one. Closing it needs a page-level season span,
  which is a larger change than this gate deserves — and the title path that
  confirmed 465 listings has exactly the same property, so this is a standing
  limit of the check rather than something the gate introduced. Stated here
  rather than pretended away.

## What the review found: four ways to confirm a listing the page never attested

A four-lens agent panel (16 agents, ~1.8M tokens) reviewed the gate before it
shipped. **Four findings survived refutation, all real, all in the one direction
that matters** — the gate confirming something the page does not attest, which
is worse than any miss because `present` means the sweep neither flags the
listing nor withdraws its `verified_at`. All four were reproduced locally and
fixed before commit. A fifth was a plain bug.

**1. Proximity has a one-line margin, and it inverted the gate.** The first
draft took the date printed *nearest* the opponent. On a real page "Western
Illinois" sits five lines after `Nov 12 (Thu)` and four before its own
`Nov 16 (Mon)`, so two extra lines in a block — a streaming line, a promo line,
which real pages carry unevenly — make the previous game's date nearer:

```
before   listing 2026-11-12 → present via=fixture "Western Illinois — Nov 12 (Thu)"
         listing 2026-11-16 → unchecked
after    listing 2026-11-12 → unchecked
         listing 2026-11-16 → present via=fixture "Western Illinois — Nov 16 (Mon)"
```

The draft confirmed the one live wrong listing and refused the right one —
precisely inverting the behaviour this guide credited it with. Replaced by block
structure: scan forward to the next marker, stop there.

**2. A bare name was treated as a fixture.** Nothing required the matching line
to be a schedule row, so a "Denver" in a region nav standing a few lines from a
dated entry confirmed a listing. Worse, this gate runs *before* the index gate,
so on a page that could convict, inserting " vs. " into a title turned a real
`absent` into `present` — **silencing an accusation**. A row must now prove
itself by its own structure, and a bare nav name has neither an adjacent date
nor a marker.

**3. The away marker was enforced on our title and ignored on the page.**
`opponentSegment` refuses " at " in *our* title — a rule about our syntax — while
the page's own marker was never read, and the residue check even stripped `at`
as noise. `gophersports.com` writes the marker on its own line, so an away
game's opponent entry is **byte-identical** to a home game's:

```
at                                 vs
Western Illinois                   Western Illinois
Western Hall, Macomb, Ill.         The Barn by Blue Cross and Blue Shield…
```

A listing putting a real away fixture in Minneapolis — wrong city, wrong venue,
on a Twin-Cities-only calendar — was returning `present`.

**4. A row that prints its year was not required to print ours.**
`pageCoversDate` matches month and day alone, deliberately, because index pages
omit the year. So a listing dated **2027**-11-13 was confirmed by
`gopherpucklive.com`'s `Fri. Nov 13, 2026`. Wrong-year re-dating is one of the
three fabrication shapes this project has shipped.

**And the one that was a plain bug:** a six-character floor on what counted as a
dated entry made `Nov 5` invisible, so the search reached *past* the true date to
the next game's. I had copied the floor from the index gate, where a floor is
correct for a different reason.

**One finding I could not fix, and did not pretend to.** The panel also showed
that an opponent-only match cannot tell one team's schedule page from its
sibling's — `gophersports.com` runs parallel men's and women's pages with
overlapping opponents, and a bogus *Minnesota Wild Hockey vs. Western Illinois*
was confirmed by the men's basketball page. The suggested guard, requiring a
non-opponent title token on the page, was **measured and does not work**: a
bogus *Gophers Volleyball vs. Western Illinois* scores 1.00 against that page,
higher than the real title's 0.75, because the site's navigation names every
sport. What does work is the venue: our listings carry `3M Arena at Mariucci`,
`The Barn by Blue Cross and Blue Shield of Minnesota`, `Ridder Arena`, and the
blocks print the same names. That became rule 5, and with it the Wild, Lynx and
Volleyball titles are all refused while the real one confirms.

**None of the five fixes cost a confirmation.** Re-measured live after each:
still 26, the same 26, and `gopherpucklive.com` went from 11 confirmed to 11
confirmed with the away leg of the Notre Dame series now explicitly skipped in
favour of the home leg, matched on `3M Arena at Mariucci`.

One claim of my own died in the same pass: a comment asserted a season string
like `2026-27` would satisfy a January 2027 fixture. It does not —
`\b20\d{2}\b` yields 2026 alone — and the test I wrote to demonstrate it failed,
which is the correct outcome for a false claim.

## Gate

`npx tsc --noEmit` clean · `npm test` **9,918 passing** across 552 files (+29) ·
`npm run build` clean · `npm audit` 0 vulnerabilities.

## Deploy

```bash
git push origin HEAD:main
```

Vercel auto-deploys. Nothing to apply by hand. The next weekly sweep picks the
gate up with no configuration.

## Verify

```bash
npm run check-sources -- --host=gophersports.com
```

Observed 27 Oct 2026 — the "before" run was taken by stashing the change and
re-running, not derived:

```
before   present 3 · NOT ON SOURCE 0 · unchecked 22
              22  unchecked    not-an-index 22
               3  present      0.667 2, 0.625 1

after    present 18 · NOT ON SOURCE 0 · unchecked 7
              18  present      fixture 15, 0.667 2, 0.625 1
               7  unchecked    not-an-index 7
```

Fifteen listings moved, all of them to `present` by the gate, and the seven that
stay unchecked include the 12 Nov Western Illinois listing. The `fixture` tag is
why `present:0.333` no longer appears: the score is the full title's and stays
below `presentAt`, so the note records what actually confirmed the listing.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Pure logic with no stored state — reverting returns those 26 listings to
`unchecked`, which is where they were on 26 Oct. Nothing to undo in the
database.
