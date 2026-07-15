# Time integrity

Roadmap 4.6. An event's time on City Pulse is Twin Cities wall-clock, stored as an unambiguous instant, or honestly labeled "All day" — never a fake clock time invented by timezone drift.

## The bug

The pipeline inserted the research agent's **raw start string** into a `timestamptz` column, and the database session runs in UTC. Three artifact classes followed:

| Agent output | Stored as | Rendered as |
|---|---|---|
| `2026-07-16` (date-only) | midnight UTC | **7 PM the previous day** (the Ramsey County Fair) |
| `2026-07-18T10:00:00Z` (Z noise) | 10:00 UTC | **5 AM** (the Aquatennial class) |
| `2026-07-18T19:30` (well-formed!) | read as UTC | shifted 5–6 hours |

User submissions were immune — that path already used `toIsoWithOffset`.

## The fix

`lib/time-integrity.ts` (pure, tested):

- **`normalizeAgentTime`** — policy: an agent's time is ALWAYS local wall-clock; any zone suffix it attached is noise. Strips it, keeps the clock face, attaches the real DST-aware Chicago offset (`toIsoWithOffset`) so the stored instant can't drift regardless of session timezone. Date-only input ⇒ `all_day = true`. Garbage ⇒ event skipped with a warning, never guessed.
- **`isImprobableStart`** — nothing here legitimately starts midnight–6:59 AM; such starts are kept but flagged in the pipeline log (`⏰ improbable start`) and counted in the run summary, the same pattern as the coverage monitor.

## All-day events

`events.all_day boolean` + `EventRecord.allDay`. Display never shows a fake time: cards, the day panel, the map popup, the digest, and IG captions all render **"All day"** via the shared `timeLabel()` helper; the detail page reads "Friday, July 17 · All day" (and a multi-day all-day run drops the "daily from …" clause). The `.ics` export emits proper `VALUE=DATE` VEVENTs (banner across the day in calendar apps, exclusive DTEND) — verified with the node-ical parser.

## Backfill

`fix-times.sql` (in outputs) repairs the database: a read-only hour-histogram diagnostic, previews of both artifact classes, transaction-wrapped repairs (the exact inverse of the bug — re-reading the stored UTC face as Central, durations preserved), and verification queries. Class B only applies when the repaired hour is plausible (7 AM–11 PM), and the preview lets a genuine early event be excluded by id.
