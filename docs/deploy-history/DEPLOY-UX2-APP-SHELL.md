# Deploy UX2 — app-shell safety net (404 / error / loading)

*August 2026. UX roadmap item 2. The site had none of the three App-Router
boundary files, so failure modes fell through to bare, branding-less defaults.*

## What shipped

- **[app/not-found.tsx](../../app/not-found.tsx)** — a branded 404 with the
  navy/gold chrome, a `noindex`, and two escape links (calendar + this-weekend).
  Every slug route (`event`, `day`, `venue`, `neighborhood`, `collection`,
  `city`) calls `notFound()`; the most common way to hit it is a **shared or
  emailed link to an event that has since been archived** — i.e. the flagship
  share surface. Before this it dumped users on a bare white Next.js 404.
- **[app/error.tsx](../../app/error.tsx)** — a root error boundary (client
  component) with the chrome, a logged error, and a **Try again** button
  (`reset()`) plus a back-to-calendar link. A transient data blip in `getEvents`
  used to turn the whole page into Next's branding-less "Application error."
- **Loading skeletons** — [components/Skeletons.tsx](../../components/Skeletons.tsx)
  (`ListSkeleton` / `CardSkeleton`, aria-busy + SR label, CSS shimmer that the
  global reduced-motion reset disables) with `loading.tsx` on the leaf server
  pages: **event** (card), **day / venues / collections** (list). Tapping into
  these on mobile data now shows structure instead of a frozen tap.

## The gotcha that cost the most (and why there's NO root loading.tsx)

A root `app/loading.tsx` seemed right (one file covers everything). It broke the
homepage: the skeleton **stuck** — visible over the real content, which rendered
at zero height. Verified in a production build (not just dev), in a clean tab
with the service worker cleared. Cause: the homepage renders the client explorer,
which uses a `dynamic(MapView, { ssr: false })` boundary; the root route-level
Suspense fallback and that client boundary don't reconcile, so the fallback
never unmounts. Leaf server pages (venues, day, event) were clean throughout.

**Resolution:** no root loading.tsx — the homepage is the entry point and
doesn't need a route skeleton — and `loading.tsx` scoped to leaf server pages
only. A test tripwire now asserts the root file's *absence* so it can't be
re-added by reflex.

*(Debugging aside: a stale PWA service worker from earlier testing served old
`/_next/static` chunks after a rebuild, 404-ing the JS and compounding the
confusion. Cleared it; the real cause was the root-loading interaction above.)*

## Verification (observed, not intended)

- **Branded 404:** navigated to a bogus event id → Logo, "404 / We couldn't find
  that," navy background, escape links to `/` and `/this-weekend`. No bare default.
- **Homepage healthy after the fix (prod build, clean origin):** view toggle, 4
  presets, 8 chips, search all present; **0 skeletons, not aria-busy.**
- **Leaf page clean:** /venues → 42 links, 0 skeletons, not busy.
- Error boundary: build-compiled + tripwires (client component, `reset()`
  retry, logs).
- Tests +6 (802/802): boundary files exist / carry chrome / escape routes;
  error is a client component with retry; leaf loading files use the skeletons;
  **root loading.tsx is absent**; shimmer + sr-only styles + reduced-motion.
- Gate: tsc clean · 802/802 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema.

## Verify checklist

- [ ] Open an old/archived event's shared link → branded 404 with a way back,
      not a white page.
- [ ] Tap into a venue/day/collection on a slow connection → a shimmer skeleton,
      then the page (no frozen tap).
- [ ] Homepage still loads normally (no lingering skeleton).

## Rollback

`git revert`. All-additive (new files + CSS); nothing else depends on them.
