# Run Guide — 1.1 Multi-Day Collapse (COLLAPSE-1.1.sql)

**What this does:** archives 159 rows and corrects 17 survivors, from the export you pasted. Nothing is deleted — every touched row's before-state is snapshotted into `collapse_backup_20260716` inside the same transaction, and a 3-line rollback (bottom of the file) restores everything exactly.

## The headline clusters
| Cluster | Rows → | Survivor |
|---|---|---|
| **Minnesota Renaissance Festival** | **19 → 1** | one card, "Aug 22 – Oct 4" |
| **Sever's Fall Festival** | **15 → 1** | one card, "Sep 4 – Oct 4" |
| **Can Can Wonderland** (ongoing-attraction listings) | **12 → 1** | distinct dated shows (Drumeoke, CircusLand, First Friday) kept |
| **Minnesota State Fair** | **6 → 1** | "Aug 27 – Sep 7," clean title, right category |
| Skyline Mini Golf / Trail of Small Wonders / MN Zoo GA / theater runs (Guys & Dolls, Annie, Dirty Dancing, In the Heights) | each → 1 | run dates set from attested rows |
| ~55 same-day duplicate pairs/triples | → 1 each | cleaner title kept |
| 22 sports same-day duplicates | → 1 each | **never across days** — the Saints rule held; every Twins/Lynx/Saints/Loons game on a distinct day survives untouched |
| 2 junk rows | archived | "Closed for Private Event," "Lynx Playoffs (if applicable)" |

Where a run's true end wasn't attested by your own data, I used the **last attested date** as a conservative floor (noted in comments) rather than inventing one — e.g. Scream Town shows "through Oct 3" for now; the verify pass or a source check can extend it to Halloween.

## How to run (Supabase SQL Editor, ~3 minutes)
1. **STEP 0 (paste alone):** the pre-flight. It lists any id in the plan that doesn't exist in your table — **expect zero rows**. Since your export traveled through chat, this is the guard against any transcription slip; a non-matching id simply archives nothing.
2. **STEP 1 (paste the transaction):** backup table → archives → survivor updates → a count check that should read **159**. If it's lower, compare with STEP 0's output and tell me the ids.
3. Re-check the site: `/collections` festival count deflates; RenFest, Sever's, and the State Fair each show once with a run badge; `/this-weekend`'s "Happening all weekend" picks up the long runs; a Twins homestand still shows every game.

## Left alone on purpose (the honest list)
Weekly series stay as designed (Melodies on the Mississippi, Utepils, Day Block, farmers markets, Drag Bingo, Como Little Explorers, the Improv series). And ~14 rows have **conflicting facts I can't adjudicate from here** — different dates or opponents for what's probably one event. These are flagged for the Thursday verify pass rather than guessed at: Lynx 7/15 (three different opponents listed) and 8/9 (Dallas vs Portland + a placeholder), Twins 9/8 (White Sox vs Guardians) and 9/15 (Tigers vs Yankees), Woodbury Days' extra 8/7 & 8/28 rows, Uptown Porchfest 8/8 vs 8/15, JUNGLE 9/9 vs 9/13, Open Streets 9/13 row, Edina Fall into the Arts dates, ROCtoberfest dates, Taste of Lakeville 8/13, Water Lantern dates, Anoka FTF 9/1, Lakeside Guitar dates, Arboretum vs Art in the Gardens.

Roadmap 1.1 ✓ when the count check reads 159. Next on the checklist: **1.2 Search Console** — the ten-minute one.
