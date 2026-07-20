# Deploy Guide — Roadmap 4.6: Time Integrity

**This fixes the 5 AM art fairs, the 7 AM WNBA game, and the fair that started "7 PM" the day before its own description said.**

The root cause, found in the audit and confirmed in code: the pipeline inserted the research agent's **raw time string** straight into the database, whose session runs in UTC. A date-only answer became midnight UTC (renders 7 PM the previous day); a time with a stray `Z` shifted 5 hours (10 AM became 5 AM); even the well-formed local times the prompt asks for were read as UTC. User-submitted events were immune — that path already attached the correct offset. The pipeline now does too, for every event, with DST handled per-date.

**One database step, one deploy, one SQL backfill.** No new secrets.

---

## What you're deploying

1. **Normalization at ingestion** (`lib/time-integrity.ts`, pure + tested): an agent's time is *always* Twin Cities wall-clock — any zone suffix it attached is noise. The clock face is kept and the real Chicago offset attached, so the stored instant can't drift no matter what timezone the database session uses. Unparseable times skip the event with a warning instead of guessing.
2. **All-day events, honestly labeled.** Date-only answers (festivals, fairs) are marked `all_day` and display **"All day"** — on cards, the day panel, the map, the digest, and IG captions — instead of a fake clock time. The detail page reads "Friday, July 17 · All day," and calendar downloads become proper all-day entries (a banner across the day in Google/Apple Calendar, validated with a real .ics parser).
3. **An improbable-hour guard** in the pipeline log: any start before 7 AM is kept but flagged (`⏰ improbable start 05:00 — "…"`) and counted in the run summary — the same "make it impossible to miss" pattern as the coverage monitor.

## Quality bar (all green)
- 348 tests pass (12 new — each of the three live bug classes is a named test case), typecheck clean, build clean, **0 vulnerabilities**.
- The all-day `.ics` output was validated by parsing it with `node-ical`: correct date-only start on the *right* date, exclusive end after the last day.
- Event keys are derived from the date only (confirmed in code), so corrected times still match their existing rows — the next pipeline run updates events in place rather than duplicating them.

---

## Step 1 — Database (one column)

**Supabase → SQL Editor** → run `db/schema.sql` (idempotent; adds `events.all_day`).

## Step 2 — Deploy the code

Unzip `citypulse-mn.zip` over your repo, commit (`Time integrity (roadmap 4.6)`) → push.

## Step 3 — Repair the existing data (`fix-times.sql`)

The events already in your database still carry shifted times. `fix-times.sql` (attached) runs in the Supabase SQL Editor and is built the way you like to work:

- **Step 0** — a read-only diagnostic: a histogram of local start hours. One caution: *if* it shows a big pile of events at 12–3 PM that should obviously be evening shows, **stop and paste me the output** — that would mean the shift is wider than the two classes below, and I'll extend the repair.
- **Step 1** — read-only previews of both artifact classes, each row showing `shows_now → will_become`. If any 0–6 AM event is *genuinely* early (a sunrise 5K), note its id and drop it from the update.
- **Step 2** — the repairs, wrapped in `begin/commit`. The fix is the exact inverse of the bug: re-read the stored UTC clock face as Central. Date-only artifacts land on their **correct calendar date** as all-day; timed artifacts keep their durations.
- **Step 3** — verification queries, including a spot-check that the Ramsey County Fair now reads its true date as "All day."

## Verify on the live site

- [ ] No more 5 AM festivals or 7 AM ball games on the calendar.
- [ ] The Ramsey County Fair shows on **July 16** (its real start), labeled "All day," not "July 15 · 7 PM."
- [ ] Download an .ics for an all-day event → it lands as a day banner, not a midnight appointment.
- [ ] After Monday's run, the pipeline log shows `times normalized N` and (ideally) `improbable 0`.

## Rollback
Code: roll back the deploy. Data: Step 2 is transactional — `rollback;` instead of `commit;` undoes everything before it's applied. After commit, the transform is mathematically invertible; tell me and I'll generate the reverse.

---

## What's next
Phase 4 is now genuinely done — including the two items this audit added. The remaining v3 item at this layer is **4.7 title & field hygiene** (strip "(Weekly Tuesdays)" / "— Weekly Thursdays (July 16)" / embedded venues from titles, canonicalize "St. Paul"). Then **Phase 5** opens with first-party analytics — the feedback loop.
