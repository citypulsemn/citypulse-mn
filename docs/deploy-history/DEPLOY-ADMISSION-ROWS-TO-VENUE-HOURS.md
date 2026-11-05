# Deploy — eight "Daily General Admission" events archived, their hours moved to the venue pages

**Date:** 5 November 2026
**Data:** 8 rows archived (applied, backed up). **Code:** `lib/venue-hours.ts` (new),
`app/venues/[slug]/page.tsx`, `app/globals.css`, `lib/__tests__/venue-hours.test.ts` (new)
**Schema:** none.

Third in a sequence: [DEPLOY-ISUPCOMING-OVERCAP.md](DEPLOY-ISUPCOMING-OVERCAP.md) made long runs
visible again, [DEPLOY-DAY-ALSO-RUNNING-SHELF.md](DEPLOY-DAY-ALSO-RUNNING-SHELF.md) gave them a
home on day pages — and that shelf is what made this one urgent.

---

## What was wrong

The pipeline kept finding a venue's **opening hours** and filing them as an **event**:

> Como Park Zoo & Conservatory – Daily General Admission · 10 Oct – 10 Nov
> Minnesota Zoo – Daily General Admission (Fall Season) · 17 Oct – 17 Nov
> Nickelodeon Universe – Daily Indoor Theme Park · 24 Oct – 24 Nov

Nothing starts, nothing ends. A reader scanning a day for plans learns only that a zoo exists.

**This is a treadmill, not a one-off.** 32 rows of this shape exist; **24 had already been
archived** by earlier passes and 8 were live again, because the weekly sweep re-mints them
against a standing fact. Three different titles for the same Como fact — *Daily General
Admission*, *Daily Open Admission*, *Daily Zoo Visit* — is why the title-based fold never
caught them.

The new day-page shelf turned a tidy-up into a live quality problem. On 10 November:

| | before | after |
|---|---|---|
| shelf slots filled by admission rows | **4 of 6** | **0 of 6** |
| "also running" on `/day/2026-11-10` | 29 | **22** |
| published rows | 600 | **592** |
| admission-shaped published rows | 8 | **0** |

---

## Archive, not hide — and why that is the right lever

`archive` takes a row out of `getEvents`, so it leaves the day shelf, the venue page, the city
page and **sitemap.xml** (event URLs come from the published set). `getEvent` filters only
`status = 'draft'`, so the event page **still resolves** for anyone arriving on an old link,
rather than 404ing.

That fits what these rows are: **not false, just miscategorised.** The zoo really is open
10am–4pm daily. `hide` is for a listing that should never have existed; these describe a true
thing in the wrong shape. The lever is reversible with one `publish: true` apply from the
backup.

**Applied:** 8 of 8, 0 refused, caches cleared.
**Backup:** `C:\Users\mccul\Documents\CityPulseMN\backups\2026-11-05-admission-rows-before.json`
(4,064 bytes, 8 rows).

### The two consequences, both accepted and both honest

- **`/venues/minnesota-zoo` returns to zero upcoming events** — that row was its only one. It
  therefore drops back out of `sitemap.xml` and the `/venues` index moves it to "Also tracked"
  (30 → 29 of 47). Honest: the zoo has no dated events listed. The page is not left empty —
  see below.
- **`/cities/apple-valley` leaves the sitemap again** (19 → 18 city slugs). It had entered two
  hours earlier *solely* on the strength of that one admission row.

---

## Where the hours went

The fact was worth keeping; the row was not. `lib/venue-hours.ts` is a per-slug table in the
same shape as `VENUE_INTROS` and `VENUE_CALENDARS`, rendered on the venue page above the
events list — **with the provenance an event row never carried**: the venue's own URL and the
date a person read it.

Every line below was read from the venue's **own site** on 5 November 2026, not from the
aggregators the archived rows cited:

- **Como Park Zoo & Conservatory** — Zoo 10AM–4PM daily; Conservatory 10AM–4PM Tue–Sun,
  8 Sep 2026 – 30 Apr 2027; Conservatory to 6PM on select Mondays **except** 5 Oct, 9 Nov,
  21 Dec 2026 and 22 Feb 2027; 1 May – Labor Day 10AM–6PM. Free, with a voluntary $8 adult /
  $5 child donation. *Those Monday exceptions are exactly the detail an event row flattened.*
- **Minnesota Zoo** — 10am–4pm, members from 9am, **online tickets required**. Full admission
  table and $10 parking.
- **Nickelodeon Universe** — Mon–Sat 10 a.m.–9 p.m., **Sunday 11 a.m.–7 p.m.** (the one that
  catches people out). Wristbands from $41.99 + tax.

### Two things deliberately not done

- **No price for Nickelodeon beyond the hedged one.** Their own pages disagree — the visit page
  says wristbands "Starting at $41.99 + tax", the opening page says $44.99 regular, and
  `tix.mallofamerica.com` shows $52.49. The page quotes the page it cites and links out rather
  than picking a winner.
- **SEA LIFE Minnesota Aquarium has nowhere to put its hours.** It is **not in the venue
  registry** (`matchVenueSlug` returns null), so it has no venue page. Its two rows were
  archived without the compensating move the other three venues got — a real if small loss,
  recorded rather than papered over. Its own site prints only "Opening times today", a
  day-specific value, so even with a page there is no standing schedule to copy. Adding it to
  the registry is a separate decision, because that registry also drives the weekly sweep.

---

## Verification

### Mutation — the guards were checked by breaking them

| mutation | test that failed |
|---|---|
| source swapped to `familyfuntwincities.com` | the aggregator guard |
| a key pointing at no venue page | the slug guard (+2 content tests) |
| Nickelodeon loses its Sunday line | the Sunday-difference test |
| `readOn` backdated to 2025 | the read-date guard |

The aggregator guard is the one that matters: two of the eight archived rows cited
`playtimecompass.com` and `mallofamerica.com/entertainment/events`. A test now makes that
mistake impossible to repeat in this table.

### Observed on the running site

- `/venues/minnesota-zoo` — **the whole point.** Hours box renders, then *"Nothing on the
  calendar here right now."* Zero events, honestly stated, page still useful. No console errors.
- `/venues/como-park-zoo-and-conservatory` — hours (all four lines, Monday exceptions intact)
  + 17 events
- `/venues/nickelodeon-universe` — hours + 7 events
- `/venues/first-avenue` — **no hours box at all.** 44 venues have no entry and render nothing;
  an empty "Hours: see website" would be the placeholder rule 6 forbids.
- `/day/2026-11-10` — "6 events · 22 also running", **0 admission rows in the shelf**

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,132 passed in 152 files** (3,121 + 11 new) |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |
| correction apply | 8 applied, 0 refused, backed up, caches cleared |

---

## Deploy

**The data half is already live** — the archive was applied to production and caches were
purged. The code half ships with the rest:

```bash
git add lib/venue-hours.ts "app/venues/[slug]/page.tsx" app/globals.css lib/__tests__/venue-hours.test.ts corrections-admission-rows.json docs/deploy-history/DEPLOY-ADMISSION-ROWS-TO-VENUE-HOURS.md
git commit -m "fix — opening hours were being listed as month-long events"
git push
```

### Verify after deploy

1. `https://citypulsemn.com/venues/minnesota-zoo` — hours box present, no events, honest empty line
2. `https://citypulsemn.com/venues/como-park-zoo-and-conservatory` — four hours lines including
   the Monday exceptions
3. `https://citypulsemn.com/venues/first-avenue` — **no** hours box
4. `https://citypulsemn.com/day/2026-11-10` — no "General Admission" anywhere on the page
5. `https://citypulsemn.com/sitemap.xml` — `/venues/minnesota-zoo` and `/cities/apple-valley`
   are **gone**; that is correct

## Rollback

Two independent halves.

- **Data:** re-publish from the backup with a `publish: true` correction per id. `publish`
  requires `evidence`, which the backup rows carry.
- **Code:** `git revert`. The hours table is additive and the venue page renders nothing
  without it.

---

## Left open

- **THE TREADMILL IS NOT FIXED.** Nothing stops Monday's sweep minting a ninth admission row.
  24 were archived before these 8. The durable fix is a pipeline-side reject for listings whose
  title matches this shape and whose "run" is just a window — or a reclassifier rule. Until
  then this needs re-running every few weeks, and the day shelf makes each new one visible fast.
- **Duplicates now dominate the shelf.** With the admission rows gone, `/day/2026-11-20` shows
  *Twelve Kinds of Ice* **three times** in six slots, plus two *Olalekan Jeyifous* rows. Three
  excess rows across two productions. That is the next thing a reader will notice.
- **SEA LIFE has no venue page** — see above.
- **No `openingHoursSpecification` in the venue Place JSON-LD.** The hours are now structured
  enough to emit it; generating it from free-text lines is the work, and getting it wrong is
  worse than omitting it.
- **A fourth wrong-year trap on Como's domain**, found while sourcing hours:
  `comozooconservatory.org/visit/` says the Fall Show "ends this Sunday, November 26th" —
  but 26 November 2026 is a Thursday. The 29 November date this project published stands
  (it *is* a Sunday). Organiser domains keep stale pages live; require a year printed adjacent.
