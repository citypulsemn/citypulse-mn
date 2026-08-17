# Deploy — Sitemap lastmod (fix the discovery blocker)

*Aug 16, 2026. Direct fix for the finding from the new GSC indexation check:
`/places`, its kind pages, and `/this-week` all report **"URL is unknown to
Google"** — Google never discovered them — despite being in the sitemap,
internally linked, and robots-allowed. The differentiator: the sitemap carried
**zero `<lastmod>`**, and the undiscovered pages are ~2 weeks old on a young,
low-authority site.*

## The diagnosis (grounded, not guessed)
GSC URL Inspection (via the `gsc-report` indexation check):

| URL | State |
|---|---|
| `/this-weekend` | **PASS — indexed** (last crawl Jul 27) |
| `/this-week` | URL is unknown to Google |
| `/places`, `/places/*` | URL is unknown to Google |

Ruled out with live checks: the pages **are** in the live sitemap (1213 URLs,
confirmed present), robots.txt **allows** them and declares the sitemap, and
they're internally linked (TopBar + footer). The only structural gap: the sitemap
had **no `<lastmod>` on any of 1213 URLs** (`grep -c "<lastmod>"` → 0). Without a
freshness signal, Google had no reason to re-crawl the sitemap and pick up
`/this-week` + `/places`, which were added *after* its last effective crawl (the
older `/this-weekend`, crawled Jul 27, made it in). This is discovery lag, not a
ranking-maturity wait.

## What shipped
[app/sitemap.ts](../../app/sitemap.ts): a **day-stable `lastModified`** on the
evergreen browse surfaces — `/`, `/this-week`, `/this-weekend`, `/ongoing`,
`/collections` + each collection, `/places` + each kind, `/neighborhoods` + each,
`/cities` + each, `/venues` + each, and the day pages. The value is
`new Date(chiDayKey(new Date()))` — parsed from the Chicago day key, so it's
**day-granular** (doesn't thrash hourly, which would make Google distrust it) and
**honest** (these pages' content is event-derived and genuinely rolls daily).
Event detail pages and the two static pages (`/submit`, `/for-venues`) keep no
lastmod — events are already indexed and stable; static pages don't change.

## Verification
- Tests +3 (1083 total): source tripwires — `today` derived from `chiDayKey`, and
  `lastModified: today` applied to `/places`, `/this-week(end)`, the kind/collection
  maps, the homepage, and day pages. (The sitemap route reads the DB, so it's
  guarded by source per convention.)
- Gate: `tsc` clean · 1083/1083 · `npm run build` clean · `npm audit` 0.
- Post-deploy, confirm live: `curl -s https://www.citypulsemn.com/sitemap.xml |
  grep -c "<lastmod>"` should jump from 0 to ~260+ (browse + day pages).

## THE BIGGER LEVER IS MANUAL (Taren, in GSC — do this too)
`lastmod` helps Google *schedule* a recrawl, but for a handful of important
brand-new URLs the fastest path is to force it:
1. **GSC → URL Inspection** → paste `https://www.citypulsemn.com/places` →
   **Request Indexing**. Repeat for `/this-week`, `/places/splash-pad`,
   `/places/rink`, and 2–3 other top kind pages. (There's a daily quota; do the
   most important ~10.)
2. **GSC → Sitemaps** → confirm `sitemap.xml` shows **Success** and ~1213
   discovered. If it shows a stale/low count or an error, resubmit it.
3. Re-run the **GSC Report** workflow in ~1–2 weeks — the indexation check should
   flip `/places` + `/this-week` from "unknown" to "Discovered"/"Submitted and
   indexed."

## Why this matters
Every hour spent building Places content produced zero return because Google
literally didn't know the pages existed. This unblocks the *entire* Places vertical
and the `/this-week` conversion shop-window for indexing — the precondition for any
of that SEO work to pay off.

## Rollback
`git revert`. `lastModified` is an additive, optional field; removing it restores
the prior (lastmod-less) sitemap. No data or schema involved.
