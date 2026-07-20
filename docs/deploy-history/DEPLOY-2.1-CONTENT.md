# Deploy Guide — Roadmap 2.1: Instagram Content Generator (the flywheel)

Turns your live event database into the week's Instagram kit: branded **1080×1350 cards** + ready-to-paste **captions with hashtags**, in the admin panel. Copy, download, post — no more manually hunting for what to feature. This is the flywheel: DB → IG post → citypulsemn.com → back into the feed.

**Code-only** update: no database migration, no new environment variables, no new dependencies.

---

## What you're deploying

- **A new "Content" tab** in `/admin` that, each week, shows:
  - **This Week — roundup** (a multi-event card + caption),
  - **Family pick** and **Uniquely MN pick** (your locked recurring formats),
  - **On the radar** (top general events, one per venue, spread across days).
- Each block has a **card preview**, a **Download card** button, and a **Copy caption** button.
- Cards render on demand at 1080×1350 in the site's brand (navy/gold frame, Oswald, skyline), via `/content/card/[id]` and `/content/week`.
- Picks and captions are generated from **published events in the next 7 days**, deterministically.

**Bonus fix included:** the OG share-image's gold frame was silently not rendering (a CSS shorthand the image renderer doesn't support). This deploy fixes that too, so shared event links now unfurl with the full framed card.

## Quality bar (all green)
- 140 automated tests pass (12 new: pick selection — windowing, family/unique routing, per-venue/day dedup — and caption/hashtag templates).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- Cards rendered and **visually verified** (single-event and weekly roundup, framed and on-brand); the Content tab loads behind admin auth; card routes are public but only render published events.

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

   Note: the brand font moved from `app/event/[id]/oswald-font.ts` to `lib/brand/oswald-font.ts` (now shared by the OG image and the new cards). If your file manager leaves the old copy behind, it's harmless, but a clean copy will remove it.

2. **Push.** GitHub Desktop → commit (`Instagram content generator (roadmap 2.1)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

---

## Verify on the live site

- [ ] Log into `/admin` → new **Content** tab.
- [ ] It shows this week's roundup, family/unique picks, and "on the radar" — each with a card preview and a caption. (If it says "No published events in the next 7 days," that just means the window is quiet right now — it fills in as upcoming events publish.)
- [ ] **Copy caption** copies the text; **Download card** saves the PNG.
- [ ] Open a card URL directly, e.g. `https://citypulsemn.com/content/week` — you should see the framed navy/gold roundup card.
- [ ] Bonus: re-share an event link (or open `…/event/{id}/opengraph-image`) — the gold frame now shows.

### Posting workflow
On Sunday: open **/admin → Content**, download the cards you want, copy their captions, and post to `@CityPulseMpls` / `@MinneapolisMNHappenings`. The captions already point back to citypulsemn.com (link in bio).

---

## Notes

- **Card routes are public** by design (they only render *published* events — nothing private), so previews and downloads work straight from the admin page.
- **Everything is live-data driven:** fix an event in the Events tab and its card/caption update automatically.
- **Deterministic:** same data in, same feed out — a consistent weekly rhythm.
- The current selection scores events by data completeness, weekend timing, and free admission (there's no engagement data feeding it yet — that arrives with roadmap **5.4**, after which picks can be popularity-ranked).

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant.

---

## What's next on the roadmap
The flywheel's core is in. Natural follow-ons: **2.2 Email capture** (turn the audience the IG drives into an owned list), or the quick UX wins **2.5 Price/Area filters** and **2.3 Add-to-calendar**. Later, a scheduled job could auto-render and stage these cards. Your call — we'll build it the same way.
