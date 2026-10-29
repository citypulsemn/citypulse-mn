# Deploy — the offer we can actually keep, and the test count that was lying

**29 Oct 2026.** B4 and B5 from
[ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md), plus one unplanned fix
that the research for them turned up. Nine files, six tests. No schema change,
no data change. Deploy is a push.

The pre-publication check cost more than the writing and was worth it: it killed
a dozen sentences that would have been false, and found a broken instrument.

## The unplanned fix, first, because it corrects this archive

**`npm test` was reporting 9,970 tests. The repository has 2,869.**

There was no `vitest.config` file, so the default glob walked the whole tree —
including `.claude/worktrees/`, which holds three full git worktrees of this same
repo. Every test ran four times.

Two things were wrong with that, and the second is the one that matters:

1. It read like growth and was duplication. CLAUDE.md's "2,290+ and rising" was
   the honest lineage of the real number all along.
2. **A worktree holds a different commit.** Those copies were gating this
   checkout's green run. A stale branch could have failed a run this code passes,
   or passed one it fails — a test suite reporting on code you are not shipping,
   which is precisely the class of fault ENGINEERING.md rule 1 exists for. It
   rendered a mixed, partial measurement as a pass.

Fixed in [vitest.config.mts](../../vitest.config.mts): keep the upstream
excludes, add `.claude` and `.next`. The suite now runs in **12 seconds instead
of 50** as a side effect.

**I put the wrong number in two deploy guides and two commit messages today.**
Both guides are corrected in place with a note; commit messages are history and
stay as they are. CLAUDE.md now carries the real figure and a tripwire sentence:
*if you see a number near 10,000, the exclude has stopped working.*

## B4 — /for-partners

A sibling of `/for-venues` for the other side of the relationship: not "get your
events listed" but "put our calendar on your screen". Copy in
[lib/editorial.ts](../../lib/editorial.ts) as `FOR_PARTNERS`, page at
[app/for-partners/page.tsx](../../app/for-partners/page.tsx), added to the
sitemap.

**Most of the work was finding out what we are not allowed to offer.** Each of
these was checked against the code or the terms, and each had been assumed true
in the roadmap's own spec:

| Tempting to offer | Why we can't |
|---|---|
| A JSON/REST API for partners | `/feeds/<slug>` emits `text/calendar` only; roadmap 6.2 is parked |
| An embeddable widget | **No CORS header exists anywhere** — a cross-origin browser fetch fails outright |
| Accuracy or verification guarantees | The terms disclaim accuracy in plain words, and two fabrications reached live listings in 2026 |
| Redistribution of event content | Descriptions, images and logos belong to the organisers. We cannot license what we do not own |
| Cancellation notices | A cancelled event just stops appearing — no `STATUS:CANCELLED`, no `SEQUENCE` |
| An SLA, uptime or stable slugs | None of those exist. No versioning, no deprecation policy |
| "All 79 feeds" | **18 of the 79 carry zero events** in a given 30-day window (measured below) |

So the page states the limits as the offer rather than burying them: a rolling
30-day window, nine fields and not more, descriptions clipped at ~180 characters,
up to a couple of hours of propagation lag, long exhibitions rendering as one
multi-month block, and *"this is one person's project… treat the feed as a
convenience you can lose, not a dependency you can't."*

It also answers the four questions the completeness check said a partner asks
first and neither document originally addressed: **what it costs** (nothing, and
notice before that ever changes), **how to get out** (a named email, no
turnaround promised), **who runs it** (one person — the same posture as B5), and
**what to do about errors** (the existing report form).

**Deliberately not a feed index.** The slug list lives on the pages that own each
slice, where `FeedSubscribe` already renders a real URL and an empty month is
visibly empty. Publishing all 79 slugs flat would hand someone a dead feed and
call it an offer; honest emptiness applies to what we advertise, not just what we
render.

**Six drift guards** in `lib/__tests__/for-partners.test.ts`. The counts in the
prose are pinned to the live registries, so adding a venue fails the test rather
than quietly making the page wrong. The do-not-claim list is encoded too — the
copy may not contain "json", "api", "widget", "embed" or "real-time" at all,
while "uptime", "SLA" and "guarantee" are allowed *only* in the paragraph that
disclaims them. That guard caught my own first draft.

## B5 — docs/GRANT-EVIDENCE.md

Source material for an application, not an application. The structure is
deliberate: scale, then method, then **where the method failed**, then the
instrumentation habit, then known gaps — before any funder is named.

**The failures are the evidence, so they are told straight:** the August Twins
listings, the September invented listing that *the verify pass had already
confirmed*, and the October year-shifted rows where *six of eight carried
verified stamps*. Each with what shipped in response, and each with what the fix
does **not** do — the year gate has not yet survived a live scheduled run, the
matching blind spot in the source check is named as unfixed, and the September
retroactive sweep deliberately changed no statuses.

Two sections exist because the completeness check demanded them:

- **What it costs** — and the admission that only model spend is ledgered. The
  hosting, database, email and domain invoices **have never been added up**, so
  any budget line would be the first time that figure existed.
- **How it earns today** — disclosed before a reviewer finds it: the affiliate
  seam (switched off, measured at 1.9% of clicks), the dark support link, no ads,
  no pay-to-rank, and a venue-side plan that is written down rather than hoped for.

**The funder section carries a warning header and deserves it.** The research
pass could confirm almost nothing from a primary source: funder sites blocked
automated access, several programs appear closed or dormant, and one "matching
challenge" surfaced only from an AI-generated roundup and is contradicted by the
funder's own site. Every row lists what must be checked rather than what to
expect, with no amounts and **no deadlines**. The most useful line in it is the
cheapest: one email to LION settles whether an events calendar even meets their
scope bar, and that gates the whole on-ramp.

It also names what was never examined — Minnesota arts, humanities and heritage
funders — with the observation that this may read more naturally as *cultural
infrastructure* than as *journalism*.

## Measurements taken for this work

Two things nobody had ever done, both now done:

**Every feed counted.** 79 slugs, 764 published events, 482 in the 30-day window:
**50 healthy, 11 thin (1–2 events), 18 empty.** Sixteen of the 47 venue feeds are
empty, including `venue-fillmore-minneapolis`, `venue-dakota-jazz-club` and
`venue-icehouse`. Also surfaced: `venue-sever-s` is a mangled slug, and
`venue-xcel-energy-center` names a building now listed as Grand Casino Arena.
Neither is fixed here — see "left for later".

**A live feed read for the first time.** `curl` on production
`/feeds/this-weekend`: HTTP 200, `content-type: text/calendar; charset=utf-8`,
`cache-control: public, max-age=3600`, 113,660 bytes, **175 VEVENTs — exactly
matching the local count for that slug.** The 6.1 deploy guide's post-deploy
boxes had been sitting unticked since the feeds shipped.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **145 files, 2,875 tests** (the real figure; see the top of this guide)
- `npm run build` — clean, 611 static pages (`/for-partners` among them)
- `npm audit` — **0 vulnerabilities**
- Smoked `/for-partners` in the browser: renders, no console errors, and a
  factual error in my own copy was caught on the live page and fixed (I had
  written that readers caught both 2026 incidents; the October one was found by
  the operator's own dead-citation sweep)

`npm run lint` still does not run — `next lint` is deprecated and drops into an
interactive prompt. Pre-existing, unchanged, and now the only leg of the gate
that is not real.

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No schema, no secret, no backfill.

## Verify

1. `/for-partners` renders, and the footer links from it work.
2. `/for-venues` is unchanged.
3. `/sitemap.xml` contains `/for-partners`.
4. `npm test` reports a number near 2,875 — **not near 10,000**.

## Left for later, named rather than silently dropped

- **`GET /api/events` is live, unauthenticated and uncapped**, returning the
  entire published table as JSON. It is undocumented and robots-disallowed, but
  robots is advisory. Given this project's history of database-egress and compute
  overages, that endpoint is worth a decision — cap it, cache it harder, or
  remove it. **Not touched here:** changing a live public endpoint is a product
  call, not a copy edit.
- **`venue-sever-s` and `venue-xcel-energy-center`** — one mangled, one renamed.
  Both are public URLs, so fixing them is a redirect question, not a rename.
- **The 18 empty feeds.** Expected for a quiet month in a small room, but worth
  knowing whether any are empty because the venue importer is broken rather than
  because the room is dark.
- **One email to LION**, which is the cheapest unblocked item in the grant pack.

## Rollback

`git revert` and push. `/for-partners` disappears and the sitemap entry with it;
nothing links to it from the site chrome, so nothing else breaks. Reverting the
vitest config would restore the inflated count — if something about it needs
changing, change the excludes rather than removing the file.
