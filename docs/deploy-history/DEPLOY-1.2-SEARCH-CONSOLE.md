# Deploy Guide — Roadmap 1.2: Search Console + Crawl Readiness

**The highest-leverage ten minutes on the roadmap.** The site has ~120 genuinely useful URLs — venue schedules, city pages, neighborhoods, the evergreen weekend page — and the open web doesn't know any of them exist. This item introduces the site to Google properly: a clean crawl surface (code, done) and the Search Console setup (you, ~10 minutes of clicking).

## Part 1 — The code half (deploy first, small)

An audit found the crawl surface already in good shape from prior phases — `robots.txt` with the sitemap reference, admin pages noindexed, canonicals on all 13 content page types, no admin/saved leaks in the sitemap. Two gaps, now fixed:

1. **The homepage had no canonical tag** — every other page type did, but the most important URL on the site was missing its own. Search Console flags this as "Duplicate without user-selected canonical" the moment query parameters or trailing-slash variants get crawled. Fixed with an explicit homepage metadata export.
2. **`/api/` wasn't disallowed in robots.txt** — beacon endpoints have no business in a crawl budget.

Verified live in smoke: robots.txt correct, canonical present on `/`, `/this-weekend`, `/venues`, `/cities`, `/neighborhoods`, `/collections`, sitemap serving **120 URLs** with zero leaks. Gate green: 516 tests, clean build, 0 vulnerabilities.

**Deploy:** unzip over the repo, commit (`Search Console crawl readiness (roadmap 1.2)`) → push.

## Part 2 — The Search Console half (you, after deploy)

1. Go to **search.google.com/search-console** → Add property → choose **Domain** (not URL prefix). Enter `citypulsemn.com`. Domain properties cover www/non-www and http/https all at once, so host variants can never fragment your data.
2. Google gives you a **DNS TXT record**. Since your domain is on Vercel: Vercel dashboard → project → Settings → Domains → click the domain → DNS Records → add the TXT record (name: `@`, value: the `google-site-verification=...` string). Verification usually clears in minutes; if it stalls, wait an hour and hit Verify again — DNS propagation is the only variable.
3. Once verified: left sidebar → **Sitemaps** → enter `sitemap.xml` → Submit. Status should show "Success" with ~120 discovered URLs (the number breathes with active cities and events — that's correct).

## What to expect (so week one doesn't look broken)

- **Days 1–3:** "Discovered — currently not crawled" on most URLs. Normal.
- **Week 1–2:** the Pages report starts filling; indexed count climbs. Some pages sit at "Crawled — currently not indexed" — normal for a young domain; it improves as internal links and content depth (3.2) land.
- **Weeks 2–4:** the Performance tab shows first impressions for queries like venue names. That trend line is what the 2.1 ops digest will track — and rising impressions is one of Phase 5's revenue gates.
- Don't request manual indexing URL-by-URL; the sitemap plus time does this properly.

## Verify checklist
- [ ] `citypulsemn.com/robots.txt` live — four disallows + the sitemap line.
- [ ] View-source on the homepage: one `<link rel="canonical" href="https://citypulsemn.com"/>`.
- [ ] GSC property verified; sitemap status "Success."
- [ ] A week from now: tell me the indexed count — it becomes the first data point in the 2.1 ops digest.

## Rollback
The code change is two additive lines; roll back the deploy if anything looks off. The GSC property is non-destructive — it observes, never modifies.

---
**Phase 1 board:** 1.1 collapse SQL delivered (run it if you haven't) · **1.2 ✓ after your clicks** · 1.3 bio link · 1.4 paste one real IG card · 1.5 phone spot-check. Then the cockpit: **2.1 the ops digest** — the keystone.
