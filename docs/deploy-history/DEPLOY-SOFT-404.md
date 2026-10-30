# Deploy — a page that isn't there now says so

**30 Oct 2026.** Five files deleted, one test replaced, six comments corrected.
No schema change, no data change, no new secret, no new dependency. Deploy is a
push.

Four routes answered **HTTP 200** for a URL that cannot exist. They rendered the
right "We couldn't find that" page — they just told every crawler, link checker
and cache that the page was fine.

| route | a URL that cannot exist | before | after |
|---|---|---|---|
| `/event/[id]` | an unused UUID | 200 | **404** |
| `/venues/[slug]` | `zzz-not-real` | 200 | **404** |
| `/collections/[slug]` | `zzz-not-real` | 200 | **404** |
| `/day/[date]` | `not-a-date`, `2026-13-45` | 200 | **404** |

## The cause, and the one that looked right but wasn't

A **`loading.tsx` wraps its segment — and every segment under it — in a React
`<Suspense>` boundary.** Next resolves the shell with that fallback and flushes
the response, status 200, *before* the page component has finished. `notFound()`
runs after the headers are already gone. The page still swaps in the not-found
UI, which is why it looks right; only the status code gives it away.

The first theory was that the broken routes were the ISR ones. **That was a
correlation, and it was wrong.** The discriminator is `loading.tsx` alone:

| route | build marker | `loading.tsx` in scope | status |
|---|---|---|---|
| `/event/[id]` | ƒ dynamic | yes | 200 |
| `/day/[date]` | ƒ dynamic | yes | 200 |
| `/venues/[slug]` | ƒ dynamic | yes, on the **parent** | 200 |
| `/collections/[slug]` | ● static | yes, on the **parent** | 200 |
| `/cities/[slug]` | ƒ dynamic | no | 404 |
| `/neighborhoods/[slug]` | ƒ dynamic | no | 404 |
| `/places/[kind]/[slug]` | ● static | no | 404 |

A dynamic route answers correctly and a static one answers wrongly, so static
versus dynamic cannot be it. Eight for eight on `loading.tsx`, and then proved
rather than inferred: with the four files moved aside and the site rebuilt, all
four flipped to 404 on a production build against the real database.

Note the two **parent-segment** rows. `app/venues/loading.tsx` was written for
the `/venues` index and silently covered `/venues/[slug]` too. That is also how
`/collections/[slug]` was broken without anyone touching it — and why it was
missing from the original report.

## What shipped

| file | change |
|---|---|
| `app/event/[id]/loading.tsx` | deleted |
| `app/day/[date]/loading.tsx` | deleted |
| `app/venues/loading.tsx` | deleted |
| `app/collections/loading.tsx` | deleted |
| `components/Skeletons.tsx` | deleted — those four files were its only callers |
| `lib/__tests__/app-shell.test.ts` | the four tests that **required** those files, replaced by one that forbids them |

`app/globals.css` is untouched: `.skel` is still worn by `/admin/growth`,
`/admin/ops` and `EventsExplorer`.

### The tripwire

The old test pinned the four files into place. The new one walks `app/` and
asserts there is no `loading.tsx` anywhere, with the measurement in the comment
so the next person reads why before deleting the test:

```ts
expect(walk(join(ROOT, "app"))).toEqual([]);
```

`toEqual([])` names the offending path when it fails, which a `toBe(false)`
would not. It also subsumes the older "NO root loading.tsx" tripwire — that
existed because a root one stuck over the homepage's client explorer (UX2). Same
file, a second and worse failure, so the rule is now simply: none.

## Two things this is NOT

**It is not a de-indexing fix, and Search Console may barely move.** The soft
404 was *already* sending `<meta name="robots" content="noindex">` — Next injects
it whenever `notFound()` runs, status code or no. I said in
[DEPLOY-VERIFY-YEAR-GATE.md](DEPLOY-VERIFY-YEAR-GATE.md) that the 200 "lets a
search engine keep a dead URL indexed". That was wrong and is corrected there.

The one place it was more than cosmetic, measured on live production rather than
assumed — the count of `robots` metas, and whether they sit before `</head>`:

| route | before | after |
|---|---|---|
| `/event/[id]` | 1, **in the body** | 2, one in the head |
| `/venues/[slug]` | 1, in the head | 2, one in the head |
| `/collections/[slug]` | 1, in the head | 2, both in the head |
| `/day/<malformed>` | 1, in the head | 2, one in the head |

So three of the four were already signalling correctly and only the status code
was wrong. **`/event/[id]` was the exception** — its `notFound()` waits on a
database round-trip, so the shell flushed first and the directive could only be
injected after `</head>`, where a crawler is not obliged to read it. That is the
route a taken-down fabrication lives on, so the narrow win lands in the right
place. Everything else this buys is an honest status code for crawlers, link
checkers, feed readers and caches — hygiene, not a ranking event.

**It is not part of the fabrication takedown.** Those four listings are
`status = 'draft'` and serve no event text, no JSON-LD, no canonical, and a
generic share image. Their URLs now 404 as well, which is tidier, but the
takedown was already complete.

## What it does not reach

**`/day/<any real date>` still answers 200, and should.** `isValidDayKey`
accepts any round-trippable `YYYY-MM-DD`, so `/day/1999-01-01` and
`/day/9999-12-31` render an honest empty day. Only malformed keys flip. **Do not
verify this fix with `/day/1999-01-01`** — it will look like a failure.

My first report listed `/day/1999-01-01` as one of the soft 404s. It never was.

## The bigger thing this turned up — not fixed here, deliberately

**`/event/[id]`, `/venues/[slug]`, `/day/[date]`, `/cities/[slug]` and
`/neighborhoods/[slug]` are not cached at all**, although four of them carry an
`export const revalidate` saying they are. Three consecutive production GETs of
the real `/venues/first-avenue` each returned:

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
X-Vercel-Cache: MISS        Age: 0
```

A route with **no** `generateStaticParams` never enters the prerender manifest,
so Next builds it as ƒ and the `revalidate` export is inert. `/collections/[slug]`
is the in-repo control: it carries `generateStaticParams() { return []; }`, it
builds as ●, and it is the one DB-backed page of the set that caches.

The comments claiming otherwise have been corrected in place
(`app/venues/[slug]/page.tsx`, `app/cities/[slug]/page.tsx`,
`app/neighborhoods/[slug]/page.tsx`, `docs/VENUE-PAGES.md`). The behaviour has
not been changed, for three reasons:

1. **The obvious one-line fix recreates the August incident.** Adding
   `generateStaticParams() { return []; }` while `revalidate = 3600` stays is
   exactly the shape that blew the CPU budget — the measurement is in this repo
   at `app/places/[kind]/[slug]/page.tsx:29-46`: *80,539 ISR writes in 30 days
   against 3,464 human page views*, Fluid Active CPU 4h16m against a 4h
   allowance. On a long tail crawled about daily, a 1-hour TTL means every crawl
   pays a full re-render **plus** an ISR write. The fix that worked there was
   `revalidate = false` and bust-on-write, i.e. ISR *off*.
2. **The database cost is already contained.** `getEvents` and `getEventsForDay`
   go through `unstable_cache` with a 1-hour TTL shared globally, so four of the
   five routes read the DB once an hour no matter how many pages render. Only
   `/event/[id]` does an uncached read, and it is a single indexed row.
3. **The number that decides it does not exist yet** — requests per path per
   hour for `/event/[id]`, from Vercel Observability → Routes. Without it, any
   TTL is a guess.

**A production-only failure mode worth knowing now (ENGINEERING rule 3).**
`lib/events.ts` deliberately *throws* when a day-page read fails, so that Next
keeps serving the last-good cached page instead of caching an empty day. There
is no cached page on these routes — so a Supabase blip on `/day/<date>` serves a
500 today with nothing behind it. This change does not alter that, and it is a
second reason the caching question is the right next item.

## The cost of this change, stated plainly

**Four pages lost their loading shimmer**, and the one that matters is
`/event/[id]` — the page a texted or emailed link lands on. On mobile data that
tap now shows nothing for a beat instead of a card outline.

The honest framing: the skeleton was covering for the fact that the page renders
from scratch on every single view. Keeping it costs the correct status code.
Fixing the caching costs nothing and removes the reason the skeleton existed.

There is a middle option, measured and left for a separate item: move the
skeleton out of `loading.tsx` and into an explicit `<Suspense>` **inside** the
page, below the existence check. That returns 404 and keeps a fallback. It is
not done here because neither existing skeleton is a valid inner fallback — both
render a whole top bar and main shell — so it needs a new component and a
before/after TTFB on the flagship share surface. That is its own session.

**Phone-test `/event/<a real id>` on cellular after deploy.** If the bare beat
feels wrong, `git revert` is one command and costs only the status codes.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,913 tests** (2,915 → 2,913: four tests replaced by two)
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Smoked on a local production build against the real database (763 events, not
  the sample fallback), before and after, with the full URL matrix below

`npm run lint` still does not run — `next lint` is deprecated. Pre-existing.

**The suite was red mid-session** while the four files were moved aside, because
`app-shell.test.ts` required them. That failure was the experiment, not a
regression.

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No schema, no secret, no backfill.

## Verify

On `https://www.citypulsemn.com` — note the **www**, the apex 308s and a
redirect will mask the status:

```bash
for p in "event/00000000-0000-4000-8000-000000000000" "venues/zzz-not-real" "collections/zzz-not-real" "day/not-a-date" "day/2026-13-45"; do echo "$(curl -s -o /dev/null -w '%{http_code}' "https://www.citypulsemn.com/$p")  /$p"; done
```

All five must read **404**.

Then confirm nothing real broke — all of these must read **200**:

```bash
for p in "" "venues" "venues/first-avenue" "collections" "this-week" "day/1999-01-01"; do echo "$(curl -s -o /dev/null -w '%{http_code}' "https://www.citypulsemn.com/$p")  /$p"; done
```

`day/1999-01-01` is in the second list on purpose: a valid empty day.

Last, the one a human has to do: **open a real event page on your phone, on
cellular.** That is where the skeleton was removed.

## Rollback

`git revert` and push. The four `loading.tsx` files and `components/Skeletons.tsx`
come back, the shimmer returns, and the four routes go back to answering 200.
Nothing else in the app depends on any of it.
