# Deploy Guide — Roadmap 4.1: Event Classification

**This is the fix for the empty Live Music collection.**

Your events were being categorized by *whichever research agent found them* — so a concert discovered by the food agent (because it's at a brewery) became a "food" event. That's why Live Music read **0** in July while Festivals held **69**. This change decides an event's category from **the event itself**.

**Code deploy + one script run.** No database migration, no new environment variables.

---

## What this changes

Every event — from the weekly pipeline, from community submissions, and the ones already in your database — now gets its category from its own title, venue, and description.

**Measured against 42 real events from your live calendar:**

| Category | Before | After |
|---|---|---|
| **Music** | **0** | **7** |
| Arts | 2 | 12 |
| Family | 0 | 1 |
| Unique | 0 | 1 |
| Sports | 4 | 5 |
| Food | 6 | 4 |
| **Festival** | **30** | **12** |

22 of 42 events were miscategorized. Live Music and Family Fun stop being empty; the bloated Festival bucket shrinks by more than half.

Full reference: `docs/CLASSIFICATION.md`.

## Quality bar (all green)
- 253 tests pass (46 new), typecheck clean, build clean, **0 vulnerabilities**.
- The new tests include a **golden set of ~35 real events from your live site**, hand-labeled — a permanent regression net for the taxonomy.
- The golden set earned its keep immediately: it caught two real bugs before shipping — brewery *venue names in titles* outvoting "live music," and "Country **Club**" being filed as a country-music concert. Both are now permanent test cases.

---

## Step 1 — Deploy the code

Unzip the new `citypulse-mn.zip`, copy **all** contents over your repo (replace), commit (`Event classification (roadmap 4.1)`) → push. Vercel redeploys.

New files: `lib/classify.ts`, `scripts/reclassify.ts`. Changed: `scripts/run-pipeline.ts`, `lib/submissions.ts`.

This makes all **future** events correct. Existing ones are fixed in Step 2.

## Step 2 — Backfill your existing events

The events already in your database still carry their old (wrong) categories. Fix them with the new script — **preview first**:

```bash
npm run reclassify -- --dry-run
```

This writes nothing. It prints every proposed change (`festival → music  Day Block Brewing Live Music Event`) and a before/after table. Read it — it should look like the table above.

When it looks right, apply it:

```bash
npm run reclassify
```

It's idempotent and safe to re-run. You'll need `DATABASE_URL` set (the same connection string Vercel uses — put it in a local `.env.local`, or run this from anywhere that has it).

> **If you'd rather not run scripts locally:** the next weekly pipeline run will re-classify events as it re-researches them, but that's gradual and only touches events it re-finds. The backfill is the clean, immediate fix.

---

## Verify

- [ ] `citypulsemn.com/collections` — **Live Music** and **Family Fun** now show real counts instead of "See what's coming."
- [ ] **Festivals & Markets** has dropped to a believable number.
- [ ] Open Live Music — you should see the brewery music nights, the concert bands, the Oratorio Society, the jazz dance.
- [ ] The category chips on the homepage now filter sensibly (tap "Music" — you get music).
- [ ] After the next Monday pipeline run, its log includes a `reclassified N` count.

---

## Notes

- **Nothing is lost.** Reclassifying only changes an event's category label; events, saves, and links are untouched.
- **The classifier is rule-based, not an AI call** — free, instant, deterministic, and it runs in CI. No new API costs.
- **When you disagree with a call,** add the event to the golden set in `lib/__tests__/classify.test.ts` with the category you want, then adjust the signals in `lib/classify.ts` until it passes. That's the workflow — the golden set is where taxonomy judgment calls get settled, so they're never re-litigated.
- Known judgment call already settled there: an all-ages art class is **arts**, not family. The event's *subject* wins.

## Rollback
Roll back the deploy. Categories that were already backfilled stay as they are (they're just labels) — re-running the old pipeline would gradually re-stamp them, but there's no data loss either way.

---

## What's next (roadmap v2)
- **4.2 Venue-anchored music discovery** — the classifier now correctly *labels* music, but the pipeline still has to *find* it. A venue registry (First Ave, Palace, Icehouse, Turf Club, the Dakota…) plus a bigger search budget for the most fragmented category. This is the other half of fixing Live Music.
- **4.3 Coverage monitor** — an admin view flagging any category that falls thin, so an empty collection can never again go unnoticed.
