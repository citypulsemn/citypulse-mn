# Hotfix — Vercel build timeout on Collections pages

## What went wrong
The Vercel build failed with errors like:
> Failed to build /collections/[slug]/page: /collections/live-music … because it took more than 60 seconds.

This was **not** a 3.1 (digest) problem — it was the Collections pages from 2.4.

Those pages were configured to **pre-render every collection at build time**, and each one reads from your live database. During the build, all 9 collection pages (8 topics + the index) tried to query Supabase **at the same time**, overwhelmed the database's connection limit, and each render hung past Vercel's 60-second cap. It never showed up locally because local builds use bundled sample data — there's no database connection to overwhelm.

The 8 non-collection pages built fine (they each make one quick call), which is why the log stopped at "8/17".

## The fix
The collection pages now render **on first visit and then cache**, instead of all at once during the build — the standard pattern for database-backed pages:
- Collection topic pages (`/collections/live-music`, etc.) are generated on demand and cached for 5 minutes (same speed and SEO for visitors, no build-time database load).
- The collections index (`/collections`) renders per request.

After the fix, the build prerenders **8 static pages and zero collection pages** (confirmed locally: build exits 0, and no collection slugs appear in the build's static-generation step). Nothing else changed — 190 tests still pass, 0 vulnerabilities.

## Deploy
1. Unzip the new `citypulse-mn.zip` and copy **all** contents over your repo, replacing everything (only two files changed: `app/collections/page.tsx` and `app/collections/[slug]/page.tsx`, but copy all to be safe).
2. Commit (`Fix collections build timeout`) → **Push**.
3. Vercel rebuilds — it should now go green.

No database or environment changes are needed for this fix.

## Verify on the live site
- [ ] The Vercel build succeeds.
- [ ] `citypulsemn.com/collections` loads and shows the collection cards.
- [ ] Opening a collection (e.g. `/collections/live-music`) works — the first load may be a hair slower while it generates, then it's cached.

## Why this is the right fix (not just a workaround)
Pre-rendering hundreds of database-backed pages at build time is fragile on any host — it couples deploys to database availability and connection limits. On-demand rendering with caching is how database-driven pages are meant to scale: the build stays fast and DB-free, pages are cached after first view, and new events still appear within the 5-minute refresh window. Your day and event pages already work this way.

## Note on the digest (3.1)
3.1 itself was fine — this failure was pre-existing in the collections code and would have surfaced on the next deploy regardless. Once this build is green, the digest (and everything from Phase 2) is live. Remember the digest still needs its Resend setup and secrets from `DEPLOY-3.1-DIGEST.md` before it will actually send email.
