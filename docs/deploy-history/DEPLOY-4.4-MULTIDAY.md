# Deploy Guide — Roadmap 4.4: Multi-Day Events & Duplicates

A 12-day State Fair should be **one** card that says "Aug 20 – 31," not twelve rows crowding everything else off your calendar. And "Slavic Experience Festival" shouldn't appear three times.

**One database step, one deploy, one cleanup script.**

---

## The part that matters most

Your export showed "Woodbury Days" ×3, "Slavic Experience Festival" ×3, and "Day Block Brewing Date Night" ×4. Those look like the same problem. **They're not** — and treating them the same would have deleted real events:

| Pattern | Example | What we do |
|---|---|---|
| **Multi-day run** | Woodbury Days ×3 — consecutive days, same venue | **Collapse** → one card, "Aug 14 – 16" |
| **True duplicate** | Slavic Experience Festival ×3, three different venue guesses, same day | **Merge** → keep one |
| **Legitimate recurrence** | Day Block Brewing Date Night ×4 — *weekly* | **Leave completely alone** |

The rule that separates them: **only consecutive days form a run.** A weekly series has 7-day gaps, so it never collapses. That single rule is what keeps your recurring date nights and Thursday film series from being wiped out — and it's tested explicitly.

Validated against your real duplicate patterns: 33 rows → 14 events, with the Minnesota State Fair's 12 rows becoming one "Aug 20 – 31" card, Sever's correctly split into *two separate weekends* (not one 9-day blob), and **all 8 weekly-series rows surviving untouched**.

---

## What you're deploying

- Multi-day festivals show a gold **"Aug 20 – 31"** badge instead of a start time; their detail page reads "runs 12 days · daily from 9 AM."
- They appear on **every day they span** — the Aquatennial is genuinely on Thursday, not just on its opening day. So "what's on today" stays correct.
- The weekly pipeline collapses new runs automatically and merges duplicates the old 250m-distance rule missed (the agents guess venues on opposite sides of town for the same festival).

Full reference: `docs/MULTIDAY.md`.

## Quality bar (all green)
- 316 tests pass (16 new), typecheck clean, build clean, **0 vulnerabilities**.
- **All 300 pre-existing tests still pass** — expanding events across calendar days is an invasive change to core calendar logic, so that's the number I was watching. Smoke-tested homepage / event / day / collections pages: no regressions.
- The suite includes explicit guards: a weekly series is never collapsed, a 2-day gap is not a run, and a runaway `multi_day_end` can't balloon the calendar (60-day cap).

---

## Step 1 — Database

In **Supabase → SQL Editor**, paste `db/schema.sql` and run it. Idempotent; it adds one column (`events.multi_day_end`). Existing data untouched.

## Step 2 — Deploy the code

Unzip the new `citypulse-mn.zip`, copy **all** contents over your repo (replace), commit (`Multi-day events (roadmap 4.4)`) → push.

## Step 3 — Clean up the existing duplicates

The collapse runs automatically on future pipeline runs, but your current database still has the pile-up. Preview it first:

```bash
npm run collapse -- --dry-run
```

That writes nothing and prints exactly what it would do:
```
  RUN    "Minnesota State Fair" 2026-08-20 → 2026-08-31  (keep 1, archive 11)
  DUP    "Slavic Experience Festival" 2026-08-22  (keep 1, archive 2)
```

Read it. Confirm no weekly series appear. Then apply:

```bash
npm run collapse
```

> **Prefer not to run scripts?** Tell me and I'll generate a paste-ready SQL file for the Supabase editor, the same way I did for the 4.1 reclassification. I'd want your current event list (id, title, city, start) to do it accurately.

**Nothing is deleted** — extras are *archived*, so this is fully reversible.

---

## Verify

- [ ] The Minnesota State Fair appears **once**, with an "Aug 20 – 31" badge, not as a dozen entries.
- [ ] Click into it: "runs 12 days · daily from …".
- [ ] Open a day *in the middle* of the fair — it still shows (that's the span logic working).
- [ ] Your weekly events (Day Block Date Night, Walker Free Thursday Night) **still appear multiple times**, as they should. If any of them vanished, stop and tell me.
- [ ] Admin → Coverage counts look more honest now that festivals aren't inflated.

## Rollback
Roll back the deploy. To restore archived rows: `update events set status='published' where status='archived' and start_at > now();` (this un-archives genuinely past events too, so use with care — or just ask me for a targeted script).

---

## What's next
**Phase 4 is essentially complete**: classification (4.1), discovery (4.2), the coverage monitor (4.3), and now data quality (4.4). Remaining: **4.5 freshness/cancellation re-verification** — re-checking near-term events against their source so a cancelled show doesn't sit on your calendar.

Then **Phase 5**, where the feedback loop finally closes: first-party analytics (see what people actually click and save), trending, and a personalized digest.
