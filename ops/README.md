# ops/

One-off and scheduled operator SQL.

- `COLLAPSE-1.1.sql` — **pending.** Roadmap 1.1 multi-day collapse: 93 clusters, 159 rows archived, 17 survivor span corrections. Run STEP 0 (pre-flight, expect zero rows) before STEP 1 (the transaction). Creates `collapse_backup_20260716` and includes a 3-line rollback. Read `COLLAPSE-1.1-GUIDE.md` first.
- `sql-history/` — previously executed one-off operations, kept for reference on how similar problems were handled (dedupe, time fixes, reclassification, moderation).

Rule for anything in here: back up first, run the pre-flight, check the count, and never delete an event — archive it.
