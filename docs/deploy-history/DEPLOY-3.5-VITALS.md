# Deploy Guide — Roadmap 3.5: Vitals Pass

**A timeboxed sweep of the things that quietly hurt load speed and layout stability on the money pages.** The spec named three cheap findings to check — image dimensions, font `display=swap`, Mapbox preconnect — and the honest result is that the site was already in good shape: two of the three were done in earlier phases. One real gap remained, now fixed.

**Code-only deploy. No database step, no new secrets. Two-line change.**

---

## The audit (all three findings, checked in code)

The container has no egress to the live site, so a real Lighthouse run is the post-deploy step (below). What *is* verifiable here — and is what actually causes the scores — is the code that produces layout shift and connection latency:

1. **Font `display=swap`** — ✅ already correct. The Google Fonts link carries `&display=swap`, so text renders immediately in a fallback and swaps to Oswald/Inter without blocking (no invisible-text flash, no CLS from late font load). Font preconnects to `fonts.googleapis.com` and `fonts.gstatic.com` were already in place too.

2. **Explicit image dimensions** — ✅ already correct on the money pages. Both the event-page and venue-page Mapbox static maps already carried explicit `width`/`height` and `loading="lazy"`, so the map area is reserved before the image loads (no reflow). The event cards use no images at all — text-only, inherently zero-CLS. The one bare image was the admin Instagram-card preview (noindexed, behind auth, not a money page); dimensioned it anyway for tidiness (`1080×1350`, the IG portrait ratio).

3. **Mapbox connection** — ⚠️ the one real gap, now fixed. The static map is the **LCP asset** on event and venue pages, and nothing was warming the connection to `api.mapbox.com`.

## The fix

A single **`dns-prefetch`** for `api.mapbox.com` at the document level. The deliberate choice — `dns-prefetch`, not `preconnect`: a preconnect holds a full TCP/TLS handshake open, which is worth it for an origin every page uses (like fonts) but wasteful for one that only appears on event and venue pages. `dns-prefetch` resolves DNS ahead of time — the cheap 80% of the win — without penalizing the homepage, `/this-weekend`, collections, and every other mapless page. Right-sized for an asset that shows up on *some* pages.

## Quality bar (all green)
- All three findings verified in source; the fix confirmed in the layout `<head>`; both money-page map images confirmed still carrying explicit dimensions.
- 556 tests green (this is a head-tag/attribute change — no unit-testable logic; the source audit is the real check) · tsc clean · build clean · 0 vulnerabilities · **archive parity 253=253**.

---

## Deploy

Unzip over the repo (parity-verified), commit (`Vitals: Mapbox dns-prefetch + image dimensions (roadmap 3.5)`) → push.

## Verify — the before/after the spec asks for (post-deploy, ~10 min)

The real Lighthouse run happens against production, since it needs the live site:

- [ ] Chrome DevTools → Lighthouse tab (or [pagespeed.web.dev](https://pagespeed.web.dev/)), run **mobile** on four URLs: the homepage, one event page, `/this-weekend`, one venue page.
- [ ] Record the scores in your deploy notes. What to expect: Performance already respectable (this is a lean, mostly-static site); **CLS at or near 0** thanks to the reserved image space; the venue/event pages' LCP a touch faster now that Mapbox DNS resolves early.
- [ ] If anything scores surprisingly low, the report names the culprit — send me the specific finding and we'll timebox a follow-up. Don't chase a perfect 100; the goal is no *cheap* points left on the table, and after this there aren't.

## Rollback
Roll back the deploy. Two additive lines; nothing else touched.

---

## The board

**Phase 3 is complete:** 3.1 indexing loop ✓ · 3.2 content depth ✓ · 3.3 OG images ✓ · 3.4 subscribe band ✓ · **3.5 vitals ✓**. The site is now discoverable (sitemap + canonicals), readable (real editorial copy), shareable (branded cards), a recruiter for its own digest (source-tagged bands), and quick. That's the whole "earn the audience" phase done.

Next is **Phase 4 — Let the Data Drive**, which the roadmap gates behind nothing: **4.1 the demand column** (surface, in admin, which categories/venues people actually click — turning the engagement data you're already collecting into an editorial signal). Or, per the roadmap's note, **6.1 iCal feeds** can jump the queue anytime after Phase 3 — it's cheap and on-brand. Your call on which comes next.
