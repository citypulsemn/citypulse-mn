# Deploy R0.2 — archivePastEvents reads the true span (the festival-killer fix)

*July 20, 2026 (evening). Roadmap v5's "most urgent" item, landed a week before its
deadline (the Jul 27 pipeline run).*

## The bug

`archivePastEvents` ran `coalesce(end_at, start_at) < now()` — blind to `multi_day_end`,
where a collapsed run's true span lives. The first pipeline run after a festival's day-1
end would archive it mid-run. **Proved against production by probe** (read-only, both
predicates evaluated at a simulated Jul 27 09:00 CT): the old predicate archives **5
still-running events** — Skyline Mini Golf (through Aug 30), Can Can Wonderland (through
Sep 27), and three sports rows — that the new one keeps.

## What shipped

The predicate now archives only when the **effective end's Chicago day is over**:

```sql
where status = 'published'
  and (coalesce(multi_day_end, end_at, start_at) at time zone 'America/Chicago')::date
      < (now() at time zone 'America/Chicago')::date
```

- True span first (`multi_day_end`), the same coalesce `trending.ts` already used.
- End-of-day grace in the Chicago frame: all-day events (midnight start, no end) and
  no-end evening shows survive through their own night — previously a UTC clock archived
  them mid-day. Semantic change: events now archive the Chicago midnight after they end,
  not the minute after — an event that ended two hours ago tonight is still tonight's event.
- **Tests:** the suite can't execute this SQL, so per v5's pattern the load-bearing
  fragments carry query-text tripwires (`lib/__tests__/upsert-queries.test.ts`) — the
  coalesce order and the Chicago date cast fail CI if regressed — and the real predicate
  was probed against prod (above).

## Finding logged while probing (separate task, chip filed)

~12 published **sports** rows carry `multi_day_end` spans — whole homestand series as one
card ("Twins vs. Royals Jul 28→31"), violating the one-game-one-card rule. Two patterns:
spans coexisting with real per-game rows (span simply wrong), and series existing ONLY as
the spanned row (splitting needs verified schedules). Not caused by the collapse (the
sports guard held); source unknown, likely agent payloads. R0.2 makes these rows *visible
longer* (the old bug archived them early by accident), so the repair chip is worth taking
soon. Needs Taren's confirmation + web-verified schedules before any write.

## Quality gate

tsc clean · 594/594 (2 new tripwires) · build clean · audit 0 · prod probe old-vs-new at
now (0/0 delta — this morning's sweep already ran) and at Jul 27 (5 saved, counts 87→82).

## Deploy steps

Push to `main`. Code-only; takes effect on the next pipeline run (Jul 27) — which is the
whole point.

## Verify checklist (after the Jul 27 run)

- [ ] Skyline Mini Golf and Can Can Wonderland still published.
- [ ] Ops digest archive count sane (~82-ish, not a stampede).
- [ ] No still-running collapsed event archived (spot-check /ongoing).

## Rollback

`git revert` — one predicate + tests. (Reverting resurrects the festival-killer; don't,
past Jul 26.)
