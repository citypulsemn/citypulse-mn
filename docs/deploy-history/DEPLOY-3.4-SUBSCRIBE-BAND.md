# Deploy Guide — Roadmap 3.4: Digest Growth Loop (Subscribe Band)

**The digest is the retention asset, and until now the only place to subscribe was the footer.** 3.4 puts a quiet subscribe band where readers already are — the weekend page and venue pages — each tagged with its own `source`, so the ops digest can show you, from day one, which placement actually converts.

**Code-only deploy. No database step, no new secrets.** (The `subscribers.source` column already existed and the subscribe form was already parameterized by source — this build is mostly placement plus one reporting query.)

---

## What shipped

**`components/SubscribeBand.tsx`** — a slim inline band wrapping the existing `SubscribeForm`. Heading, subtext, and a `source` value; the form's hidden `source` input flows straight through the (already source-aware) `subscribeAction` into `subscribers.source`. No new subscribe logic — the plumbing was proven; this is a new doorway onto it.

**Two placements:**
- **`/this-weekend`** — after the *first* day section: "Get this in your inbox every week." `source="this-weekend"`.
- **Venue pages** — after the event list: "Never miss a show here — the week's best Twin Cities events, including what's coming to {venue}." `source="venue-page"`.

**Quiet by design:** one band per page, and no popup, ever. The no-dark-patterns stance is part of the brand, and this build honors it — a single unobtrusive band, skippable, never modal.

**The reporting line — ops digest, Subscribers section:** a new "new by placement" breakdown, 7-day signups grouped by source, most first:

```
## Subscribers
- 112 subscribed (+8 last 7 days)
- new by placement: this-weekend 5 · venue-page 2 · site 1
- last digest: 112 sent, 23 personalized
```

One `group by` query, resilience-wrapped like the rest of the section. On a zero-signup week the line is **omitted entirely** — no empty "new by placement:" — the honest-emptiness rule.

## Quality bar (all green)
- **556 tests (3 new):** the breakdown renders when signups exist; the line is absent on a zero week; a missing `bySource7` (older gather shape) doesn't crash the section. Plus the existing source-propagation coverage the form already carried.
- **Verified renders:** the venue band live on `first-avenue` (correct source, custom heading, exactly one band); both band configs proven by direct render — weekend band carries `source="this-weekend"` and the default heading, venue band its custom copy, one form each.
- tsc clean · build clean · 0 vulnerabilities · **archive parity 253=253**.

One honest note: an em-dash in a wiring script briefly broke it mid-build (the script failed, the paired CSS write didn't) — caught by re-checking that the wiring actually landed before moving on, then redone cleanly.

---

## Deploy

Unzip over the repo (parity-verified), commit (`Subscribe band on weekend + venue pages, source-tagged (roadmap 3.4)`) → push.

## Verify

- [ ] `citypulsemn.com/this-weekend` — a subscribe band sits after the first day's events. One band, no popup.
- [ ] `citypulsemn.com/venues/first-avenue` — a band after the event list, venue name in the subtext.
- [ ] **The source check that proves the loop:** subscribe a test address from the venue band, then in Supabase → `subscribers` confirm the newest row reads `source = 'venue-page'`. Do the same from the weekend band → `this-weekend`. (Unsubscribe the test rows after.)
- [ ] Next Monday's ops digest: the Subscribers section shows "new by placement" if anyone signed up. That line is the growth loop's dashboard — it tells you which surface to lean into.

## Rollback
Roll back the deploy. Nothing was written to the schema; the footer form is unchanged.

---

## The board

Phase 2 ✓ · 3.1 ✓ · 3.2 ✓ · 3.3 ✓ · **3.4 ✓** — the digest now recruits from the pages people actually read, and you'll see where from. Next: **3.5 — the vitals pass** (a timeboxed check of Core Web Vitals / Lighthouse on the money pages, fixing whatever cheaply improves load and layout stability), and Phase 3 is complete — which opens the door to Phase 4's data-driven features.
