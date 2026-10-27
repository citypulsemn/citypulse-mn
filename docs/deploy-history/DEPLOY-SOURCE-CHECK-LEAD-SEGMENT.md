# Deploy — the source check stops accusing listings the page plainly names

**27 Oct 2026.** Code only. No schema, no secrets, no migration.

## What shipped

The first source-check sweep after the four-week outage produced **four flags
against 475 present listings, and three of them were false**. All three for one
reason: `scoreEntry` divides by *our* token count, so our titles carry the tour
name and the venue's calendar lists the act.

```
SOMBR: You Are The Reason Tour                 line on the page: "SOMBR"                0.333
KATSEYE: THE WILDWORLD TOUR                    line on the page: "KATSEYE"              0.333
Motionless In White: The Sweat and Blood Tour   line on the page: "Motionless In White"  0.400
```

Each of those acts is printed verbatim on `targetcenter.com/events/all`, the page
the listing cites. Applying would have withdrawn `verified_at` from three correct
listings and put three correct listings in Monday's flag queue.

- `lib/source-presence.ts` — new exported `leadSegment(title)`, and a last gate
  before `absent`: if the title's head (the part before a `:` or a spaced dash)
  scores at the present bar on an entry **within three entries of a line
  carrying the listing's own date**, the verdict becomes `unchecked`.
- `lib/source-trust.ts` — `tourstoyou.org` added to `AGGREGATOR_HOSTS`.
- `lib/__tests__/source-presence.test.ts` — 14 new tests (178 in the file).
- `docs/SOURCE-CHECK.md` — the gate, and the two fixes that were rejected.

## Why it is built this way

**Not by moving the threshold.** The genuine catch — "Prairie Bathing Under a
Harvest Moon" — scores **0.25**. `presentAt` is 0.6. Every point of slack given
to `presentAt` comes off the only margin that makes this check work, and it would
have taken 0.4 to clear these three.

**Not by scoring the page line against the title.** This is the obvious
symmetric fix and it was measured and rejected on two counts:

- `Minnesota Twins vs Detroit Tigers` is half contained in `Minnesota Twins vs
  Chicago White Sox`, so a game genuinely missing from a schedule page would be
  cleared by a different game on it.
- It cleared the fourth flag for the wrong reason — the line it matched was
  `BOOP! The Musical`, a coincidence on the word "musical".

**The date adjacency is load-bearing, not a refinement.** A bare lead match is
worse than no gate: an index page prints its own series name at the top, so
`Music on the Mall` is the lead of every listing in `Music on the Mall: …`, and
every night of a real series becomes unconvictable. Inventing the next night of a
real series is one of the three fabrication shapes this project has shipped. Both
holes have a test.

**The gate abstains, it never confirms.** A lead match returns `unchecked`, never
`present`, because an act being on the calendar does not attest that *this* show
is. The gate can only withdraw an accusation — it is unreachable for the 475
`present` and 177 `unchecked` rows, which is what bounds the blast radius to the
four flags without a second 400-fetch sweep.

## Deploy

```bash
git push origin HEAD:main
```

Vercel auto-deploys. Nothing to run, nothing to set. The gate takes effect on the
next weekly run — Monday 06:00 UTC, or a manual dispatch of **Weekly Event
Research**.

## Verify

Both of these are read-only and write nothing.

```bash
npm run check-sources -- --host=targetcenter.com
```

Expect `present 1 · NOT ON SOURCE 0 · unchecked 3` (it was `NOT ON SOURCE 3`).

```bash
npm run check-sources -- --host=tourstoyou.org
```

Expect `NOT ON SOURCE 1` — unchanged, and see below.

Gate: `npx tsc --noEmit` clean · `npm test` 9,805 green across 552 files ·
`npm run build` clean · `npm audit` 0 vulnerabilities.

## The one flag that stands, and it is a real finding

`The Unauthorized Hallmark(ish) Parody Musical` is **still flagged, and the
listing is correct.** Pantages Theatre, 14 Dec 19:30 — confirmed by Hennepin
Arts' own press release and event page, which scores 1.0.

The defect is the citation. It cites
`tourstoyou.org/resources/venues/hennepin-arts/`, a touring-Broadway roundup
whose Hennepin Arts page lists this show beside archived runs from 2020, 2021 and
2022. The title has no lead segment to strip and shares only `Hallmark(ish)` with
the page, which is not enough to withdraw a negative without conceding real
catches.

The repair is one field on one row:

```
source_url → https://hennepinarts.org/events/the-unauthorized-hallmark-ish-parody-musical-2026
```

That page scores `present` 1.0, so the flag goes away honestly. `npm run correct`
has no `source_url` field yet — about ten lines in `lib/corrections.ts` and
`scripts/apply-correction.ts`, and `source_url` is not in `VERIFY_RELEVANT`, so
the stamp is untouched by design. **Not shipped here; it is a separate item.**

Until it is done, Monday will flag that one listing and clear its stamp. The flag
is self-clearing and costs one glance, which is the designed cost of a wrong
accusation — but it is a wrong accusation and it is known.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Nothing to undo in the database: this deploy writes nothing and the dry runs
above write nothing. Reverting returns the sweep to flagging all four.
