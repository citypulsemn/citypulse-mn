# The evergreen weekend page

Roadmap 6.3. `/this-weekend` — one permanent URL that always answers the highest-intent search in local events ("things to do in the twin cities this weekend") and serves as the Instagram bio link. Title and URL never carry dates; only the content rolls with the clock.

## The weekend clock (`lib/weekend.ts`, pure, golden-tested)

America/Chicago, like everything on the site: Mon–Thu → the upcoming Fri–Sun · Friday → today through Sunday · Saturday → Sat+Sun (tonight still counts) · Sunday → Sunday only · Monday it flips to the NEXT weekend. Never stale, never shows a day that already ended.

## Grouping without duplicate cards

"Happening all weekend" leads (runs that started before the weekend and are still going), then Friday/Saturday/Sunday sections that fall away as the weekend progresses. An event starting on a weekend day sits in that day's section — its card carries the multi-day run label if it spans onward.

**The bug the tests caught**: 4.4 caps `daysSpanned` at 14 days so ongoing runs don't flood the calendar grid — which made a 17-day fair *invisible* on the weekend page. `selectWeekend` therefore uses TRUE span intersection (`start ≤ lastWeekendDay && end ≥ firstWeekendDay`), so the State Fair overlapping a Saturday counts, as it obviously should.

## Migration from the collection

The old `/collections/this-weekend` 301s (Next emits 308, equally permanent) to `/this-weekend`; the collection entry is retired (two pages must not compete for one query — encoded as a test), the collections index carries a permanent card to the new URL, the footer links it first, internal links updated, and the sitemap lists it at priority 0.9 — the highest-intent URL on the site. ItemList JSON-LD (top 20) renders only when the page has content.
