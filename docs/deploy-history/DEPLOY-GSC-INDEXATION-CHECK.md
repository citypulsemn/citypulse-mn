# Deploy — GSC indexation check (is /places even indexed?)

*Aug 16, 2026. An addition to the `gsc-report` diagnostic. The "what's ranking"
read showed Places with ~0 impressions; this answers the follow-up that decides
whether to keep building Places: is `/places` **not indexed** (a fixable blocker)
or **indexed but not ranking yet** (a maturity wait — stop building kinds on
faith)?*

## What shipped
- **`inspectUrls(paths)`** ([lib/search-console.ts](../../lib/search-console.ts))
  — the Search Console **URL Inspection API** on the F2.4 service account.
  Returns each URL's `verdict` + `coverageState` ("Submitted and indexed",
  "Crawled - currently not indexed", "URL is unknown to Google", …) + last crawl.
  **Requires the SA be a FULL user** on the property (Restricted can't inspect —
  we bumped it to Full at F2.4 wire-up). Never-break: `[]` when unwired, and a
  per-URL failure becomes an ERROR row rather than throwing.
- **`resolveInspectionUrl(path, base)`** — pure/tested helper (the API needs an
  absolute inspectionUrl; bare paths get the site base, trailing slash collapsed).
- **`gsc-report` now prints an INDEXATION CHECK** ([scripts/gsc-report.ts](../../scripts/gsc-report.ts))
  for `/places`, three kind pages, and `/this-week` + `/this-weekend` (also useful
  — are the discovery shop-windows indexed after the routing pass?). The workflow
  ([.github/workflows/gsc-report.yml](../../.github/workflows/gsc-report.yml)) now
  passes `SITE_URL` so the inspection URLs resolve to the canonical www host.

## Verification
- Tests +3 (part of 1080 total): `resolveInspectionUrl` (path→absolute, trailing
  slash, pass-through absolute); `inspectUrls` → `[]` with no key (never-break).
- The live URL Inspection path runs only with the secret (Actions) — verified at
  first real run, same as the F2.4 query path. Behind the never-break contract.
- Gate: `tsc` clean · 1080/1080 · `npm run build` clean · `npm audit` 0.

## How to use
Run **Actions → GSC Report → Run workflow**. The output now ends with an
INDEXATION CHECK block. Read it as:
- **"Submitted and indexed"** on `/places*` → Places IS indexed; the 0 impressions
  are a ranking-maturity issue (hard SERP). Don't keep building kinds on faith;
  the lever is authority/links/time or a pivot to demand-validated pages.
- **"Crawled - currently not indexed" / "URL is unknown to Google"** → an
  indexation blocker (fixable — sitemap, internal links, crawl budget). Fix that
  before any more Places content.

## Rollback
`git revert`. `inspectUrls` is read-only and additive; removing it leaves the
`gsc-report` query/page sections intact.
