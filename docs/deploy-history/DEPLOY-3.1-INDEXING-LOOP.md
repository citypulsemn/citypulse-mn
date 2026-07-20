# Deploy Guide — Roadmap 3.1: The Indexing Loop

**Pages that aren't indexed don't exist.** 1.2 did the *submit*; 3.1 completes the loop: the site's crawl surface is now audited to the slug level, and the *measure* half is wired into the Monday ops digest automatically. From here, "is Google taking what we're offering?" is a glance, not an investigation.

**Code-only deploy. No database step, no new secrets.** (The new baseline key rides in the existing `ops_digest_runs.totals` jsonb — additive and backward-compatible; old rows simply read "first report.")

---

## The audit — slug level this time

1.2 verified the index pages; 3.1 verified the *fleets*, live in smoke rather than by reading source:

| Page type | Canonical | Notes |
|---|---|---|
| `/event/[id]` | ✓ self | |
| `/day/[date]` | ✓ self | invalid dates **404** — no infinite crawl space for `/day/2050-13-99` |
| `/venues/[slug]` · `/neighborhoods/[slug]` · `/cities/[slug]` · `/collections/[slug]` | ✓ self | right host, no variants |
| `/ongoing` · `/this-weekend` · all indexes · homepage | ✓ | from 2.2/1.2 |
| `/saved` | **noindex** + robots-disallowed | belt and braces — disallow alone doesn't prevent URL indexing from external links |

Genuinely nothing to fix — the audit's job is to *prove* that, live, which it did. The discipline of prior builds paid its dividend here.

## The measure half — the ops digest's 7th section

**Index surface**, automatic every Monday:

```
## Index surface
- 121 URLs in the live sitemap (+3% WoW)
- demand side: check GSC Pages + Performance for indexed count & impressions
```

The design choice that matters: the gather **fetches the live `sitemap.xml` over HTTP and counts `<loc>` entries** — it reads the same XML Google reads, so the number can never drift from reality the way a re-implementation of sitemap logic would. Resilience-wrapped like every section: unfetchable sitemap → an alert line, email still sends. The count becomes next week's WoW baseline, stored alongside engagement totals.

Supply side automatic; demand side stays your two-minute GSC glance by design (the API can wait until the numbers are worth automating).

## The react half — a decision table, written down

`docs/INDEXING.md` now holds the loop's playbook: what "Discovered — not crawled" means (wait), when "Crawled — not indexed" demands action (>4 weeks on money pages → 3.2 content depth), what an indexed-count drop the same morning as a pipeline alert tells you, why orphan pages never index, and what impressions-without-clicks points at (3.3). The loop isn't just wired — its operating manual exists.

## Quality bar (all green)
- **546 tests (3 new)** — the Index section's WoW render, first-report behavior, unfetchable-sitemap-is-an-alert; the all-sections-down resilience test now proves a **seven**-alert email still composes.
- Live smoke: every slug-level canonical verified by actually crawling one of each; the 404 boundary; the noindex meta; the section rendered from the pure composer.
- tsc clean · build clean · 0 vulnerabilities · zip contents verified post-package (the 2.2 lesson, now habit).

---

## Deploy

Unzip over the repo, commit (`Indexing loop (roadmap 3.1)`) → push.

## Verify

- [ ] Next Monday's ops digest includes **Index surface** with a URL count. First one says "first report" — correct.
- [ ] The count roughly matches GSC's "discovered" universe over time.
- [ ] Your weekly glance: GSC → Pages (indexed trending up?) → Performance (impressions appearing?). ~2 minutes; the decision table in `docs/INDEXING.md` covers everything you might see.

## Rollback
Roll back the deploy. The ops digest reverts to six sections; nothing else changed.

---

## The board

Phase 2 ✓ complete · **3.1 ✓**. The loop is closed: supply measured automatically, demand a weekly glance, reactions written down. Next: **3.2 content depth** — your editorial paragraphs on the top venues and all 16 neighborhoods (my plumbing, your voice, `TODO(taren)` placeholders) plus the "More at this venue" strip — which is exactly the lever the decision table reaches for when pages sit at "Crawled — not indexed."
