# Deploy Guide — Roadmap 4.2: Venue-Anchored Discovery

**4.1 fixed how music gets *labeled*. This fixes whether it gets *found* at all.**

Here's the tell from the 4.1 backfill: it surfaced 16 music events — and **not one was a First Avenue, Palace, Turf Club, Icehouse, or Dakota show**. They were brewery choir nights and music festivals that other agents stumbled across. The actual live-music calendar of the Twin Cities was never being discovered, because the music agent had **8 web searches to cover 30 days across the whole metro**. First Avenue alone books more shows than that in a month.

**Code-only deploy.** No database migration, no new environment variables.

---

## What you're deploying

A **venue registry** (`lib/venues.ts`) — 30 real music rooms (First Ave & 7th St Entry, The Armory, Palace, Fillmore, Fine Line, Varsity, Uptown, Turf Club, Icehouse, Cedar Cultural Center, Dakota, Hook & Ladder, Berlin, Amsterdam, Green Room, 331 Club, Crooners, Parkway, Cabooze, Mystic Lake Amphitheater, Surly Festival Field, Lake Harriet Bandshell, Como Pavilion, Orchestra Hall, Ordway, Xcel, Target Center, Ames Center, Hopkins Center, Paisley Park) plus 12 family anchors (zoos, museums, libraries, the Arboretum).

The pipeline now shards that registry into groups of 5 and hands each group to its own sub-agent whose job is narrow and achievable: *walk these five venue calendars and list everything in the window*. Coverage becomes a function of the venue list instead of whatever a generic search happens to surface.

**Want better music coverage? Add venues.** That's the whole model.

Full reference: `docs/VENUES.md`.

## Quality bar (all green)
- 286 tests pass (15 new), typecheck clean, build clean, **0 vulnerabilities**.
- One test is worth calling out: **every venue's city must map to a real area**. If a venue's city isn't in `lib/areas.ts`, every event found there silently lands in the "Elsewhere" bucket and disappears from your area filters. That's exactly the kind of quiet failure that produced the empty-collection problem in the first place — now it's impossible to introduce.
- Sweeps compose correctly with the 4.1 classifier: a comedy night at the Turf Club is still filed as **arts**. The registry says where to look; the classifier says what it is.

---

## Deploy

Unzip the new `citypulse-mn.zip`, copy **all** contents over your repo (replace), commit (`Venue-anchored discovery (roadmap 4.2)`) → push. Vercel redeploys.

New file: `lib/venues.ts`. Changed: the pipeline, the agent, the prompts, `lib/pipeline-config.ts`.

Nothing else to do — **the payoff arrives with the next Monday pipeline run.**

---

## ⚠️ One thing to know: this costs more

The music budget goes from **8 searches/week → ~72**. In total, sweeps add **9 sub-agents and ~108 web searches** to each weekly run.

That's the honest price of actually having a live-music calendar, and it's still a modest weekly bill (Sonnet + web search, once a week). But you should know it before it shows up on your Anthropic usage.

To tune it, edit `lib/pipeline-config.ts`:
- `VENUES_PER_SHARD` (default 5) — bigger shards = fewer agents, but each has more calendars to cover in its budget.
- `VENUE_SWEEP_SEARCHES` (default 12) — searches per shard.

Or simply trim the venue registry. Sweeps only run in the **near band** (next 30 days), so they don't multiply across the mid/far horizons.

---

## Verify (after the next pipeline run)

- [ ] The pipeline log shows `venue sweep 1/6: First Avenue & 7th St Entry, The Armory, …` lines, and a `venue-swept N` count in the final summary.
- [ ] **citypulsemn.com/collections → Live Music** now contains actual club shows — touring bands at First Ave, shows at the Turf Club and Icehouse — not just brewery choir nights.
- [ ] Tap the **Music** category chip on the homepage: it should feel like a real Twin Cities music calendar.
- [ ] **Family Fun** likewise fills out from the zoos, museums, and libraries.

You can also trigger a run manually from **GitHub → Actions → Weekly Research → Run workflow** rather than waiting for Monday.

## Rollback
Roll back the deploy — the pipeline reverts to generic search. Nothing in the database changes, and any events already discovered stay.

---

## What's next
**4.3 — Coverage monitor.** You've now fixed classification (4.1) and discovery (4.2), but you still have no instrument that would *tell* you if a category went thin again. Right now you'd find out the way you did last time: by looking at the site and noticing. 4.3 puts events-per-category-per-week in the admin with a red flag below a floor — cheap insurance that keeps 4.1 and 4.2 from silently regressing.
