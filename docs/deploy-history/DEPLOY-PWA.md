# Deploy — PWA (installable home-screen app + honest offline)

*July 22, 2026. Not a roadmap item — the outcome of the "should we build a
mobile app?" conversation. This is the 80/20: the install/home-screen experience
of an app, on the existing Next.js codebase, with no second platform to
maintain.*

## What shipped

**Web app manifest** ([app/manifest.ts](../../app/manifest.ts)) — Next serves it
at `/manifest.webmanifest` and links it automatically. `display: standalone`
(launches without browser chrome), navy/gold colours matching the site so the
splash screen doesn't flash a foreign palette, and **shortcuts**: long-press the
home-screen icon to jump straight to *This Weekend* or *Ongoing*.

**Icons** — generated from the Logo's pulse-skyline path in gold on navy by
[scripts/make-icons.ts](../../scripts/make-icons.ts) (`npx tsx
scripts/make-icons.ts`, uses the `sharp` that ships with Next; not part of the
build). Produces `icon-192`, `icon-512`, a **maskable** 512 with the mark pulled
in to survive Android's circular crop, a 180px `apple-touch-icon`, and
`icon.svg` as the modern favicon. Full-bleed squares with no baked rounding —
iOS and Android each apply their own.

**Service worker** ([public/sw.js](../../public/sw.js)) + production-only
registration ([ServiceWorkerRegistration](../../components/ServiceWorkerRegistration.tsx)).

**Offline page** ([app/offline/page.tsx](../../app/offline/page.tsx)) — noindex,
precached, and honest about *why* there's nothing to show.

## The design decision that governs everything: never cache HTML

A cached events page is a **wrong** events page — a start time that moved, a
show since cancelled, a festival that ended. So the worker:

| Request | Strategy |
|---|---|
| `/_next/static/*` | **cache-first** — content-hashed, so the URL changes when the bytes do; cannot go stale |
| page navigations | **network-only** → the offline page when the network is truly gone. Never cached. |
| everything else (API, beacons, feeds, images, third-party) | **untouched** |

Only `GET` is intercepted, so the analytics beacon (a POST) always flies. This
is the honest-emptiness rule extended offline: say "you're offline" rather than
quietly serve yesterday's calendar.

## Verification (observed, not intended)

Against a real **production** build (`npm run build && npm start` — the worker
deliberately does not register in dev, where it would fight HMR):

- Manifest served 200, linked as `/manifest.webmanifest`, `display: standalone`,
  theme `#0e1830`, icons `192:any / 512:any / 512:maskable`, shortcuts
  `/this-weekend` + `/ongoing`, apple-touch-icon linked.
- Worker **registered, activated, and controlling** at scope `/`.
- **The guarantee, proven:** after browsing the homepage and /this-weekend, the
  cache held 8 entries — 7 hashed `/_next/static/` assets + the precached
  `/offline` — and **zero HTML pages**.
- **Offline fallback, proven end-to-end:** stopped the server, navigated to
  `/ongoing` → the worker served the offline page, correctly styled (from the
  cached hashed CSS).
- Test worker + caches unregistered afterwards so they can't interfere with
  local dev.
- Tests +16 (757/757): manifest shape, colour match with `viewport.themeColor`,
  every declared icon exists on disk with a valid PNG magic number, shortcut
  targets are real pages; SW tripwires (cache-first only for hashed static, the
  navigate branch never writes to cache, GET-only, third-party untouched,
  versioned cache + purge, offline precached and noindex); registration is
  production-only and swallows failures.
- Gate: tsc clean · 757/757 · build clean · **audit 0** (see below).

## Bundled security fix: `sharp` override

Mid-session, `npm audit` went from 0 to **2 high** — a newly published advisory
against `sharp <0.35.0` (inherited libvips CVEs). Pre-existing and unrelated to
this work (`sharp` has always been a Next dependency), but audit-zero is a
standing gate. npm's suggested `--force` fix would have **downgraded Next 15 →
14**, which we refused. Instead: an `overrides` entry pinning `sharp ^0.35.3`,
matching the repo's existing `postcss` override pattern. Result: **audit 0**,
Next stays on 15.5.19, sharp resolves to 0.35.3, icon generation and the build
both still work.

## Deploy steps

Push to `main`. Code + static assets only, no schema. Vercel serves
`/sw.js` with `Cache-Control: no-cache` (added in `next.config.ts`) so a fix —
or the kill-switch below — reaches browsers immediately.

## Verify checklist

- [ ] On your phone, open citypulsemn.com → browser menu → **Add to Home
      Screen**. The icon should be the gold skyline on navy.
- [ ] Launch from the home screen: no browser address bar, navy status bar.
- [ ] Long-press the icon → shortcuts to *This Weekend* / *Ongoing*.
- [ ] Turn on airplane mode and open it → the "You're offline" page, not a
      browser error and not a stale calendar.

## Rollback — READ THIS FIRST

**`git revert` alone does NOT remove an installed service worker.** Deleting
`sw.js` yields a 404, and browsers keep the existing worker. To actually retire
it, deploy this stub *as* `public/sw.js`, let it reach users, and only then
remove it:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((cs) => cs.forEach((c) => c.navigate(c.url))),
  );
});
```

Everything else here (manifest, icons, offline page) is inert on rollback and
safe to revert normally.
