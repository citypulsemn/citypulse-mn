# Deploy — Place of the week stops alternating two places (5 Oct 2026)

## Why

`placeOfTheWeek(now)` feeds the Thursday email and Admin → Content. A year of
weekly picks was simulated on 4 Oct 2026 and the rotation turned out to be
broken in three ways its tests could not see (they sampled four dates):

| What the old picker did, Oct 2026 → Sep 2027 | |
|---|---|
| Year-round places featured (227 of the registry's 567) | **0 of 52 weeks** |
| November 2026 | **two places, alternating**: Apple Valley Sports Arena, Great River Water Park, and again |
| 25 Feb and 4 Mar 2027 | the same ski hill twice running |
| April 2027 | **five golf courses in a row** |
| 23 Sep 2027 | a splash pad, three weeks after Labor Day |

Cause, in one line each:

1. It preferred seasonal places whenever any were open, and something seasonal
   is open every month, so the "evergreen fallback" never fired.
2. It indexed `week % pool.length` into a slug-sorted pool whose size changed on
   the 1st of each month. November's pool was two places.
3. Seasons are month-level and wider than their labels. `SUMMER` is May–September
   and says "Memorial Day–Labor Day".

Without this change, subscribers get the same two places through November.

## What shipped

`lib/places.ts` — the picker is rebuilt. Still a **pure function of the date**:
no table, no stored history, nothing to migrate. Four rules:

1. **The wheel (no repeats).** Every place owns one fixed slot on a 57-week
   wheel — a hash of its own slug — and is only a candidate on its own turn. A
   year-round place therefore cannot come back for 57 weeks. Short-season places
   (beaches, rinks, orchards, golf, markets) ride a 19-week wheel instead: 19
   weeks is longer than any of their primes, so none is ever featured twice in
   one season.
2. **Lanes.** Even weeks feature a place in season, odd weeks a year-round one.
   When nothing is in season — most of November, March, April — every week is
   year-round.
3. **Kinds.** Never the same kind two weeks running; three different kinds in
   any three weeks wherever the candidates allow.
4. **Prime season.** A seasonal place is featured only in the middle 60% of its
   season, and only if the whole Thursday–Wednesday week fits inside it.

What rule 4 means on the calendar (first and last Thursday a place can be featured):

| Season in the registry | Places | Featured |
|---|---|---|
| Memorial Day–Labor Day (beaches, splash pads) | 94 | 3 Jun → 19 Aug |
| June–August (outdoor pools) | 18 | 24 Jun → 5 Aug |
| April–October (golf, a few dog parks and gardens) | 94 | 20 May → 9 Sep |
| May–October (farmers markets) | 75 | 10 Jun → 16 Sep |
| September–October (orchards) | 14 | 16 Sep → 7 Oct |
| December–February (outdoor rinks, sledding) | 36 | 24 Dec → 4 Feb |
| December–March (ski hills) | 7 | 31 Dec → 25 Feb |
| September–May (the two closed-in-summer places) | 2 | 29 Oct → 25 Mar |

(Dates for the 2026–27 seasons; they move by a day or two each year.)

Also in this change:

- `openNow` is unchanged in behaviour; its month check got a name
  (`openInMonth`) so the picker shares one definition with it.
- A latent disagreement is gone: the old pool was rebuilt from `now`'s month, so
  in a week that straddled the 1st, Thursday's email and a later look at
  Admin → Content could show different places. The new pick is fixed for the
  whole Thursday–Wednesday week.
- `lib/__tests__/schema-drift.test.ts` — one line. Its comment-stripper split on
  `\n` only, so on a Windows checkout (CRLF) it read a commented-out column as
  real and failed. Unrelated to places; it was the only red test in the suite on
  this machine, and it is green in CI either way.

## Design decisions

**Why slots instead of a shuffled list.** Any "index into a list" scheme repeats
when the list changes length — that was the bug. A slot depends on the place's
own slug and nothing else, so adding fifty splash pads moves nobody. The
no-repeat guarantee holds however the registry grows, and there is a test that
adds fifty places and checks every original still lands on the same slot.

**Why both wheels are odd.** A place's turns come round every 57 (or 19) weeks.
On an even wheel a place's turn would always fall on an even week, or always on
an odd one — half the registry could never match its lane. The first draft used
56/28/14 and did exactly that. A test pins the oddness.

**Why not a longer ladder of wheels.** Tried 513 → 171 → 57 → 19 (each place gets
a "home week" once a decade). Twenty simulated years: 398 distinct places against
384 for plain 57/19. Not worth the extra concept, so it was cut.

**Why short seasons get their own wheel.** With one 57-week wheel, a week in
January had a winter candidate barely half the time (43 rinks, hills and ski areas
spread over 57 slots). On the 19-week wheel nearly every seasonal week in January has
one, and the closed months supply the rest of the gap.

**What gives way when a week's candidates don't fit**, in order: the lane, then
the two-weeks-apart kind rule, then the wheel down to its 19-week floor. The
same-kind-two-weeks-running rule never gives way.

## The honest numbers

Ten simulated years against today's registry (520 Thursdays, 567 places):

| | |
|---|---|
| Same place two weeks running | **0** |
| Same kind two weeks running | **0** |
| Same kind two weeks apart | 11 (2%) |
| Different places featured | 296 |
| A place returning exactly 57 weeks later | **85 (16% of sends)** |
| A place returning inside a year | **5**, all 38 weeks apart |
| Year-round share of picks | Nov 98%, Mar 96%, Apr 100%, Jan 61%, Jul 41% |

Two of those deserve a plain sentence each:

- **One pick in six is a place that was featured 13 months earlier.** That is
  the price of having no memory. A week chooses among the few places whose slot
  it is, and sometimes the same one wins two turns in a row. It is inside the
  guarantee, and it is not what "567 places" would lead you to expect.
- **The five returns inside a year**: three are a year-round place picked through
  the 19-week floor (a week whose own candidates were all the wrong kind), and
  two are a short-season place featured late one season and early the next.
  Nineteen weeks is the hard floor; 38 is the closest any came.

## Decisions for Taren

Each of these is one constant at the top of the picker in `lib/places.ts`.

1. **How long before a place may return** — `PLACE_WHEEL_WEEKS = 57`.
   *Recommended: leave it.* Just over a year. Shorter (say 39) gives each week
   more to choose from and brings back the same place inside a year. Longer thins
   each week's candidates and sends more weeks to the 19-week floor. It must stay
   odd and a multiple of `PLACE_FLOOR_WEEKS`.
   The only way to get "never repeat until all 567 have had a turn" is to store
   what was actually sent — a small table the digest writes and both callers
   read. Not recommended now: it puts a database read on the email's path to buy
   a difference a subscriber is unlikely to notice.
2. **How seasonal** — every other week is an in-season place when one is in
   prime. Changing the share is a one-line edit to `inLane`.
3. **How much of a season counts** — `PLACE_SEASON_EDGE = 0.2` (the table
   above). `0.15` would put beaches on from about 24 May to 5 Sep.
4. **Not built: a cold-weather lean.** The registry marks disc golf, dog parks
   and playgrounds year-round, so the picker will feature one in February. It is
   true — they are open — and it may not be what you want in the email. If not,
   the fix is a rule that prefers indoor kinds December–March.

To hand-pick any week, set `PLACE_OF_WEEK_PIN` to a slug. That is unchanged.

## The next twelve Thursdays

As of this commit. Adding places can change a week's pick; it cannot make a
place repeat.

| Send | Place | |
|---|---|---|
| 8 Oct | Walker Art Center | Museum, Minneapolis |
| 15 Oct | Fun For All Playground | Playground, Shakopee |
| 22 Oct | Lookout Ridge (Woodbury Central Park) | Indoor Playground, Woodbury |
| 29 Oct | Lebanon Hills Regional Park | Park, Eagan |
| 5 Nov | American Swedish Institute | Museum, Minneapolis |
| 12 Nov | Garlough Park Disc Golf Course | Disc Golf Course, West St. Paul |
| 19 Nov | Madison's Place Playground | Playground, Woodbury |
| 26 Nov | Shakopee Ice Arena | Ice Rink, Shakopee |
| 3 Dec | Galloway Park Disc Golf Course | Disc Golf Course, Champlin |
| 10 Dec | Scott County Historical Society | Museum, Shakopee |
| 17 Dec | Boom Island Park | Park, Minneapolis |
| 24 Dec | Hyland Lake Park Reserve Sledding Hill | Sledding Hill, Bloomington |

None of these can collide with a recent send: the old picker never featured a
year-round place.

## Deploy

No schema change, no environment variable, no migration.

1. Merge this branch to `main` and push. Vercel builds and deploys on its own.
2. The Thursday digest runs from `main` in GitHub Actions, so the 8 Oct send
   picks it up with no further step.

**One thing to expect:** Admin → Content will show a different place the moment
this deploys, mid-week — Kenneth Rosland Park Disc Golf Course for the week that
began 1 Oct, where the old picker had something else. If this week's place card
has already gone to Instagram, ignore that panel until Thursday.

## Verify

- [ ] Vercel shows the deploy as Ready.
- [ ] Admin → Content, on or after Thu 8 Oct: "Place of the week" is **Walker
      Art Center**.
- [ ] The 8 Oct email's "Place of the week" block is Walker Art Center, linking
      to `/places/museum#walker-art-center`.
- [ ] 12 Nov and 19 Nov emails: two different places, neither of them Apple
      Valley Sports Arena or Great River Water Park.

## Rollback

Revert the commit and push. Nothing is stored, so there is nothing to undo. Or
leave the code and set `PLACE_OF_WEEK_PIN` for the week.

## Quality gate

- `npx tsc --noEmit` clean
- `npm test` — 2,352 passing (2,317 before this change: 6 old picker tests
  replaced by 41). The new file was checked by breaking each rule on purpose —
  no season trim, no wheel, kinds ignored, seasonal-always, one wheel for all,
  UTC weeks — and every break failed at least one test.
- `npm run build` clean
- `npm audit` — 0 vulnerabilities
- Smoked: the digest's HTML and text blocks and the Instagram caption rendered
  from the new pick for 5 Oct, 8 Oct, 5 Nov and 12 Nov. The admin page itself
  was not opened — it needs the database and a login this worktree doesn't have,
  and its code did not change.

## Found on the way, not changed

`northview-pool-south-st-paul` and `lorraine-splash-pool-south-st-paul` are
tagged outdoor but carry the April–October season instead of June–August. Under
the new rules Northview comes up on **9 Sep 2027**. It also makes the pools page
call them open in April. Their source page needs reading before the season is
changed, so it is flagged rather than guessed.
