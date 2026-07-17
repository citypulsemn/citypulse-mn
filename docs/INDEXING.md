# The indexing loop

Roadmap 3.1 — submit → measure → react. Pages that aren't indexed don't exist.

## Submit (done once, 1.2)
Domain property in Search Console, sitemap.xml submitted. The crawl surface is clean: robots.txt (admin/saved/api disallowed), canonicals on every page type including slug pages (event, day, venue, neighborhood, city, collection, this-weekend, ongoing), /saved additionally noindexed, invalid day keys 404.

## Measure (weekly, two halves)
- **Supply side — automatic.** The ops digest's "Index surface" section fetches the LIVE sitemap and counts URLs, with week-over-week delta. It reads the same XML Google reads — zero drift by construction. The count breathes with active cities and upcoming events; steady growth is the healthy shape.
- **Demand side — your 2-minute GSC glance.** Pages report: indexed count trending up? Performance report: impressions appearing for venue/city queries? These two numbers are the loop's output — and rising impressions is one of Phase 5's revenue gates.

## React (the decision table)
| Observation | Action |
|---|---|
| "Discovered — not crawled" for days | Normal for a young domain; wait |
| "Crawled — not indexed" persisting >4 weeks on money pages | Deepen content: 3.2 editorial paragraphs + internal links |
| Indexed count drops week-over-week | Check the ops digest's pipeline + sitemap sections the same morning — did the supply shrink or did something break? |
| A page type never indexes | Check its canonical + an internal-link path to it; orphan pages don't index |
| Impressions but no clicks | Titles/descriptions: 3.3's OG/social cards and metadata polish |
