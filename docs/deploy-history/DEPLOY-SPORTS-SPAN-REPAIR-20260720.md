# Deploy — Sports series-span repair (data + collapse guards)

*July 20, 2026 (evening). The follow-on the R0.2 probe exposed: legacy sports rows
carrying `multi_day_end` spans, plus the ghost-series rot underneath them.*

## Root cause (closed)

20 sports rows (14 published) carried spans, all ending `04:59` — the rule-9 double-shift
fingerprint. Written weeks ago by the old collapse while the rows wore wrong categories
(June's pre-reclassify taxonomy); reclassify later made them "sports" with spans baked in.
Nothing writes sports spans today — and now nothing *can*:

## Code shipped (`lib/multiday.ts` + 2 golden tests)

- `planCollapse` treats sports rows as **single-day intervals always** — a corrupted span
  can no longer absorb (and archive) real per-game rows inserted inside its window. This
  was live risk: the Saints/Twins series land in the pipeline horizon before Jul 27.
- Sports clusters can never produce a `setEnd` — deduping a same-day pair where one row
  carries a legacy span will not write a fresh span onto the survivor.

## Data applied (Taren-confirmed; 3 backups in session scratchpad)

1. **Spans cleared:** all 20 (`sports-spans-backup-20260720.json`).
2. **36 schedule-verified ops** (`sports-repair-backup-20260720.json`) — every op matched
   exactly one row or aborted. Sources: ESPN Twins schedule, milb/CHS Field (Saints),
   MLS listings (Loons), CBS (Lynx). Highlights:
   - **17 archived games restored** (the old collapse had archived, never deleted them):
     Saints–Columbus ×3, Twins–Royals ×2, Saints–Louisville ×5, Twins–Braves ×2,
     Saints–Toledo ×4 (net), Twins–White Sox ×2, Twins–Tigers ×2, Twins–Rangers ×1 —
     with corrected times (several were stored as 7:40 AM ballgames).
   - **Two games were on the wrong DAY**: Phillies G1 (Aug 14 → real Aug 13) and Braves
     G1 (Aug 18 → real Aug 17).
   - **False series archived**: Twins–Yankees "Sep 4–7" and Twins–Tigers "Sep 5–7"
     (Twins are on the road; Yankees really visit Sep 14–16).
3. **8 more ghosts swept** (`sports-ghosts-backup-20260720.json`), caught by read-back
   verification: Royals rows on Tigers' dates, Tigers rows on White Sox dates, White Sox
   rows on road days, a Rangers row on a no-game day, and both Lynx "Home Game"
   placeholders (no Lynx home games Jul 25/26/29; next real one is Jul 28 vs Toronto).

**Read-back:** all 9 series match their verified schedules, one game per day; zero sports
spans; zero live placeholders. Unattested-time games (Saints weekday standards) were
restored WITHOUT `verified_at` so the Thursday pass surfaces them.

## Known coverage gaps (pipeline's job, not invented here)

Attested games with NO row on the site: Twins–Yankees **Sep 14** and **Sep 16** (only the
verified Sep 15 card exists) · Lynx vs Toronto Tempo **Jul 28** (~7 PM CT). The weekly
sweep should pick these up; check after Jul 27, add via admin if it misses.

## Quality gate

tsc clean · 600/600 (2 new) · build clean · audit 0 · read-back verification green.

## Rollback

Code: `git revert`. Data: three backup JSONs restore every prior state.
