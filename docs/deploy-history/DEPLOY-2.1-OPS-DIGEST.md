# Deploy Guide — Roadmap 2.1: The Ops Digest

**The keystone of v4.** The site has coverage floors, a verify pass, pipeline logging, engagement counters, trending, and subscriber stats — all living in an admin you have to remember to open. This item is the cockpit: **one email, after every weekly pipeline run, reading every instrument.** Unwatched dashboards are this project's documented failure mode; this ends it.

**Deploy = zip + one schema paste + one new GitHub secret.**

---

## What the email contains

Six sections, one screen: **Pipeline** (last run's ok/error, upserted/cancelled/archived/collapsed counts, duration — with the kill signature called out by name if a run died without finalizing) · **Coverage** (the 4.3 floor report, breaches verbatim) · **Verification** (events re-verified in 7 days + upcoming events *never* verified) · **Engagement** (views/clicks/saves/calendar with real week-over-week deltas) · **Trending** (lit with top 3, or "dark — expected while stats accumulate," which is deliberately *not* an alarm) · **Subscribers** (total, 7-day delta, and the "N personalized" note from the last subscriber digest).

Subject line does the triage for you: `✅ City Pulse ops — all green (Jul 20)` or `⚠️ City Pulse ops — 3 alerts (Jul 20)`.

## The design decision that matters

**Every section is gathered independently; a failed source becomes "section unavailable: \<reason\>" — itself an alert — and the email still sends.** A cockpit that dies when an instrument fails is a smoke detector wired to the stove's fuse. This is tested to the extreme: all six sections down still composes a six-alert email. The one thing that fails loudly is the send itself (exit 1) — the 5.4 lesson, kept.

Week-over-week math has a home: `ops_digest_runs` stores each send's engagement totals as the next week's baseline — written **only on real sends**, so deltas always compare against what was actually reported. First run says "first report," never a fake 0%.

## Quality bar (all green)
- **530 tests (14 new)**: healthy week, failed run, the kill signature, coverage breaches counting toward the subject, WoW math (signed %, first-run, zero-baseline), the resilience contract single- and total-failure, dark-trending-stays-calm.
- Both email states composed and the alert state **visually rendered and inspected**: alert borders on the broken sections, "section unavailable" line visible while the rest keep reporting.
- tsc clean · build clean · 0 vulnerabilities.

---

## Deploy (three steps)

1. **Zip** → unzip over the repo, commit (`Ops digest (roadmap 2.1)`) → push.
2. **Schema** → Supabase SQL Editor, paste from `db/schema.sql` (the whole file is idempotent — safe to run in full) or just the new block:
   ```sql
   create table if not exists ops_digest_runs (
     id      bigint generated always as identity primary key,
     sent_at timestamptz not null default now(),
     totals  jsonb not null
   );
   alter table ops_digest_runs enable row level security;
   ```
3. **Secret** → GitHub repo → Settings → Secrets and variables → Actions → New secret: `OPS_DIGEST_TO` = your email address. (Everything else — `DATABASE_URL`, `RESEND_API_KEY`, `DIGEST_FROM` — already exists from the weekly digest.)

## Verify

- [ ] GitHub → Actions → **Ops Digest** → Run workflow → check **dry run** → the log shows the composed subject + all six sections, no send.
- [ ] Run it again *without* dry run → the email arrives. First one will say "first report" on the WoW lines and probably "dark" trending — both correct.
- [ ] **Monday morning:** the pipeline runs at its usual time, and the ops digest follows it automatically — success *or* failure; it's wired to `workflow_run: completed`, because the cockpit must report especially when the news is bad.
- [ ] The Monday after that: WoW percentages appear. The cockpit is now self-comparing.

## Rollback
Roll back the deploy; the workflow disappears with it. The table is inert without the sender. Nothing user-facing changed at all.

---

## The board

Phase 1: 1.1 SQL delivered · 1.2 ✓ · 1.3/1.4/1.5 yours. **2.1 ✓ — the keystone is in.** Next: **2.2 the Ongoing strip** (small — the span logic already exists in `lib/weekend.ts`), and 2.3's ENGINEERING.md folds into that PR. Then Phase 3: earning the index. From here on, every Monday tells you whether the machine ran, whether the calendar is honest, and whether anyone came — without you opening a single dashboard.
