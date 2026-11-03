# Deploy — the concurrent-venue allowlist was keyed on a spelling, not a room

**3 November 2026.** The self-check groups listings by `roomKey` and then read
its exemption list with a *different* normalizer, so an exemption only fired when
a group's first row happened to carry the one spelling that had an entry. One
line changed, two dead entries repaired, three added. No schema change, no data
change, no new dependency.

## What was wrong

`findContradictions` builds its groups on the room:

```ts
const room = roomKey(r.venue);
const key = `${room}|${day}`;
```

…and then looked the exemption up on the raw spelling:

```ts
const concurrent = CONCURRENT_VENUES[norm(list[0].venue)];
```

`norm` and `roomKey` are not the same function, and the differences are exactly
the ones that matter for venue names:

| | `norm` (via `foldTitle`) | `roomKey` (via `normalizeKeyPart`) |
|---|---|---|
| punctuation | → **space** | → **deleted** |
| city suffix | kept | **stripped** |
| room aliases | none | `ROOM_ALIASES` applied |

So `"Bryant-Lake Bowl & Theater"` is `bryant lake bowl theater` to one and
`bryantlake bowl theater` to the other, and `"Walker Art Center (Minneapolis)"`
loses its exemption while `"Walker Art Center"` keeps it. Bryant Lake Bowl alone
carries **eight spellings** in the data.

The fix reads the room off the group's own key, so the grouping and the exemption
cannot drift apart again:

```ts
const room = key.slice(0, key.lastIndexOf("|"));
const concurrent = CONCURRENT_VENUES[room];
```

## Two entries had been inert since the day they were added

`"crow-hassan park reserve"` and `"murphy-hanrehan park reserve"` carried
hyphens. `norm` turns a hyphen into a space and `roomKey` deletes it, so
**neither key was reachable from any venue string under either normalizer.** They
are now spelled as `roomKey` actually returns them, and a test asserts every key
is a `roomKey` fixpoint so it cannot happen again.

## Measured before shipping: nothing lost

The risk in this change is losing an exemption that works today. That was
measured rather than reasoned about — every distinct venue spelling in the
database, run through both rules:

```
17 same-room same-day groups in the live calendar
exemptions lost: 0        newly exempt: 1
all 28 keys reachable
```

Every active exemption's `roomKey` is **identical** to its current key, with one
exception — `berlin minneapolis`, whose `roomKey` is `berlin`, which is already a
key. (That entry is left in place: it is now redundant for the spelling in the
data, and removing it would be cleanup with no benefit.)

## What was added, and one thing deliberately not

**Bryant Lake Bowl — three keys.** It programmes a 7pm show and a 9:30pm show
most nights, the same shape as Icehouse and Berlin. Three keys rather than one
because `roomKey` does *not* fold `"Bryant-Lake"` and `"Bryant Lake"` together,
and folding them in `ROOM_ALIASES` would reach the grouping itself — and
therefore the **write-time dedupe gate** in `lib/upsert.ts`, where a wrong fold
could block a real event from being written. An entry in `CONCURRENT_VENUES` only
ever suppresses a report, so it is cheap; an entry in `ROOM_ALIASES` is not. That
asymmetry is now documented on both lists.

**`"ordway concert hall"` — asked for, and deliberately NOT added.** The finding
that prompted it (two real performances of *Gravity and Other Myths* at 10:00 and
12:00 on 17 Nov) is reported as a **duplicate**, and an entry here only
suppresses a **conflict** — the skip sits after the duplicate test on purpose,
moved there on 29 Sep because it had been swallowing both and three live
duplicate pairs sat at the Walker and Como while the panel reported zero. So the
entry would not have silenced that report.

What it *would* have done is suppress a genuine same-minute clash in a single
hall, where two different concerts at one time is physically impossible — and the
five-row James Ehnes cluster archived earlier the same day was in that room. The
Ordway **Centre** stays exempt, correctly: it has two halls. One hall is not a
concurrent venue however many shows it runs in a day, and a test pins that.

## It was proved to fail, not assumed to

Nine mutations, every one caught:

| mutation | result |
|---|---|
| unmutated | GREEN |
| the lookup reverts to `norm(venue)` — the bug this fixes | **RED** |
| the lookup uses the raw venue string | **RED** |
| a hyphenated (unreachable) key comes back | **RED** |
| one hall gets exempted after all | **RED** |
| the Bryant Lake Bowl entry is dropped | **RED** |
| the hyphen-spelling entry is dropped | **RED** |
| the skip runs before the duplicate test again (the 29 Sep bug) | **RED** |
| the exempted pair stops being counted | **RED** |

`lib/contradictions.ts` restored byte-identical afterwards.

## What shipped

| file | change |
|---|---|
| [lib/contradictions.ts](../../lib/contradictions.ts) | the lookup reads the group's own room key; two hyphenated keys repaired; three Bryant Lake Bowl keys added; both lists' doc comments explain the keying and the report-only/blocking asymmetry |
| `lib/__tests__/contradictions.test.ts` | +8 tests: the fixpoint guard, the city-suffix case, spelling-order independence, the real 27 Nov double bill, the hyphen spelling, the duplicate-still-reported protection, and one-hall-is-not-exempt |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **150 files, 3,018 tests** (3,010 → 3,018), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in nine directions; the before/after exemption diff run over the real calendar

## Deploy

1. Push to `main`. Vercel auto-deploys; the next ops digest picks it up.
2. Nothing else. No secret, no migration, no data step.

## Verify

```bash
npm run ops-digest -- --dry-run
```

Measured on the live instrument, before and after:

```
before   1 clash — 2026-11-27 · Bryant Lake Bowl & Theater (19:00 vs 21:30)
         1 probable duplicate — 2026-11-17 · Ordway Concert Hall (10:00 vs 12:00)

after    1 probable duplicate — 2026-11-17 · Ordway Concert Hall (10:00 vs 12:00)
```

The clash is gone; the duplicate correctly is not.

## Rollback

`git revert` and push. The lookup line and the allowlist entries go back
together. No data to undo — this change only decides what the panel reports.

## Left open

- **The 17 Nov Ordway report will keep firing.** Those two rows are the venue's
  own two printed performances, and they were given the same show title with a
  `(Midday)` suffix when the midday row was repointed earlier today, so the title
  matcher sees them as one event. That is the matcher working as designed on
  titles that really are nearly identical. The alternatives are worse: archiving
  the midday row again would take a real, dated, $4 performance off the calendar,
  and teaching the matcher that a parenthetical time marks a distinct performance
  would let `"Show (2)"` past. Left as one line in the operator email for a human
  to confirm, which is what the panel is for.
- **`ROOM_ALIASES` still does not fold the Bryant Lake Bowl spellings**, so the
  dedupe matcher cannot see a pair across two of them — a real duplicate entered
  once as "Bryant Lake Bowl" and once as "Bryant-Lake Bowl & Theater" would not
  be grouped. Fixing that reaches the write-time gate, so it wants its own
  session with the 24-false-merge measurement that killed the pin fold.
- **Four of the 28 entries match no spelling in the data** (`childrens theatre
  company` and three others). Harmless and defensive, but they are the shape that
  let the two hyphenated keys rot unnoticed; the fixpoint test now at least
  guarantees they *could* fire.
