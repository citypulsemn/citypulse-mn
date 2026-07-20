# HOTFIX — Calendar flooded by ongoing exhibitions + empty day panel

**What you saw:** the same three events ("Skyline Mini Golf," "The People's Museum…," "Kilnforming in the Upp…") on every day of the calendar with ballooning "+N more" counts — and clicking July 1 opened an empty panel.

**What happened (honestly):** my last audit fix taught the calendar that an event whose `end_at` lands on a later date spans multiple days. That correctly fixed the county-fair display, but it also made **summer-long museum exhibitions expand onto every single day**, burying real events. Separately, the day-click panel was still filtering by start-day only — so a cell full of spanning events opened onto an empty panel. Both are my regressions from that change; both are fixed in this zip.

## The fix

1. **A 14-day expansion cap (`EXPAND_MAX_DAYS`).** Spans up to 14 days appear on every day they run — the 12-day State Fair still works exactly as designed. Anything longer is an *ongoing attraction*, not a daily event: it shows on its start day only (the pre-4.4 behavior for those). Applied identically on the client (`daysSpanned`), and in the server day-page query.
2. **The day panel now uses the exact same rule as the cells** — verified with a reproduction of your screenshot's scenario: panel contents equal cell contents on every tested day, including the empty ones.
3. Panel ordering: multi-day/ongoing items list first (they're all-day context), then timed events by clock time — a span's original weeks-old start date no longer scrambles the order.

Regression test added: a three-month exhibition yields exactly its start day; the 12-day fair yields 12 days.

**336 tests, clean build, 0 vulnerabilities.**

## Deploy
Unzip over your repo, commit (`Hotfix: cap span expansion + span-aware day panel`) → push. No database step.

## Verify
- [ ] The calendar shows *different* events on different days again, with sane "+N more" counts.
- [ ] Clicking any day opens a panel whose contents match the cell.
- [ ] The Ramsey County Fair (once its dates arrive / after the collapse runs) still shows across its days with the run badge.

## Follow-up worth noting (added to the roadmap)
Long-running exhibitions are now visible only on their start day — same as before Phase 4.4, so nothing is *lost*, but the right long-term answer is an **"Ongoing" strip**: a small section on the homepage/day view listing exhibitions and attractions currently open, separate from the day-by-day calendar. That's now roadmap item **5.7**, and it's a natural companion to the venue pages in Phase 6.
