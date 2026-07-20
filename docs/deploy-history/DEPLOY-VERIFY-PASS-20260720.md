# Deploy — Verify pass 2026-07-20 + timestamp-param fix (Engineering rule 9)

*July 20, 2026. Data operation (the Thursday verify pass, done early with web evidence) plus
a code fix for a latent timezone bug the operation itself exposed.*

## Data applied to production (Taren-confirmed, evidence-linked)

All 13 outstanding conflicts from `ops/COLLAPSE-1.1-GUIDE.md` resolved against official
sources (team schedules, organizer sites): **16 rows archived, 12 winners stamped
`verified_at`, 3 spans set** (Edina Fall into the Arts → Sep 13 · Lakeside Guitar → Aug 15 ·
Woodbury Days → Aug 30), **1 time fix** (ROCtoberfest → 5 PM). Notables: Twins 9/8 — both
candidate rows were wrong (team is away at Detroit); Lynx 8/9 is Dallas; Porchfest is Aug 15.
Every matcher required exactly one row or the script aborted. Backup of all 28 prior row
states: session scratchpad `verify-pass-backup-20260720.json`. Rollback: restore status /
`multi_day_end` / `start_at` from the backup.

## The bug this exposed — and the code fix

The span/time writes initially landed **+5h shifted** (spans read one day late, 5 PM became
10 PM). Probed against prod: postgres.js infers **timestamptz** for ISO-shaped string
*parameters*, so `${str}::timestamp at time zone 'America/Chicago'` treats the value as UTC
before attaching the zone — while the identical expression with a literal is correct (why
COLLAPSE-1.1's pasted SQL never showed it). The four bad writes were repaired in place the
same hour (verified reading back correctly).

**Fix — cast `::text` first**, applied to every parameterized wall-time write:
- `lib/upsert.ts` (`collapseMultiDayRuns` span writes)
- `scripts/collapse-multiday.ts` (same)
- `lib/admin-actions.ts` (`updateEvent` start/end — **admin manual time edits carried this
  latent bug**; any event whose time was hand-edited in admin may be stored +5/6h late and
  is worth a spot-check)

Codified as **rule 9 in `docs/ENGINEERING.md`**.

## Quality gate

tsc clean · 572/572 tests · build clean · audit 0 · data verified by read-back after repair.
No new unit tests: the defect lives in driver/param behavior, not pure logic — the probe
script pattern (literal vs param round-trip) is recorded in rule 9 for future verification.

## Deploy steps

Push to `main`. Code-only. Until pushed, admin time edits and future pipeline span
extensions keep the +5h behavior.

## Verify checklist

- [ ] Site: Woodbury Days card shows "Aug 28 – 30"; Edina shows "Sep 12 – 13"; Lakeside
      shows "Aug 14 – 15"; ROCtoberfest shows 5 PM on Sep 19.
- [ ] Admin: edit any test event's time, confirm it displays as entered.
- [ ] Only one published card each: Lynx 8/9 (Dallas), Twins 9/15 (Yankees); zero Twins
      home cards on 9/8.
