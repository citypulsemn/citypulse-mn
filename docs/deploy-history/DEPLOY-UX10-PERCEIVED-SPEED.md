# Deploy UX10 — perceived speed & interaction polish

*August 2026. UX roadmap item 10. The headline is the font migration (a real
Core-Web-Vitals win); the rest are small "the page feels quick and finished"
touches. One sub-item (PWA Install chip) is deferred with a reason.*

## What shipped

**1 — Self-hosted fonts via `next/font` (the perf win)**
([app/layout.tsx](../../app/layout.tsx), [app/globals.css](../../app/globals.css))

Fonts loaded through a render-blocking `<link>` to `fonts.googleapis.com` —
Inter + Oswald — with a classic Oswald swap/CLS on every first paint. Now Inter
and Oswald are loaded by `next/font/google`: **self-hosted** (no third-party
request, no `preconnect` to two Google origins), served from `/_next`, with
`display: "swap"` and a **size-adjusted fallback** (`"Inter Fallback"` /
`"Oswald Fallback"`) that kills the layout shift. They're exposed as CSS
variables (`--font-inter`, `--font-oswald`), so all 60+ `font-family` rules in
globals.css keep referring to them by name — mechanical swap, no design change.

*(The OG-image routes keep their own base64-embedded Oswald — that path is
serverless satori rendering, unrelated to the browser fonts, and untouched.)*

**2 — Sized placeholder for the lazy map**
([EventsExplorer.tsx](../../components/EventsExplorer.tsx))

Switching to Map view loaded the ~200KB Mapbox chunk with **nothing** in its
place — the layout collapsed to zero height, then popped. The `dynamic()` import
now has a `loading:` fallback sized to the map's exact height
(`clamp(440px, 64vh, 720px)`), so the switch holds its space.

**3 — One-tap add-to-calendar**
([AddToCalendar.tsx](../../components/AddToCalendar.tsx))

Was a two-tap `<details>` disclosure (open menu → pick). Now the primary control
**is** the `.ics` download link itself — one tap, and Apple/Outlook/iOS Calendar
all consume it (most phones offer "Add to Calendar" the instant the file lands).
Google Calendar rides alongside as a quieter secondary link. Both still fire the
`ics_download` analytics event and the first-party `calendar` beacon on the human
click (unchanged from the R2/5.1 wiring).

**4 — Back-to-top on long lists**
([BackToTop.tsx](../../components/BackToTop.tsx), mounted in the layout)

A month of events or a busy venue page is a long scroll with no way back up. A
floating ↑ (44px, bottom-right, clear of the centered save nudge) appears only
after you've scrolled past ~800px — so short pages never show it — and honors
`prefers-reduced-motion` (jumps instead of smooth-scrolling).

## Not shipped (with reasons)

- **Save confirmation / destination feedback** — already covered: the Save
  button flips to a filled ♥ "Saved" state on click, and the one-time
  `FirstSaveNudge` (UX3) points to the keep-list. No change needed.
- **PWA "Install" chip** (roadmap marked *optional*) — deferred. It's a distinct
  *capability* affordance (capture `beforeinstallprompt`, show only when
  installable, persist dismissal, handle `appinstalled`) and would be a **third**
  floating element competing with the save nudge and the new back-to-top for the
  bottom of the screen. Better as its own considered item than crammed in here.

## Verification (observed, not intended)

- **Browser (dev):** `<html>` carries the two `__variable_*` classes; body font
  computes to `Inter, "Inter Fallback", system-ui, sans-serif`;
  `--font-oswald` = `'Oswald', 'Oswald Fallback'`; **zero** `googleapis`/
  `gstatic` `<link>`s in the DOM. Event page add-to-calendar: primary is an
  `<a download="citypulse-….ics">` (no `<details>`), Google Calendar a secondary
  `target="_blank"` link. `.back-to-top` computes to `position: fixed`, 44×44,
  bottom-right, z-index 55. No console errors.
- **Build:** compiles clean — `next/font` fetched Inter + Oswald at build time.
- **Tests +9 (876/876):** tripwires — layout uses next/font + variables and
  drops the Google Fonts request; globals.css references the variables with no
  bare family literals left; the map dynamic import has a sized loading
  placeholder; add-to-calendar is one-tap `.ics`-primary with the disclosure
  gone; back-to-top gates on scroll + reduced-motion and is mounted.
- **Gate:** `tsc` clean · 876/876 · `npm run build` clean · `npm audit` 0.

### Honest local-verification limit
The headless preview reports a 0-width viewport, so the page never scrolls past
800px — the back-to-top's *appearance on scroll* is confirmed by its tripwire +
the resolved CSS, but its on-scroll reveal is best eyeballed on a real device
(checklist below). Same class of limit noted in UX7.

## Deploy steps

Push to `main`. Font/CSS/component only — no schema, no env, no new deps
(`next/font` ships with Next).

## Verify checklist

- [ ] First paint: headings (Oswald) and body (Inter) render with no visible
      font swap/reflow; DevTools Network shows no request to `fonts.googleapis`.
- [ ] Switch the homepage to Map → a placeholder holds the space, then the map
      fills it (no collapse/pop).
- [ ] On an event, one tap on "Add to calendar" downloads the `.ics`; "Google
      Calendar ↗" opens Google.
- [ ] Scroll a long page (a full month, a busy venue) → a ↑ appears bottom-right
      and returns you to the top.

## Rollback

`git revert`. All additive/mechanical: the font swap is name-for-name, the map
placeholder and back-to-top are self-contained, and add-to-calendar reverts to
the disclosure. Nothing depends on the new pieces.
