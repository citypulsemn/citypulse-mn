# Deploy Guide — Roadmap 6.3: The Evergreen "This Weekend" Page

**One permanent URL for the highest-intent search in local events.** `citypulsemn.com/this-weekend` — short enough for your Instagram bio, titled "Things to Do in the Twin Cities This Weekend" forever, with content that rolls with the clock. When someone searches that phrase, this page is built to be the answer; when someone taps your bio link on a Thursday night, it's already showing them Friday.

**Code-only deploy. No database step, no new secrets.**

---

## The weekend clock — the design core

"This weekend" means something different every day, and the page knows it (all in America/Chicago, golden-tested day by day):

| When you visit | What you see |
|---|---|
| Mon–Thu | The upcoming Fri / Sat / Sun |
| Friday | Today through Sunday — the weekend has begun |
| Saturday | Tonight + Sunday (Friday is gone) |
| Sunday | Sunday — it's still the weekend until it isn't |
| Monday morning | The *next* weekend — never stale, never a day that already ended |

## The structure

**"Happening all weekend" leads** — ongoing runs (fairs, exhibitions) that started earlier and span the weekend — then **Friday / Saturday / Sunday sections** that fall away as the weekend progresses. No event appears twice: day-starters sit in their day (their card carries the run label if they continue), earlier-started runs go up top.

**The bug the tests caught before you could:** 4.4 deliberately caps calendar expansion at 14 days so long runs don't flood the grid — which would have made a 17-day fair *invisible* on this page. The weekend selector uses true span intersection instead, so the State Fair overlapping a Saturday counts, as it obviously should. That case is now a permanent test.

## The migration (done cleanly)

The old `/collections/this-weekend` now **permanently redirects** to `/this-weekend`, consolidating any SEO equity; the collection entry is retired — two pages must not compete for one query, and that rule is itself encoded as a test. The collections index keeps a permanent card pointing at the new URL, the footer links **This Weekend** first, all internal links are updated, and the sitemap lists it at **priority 0.9** — the highest on the site. ItemList JSON-LD (top 20 events) renders only when there's content.

## Quality bar (all green)
- **494 tests (13 new)** — the clock on all five weekday cases, month-boundary labels, day-section sorting, the no-duplicate grouping rules, the Saturday migration of a Friday-started run into "all weekend," and the long-run intersection fix.
- Live smoke: page renders, permanent redirect fires with the right Location, collections card and footer link verified, honest empty state confirmed.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Evergreen this-weekend page (roadmap 6.3)`) → push.

## Verify

- [ ] `citypulsemn.com/this-weekend` — day-grouped weekend, ongoing runs on top.
- [ ] `citypulsemn.com/collections/this-weekend` → lands on the new URL.
- [ ] Visit again Sunday evening: only Sunday remains. Monday: next weekend.
- [ ] **Then the payoff: put `citypulsemn.com/this-weekend` in the @CityPulseMpls bio.** That's the whole point of the URL being this short.

## Rollback
Roll back the deploy. The redirect and page disappear together; the old collection returns with the previous zip.

---

## Phase 6 status

6.1 venues ✓ · 6.2 cities ✓ · **6.3 this-weekend ✓**. The finale is **6.4 Instagram automation** — weekly card images + captions generated from the admin, aligned to your locked content rules, turning the Sunday Reels workflow into a one-tap job that links back to this page. Also still open: **5.6 ops digest**, **5.7 Ongoing strip**, and the **multi-day collapse** export.
