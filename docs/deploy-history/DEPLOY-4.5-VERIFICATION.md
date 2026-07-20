# Deploy Guide — Roadmap 4.5: Freshness Re-Verification

**Phase 4's last piece.** Events are discovered weekly, but reality changes daily — before this, a show cancelled on Tuesday sat on your calendar until Monday's research run, and anyone who drove to a dead show would never trust the site again.

Now, every **Thursday morning** (before the weekend), a verification agent re-checks the next 7 days of events against their sources.

**One database step (a single column), one deploy, one GitHub secret check.**

---

## What you're deploying

A `verify-events` workflow that runs Thursdays at ~11am Central (and on-demand, with a dry-run option):

1. Picks the next 7 days of published events — **soonest first** (tonight's show matters more than Sunday's), capped at 40.
2. A verification agent reads each event's source page and returns a verdict.
3. The verdicts are applied under a deliberately cautious policy.

## The policy — read this part

| The agent says | What happens |
|---|---|
| Still scheduled | `verified_at` stamped |
| **Cancelled, with evidence** (URL or quoted wording) | **Auto-cancelled** — banner on the event page, cancelled status in calendar exports, logged to the audit trail |
| Cancelled, *no evidence* | Downgraded to a flag — the agent must show its work |
| Date/time changed | **Flagged, never auto-edited** — you fix times in the admin editor; an AI misreading a webpage must not corrupt good data |
| Sold out | Flagged (informational) |
| **Page not found** | **Flagged only — never cancels.** A vanished page is not evidence; sites reorganize constantly. A false cancellation is worse than a stale listing. |

That asymmetry is the design: the one automated change is the one where being slow hurts people (a cancelled show still on the calendar), and even that requires evidence.

Full reference: `docs/VERIFICATION.md`.

## Quality bar (all green)
- 328 tests pass (12 new — every row of the policy table above has an explicit test, including "an evidence-free cancel verdict is downgraded" and "not_found never cancels").
- Typecheck clean, build clean, **0 vulnerabilities**.
- The runner script fails loudly without credentials and supports `--dry-run` end to end.

## Cost
≤5 agent batches and ≤60 web searches, **once a week**. Small next to the Monday research run. If you ever want daily checks, it's one line in the workflow cron.

---

## Step 1 — Database

In **Supabase → SQL Editor**, run `db/schema.sql` (idempotent). Adds one column: `events.verified_at`.

## Step 2 — Deploy the code

Unzip `citypulse-mn.zip`, copy **all** contents over your repo, commit (`Freshness re-verification (roadmap 4.5)`) → push.

## Step 3 — Secrets (probably already done)

The workflow uses `DATABASE_URL` and `ANTHROPIC_API_KEY` from GitHub Actions secrets — the same two the weekly research run already uses. If Monday runs work, this works. Nothing new to add.

## Step 4 — Test it

**GitHub → Actions → Verify Upcoming Events → Run workflow**, set **dry run = true**. The log shows each batch and verdict, changing nothing:

```
[verify] 23 event(s) to re-check (DRY RUN)
[verify] batch 1: Trampled by Turtles · Twins vs. Guardians · …
[verify]   ⚑ SOLD_OUT "Trampled by Turtles" — listed as sold out
[verify] confirmed 21, cancelled 0, flagged 2
```

If it looks sane, it's live — Thursdays take care of themselves.

---

## Verify over time

- [ ] The dry run completes and the verdicts look reasonable.
- [ ] After a real run, spot-check a confirmed event — nothing visibly changes (that's correct; `verified_at` is internal).
- [ ] If a cancellation ever fires, the event page shows the "cancelled" banner and the evidence is in the audit log (`admin_audit`, action `verify_cancel`).

## Rollback
Disable the workflow (Actions → Verify Upcoming Events → ⋯ → Disable). Any cancellation it applied can be reversed in the admin (restore the event), and the audit log shows exactly why each one happened.

---

## 🎉 Phase 4 complete

Classification (4.1), venue-anchored discovery (4.2), the coverage monitor (4.3), multi-day handling (4.4), and freshness (4.5). The content engine now **finds** events properly, **labels** them by what they are, **collapses** noise, **re-checks** what's imminent, and **tells you** when any category runs thin.

**Next is Phase 5**, and the natural opener is **5.1 first-party analytics** (`event_stats`): server-side counts of views, ticket clicks, saves, and calendar adds — queryable in your admin, joinable against your own data. It's the feedback loop that turns "what should we cover?" from a guess into a measurement, and it unlocks trending (5.2) and the personalized digest (5.3).
