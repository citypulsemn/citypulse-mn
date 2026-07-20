# Deploy 4.5.1 — admin_audit.patch: consistent jsonb shapes

*July 20, 2026. Companion to DEPLOY-2.1.1 — same bug pattern, last remaining instances.*

## What shipped

`lib/upsert.ts` (`cancelVerified`, `flagVerification`) wrote `admin_audit.patch` with
`${JSON.stringify(...)}::jsonb`, which the postgres.js client stores as a jsonb **string
scalar** (double-stringified) — while `lib/admin.ts` writes the same column correctly via
`sql.json()`, leaving mixed shapes. Both call sites now use `sql.json()`. No reader of
`patch` exists yet, so this is preventive: the first future reader (e.g. an ops-digest
verification section) would have hit the mixed shapes.

Data: the 6 existing legacy rows (all `verify_flag`) were normalized in place this session
(`update admin_audit set patch = (patch #>> '{}')::jsonb where jsonb_typeof(patch) = 'string'`,
verified: 6 object rows, 0 strings). The column is now uniformly object-shaped.

## Quality gate

tsc clean · 572/572 tests · build clean · audit 0. No new tests: the change is DB-layer
plumbing with no pure logic; the shape convention itself is exercised by the digest's
`parseStoredTotals` suite from 2.1.1.

## Deploy / rollback

Push to `main`; code-only, takes effect on the next verify/cancel action. Rollback:
`git revert` (the old writes were harmless to current code — nothing reads the column).
