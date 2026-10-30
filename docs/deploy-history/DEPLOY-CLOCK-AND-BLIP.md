# Deploy — tonight's shows stopped vanishing at 7pm, and a database hiccup stopped declaring events dead

**30 Oct 2026.** Two one-function fixes, eight new tests. No schema change, no
data change, no new secret, no new dependency. Deploy is a push.

Neither of these was the task. Both came out of recon for the caching question,
whose answer was *no* — see [CACHING.md](../CACHING.md). These are what that
recon actually found, and both were live.

## 1. Every event disappeared from the venue, city and neighborhood pages at 7pm

`isUpcoming` in `lib/dates.ts` is the single predicate behind
`/venues/[slug]`, `/cities/[slug]`, `/neighborhoods/[slug]` and their three
index pages. It read:

```ts
const endMs = new Date(`${lastDay}T23:59`).getTime();
return Math.max(startMs, endMs) >= now.getTime();
```

`ev.start` and `lastDay` are **naive Chicago wall strings** — `"2026-10-30T19:00"`
with no zone. `new Date()` on such a string parses it in the *server's* zone.
Vercel runs UTC. So `23:59` meant 23:59 UTC, which is **18:59 Chicago**, and the
comparison was against a real instant that was correct. The two sides were five
hours apart.

**The effect:** a 7pm show left the site at 7pm. Reproduced with the clock set to
a Vercel server:

```
server TZ: UTC
event: a 7pm show in Chicago on Fri 30 Oct 2026

  Chicago wall   UTC instant            isUpcoming
  18:00 Fri      2026-10-30T23:00:00Z   true
  18:59 Fri      2026-10-30T23:59:00Z   true
  19:01 Fri      2026-10-31T00:01:00Z   FALSE  <-- gone from the site
  21:00 Fri      2026-10-31T02:00:00Z   FALSE  <-- gone from the site
```

Not an edge case. Every evening, during the hours people open a listings site to
decide where to go, tonight's events were being hidden from the venue, city and
neighborhood pages at doors.

**This repo already knew about this bug class.** `lib/clock.ts` exists to
prevent it and its header says so: *"a naive wall string may NEVER be compared
against a real instant — `new Date(wallString)` on a UTC server reads 7 PM
Chicago as 7 PM UTC and shifts every comparison 5–6 hours."* That is ENGINEERING
rule 10. And `lib/related.ts:24`, one file over, carries a comment about the
identical bug being fixed there in R1.3: *"The old naive-parse-vs-real-now
compare hid tonight's shows from the strip every afternoon on UTC servers."*
The sweep that fixed `related.ts` missed `dates.ts`.

**The fix** is the same shape as its neighbour — walls to walls, one frame, a
string compare:

```ts
return `${lastDay}T23:59` >= chiWallClock(now);
```

The old `Math.max` was redundant: `lastDay` is derived from the start day, so
its `23:59` is never earlier than the start.

### Why the test suite never caught it

`lib/__tests__/dates.test.ts` used `new Date("2026-08-06T15:00:00")` for "now" —
**also a naive parse.** On a Chicago laptop the bug cancelled itself on both
sides of the comparison, so the suite was green locally and green in review, for
a bug that only existed in production. ENGINEERING rule 3, exactly.

Both sides are pinned to explicit instants now (`...T20:00:00Z`, which is 15:00
Chicago in August), so the block means the same thing on any machine. Four new
cases cover the evening boundary and the winter offset. **Verified as real
tripwires**, not just green: swapped the one comparison line back to the old
naive parse and three of the four fail under `TZ=UTC`. The suite also passes
under `TZ=UTC` now, which it was never checked for before.

## 2. A database blip told readers — and Google — that live events were gone

`getEvent` in `lib/events.ts` ended:

```ts
  } catch (err) {
    console.error("[events] getEvent failed:", err);
    return null;
  }
```

Its own docstring defines `null` as *"drafts (hidden) and unknown ids (→ 404)"*.
So a **transient Supabase failure was routed through the "this event does not
exist" contract.** `app/event/[id]/page.tsx` does `if (!event) notFound()`, and
`app/not-found.tsx` tells the reader the page *"may have ended and been
archived"* while carrying `robots: { index: false, follow: false }`.

During any blip, every event page a reader or a crawler requested stated as fact
that a live listing was gone, and asked Google to drop the URL.

This is the mirror image of the soft-404 fix pushed hours earlier (`e09defa`):
there the page could not say "gone" when it meant it; here it said "gone" when
it had no idea.

**The fix** follows the convention already in that file — `read*` throws, `get*`
forgives:

- `readEvent` (new, exported) does the query and lets a failure propagate. A
  blip is now a **500**, which is the honest "we don't know".
- `getEvent` keeps the `catch → null` and now just wraps `readEvent`.
- `app/event/[id]/page.tsx` uses `readEvent` in **both** places — the page and
  `generateMetadata`, which had the same hole.
- The four aux callers keep `getEvent` and should: the OG image (never a broken
  share card), the `.ics` route, the content card, and the fabrication-report
  form, which must still render without its context block. ENGINEERING rule 1.

Four tripwires pin the split, including that the page uses `readEvent` twice and
that the aux paths still use the forgiving read.

## What shipped

| file | change |
|---|---|
| [lib/dates.ts](../../lib/dates.ts) | `isUpcoming` compares wall to wall; imports `chiWallClock` |
| [lib/events.ts](../../lib/events.ts) | `readEvent` split out; `getEvent` becomes the forgiving wrapper |
| [app/event/[id]/page.tsx](../../app/event/[id]/page.tsx) | reads through `readEvent`; the inert `revalidate` comment corrected |
| `lib/__tests__/dates.test.ts` | explicit-Z "now", +4 evening/winter cases |
| `lib/__tests__/events-read.test.ts` | +4 tripwires on the read split |
| [docs/CACHING.md](../CACHING.md) | new — the decision these came out of |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,921 tests** (2,913 → 2,921), green under the local
  zone **and** under `TZ=UTC`
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- The new clock tests were confirmed to **fail** against the old implementation

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else.

## Verify

The 404 fix is checkable immediately — these should all still be **200**, and a
nonexistent id should still be **404**:

```bash
for p in "venues/first-avenue" "cities/minneapolis" "neighborhoods/northeast"; do echo "$(curl -s -o /dev/null -w '%{http_code}' "https://www.citypulsemn.com/$p")  /$p"; done
```

**The clock fix needs an evening.** It changes nothing before 7pm Chicago, which
is exactly why it went unnoticed. After 7pm tonight, open
`/venues/<a venue with a show tonight>` and confirm tonight's show is **still
listed**. Before this change it would have dropped off at the start time. The
same goes for that venue's city and neighborhood pages, and for the counts on
`/venues`, `/cities` and `/neighborhoods`.

## Rollback

`git revert` and push. Events go back to vanishing at 7pm and blips go back to
reporting 404s. Both functions are self-contained; nothing else changes.

## Two things left open, both needing you

**The weekly pipeline has failed its last four scheduled runs.** Confirmed with
`gh run list`: 5, 12, 19 and 26 October all failed; the last success was
28 September. The error is `PostgresError: syntax error at or near "//"` in the
sports-reconcile step. The research half succeeds, so new events are still
arriving — but `import-venues` and `check-sources` have not run in a month,
which means the source-check queue has been frozen that whole time. Not
diagnosed here; it deserves its own session.

**`app/event/[id]/calendar/route.ts` has the same 404-on-blip lie in miniature**
— a blip returns 404 to a calendar poller. Left alone deliberately: no crawler
de-indexes from an `.ics`, and the fix would mean the same split again for a
much smaller consequence.

**And one thing to know about the 404 fix:** during an outage a reader now gets
a 500 instead of a branded "this event isn't here" page. That is the right
trade — a 500 is honest and a false 404 is a lie Google acts on — but
`app/error.tsx` is a client boundary, so the 500 is blank until JavaScript
loads. A reader without JS sees nothing rather than something wrong.
