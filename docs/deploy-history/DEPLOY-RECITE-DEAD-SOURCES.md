# Deploy — re-citing eight dead sources, and the four that turned out not to be real

**28 Oct 2026.** One line of library code, one test, one data file for an
operator to apply. No schema change.

## What this was meant to be

A tidy-up. Eight live listings cited a page that no longer answers:

| listings | cited page | what it does now |
|---|---|---|
| 4 | `armorymn.com/events/` | 307, every path, to any script |
| 3 | `womenspress.com/event/toddler-music-lab-…/2026-11-03/` | 404 |
| 1 | `womenspress.com/organizer/minnesota-childrens-museum/` | 404 |

Half of it was a tidy-up. The other half was four fabrications, two of them
stamped verified, one of them today.

## The Armory four — citations repaired

`armorymn.com` is **not a dead link and not a redirect loop.** It is a Sucuri
WAF serving a JavaScript cookie challenge: a 307 whose body is
`<noscript>Javascript is required</noscript>` and an obfuscated script. The
site's own `robots.txt` answers 200 through the same WAF, says
`User-agent: *` / `Disallow:` — allow everything — and advertises a sitemap.
So this is the `minnesotaorchestra.org` / `guthrietheater.org` shape: a
published policy of yes and an edge rule of no.

**The sitemap is readable.** `post-sitemap.xml` came back 200 and listed 22
`/events/<slug>/` URLs, including one for each of our four shows. Opened each
in a browser, which the challenge admits:

| listing | our start | the venue's own page |
|---|---|---|
| Ganja White Night – Wobbleween (Night 1) | 30 Oct 2026, **21:00** | "Friday, October 30, 2026 · Doors at 6:00 // **Show at 6:15**" |
| Orville Peck (with Abbie Callahan) | 3 Nov 2026, 20:00 | "Tuesday, November 3, 2026 · Show at 8:00" ✓ |
| Jack White Live 2026 | 8 Nov 2026, 20:30 | "Sunday, November 8, 2026 · Show at 8:30" ✓ |
| Sabaton (with Pop Evil and Wings of Steel) | 22 Nov 2026, 19:00 | "Sunday, November, 22nd · Show at 7:00pm" ✓ |

Four dates confirmed, three start times matching the venue's **show** time
exactly — which is what establishes the convention, and what makes the fourth
a finding rather than a quibble. **Wobbleween Night 1 is listed at 21:00
against a 6:15 show**, two days out. Left alone: it is a time on a real show
on the right night, and a 2¾-hour move is a product call, not a citation
repair. The one-line addition is in the Verify section below.

Re-citing them from the shared index to each show's own page buys a reader the
exact page instead of a venue index, and buys the weekly sweep nothing — the
event pages carry the same 307. Said plainly rather than implied: after this
lands, those four rows will record `blocked:307` where they currently record
nothing at all, which is an honest note replacing a silence.

## The Women's Press four — not re-citable, because they are last year's

The 404 was the symptom. Going to the organiser instead:

| our listing | the museum's own page |
|---|---|
| Bounce & Boogie, **28 Oct 2026** 10:30 | "October 28, **2025** 10:30 am - 11:30 am" |
| Echo & Explore, **3 Nov 2026** 10:30 | 7 Oct **2025** and 4 Nov **2025** |
| Splish Splash, **18 Nov 2026** 10:30 | "November 18, **2025**" |
| Bounce & Boogie, **25 Nov 2026** 10:30 | "November 25, **2025**" |

Same month, same day, same 10:30 start, one year earlier. 28 Oct 2025 was a
Tuesday; 28 Oct 2026 is a Wednesday. The museum ran a four-week Tuesday
series — its own page says "join us for the entire 4-week series" — in autumn
**2025**.

Three checks, because a stale organiser page would look the same:

1. **The museum's event pages are current.** 46 of its 331 event URLs were
   modified in 2026, and the 2026 ones carry 2026 dates: Monster Yoga
   17 Oct 2026, Halloween Party 24 Oct 2026, New Year Party 30 Dec 2026.
   Every Toddler Music Lab page was last touched in 2025.
2. **Its rendered calendar is empty on those days.** The calendar is
   JavaScript, so it was opened in a browser. October 2026 holds Securian Free
   First Sunday, three Monster Yogas and two Halloween Parties — nothing on the
   28th. November 2026 holds Securian Free First Sunday on the 1st and nothing
   else at all.
3. **The series is eight rows, not four, and the first four are already
   archived** — 7, 14, 17 and 21 October, every one of them stamped verified.
   Those are the 2025 series' Tuesdays, archived as their dates passed. The
   same eight-row shape, from the same source, confirmed six times by the
   verify pass.

So these four are archived, not re-cited. Archiving is the house remedy;
nothing is deleted and one `status` flip reverses it.

## The one-line fix, which is for the category

`womenspress.com` is now in `AGGREGATOR_HOSTS` (`lib/source-trust.ts`). A
monthly magazine running a community calendar is a roundup however local it is
— the rule the file already states for a tourism board and a radio station.

What that changes, for future finds and for the rows already here:

- `statusForNewEvent` holds a womenspress-sourced find as **draft**, so it
  never reaches a reader unverified. Had this line existed, all eight would
  have been drafts.
- `verify.ts` sorts roundup-sourced rows to the **front** of the verify queue
  and tells the agent its source is a roundup.
- `validateCorrection` refuses a correction that re-cites *to* womenspress.

Nothing hides or re-labels an existing published row at render time — every
consumer was checked. The two surviving womenspress rows (May 2026 museum
exhibits, both in the past, both unverified) are untouched.

`lib/__tests__/source-trust.test.ts` pins it, with the incident in the
comment. Proven to bite by commenting the host out: 1 failed, 64 passed.

## What this does not fix

The hole that let it through is `pageCoversDate` matching **month and day
only** — documented in `docs/SOURCE-CHECK.md` as the largest known hole in the
source check. This is its first measured live instance: a year-shifted listing
on a day the source really covers, confirmed. Closing it properly means
establishing a page's season span, which is a design decision and not this
deploy.

The second hole is the verify pass, which stamped six of these eight. That is
the weakness recorded on 10 Sep 2026 when a reader caught a fabrication the
verify pass had confirmed, and it is still open.

## Deploy

**Step 1 — push the code.** Vercel auto-deploys. No schema change, no
behaviour change for any current page.

```bash
git push origin HEAD:main
```

**Step 2 — apply the eight corrections.** `corrections.json` sits in the repo
root, is not committed, and was written by this session. Read it first; it
carries a `why` for each row.

```bash
npm run correct -- --from=corrections.json
```

That is the dry run, and it reads only. It prints four `± EDIT` plans and four
`✗ ARCHIVE` plans, `0 refused`. Then:

```bash
npm run correct -- --from=corrections.json --apply --backup=before-recite.json
```

Keep `before-recite.json` — it is the rollback.

**Step 3 — delete `corrections.json`** once applied. It is a working file.

## Verify

After the apply:

```bash
npm run check-sources -- --host=armorymn.com
```

Expect four listings at four distinct URLs instead of four sharing one, and
`blocked:307` recorded against each — the honest note, not a confirmation.

The four archived rows should be gone from the calendar and from
`/events/<slug>` on the live site. 28 Oct's is the one to check first: it is
today.

**Optional, the Wobbleween time** — a product call, not part of this. If you
want our start to match the venue's show time, replace that id's entry in
`corrections.json` before applying:

```json
{
  "id": "d13a2f7f-7ade-484f-858d-913e6b26cc9f",
  "why": "listed at 21:00; the venue's own page says doors 6:00, show 6:15, and our other three Armory listings carry the venue's show time",
  "evidence": "https://armorymn.com/events/wobbleween-night-1/",
  "source_url": "https://armorymn.com/events/wobbleween-night-1/",
  "start": "2026-10-30T18:15",
  "verified": true
}
```

`verified: true` is legitimate here and only here: the evidence *is* the
organiser's own page showing exactly that value.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

For the data, `before-recite.json` holds every prior value. The four archived
rows come back with one `status` update each; nothing was deleted.
