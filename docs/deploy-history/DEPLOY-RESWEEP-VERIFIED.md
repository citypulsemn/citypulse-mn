# Deploy — the retroactive sweep over stamps made by the old prompt (5 Sep 2026)

## Why

Until earlier today, `buildVerifyPrompt` asked whether an event "still appears
as scheduled" against *its own source*, and `parseVerdicts` treated a missing
verdict field as `"confirmed"`. Between them, an event the agent never actually
found could come back confirmed — which is how a fabricated Damian Marley show
at The Fillmore carried a `verified_at` stamp two days before a reader caught it.

Every stamp the **agent** made under that prompt is a claim the site cannot
stand behind. This is the sweep that re-asks the question properly.

## Result

```
478  upcoming published listings carrying a verified_at stamp
448    from a primary source — left alone
 30    stamped by the agent — re-checked
 22      still confirmed under the new prompt
  8      stamp cleared
```

**Nothing was hidden and nothing was cancelled.** The most this job can conclude
is that we do not actually know — so it clears the stamp and stops there.
Verified after the run: `listings the sweep hid or cancelled: 0`.

The eight:

| verdict | listing |
|---|---|
| `wrong_event` | Surly Brewing Oktoberfest — Surly's own page puts SurlyFest on Sep 19 |
| `wrong_event` | Sunday Live Music at the Arboretum |
| `not_found` | Caponi Art Park Self-Guided Family Trails |
| `not_found` | Can Can Wonderland — Regular Open Play |
| `not_found` | Minnesota Zoo — Music in the Trees ×2 |
| `not_found` | Minnesota Zoo — Daily Family Visits |
| `not_found` | Como Park Zoo & Conservatory — Daily Visits |

A cleared stamp is honest, and it is also useful: `selectForVerification` sorts
never-verified first, so each of these goes to the front of the next scheduled
pass rather than waiting behind rows a source already vouched for.

## The attribution, which is the whole safety of this

Two very different things write `verified_at`: a **primary-source importer**
reading a league API or a venue's own calendar, and the **verify pass**, i.e. a
model. Only the second was affected. Getting the split wrong is expensive both
ways — leave false confidence in place, or throw away a feed's evidence and
replace it with a weaker agent opinion.

**The first version got it wrong.** It read `MUSEUM_SOURCES[].host` and
`FIRST_AVENUE_VENUES[].url`; neither field exists. Every museum source silently
contributed nothing, and the dry run was about to clear stamps on **15 Bell
Museum and Science Museum listings that a feed had made**. Caught by reading the
dry run rather than trusting the count.

The corrected version asks each source for its own URLs instead of guessing at a
field name, and reads `MUSEUM_SOURCES[].venues` (plural). Attribution went from
"114 suspect" to the true **30**.

That logic now lives in `lib/verify-attribution.ts` with tests, precisely
because it was got wrong once. A registry reshuffle now fails loudly.

## A second thing this surfaced

The Queue section of the ops digest — which today learned to show verify flags —
now reads:

```
## Queue ⚠️
- 18 listings the verify pass flagged, still live → /admin/events
-     wrong_event: "Surly Brewing Oktoberfest…" @ Surly Brewing Co. · Sep 10
-     wrong_event: "Sunday Live Music at the Arboretum" @ Minnesota Landscape Arboretum · Sep 06
-     moved: "Can Can Wonderland — Regular Operation" @ Can Can Wonderland · Sep 10
-     not_found: "TaikoArts Midwest: Edo Bayashi" @ Bryant-Lake Bowl & Theater · Sep 09
```

Ten of those eighteen are **older flags that had been invisible the whole time**
— a `sold_out` on TLC at the State Fair Grandstand, a `moved` on *Pinocchio* at
the Children's Theatre, `not_found` on two Armory shows. They were written to
`admin_audit` weeks ago and nothing ever read them.

## Running it again

```bash
npm run resweep-verified                 # dry run — decides nothing
npm run resweep-verified -- --apply --backup=path.json
```

It is safe to re-run: it only looks at rows that still carry a stamp, and rows
re-confirmed under the new prompt keep theirs. It is not scheduled — this was a
one-off for a specific bug, and the twice-weekly pass now does the ongoing work.

## Rollback

`admin_audit`, action `resweep_unverify` — one row per listing with the verdict
and the evidence. Restoring is `update events set verified_at = <old value>` for
those ids; the old values are in the backup written at run time and in the audit
rows. Recipe in `docs/ADMIN.md` under "Undoing a bulk change".

Restoring is unlikely to be what you want, though: the stamps said an event had
been verified when it had not been.

## Quality gate

`npx tsc --noEmit` clean · **1938/1938** tests (+11) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · dry run read in full before applying, backup
written, post-run check confirming zero listings hidden or cancelled.

## Not done

**Only upcoming published listings were swept.** Drafts and archived rows still
carry old stamps; they are not on the site, so they are not urgent, but a
`verified_at` on an archived row is still a claim.

**`REVALIDATE_SECRET` is still unset**, so the sweep could not bust the CDN.
Nothing user-visible changed here — a cleared stamp is not rendered — so the
cost is zero this time. It was not zero when the Marley listing was hidden.
