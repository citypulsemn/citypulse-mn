# Deploy — Pipeline coverage for the demand-validated clusters

*Aug 17, 2026. Tunes the weekly research agent's category source-hints to
exhaustively capture the recurring events the GSC read proved real search demand
for — food-truck festivals and cultural/ethnic festivals — so the transactional
traffic that's already arriving lands on events we actually list.*

## Why this (and why it's not gated on indexing)
The GSC "what's ranking" report showed the site's traffic is transactional: people
search specific events by name and land on the event page. Two clusters stood out
with real, repeated demand:
- **Food-truck festivals** — "mn/minnesota/anoka/rosemount food truck festival"
  (position 1–4, 20–27% CTR).
- **Cultural / ethnic festivals** — "st maron lebanese festival", "lebanese
  festival", plus night markets ("asian street food night market").

Unlike the Places SEO work, this doesn't wait on indexation — it improves the
*data* behind pages that are already indexed and drawing clicks. Recon of
`lib/agents/prompts.ts` found the gap: the `food` hint mentioned food-trucks only
in passing, and the `festival` hint had **no mention of cultural/ethnic/heritage
festivals at all** — the exact vein the Lebanese festival demand sits in.

## What changed
[lib/agents/prompts.ts](../../lib/agents/prompts.ts) — two `SOURCE_HINTS` entries,
the strings that steer each weekly research agent (same lever as the earlier
`weird`-coverage fix):

- **`food`** — now explicitly seeks **food-truck festivals & rallies** (naming
  recurring ones: Minnesota / Anoka / Rosemount, plus brewery "food truck night"
  and city "food truck rally" events, with a `'food truck festival <suburb>
  <month>'` search cue) and **night / street-food markets** (Asian night markets,
  Little Mekong Night Market, maker/food markets).
- **`festival`** — adds **cultural, ethnic & heritage festivals** as a stated
  priority, with concrete metro anchors so the agent knows what to look for:
  Festival of Nations, Hmong (Freedom Celebration, MN Hmong New Year), Somali /
  East African, Middle Eastern / Lebanese (St Maron), Greek, Irish (Irish Fair),
  Scandinavian/Nordic, German (Oktoberfest), Cinco de Mayo / West Side, Juneteenth,
  powwows, Diwali, Lunar New Year, and community heritage festivals.

Additive and prompt-only — no schema, no pipeline-flow change. Classification still
re-checks each event's category honestly (`lib/classify.ts`), so a cultural
festival found by the festival agent still lands in whatever category it truly is.

## Verification
- **Tests +3**: `buildResearchPrompt` structure (category/window/scope/JSON
  contract) + tripwires that the food hint names food-truck festivals/rallies +
  night markets, and the festival hint names cultural/ethnic/heritage festivals
  with concrete anchors (Festival of Nations, Hmong, St Maron, Juneteenth). These
  pin the intent so a future edit can't silently drop the coverage.
- Gate: `tsc` clean · 1091/1091 · `npm run build` clean · `npm audit` 0.
- **The real proof is Monday's pipeline run** (or a manual `weekly-research`
  workflow_dispatch): watch the `food` and `festival` counts and whether cultural
  festivals + food-truck festivals show up. No local Anthropic key here, and a
  full run writes to prod + costs API — so it's verified on the scheduled run, the
  same way the `weird`-coverage fix was.

## Deploy steps
Merge to `main`. The prompts take effect on the **next weekly research run**
(Mondays 06:00 UTC) — no deploy of the site needed (the pipeline reads the repo at
run time via Actions). To see it sooner: Actions → Weekly Event Research → Run
workflow (a real run — writes events, incurs API cost).

## Verify checklist (after the next run)
- The `food`/`festival` category counts hold or rise in the ops digest.
- Spot-check the calendar for new cultural/ethnic festivals and food-truck
  festivals not previously listed.
- Coverage stays honest — no invented events (the agent still requires a
  `source_url` per event).

## Rollback
`git revert`. The hints revert to the prior strings; the next run uses them. No
data migration — past events already found stay as they are.
