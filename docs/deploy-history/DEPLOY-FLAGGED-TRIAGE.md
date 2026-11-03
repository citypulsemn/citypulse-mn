# Deploy — the Monday email's triage link, and somewhere for it to land

**3 November 2026.** For 69 days the ops digest told the operator to open
`/admin/events` for its flagged-listing queue. That route has never existed, and
because middleware asks for the admin password first, the operator paid it and
landed on the public reader 404. The link now points at a filter that shows
exactly the rows it counted. One new module, one query branch, one `<option>`,
two strings. No schema change, no data change, no new dependency.

## What was wrong

`lib/ops-digest.ts` emitted this from `caa7470` (26 Aug) until today:

```
33 listings the verify pass flagged, still live → /admin/events
N music listings a venue calendar disagrees with → /admin/events
```

There is no `app/admin/events`. The real editor is `/admin` — `app/admin/page.tsx`
exports `AdminEventsPage` and `AdminTabs` labels it "Events" — and it filtered on
`q` and `status` only, with **no way to see the flagged rows at all**.

Two details that kept it invisible:

- **The paths are plain text, not anchors.** Section `lines` are HTML-escaped;
  only `items[].actions` become `<a href>`. So nothing ever resolved the path,
  and the sibling lines (`/admin/submissions`, `/admin/reports`) happened to be
  correct, which made the convention look fine.
- **`verifyFlagExamples` is a `slice(0, 4)`.** The four `wrong_event` rows the
  email names are a *sample*. The real split, now that the predicate has one
  home: `wrong_event` 9 · moved 8 · weak_source 7 · not_found 6 · unproven 2 ·
  sold_out 1. Four was mistaken for the count twice in one day, once by me.

## The predicate had to move first

`/admin` needed the same definition of "open flag" the digest uses, and this is a
project that has already paid for three copies of one query. So before adding the
filter, the predicate moved to **`lib/verify-flags.ts`**:

```ts
export function flagRank(verdict: string): number
export async function openVerifyFlags(): Promise<OpenVerifyFlag[]>
export async function openVerifyFlagIds(): Promise<string[]>
```

The digest's gather and `getAdminEvents` both come through it, and a test asserts
neither file carries its own `a.action = 'verify_flag'` any more.

**It is subtler than it looks, which is the argument for one home.** A
hand-written query over the same table on the same day returned **164**, then
**25**, against the digest's **33**. The clause everyone drops:

```sql
and (e.verified_at is null or a.at > e.verified_at)
```

A flag raised *after* a stamp is still open — and it is the most dangerous flag
there is, because something re-checked a confirmed listing and disagreed. Omit
that clause and 33 becomes 25.

## The filter

`status=flagged` is not a status column, so it resolves the ids first and filters
on them, ordered **soonest first** — a flagged listing that starts tonight
matters more than one in December:

```ts
const flaggedOnly = status === "flagged";
const flaggedIds = flaggedOnly ? await openVerifyFlagIds() : [];
if (flaggedOnly && flaggedIds.length === 0) return [];
…
where ${flaggedOnly ? sql`id = any(${flaggedIds}::uuid[])` : status ? sql`status = ${status}` : sql`true`}
order by ${flaggedOnly ? sql`start_at asc` : sql`created_at desc`}
```

Two round trips on a small table, in exchange for one definition. The existing
conditional-fragment idiom in that query is what made this a three-line branch.

## Verified against the live calendar and a running server

```
openVerifyFlags()                 33
getAdminEvents({status:flagged})  33
same ids                          true
```

Then over HTTP, with the real admin password and the real database:

```
/admin?status=flagged           200   "33 events"   filter option present
/admin?status=flagged&q=Ordway  200   "2 events"    q composes with it
/admin                          200   "100 events"  unchanged
```

And the email now reads:

```
## Queue ⚠️
- 33 listings the verify pass flagged, still live → /admin?status=flagged
```

The screen shows the same 33 the email counted, by construction rather than by
coincidence.

## It was proved to fail, not assumed to

Eleven mutations, every one caught:

| mutation | result |
|---|---|
| unmutated | GREEN |
| the flagged queue points at the dead route again | **RED** |
| the music queue points at the dead route again | **RED** |
| **a flag raised AFTER a stamp stops counting (33 → 25)** | **RED** |
| archived and hidden listings count as flagged | **RED** |
| past events count as flagged | **RED** |
| every flag per listing counts, not just the latest | **RED** |
| `wrong_event` loses its place at the front | **RED** |
| the screen stops offering the filter | **RED** |
| the admin branch falls through to a status match | **RED** |
| the gather grows its own copy of the predicate again | **RED** |

All five touched files restored byte-identical afterwards.

**The test that would have caught the original bug** resolves every `/admin` path
the digest prints against `app/**/page.tsx`. It found one immediately — a comment
I had written explaining the history contained the dead path verbatim, so the
file still named a route that does not exist. Reworded rather than weakening the
test: a dead route in a comment is the next person's wrong grep.

Also pinned in source, because the no-database path cannot tell the difference: a
`flagged` branch that fell through to `status = 'flagged'` would return nothing
on a real database while the unit tests stayed green.

## What shipped

| file | change |
|---|---|
| [lib/verify-flags.ts](../../lib/verify-flags.ts) | **new** — `flagRank`, `openVerifyFlags`, `openVerifyFlagIds`; the one definition |
| [lib/ops-inputs.ts](../../lib/ops-inputs.ts) | the inline flag query replaced by `openVerifyFlags()` |
| [lib/ops-digest.ts](../../lib/ops-digest.ts) | both dead paths repointed; a note that these are text, not links, and that a test reads this file |
| [lib/admin.ts](../../lib/admin.ts) | the `flagged` branch, soonest first |
| [app/admin/page.tsx](../../app/admin/page.tsx) | the filter option |
| `lib/__tests__/verify-flags.test.ts` | **new** — 8 tests: the rank, the predicate as source, the admin wiring, honest-empty without a database |
| `lib/__tests__/ops-digest.test.ts` | +3 tests incl. the path-resolution guard; the stale `/admin/events` assertion updated |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **151 files, 3,029 tests** (3,018 → 3,029), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in eleven directions; verified against the live calendar and a running dev server

## Deploy

1. Push to `main`. Vercel auto-deploys; the next ops digest picks up the new path.
2. Nothing else. No secret, no migration, no data step.

## Verify

```bash
npm run ops-digest -- --dry-run
```

The Queue line must read `→ /admin?status=flagged`. Then open that URL and
confirm the count matches the number in the line.

## Rollback

`git revert` and push. `lib/verify-flags.ts` is new and only two modules import
it; the filter option and the query branch go back together. No data to undo —
this change only decides what the panel shows and where the email points.

## Left open

- **The queue itself.** 33 listings still need a human, 9 of them `wrong_event`,
  and one starts tonight. The screen exists now; the triage does not.
- **The music-review line points at `/admin`, not a filter.** It counts a
  different set (`import_music_review`, published, unverified), so
  `?status=flagged` would have been wrong for it. It is currently 0, so this is
  dormant rather than broken — but it is a second filter value whenever it wakes.
- **No bulk action.** The screen lists the 33 and each row has Hide / Edit /
  Archive, but `updateEvent` is the wrong applier for a date fix: it recomputes
  `event_key` without checking for a collision and cannot move coordinates
  (`lib/corrections.ts` documents the 18 Oct case). The safe path for a real
  correction is still `npm run correct -- --from=…`.
