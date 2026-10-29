# Deploy — one ask that is not switched on yet, and one link that earns nothing

**29 Oct 2026.** B2 and B3 from
[ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md), built together because
they touch nothing in common. Six files, twelve tests. No schema change, no
data change, no new dependency, no new vendor. Deploy is a push.

Both land with an honest asterisk, and both asterisks are the interesting part.

## B2 — the supporter link, shipped dark

**What it is:** one `SUPPORT` object in [lib/editorial.ts](../../lib/editorial.ts)
holding a payment URL, a footer label and one line for the weekly email. It is
`null`, so **right now this renders nowhere** — not in the site footer, not in the
email, not as a placeholder or a "coming soon". Set the object when the payment
page exists and both surfaces light up together.

**Why no Stripe integration.** The roadmap sized this as S and meant it. We take
no card details, hold no keys, run no webhook, store no row and reconcile
nothing — `url` points at whatever the payment host gives us (Stripe payment
link, Ko-fi, Buy Me a Coffee) and that is the entire integration. The cheapest
version that works is also the one with no PCI surface and nothing to maintain.

**Why it copies the sponsor slot exactly.** `DIGEST_SPONSOR` already solved this
problem: a module const, `null` meaning *render nothing*, an option on
`DigestOptions` so tests can pass one explicitly, and a documented example in the
comment. B2 is the same shape — `SUPPORT`, `supportLineHtml`, `supportLineText`,
`opts.support`. Two configs that behave identically are worth less than two
configs that *look* identical at a glance.

**One ask, in the footer.** Not a band, not a popup, not an interstitial. It sits
after Terms, where someone who scrolled that far will find it, and it is phrased
as an offer rather than a guilt trip. The product stance on dark patterns does not
get an exception because this one is for us.

**`sponsorUrl` became `campaignUrl(url, campaign)`.** Private, two call sites,
identical logic. Two copies of a UTM builder is exactly how the panel and the
writer drifted apart in September, so: one definition, two campaigns —
`utm_campaign=sponsor` and `utm_campaign=support`, which also lets us tell an
email click from a site-footer click without any extra instrumentation.

## B3 — parking on venue pages, and why it earns nothing

The roadmap costed this as a SpotHero affiliate link worth $5–20/month, with an
explicit instruction: *verify the deep-link shape first; if it cannot be
deep-linked honestly, fall back; if that reads badly, cut the item rather than
ship a guessed URL.*

**SpotHero publishes no documented lat/lng deep-link format.** What exists is a
third-party API example behind a key and a scraper's description of a search box.
Everything else is inference. So the affiliate version of this item is not
buildable today without guessing a URL, and guessed shapes are this project's
most expensive habit.

**What shipped instead:** a Google Maps parking search, which is

- the pattern **already on this page** — the Directions link next to it has used
  `https://www.google.com/maps/search/?api=1&query=` all along,
- documented and stable, with no app install and no account,
- and, per SpotHero's own 2024 announcement, where SpotHero inventory now
  appears anyway — a reader who wants to reserve a spot still can.

**This earns $0.** It is in the queue because it is useful at 7pm on a Friday, and
the roadmap's own disruption veto is what let a zero-revenue item through: a link
that helps the reader survives where a link that only helps us would not. The
roadmap's $5–20/mo line for B3 has been corrected to $0 rather than left to look
like a forecast we missed.

**The extraction is byte-identical.** `directionsUrl` now builds the string the
page used to build inline, and a test pins the exact output —
`?api=1&query=44.9784,-93.2762`, commas unencoded, as before. Refactors that
quietly change a URL are how working links stop working.

## What shipped

| File | Change |
|---|---|
| [lib/editorial.ts](../../lib/editorial.ts) | `SupportLink` + `SUPPORT` (null), with the worked example in the comment |
| [components/SiteFooter.tsx](../../components/SiteFooter.tsx) | the footer link, rendered only when `SUPPORT` is set |
| [lib/digest.ts](../../lib/digest.ts) | `campaignUrl`, `supportLineHtml`, `supportLineText`, `opts.support`, and both footers (HTML **and** plain text) |
| [lib/venue-pages.ts](../../lib/venue-pages.ts) | `directionsUrl`, `parkingUrl` |
| [app/venues/[slug]/page.tsx](../../app/venues/%5Bslug%5D/page.tsx) | uses both; renders `Parking ↗` beside `Directions ↗` |
| `lib/__tests__/digest.test.ts`, `lib/__tests__/venue-pages.test.ts` | 12 new tests |

The plain-text half of the email is the half that gets forgotten, so it has its
own test asserting the support line adds exactly two lines and the unsubscribe
block stays last.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **552 files, 9,970 tests** (was 9,958; +12)
- `npm run build` — clean, 610 static pages
- `npm audit` — **0 vulnerabilities**
- Smoked both surfaces in the browser (below)

`npm run lint` still does not run — `next lint` is deprecated and drops into an
interactive prompt. Pre-existing, project-wide, unchanged by this.

### The smoke

Dev server, `/venues/first-avenue`, real data (84 upcoming events):

```
701 First Avenue North, Minneapolis, MN · Downtown Minneapolis · Directions ↗ · Parking ↗

Directions → ?api=1&query=44.978304,-93.276062
Parking    → ?api=1&query=parking%20near%2044.978304%2C-93.276062
```

Real pin, both links correct, no console errors. A search for "Support" anywhere
on the page returns **no matches** — which is B2's honest-emptiness contract
verified in a live render rather than only in a test.

**Not verified:** the email with `SUPPORT` set, and the footer link in its
configured state. Both are covered by tests but neither has been seen by a human,
because neither can exist until there is a payment URL.

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No schema, no secret, no backfill.

## Verify (a minute)

1. Any venue page — `/venues/first-avenue` is a good one. **Parking ↗** sits
   beside **Directions ↗**. Tap both on a phone; they should open Maps.
2. The site footer is unchanged — no support link, because none is configured.
3. Nothing in the weekly email changes until step 4.

## Switching B2 on (when the payment page exists)

Edit `SUPPORT` in `lib/editorial.ts` — one object, three strings:

```ts
export const SUPPORT: SupportLink | null = {
  url: "https://buy.stripe.com/xxxxxxxx",
  label: "Support the site",
  digestLine: "This email is free and carries no ads. If it's worth something to you, you can chip in.",
};
```

Push. The footer link and the email line appear together. **Send yourself a test
digest before the Thursday send** and check the plain-text part, not just the
HTML. The copy is yours to rewrite — it is editorial, and your voice wins.

Worth saying plainly: 47 subscribers and ~6k monthly views will not make this
meaningful money. It is here to start the reader-funded story, not to pay a bill.

## Rollback

`git revert` and push. B2 was already rendering nothing, so reverting it is
invisible. B3 removes one link from venue pages; `directionsUrl` goes back inline
and the test that pins its exact output is what guarantees that round-trip is
lossless.
