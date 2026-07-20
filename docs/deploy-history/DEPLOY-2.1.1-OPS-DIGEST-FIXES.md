# Deploy 2.1.1 — Ops digest: WoW baseline fix + Index-surface bring-up

*July 20, 2026. Session: closing handoff queue items 1 (collapse) and 3 (ops digest bring-up).*

## What shipped

1. **Fixed the week-over-week math** — it was silently dead. The baseline insert used
   `${JSON.stringify(baseline)}::jsonb`, which stored a jsonb *string scalar* instead of an
   object. Reading it back gave `prevTotals` a string, every property access returned
   `undefined`, and the digest reported "first report" on every line, forever. Both rows in
   `ops_digest_runs` (Jul 17, Jul 20) had the bad shape.
   - `scripts/send-ops-digest.ts` — insert now uses `sql.json(baseline)`, the repo's existing
     convention (`run-pipeline.ts`, `lib/admin.ts`).
   - `lib/ops-digest.ts` — new pure `parseStoredTotals()` accepts both shapes (object, or the
     legacy double-stringified string) and returns `null` for anything else, so old rows keep
     working without a data migration. Golden-tested (5 cases incl. honest-emptiness).
2. **Index-surface section can now work in CI** — `.github/workflows/ops-digest.yml` passed no
   `SITE_URL`, so the sitemap fetch was skipped on every workflow send. Added
   `SITE_URL: https://www.citypulsemn.com` (the canonical host; apex 308-redirects to www).

## What was verified, not changed

- **Handoff item 1 (COLLAPSE-1.1.sql) was already applied**: STEP 0 pre-flight returned 0
  missing ids; all **159** archive-target ids are `archived`; backup table
  `collapse_backup_20260716` exists. Sports rule held (Twins: 1 game per day, all days intact).
- **The ops digest has already sent twice for real** (Jul 17 10:23, Jul 20 09:04, ~40 min after
  the pipeline) — workflow trigger, Resend, and `OPS_DIGEST_TO` secret are live in GitHub.

## Known issues discovered, deliberately not fixed here

- **The Jul 20 pipeline run re-created multi-day duplicates** with new ids and *varied titles*
  (RenFest "Weekend V/VI", six Sever's weekend rows, six State Fair attraction rows). The
  in-pipeline collapse missed them because titles differ. COLLAPSE-1.1 cannot stay ahead of
  this; the durable fix belongs in the pipeline's collapse logic (`lib/multiday.ts` /
  `scripts/collapse-multiday.ts`). Needs its own session.
- `lib/upsert.ts:251,262` use the same `JSON.stringify(...)::jsonb` pattern for `admin_audit`
  writes — likely storing string scalars there too. Separate small fix.
- Optional data tidy (code tolerates the old rows; run in Supabase SQL Editor if wanted):
  ```sql
  update ops_digest_runs set totals = (totals #>> '{}')::jsonb
  where jsonb_typeof(totals) = 'string';
  ```

## Quality gate

`npx tsc --noEmit` clean · `npm test` 559/559 green (3 new) · `npm run build` clean ·
`npm audit` 0 vulnerabilities · dry-run observed: WoW labels render (±0% vs today's baseline),
Index surface shows "121 URLs in the live sitemap".

## Deploy steps

1. Push to `main` (Vercel auto-deploys; the workflow change takes effect on the next Actions run).
2. Nothing else — no schema change (`ops_digest_runs` already exists in Supabase with 2 rows).

## Verify checklist (after next Monday's pipeline)

- [ ] Ops digest email arrives ~40 min after the pipeline run.
- [ ] Engagement lines show real percentages (e.g. "+18% WoW"), **not** "first report".
- [ ] Index surface line shows a URL count, not "sitemap not fetched".

## Rollback

`git revert` the commit. The old code still sends the digest; only WoW labels and the Index
section regress to their prior (broken-but-harmless) behavior. No data to roll back.
