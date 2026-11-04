# Deploy — the registry knew the right page and nothing ever wrote it down

**4 November 2026.** Thirty live listings cited an aggregator while
`lib/venue-sources.ts` already held their room's own calendar. One registry URL
improved, two recorded as unusable for this purpose, four guard tests. Deploy is
a push; the data change is already applied.

## What the flag queue was actually telling us

Measured across the 24 open verify flags:

| | |
|---|---|
| cite an aggregator, reseller or roundup | **14** |
| cite an organiser index page shared by many listings | 1 |
| cite what looks like an organiser's own page | 9 |

Three of those nine are also aggregators that a first pass missed —
`happeningnext.com`, `thriftyminnesota.com`, `facebook.com` — so **17 of 24**
cite a page that cannot confirm the listing it is attached to. Against **17% of
the live calendar**. A row citing an aggregator is roughly four times more likely
to be flagged.

It shows up hardest in the verdicts that are *about* sourcing: `weak_source` 5 of
6, `moved` 6 of 8. And a `moved` note reads *"source shows 19:00"* — which is
songkick or a holiday listicle disagreeing with us, with no reason to assume the
listicle is right.

So the queue was not 24 listing problems. It was largely one citation problem.

## The gap

`canonicalSourceFor` is called in exactly two places:

- `lib/agents/prompts.ts:187` — hands the verify agent the room's own calendar
- `app/venues/[slug]/page.tsx:102` — shows official calendars to a reader

**Nothing writes it to `events.source_url`.** So the verify agent could confirm
an event against the right page while the stored citation — the thing
`check-sources` fetches every week, and the link a reader clicks — stayed the
aggregator the pipeline happened to find it on. `d453f16` put twenty rooms in the
registry on 5 Oct and `dff4f4f` surfaced them on venue pages on 29 Oct. The rows
were never repointed.

## The correction that curation does not cover

The registry's own header is explicit, and it is right:

> EVERY URL HERE WAS OPENED. … Armory answers a redirect loop to curl and loads
> in a browser … **A 200 was never the test — the test was whether the page lists
> that room's events.**

That standard fits the consumer it was built for: an agent with a browser.
**`events.source_url` needs more** — it is fetched by a plain weekly request. A
browser-only page in that column means the sweep reads nothing and the listing
can never be confirmed.

So this was not a table full of bad entries. It was a second use the curation
never promised to serve, and three of the six target calendars could not serve
it. Probed 4 Nov with a plain fetch:

| room | result | action |
|---|---|---|
| `fine line`, `first avenue`, `dakota jazz club` | 200, a real calendar path | **repointed** |
| `childrens theatre company` | root 200s but prints **no run dates** | **URL improved to `/calendar/`** |
| `armory` | every HTML path **307** (`/events/`, `/`, `/calendar/`, `/shows/`); only `robots.txt` and `sitemap.xml` answer | left; recorded |
| `chanhassen dinner theatres` | 200, but **no run dates** on any readable page | left; recorded |

Children's Theatre `/calendar/` prints what the homepage does not:
*"Twelve Kinds of Ice" — "October 13-November 22, 2026"* and *"Dr. Seuss's How The
Grinch Stole Christmas!" — "November 3, 2026-January 3, 2027"*.

The Armory one is on record elsewhere too: the 28 Oct Armory corrections moved
four citations **off** `armorymn.com/events/` onto each show's own page, for
exactly this reason. Without the live gate this repoint would have put three rows
straight back on it.

## BROWSER_ONLY_CALENDARS

The probe result is now code rather than a thing to rediscover:

```ts
export const BROWSER_ONLY_CALENDARS: ReadonlySet<string> = new Set([
  "armory",                      // every HTML path 307s behind a WAF
  "chanhassen dinner theatres",  // 200, but no run dates a fetch can see
]);
```

Anything repointing a citation at the registry consults this and skips them. Four
guard tests, mutation-proved in five directions:

| mutation | result |
|---|---|
| unmutated | GREEN |
| the Armory stops being marked browser-only | **RED** |
| Chanhassen stops being marked browser-only | **RED** |
| **a room the repoint DOES use gets marked browser-only** | **RED** |
| a browser-only key `roomKey` never generates | **RED** |
| Children's Theatre reverts to its homepage | **RED** |

The third matters most: a wrongly-marked room makes the repoint silently do
nothing, which is the failure mode that hides. The fourth is the same trap
`CONCURRENT_VENUES` had two of — a key `roomKey` cannot produce reads as coverage
and is dead weight.

## The data change, already applied

```
backed up 30 row(s) to backups/2026-11-04-citation-repoint-before.json
30 applied, 0 refused
↻ site caches cleared (+30 event page(s))

  15  first-avenue.com/venue/fine-line/
  10  first-avenue.com/venue/first-avenue/
   3  dakotacooks.com/events/
   2  childrenstheatre.org/calendar/
   3  skipped — armory in BROWSER_ONLY_CALENDARS
   2  skipped — chanhassen dinner theatres in BROWSER_ONLY_CALENDARS
```

Verified after applying:

```
30/30 now cite the intended calendar
30/30 have source_checked_at cleared — the next sweep reads the new page
27    carry a verified_at, unchanged — a citation change must never touch a stamp
 0    still cite an aggregator
calendar-wide: 92 → 62 published upcoming rows citing a non-authority
```

Each entry carries `id`, `why` and `source_url` only — **no `verified`, no
`evidence`**, deliberately. The URL comes from the registry, not from a page
anyone read for that event, so this asserts nothing about the listing. It does
reset `source_checked_at`, which is the point.

A live event page confirms the reader-facing shape: it cites first-avenue.com and
still offers the Ticketmaster **ticket** link, which is correct — you buy a seat
where seats are sold; the citation is what has to be able to prove the date.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **151 files, 3,032 tests** (3,029 → 3,032), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in five directions; every target calendar fetched live before the file was written

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. The data change is applied and the caches are cleared. Nothing else.

## Verify

```bash
npm run ops-digest -- --dry-run
```

Next Monday's Source check line will jump: 30 rows had `source_checked_at`
cleared, so they go to the front of the sweep queue (`stalestFirst`). That is
correct, not a regression — it is 30 listings becoming checkable for the first
time.

## Rollback

`git revert` for the registry change. For the data, the backup holds all 30 rows
as they were; re-applying it as a correction file restores the old citations. No
stamp was touched, so nothing needs re-verifying either way.

## Left open

- **62 rows still cite a non-authority** and have no registry entry. The
  concentrations are Target Center (18), US Bank Stadium (6), Williams Arena (6)
  and Ames Center (3) — four entries would cover about half of what remains, and
  the registry's own rule is to add a room when it reaches the top of that count.
- **The Armory needs per-show citations, not a calendar.** Its sitemap is served
  even though its HTML is not, which is how the 28 Oct repair found each show's
  own page. A sitemap-driven repoint is possible and is its own item.
- **Chanhassen may not belong in the table at all** for citation purposes — it
  passes the verify-agent standard and fails this one, which is exactly what
  `BROWSER_ONLY_CALENDARS` now records rather than resolves.
- A venue calendar is still an index. It proves the venue rather than pinning the
  event the way a per-show page would — the same trade `a024dad` made when it
  began handing the verify agent this page.
