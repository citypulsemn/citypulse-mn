# Source check — is a listing on the page it cites?

One HTTP fetch per distinct source URL, no model call, and it answers the
question that would have caught every fabrication this project has shipped:
**does the page we cite actually list this event?**

```bash
npx tsx scripts/check-sources.ts                    # look, write nothing
npx tsx scripts/check-sources.ts --apply            # flag what is missing
npx tsx scripts/check-sources.ts --host=arb.umn.edu # one source
npx tsx scripts/check-sources.ts --limit=40         # cap the fetches
```

*(An `npm run check-sources` alias exists in the working tree but is
deliberately not committed — `package.json` currently carries the uncommitted
reels entries, and staging it would drag those in. Add the alias when reels
lands.)*

## What it was built for

On 14 Sep 2026 **"Prairie Bathing Under a Harvest Moon"** was live, stamped
verified, and did not exist. Three Rivers Park District runs seven programmes on
26 September and none of them is that. What the listing really was:

| the real thing | where | when |
|---|---|---|
| Guided Forest Bathing Walk | Silverwood Park | 10 Oct |
| Night on the Prairie | Eastman Nature Center | 31 Oct |
| "The Harvest Moon" | — | **a blog post from September 2018** |

Three real things and a blog headline, blended into a fourth. The date was not
random either: the harvest moon genuinely falls near 26 Sep 2026. Real
vocabulary, real date anchor, no event.

It cited `threeriversparks.org/programs`, a live index page that names every
programme the district runs. The title was never on it.

## How it decides

`lib/source-presence.ts` is pure and golden-tested (31 tests).

**The unit of comparison is one ENTRY, never the page.** Matching against the
whole page would have cleared this listing: "prairie" is on it (Prairie Seed
Collection), so is "bathing" (Fall Colors Guided Forest Bathing), "harvest"
(Preserving the Harvest) and "moon" (Moonlit Magic). All four words present,
never together.

Three gates gate every negative, each one added after it flagged something real:

1. **The page must be an index.** ≥50 distinct dated entries. The first full
   sweep flagged five listings and four were real — a single-event page for
   *Clue*, the Guthrie's ticketing page, a Gophers news article. Our titles
   carry decoration those pages never use ("– Saturday Performance"), so they
   scored low and looked missing. What separated them from the real catch was
   not the score but how much calendar the page enumerates:

   | page | dated entries | verdict |
   |---|---|---|
   | threeriversparks.org/programs | **208** | the real catch |
   | securesite.guthrietheater.org | 32 | false positive |
   | gophersports.com article | 31 | false positive |
   | arb.umn.edu/events/calendar | 14 | false positive |
   | hennepinarts.org/events/clue | 9 | false positive |

2. **The page must cover the listing's date** — ≥2 *distinct* entries naming
   that day. `arb.umn.edu/events/calendar` is "Today at the Arb"; a page showing
   today proves nothing about the 26th. Distinct, because a nav element carrying
   a date can repeat down a page and boilerplate must not stand in for a listing.

3. **The title must have ≥3 distinctive words.** "Sting" missing from an index
   proves nothing.

Anything else — a thin page, a 403, a partial match, a title of stopwords —
returns `unchecked`. **`unchecked` is never treated as either answer.**

## What it does to a row

A missing listing is **flagged and un-verified. Never archived, never edited.**

Withdrawing `verified_at` is deliberate: the ops digest's queue only reports
flags on *unverified* listings, so a fabrication carrying a stamp would be
flagged into a place nobody looks — which is exactly how this one survived. And
a verified claim that its own cited source does not corroborate has not earned
the stamp.

Flags land as `verify_flag` audit rows with verdict `not_on_source`, so they
appear in the existing ops-digest queue and on `/admin/ops` with no new plumbing.
They are self-clearing the same way the others are: computed from the listing's
current state, not from flag count.

## Known limits, stated plainly

- **Small organiser calendars are not checked.** The 50-entry bar excludes a
  parish with ten events. That is a miss, not a false accusation, and it is the
  right direction to err.
- **JavaScript calendars are invisible.** If the events are drawn client-side we
  read only the nav menu, and gate 1 refuses.
- **Sites that block us return 403** and stay `unchecked`. The fetch identifies
  itself honestly; a site that would rather we did not read it gets that wish.
- It proves a title is *on a page*, not that the event is real. A page can be
  wrong. This is a cheap first filter, not a verdict.
