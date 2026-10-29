# Deploy — one room is one venue, and a duplicate now wakes somebody up

**29 Oct 2026.** Four data entries, one lookup line, three print lines, eight
tests, two doc corrections. No schema change, no data change, no re-key, no
`event_key` moves. Deploy is a push.

## What I set out to fix, and what the measurement said instead

The premise I wrote down yesterday was: five venue spellings on one identical
pin produced five published cards for a two-performance recital, so fold the
aliases. **That was wrong in its most important part.** Measured:

- **Four of the five Ehnes rows already shared one `roomKey`.** Venue identity
  was never what kept them apart — the titles were. Trigram similarity across
  the three Nov 10 rows is 0.015–0.256 against a 0.6 dedupe gate and a 0.4
  admin-tab gate.
- Site-wide, **9 excess published rows** exist across 8 duplicate clusters;
  only **2** are reachable solely by folding venue spellings. Four sit in
  clusters whose two rows carry *byte-identical* venue strings.
- **A pin-only fold would wrongly merge 24 real published pairs to catch 6**,
  and 22 of those 24 are one building: First Avenue's mainroom against the 7th
  St Entry. The pin fails in both directions — 196 of 868 pins carry 2+
  addresses, 181 of 1,010 `roomKey`s sit on 2+ pins.

So the thing I chipped as "fold venue aliases" is a four-entry data change, not
a venues table, and the pin idea I was leaning toward is measurably destructive.

*(Numbers in this section come from the measurement fan-out. The ones I
reproduced myself with my own queries are marked **[mine]** below.)*

## What shipped

### 1. `ROOM_ALIASES` — four entries, one line, in `lib/contradictions.ts`

`roomKey` already folded `"Turf Club (St Paul)"` into `"Turf Club"` by stripping
a *city* parenthetical. It did not fold a building name restated in front of a
room name. Four entries, keyed on `roomKey` output:

```
ordway center for the performing arts concert hall  → ordway concert hall
ordway center for the performing arts music theater → ordway music theater
ordway music theater at ordway center for the performing arts → ordway music theater
ordway music theatre                                → ordway music theater
```

**[mine]** All eight Ordway spellings in the table, with the row counts and the
`roomKey` each produces, read straight from production:

| spelling | rows | live | → roomKey |
|---|---|---|---|
| Ordway Concert Hall | 59 | 10 | ordway concert hall |
| Ordway Music Theater | 31 | 3 | ordway music theater |
| Ordway Concert Hall (St Paul) | 22 | 5 | ordway concert hall |
| Ordway Center for the Performing Arts – Concert Hall | 5 | 2 | **folded** |
| Ordway Center for the Performing Arts – Music Theater | 5 | 2 | **folded** |
| Ordway Center for the Performing Arts | 4 | 2 | *left alone* |
| Ordway Music Theater at Ordway Center for the Performing Arts | 1 | 0 | **folded** |
| Ordway Music Theatre | 1 | 1 | **folded** |

**Attested, not inferred.** ordway.org's own events index prints the venue line
for each show as `Ordway Concert Hall` or `Ordway Music Theater` and
distinguishes the two room by room — 9 occurrences of the first and 2 of the
second on one page **[mine]**. The long forms are an agent restating building +
room, not a third and fourth hall. That matters because folding on "same pin"
would have been the tempting shortcut, and a venue-truth claim inferred from
coordinates is the reasoning this project already distrusts.

**The bare building spelling is deliberately NOT in the map.** It names no room
— and it is an exact key in `CONCURRENT_VENUES`, mapping to *"Music Theater plus
Concert Hall"* **[mine]**. Folding either hall into it would route the building
into the concurrent-venue suppression and **silence every finding at the
Ordway** instead of surfacing them. That is the sharpest line in this change.

**Why `roomKey` and not `VENUE_ALIASES`.** `VENUE_ALIASES` feeds
`canonicalizeVenue`, which feeds `computeEventKey`, which is stored on every row
and unique repo-wide. Putting these four there re-keys 12 Ordway rows, and 7 of
the new keys already belong to another row — so the correction path would refuse
them. The Xcel Energy Center → Grand Casino Arena fold came out clean only
because it shipped with a hand re-key of all 36 live rows in the same session.
`roomKey` touches no key: **0 of 5,084 `event_key`s move**, pinned by a test
with fixtured hashes for all eight spellings.

### 2. A duplicate now alerts, and gets named

The Self-check section printed `"3 probable duplicates"` and raised no flag, on
a stated rule: *duplicates are untidy rather than untrue.* **That rule was
wrong, and this is the more valuable half of this session.**

While **both** rows of a duplicate pair are live, each blocks the other's weekly
re-find. `withoutLiveDuplicates` excludes an incoming row from comparison with
*itself* by `event_key` — the code says so — but not with its twin, and
`findIncomingDuplicates` then refuses the arrival. `findContradictions` skips
such a pair outright (`// both live (the panel's problem)`), so the digest is the
*only* instrument that ever reports it, and it was the quietest line in the
email.

**[mine]** Simulating every live row's own re-find through the gate's own
function: **2 live rows are in that state right now** — "Securian Financial Free
First Sunday" and "Minnesota Children's Museum First Free Sunday", both 1 Nov
09:00, same venue string. Their `last_seen_at` shows it: 19 and 26 October, one
losing each run. A frozen row cannot receive a cancellation or a time change.
That is untrue, not untidy.

So: `alert = true` when duplicates > 0, and `dupExamples` carries up to five
formatted lines, mirroring what conflicts already do.

### 3. Two doc corrections

`docs/SELF-CHECK.md` claimed venue fragmentation *"is now reported directly as
`venueSpellings`"*. False twice over: `lib/ops-inputs.ts` drops the field so it
reaches no email and no panel, and because it groups **by** `roomKey` it can
only list spellings that *already* fold. **[mine]** Post-fold it names 9 rooms
and every one is a room where folding is working correctly — so wiring it up
would have shipped a noise generator. Corrected to say what it does, with the
measured reason a drift detector would need a different key and why the pin is
unfit for it.

## The live effect, measured before and after

**[mine]** `findContradictions` over the 688 live upcoming rows, same query the
self-check uses:

| | before | after |
|---|---|---|
| duplicates | 1 | **3** |
| conflicts | 13 | 14 |
| skipped | 11 | 11 |

Nothing was lost. The two new duplicates:

- **Nov 10, Ordway Concert Hall** — "Schubert Club Presents (Concert)" vs
  "Schubert Club International Artist Series: James Ehnes, Violin". The triple
  from yesterday's session.
- **Nov 15, Ordway Concert Hall** — "Gaelynn Lea Presents" vs "Gaelynn Lea: It
  Wasn't Meant to Be Perfect – An Evening with Gaelynn Lea and Friends".
  **This one was in no list anywhere, and it is live on the site.**

And the real email, from `npm run ops-digest -- --dry-run` **[mine]**:

```
## Self-check ⚠️
- 9 clashes — one room, one time, two different events
-     2026-11-10 · Ordway Concert Hall (both 19:30): "Schubert Club Presents (Concert)" / "James Ehnes, violin…"
-     2026-11-11 · Ordway Concert Hall (St Paul) (both 10:30): "James Ehnes, violin & Andrew…" / "James Ehnes, violin — Schubert…"
- 3 probable duplicates — same event listed twice, and while both are live neither can be updated
-     2026-11-01 · Minnesota Children's Museum (both 09:00): "Securian Financial Free First Sunday" / "Minnesota Children's Museum First Free Sund…"
-     2026-11-10 · Ordway Concert Hall (both 19:30): "Schubert Club Presents (Concert)" / "Schubert Club International Artist Series: …"
-     2026-11-15 · Ordway Center for the Performing Arts – Concert Hall (both 19:30): "Gaelynn Lea Presents" / "Gaelynn Lea: It Wasn't…"
```

**Sequencing note.** `corrections-ehnes-dedupe.json` from yesterday is still
unapplied and archives two of the rows in that Nov 10 duplicate. Apply it and
this fold's remaining live finding is the Gaelynn Lea pair — one, not two. The
fold is then mostly prevention for the next time a feed restates a building
name, which it will.

## What I deliberately did NOT build

A second list on `/admin/duplicates`, fed by `findContradictions().duplicates`,
was the most attractive idea in the design round — the admin tab is the one
surface with a drain record, and it ends at a button on a phone rather than a
line in an email. It is not in this change, because reviewing it found three
things that make it unsafe as described:

- **The destructive button would point at an arbitrary row.** A `Finding`'s
  `a`/`b` order is by start time; every one of these pairs is 0 minutes apart,
  so the tie falls through to the row order of a query with **no `ORDER BY`**.
  The existing tab has a real survivorship rule (earliest `created_at` keeps)
  and the reused markup puts the single Archive form on the `b` side.
- **The bucket is four hours wide, not one minute.** `looksLikeSameEvent`
  matches by title containment without `sameStart`, and findings pair anything
  inside `CLASH_WINDOW_MINUTES = 240`. A list headed "same room, same minute" is
  the entire explanation a phone user gets before tapping.
- **`CONCURRENT_VENUES` gives that surface no cover** — it skips conflicts only,
  deliberately. The one hand-curated list of venues that genuinely run several
  things at once would not protect the button.
- `Finding` also carries no per-side venue and no similarity score, so "show
  both spellings" needs a change to a type shared with the live write gate. Not
  "~25 lines, no new SQL".

It is a good idea that needs its own session and a keeper rule. The email now
names the pairs, which is what was missing.

## Deploy

```bash
git push origin HEAD:main
```

That is all. No data step, no backup needed, nothing to run. The fold changes
comparison identity only; no stored value moves.

## Verify

```bash
npm run ops-digest -- --dry-run
```

The Self-check section should carry **⚠️**, read `3 probable duplicates — same
event listed twice, and while both are live neither can be updated`, and name
the Minnesota Children's Museum, Schubert Club and Gaelynn Lea pairs. Then the
gate: `npx tsc --noEmit`, `npm test`, `npm run build`, `npm audit` → 0.

On the phone, `/admin/ops` should show the same three named duplicates.

Also confirmed **[mine]**: none of the four folded-from `roomKey`s has a
`venue_coords` row, and both folded-to keys do, on the same pin
(44.944597, -93.09804). So nothing is orphaned and no table write is needed —
`roomPin` falls back to geocoding on a miss anyway.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Delete the four map entries and the Ordway halls split again; nothing in the
database remembers the fold. Reverting also returns the duplicates line to
silence, which is the part you would not want back.

## What this does not fix

- **Seven of the nine excess published rows.** The dominant cause is not venue
  identity. The series guard in `findContradictions` early-returns before the
  venue-token strip, so it reads the venue name as *evidence of difference*: a
  shared `"james ehnes violin"` prefix kills the Nov 11 pair, which is reported
  as a **conflict** — "two different events in one room", the opposite diagnosis
  of the truth. Hoisting that strip is about two lines and is the highest-recall
  fix available, but it loosens the one function that gates every write, and it
  is measured wrong in both directions (it would authorise merging a Gophers
  men's and women's hockey game). Own session, own measurement.
- **The display half.** The fold changes identity, not the stored string, and
  `lib/upsert.ts` re-asserts `venue = excluded.venue` on every re-find — which
  is why 8 published rows still read "Xcel Energy Center" a month after that
  rename. "One room is one venue" is two problems and this ships the keying half.
- **A finding's venue label is whichever row Postgres returns first** — the
  self-check query has no `ORDER BY` and a finding is labelled `list[0].venue`.
  Cosmetic (the Gaelynn Lea line above shows the long spelling), but it is why
  a room with three spellings can print any of them.
- **No detector for unfolded drift.** `venueSpellings` cannot see it by
  construction, and the pin is measured unfit to key one. The 47 further merge
  clusters, the suburb-parenthetical rule (2,708 row-pairs but zero measured
  payoff against the nine live duplicates) and 251 subset pairs no string rule
  can decide are all parked.
