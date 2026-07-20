# Deploy Guide — Roadmap 4.7: Title & Field Hygiene

**The last Phase 4 build item.** Titles on the live site carry metadata the agents copied from source pages — "(Weekly Tuesdays)", "— Weekly Thursdays (July 16)", "(Artistry / Bloomington Center for the Arts)", "(Exhibition)", "– Beach Tote Bag Giveaway" — plus "Saint Paul" and "St Paul" rendered on the same page. A title should carry the event's *name*; the structured fields already hold everything else.

**This is a code-only deploy. No database step, no backfill, no SQL to run.** After a week of Supabase surgery, that's by design — read on.

---

## The design decision that matters

Cleaning happens **at the read path, not at ingest**. Here's why that's the safe call:

The dedup key canonicalizer already strips *trailing* parentheticals before hashing — but mid-title parens and dash-suffixes are hashed **as-is**. If I rewrote stored titles, future re-finds of the same event would compute a *different* key from the raw agent title and create duplicates — the exact failure mode we spent 4.4 cleaning up.

Instead, `rowToEvent` — the single choke point every database read passes through — cleans titles and cities on the way out. Every consumer inherits it automatically: cards, day panel, detail pages, the digest email, `.ics` downloads, Google's JSON-LD, OG images, IG captions. The raw title stays in the database as provenance, and **the admin intentionally keeps showing it** — that's your view of what an agent actually returned. The sample-data fallback runs through the same cleaner, so previews match production.

## What gets cleaned

| Live example | Now displays as |
|---|---|
| Utepils Brewing Free Meat & Cheese Raffle **(Weekly Tuesdays)** | Utepils Brewing Free Meat & Cheese Raffle |
| Marketfest at Manitou Days **— Weekly Thursdays (July 16)** | Marketfest at Manitou Days |
| In the Heights **(Artistry / Bloomington Center for the Arts)** | In the Heights |
| Trail of Small Wonders **(Exhibition)** / Wicked **(Touring)** | Trail of Small Wonders / Wicked |
| Twins vs. Angels **– Beach Tote Bag Giveaway** | Minnesota Twins vs. Los Angeles Angels |
| "Saint Paul" / "St Paul" / "St. Paul" | **St. Paul**, everywhere |
| " - " and " — " mixed dashes | " – " (one style) |

## The prime rule: when unsure, KEEP

This is where the judgment lives, and every call is a named test: **"(COSA Fest)"** is an alias — kept. **"(World Premiere)"** is information — kept. **"– Weekend 1"** distinguishes Sever's two real weekends — kept. A paren naming a *different* venue than the event's own — kept (the venue-match strip requires ≥60% token overlap with the event's own venue/city fields). And if cleaning would gut a title, the original comes back untouched.

## Quality bar (all green)
- **378 tests pass (30 new)** — the golden set is built from real live-site titles collected during the audits, including the keep-cases above.
- Typecheck clean, build clean, **0 vulnerabilities**.
- Rendered-HTML smoke test: the homepage serves with cleaned titles and zero "(Weekly Tuesdays)"-style tags in the output.
- Consumer audit: multi-day run grouping unaffected (it strips parens for grouping already), the DB-side collapse reads raw titles (unaffected), admin shows raw (intentional).

One honest trade-off, documented in `docs/TITLES.md`: search runs over cleaned titles, so querying "exhibition" won't match a stripped tag — descriptions still carry those words. And "Minnesota Lynx Home Game" (no opponent) is a *data* gap, not formatting — the roadmap notes resolving opponents at verification time as the future fix.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Title & field hygiene (roadmap 4.7)`) → push. That's the whole deployment.

## Verify on the live site

- [ ] The Utepils raffle and Marketfest cards show clean names — no "(Weekly Tuesdays)", no "— Weekly Thursdays (July 16)".
- [ ] "Trail of Small Wonders" has no "(Exhibition)" tag.
- [ ] Every city reads "St. Paul" — no "Saint Paul" anywhere on a collection page.
- [ ] Sever's Fall Festival still says "– Weekend 1" (the keep-rule working).
- [ ] Admin event list still shows the raw titles (intentional — provenance).

## Rollback
Roll back the deploy. Nothing was written anywhere — the database is untouched.

---

## 🎉 Phase 4 is complete — for real this time

Classification (4.1), venue-anchored discovery (4.2), coverage monitoring (4.3), multi-day & duplicates (4.4), freshness verification (4.5), time integrity (4.6), and now title hygiene (4.7). The content engine finds events, labels them, collapses noise, re-checks what's imminent, keeps honest time, and presents clean names — with 378 tests holding it together.

**One data op still pending:** the multi-day collapse (your State Fair rows are still quadrupled). The export query stands — send it whenever and I'll generate the paste-ready SQL.

**Then Phase 5**, opening with **5.1 first-party analytics**: server-side counts of views, ticket clicks, saves, and calendar adds. It's the feedback loop that turns "what should we cover?" into a measurement — and it's what trending (5.2) and the personalized digest (5.3) are built on.
