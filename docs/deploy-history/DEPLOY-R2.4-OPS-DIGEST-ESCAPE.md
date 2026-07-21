# Deploy R2.4 — escape the ops digest HTML

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 4. Size XS: the
subscriber digest has had `esc()` since day one; the operator email forgot it.*

## The bug

[lib/ops-digest.ts](../../lib/ops-digest.ts) interpolated scraped event titles
("most viewed", trending top-3) and raw DB error strings straight into its HTML.
A pipeline-sourced title like `Beauty & the Beast <Preview>` breaks the section
markup; an error string containing markup injects into the operator's inbox.

## The fix

`esc()` is now exported from [lib/digest.ts](../../lib/digest.ts) (same helper,
one implementation) and applied at the ops digest's **HTML boundary**: the date
line, every section title, every content line — titles, coverage alerts, and
error strings all flow through lines, so one choke point covers them all. The
plain-text version stays raw, as plain text should.

## Verification

- Golden tests +2 (666/666): `Beauty & the Beast <Preview>` and a
  `<script>` trending title render escaped in HTML and untouched in text; a DB
  error carrying `<img onerror>` cannot inject.
- `npm run ops-digest -- --dry-run` against prod: composes unchanged.
- Gate: tsc clean · 666/666 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist

- [ ] Next Monday's ops digest renders normally (real titles rarely carry
      markup — the fix is for the day one does).

## Rollback

`git revert`.
