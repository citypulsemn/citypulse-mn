# Roadmap — UX (seamless-journey edition)

*Synthesized from a five-track UX audit (Aug 2026): discovery/homepage · event
detail · browse/wayfinding · conversion/retention · mobile/a11y/perf. Each item
is scoped to be finished in one session with the usual quality gate. Ordered by
user-impact ÷ effort, with strategic-unlock weighting.*

## The three findings that shape everything

1. **Mobile discovery is blind.** The homepage defaults to a month calendar
   grid that *hides every event title below 820px* (only colored dots), and the
   date presets merely dim cells instead of producing a list — so "what's on
   this weekend" takes 3+ taps and can't be seen as one scannable thing. The
   clean list surfaces (`/this-weekend`, `/ongoing`) exist but are buried in the
   footer.
2. **The save affordance is the retention bottleneck.** You can only save an
   event from its *detail page* — the calendar/list cards have no ♡. That almost
   certainly explains why saves are stuck near zero (4/30 days), which is the
   exact gate blocking F1.3 personalization and the "most saved" digest line.
   Fix the front door and a whole chain unlocks.
3. **The site occasionally contradicts itself.** Cancelled and already-ended
   events still show the live gold "Tickets & Info" button and Save/Add-to-
   calendar — the banner says "already happened," the biggest button says "buy."
   Small root cause (time-state isn't threaded into the body), real trust cost.

---

## Tier 1 — Trust + retention unlock (do first)

### UX1 — Dead-event honesty (S)
Thread the already-computed `timeState`/`cancelled` into `EventDetailBody`: for
ended or cancelled events, hide/downgrade the ticket CTA and the Save/Add-to-
calendar row (keep Share). Also: omit the Price row when price is empty; restyle
the no-ticket "Details to come" ghost button so it doesn't look broken.
*Evidence: event-detail #1,#2,#5,#9. Files: `EventDetailBody.tsx`,
`TicketButton.tsx`, `app/event/[id]/page.tsx`.*

### UX2 — App-shell safety net (S)
Add the three missing App-Router boundaries, all with navy/gold chrome + an
escape link: `app/not-found.tsx` (a shared/emailed link to an archived event
currently dumps users on a bare white 404 — this breaks the flagship share
feature), `app/error.tsx` (a data blip currently kills the whole page), and
`loading.tsx` skeletons for the high-traffic segments (root, day, event, venues,
collections).
*Evidence: cross-cutting #1,#2,#3. New files mirroring `app/offline/page.tsx`.*

### UX3 — Save from anywhere + a home for saves (M) · strategic unlock
A compact ♡ on `EventDayCard` (reuse `SaveButton`, icon-only) so people can save
while browsing; a "♥ Saved (N)" link in the topbar (no badge at 0 — honest
emptiness); a one-time, dismissible first-save nudge to the keep-list magic link;
and a restore hint in the empty `/saved` state. This is the compounding win:
more saves → durable lists → personalized digests → **F1.3 becomes buildable.**
*Evidence: conversion #1,#2,#3,#4. Files: `EventDayCard.tsx`, topbar in
`EventsExplorer.tsx`, `SaveButton.tsx`, `app/saved/page.tsx`.*

---

## Tier 2 — The mobile-discovery transformation + core mobile actions

### UX4 — A mobile-first list view & presets that list (M–L)
Add a chronological **List** view to the homepage explorer (third toggle beside
Calendar/Map), make it the mobile default, and make the date presets render an
actual list of the windowed events instead of dimming grid cells. This single
change fixes the blind-mobile-calendar, the 3-tap weekend journey, and the
count/grid mismatch together.
*Evidence: discovery friction #1,#2, gaps #1,#3. File: `EventsExplorer.tsx`,
`CalendarView.tsx`, new list component.*

### UX5 — "Get me there" (S)
Make the venue address tappable and add a **Directions** link that deep-links to
the native maps app (`google.com/maps/dir/?…destination=lat,lng`); make the map
thumbnail open directions instead of the site-wide map. The most common phone
action on an event, currently missing.
*Evidence: event-detail #6. Files: `EventDetailBody.tsx`, `app/event/[id]/page.tsx`.*

### UX6 — Persistent section nav (S–M)
Extract a shared `TopBar` and give it a compact, horizontally-scrollable section
nav (This Weekend · Collections · Neighborhoods · Venues · Cities) on every page.
Today all eight sections live *only* in the footer, so a Google-arrival visitor
can't reach the site's breadth without scrolling past everything.
*Evidence: browse #1,#8, conversion #2. Files: new `TopBar.tsx`, all page headers.*

### UX7 — Touch targets & modal accessibility (M)
44px minimums on the core controls (view toggle, chips, presets, close button,
filter pills, search-clear); real modal focus management (focus in on open, trap
Tab, restore on close, `inert` background) for `DayPanel`/`EventDetail`; fix the
`--gold-dim` label contrast (3.98:1 → ≥4.5:1); keyboard-accessible map markers;
`DayPanel` aria-label; body scroll-lock behind modals.
*Evidence: cross-cutting #4,#5,#6,#7,#10,#11. File: `app/globals.css`, the two
modals, `MapView.tsx`.*

---

## Tier 3 — Correctness, cross-linking, perceived speed

### UX8 — Structured-data & submit-data correctness (S)
JSON-LD: emit `endDate` from `spanEnd()` so multi-day festivals aren't seen as
single-day by Google, and emit the DATE form for all-day events (mirrors the ICS
fix from R2.5, which never reached the JSON-LD). Submit form: normalize a bare
domain to `https://…` before validating the ticket URL; catch/handle an end time
that crosses midnight (a 9pm–1am show currently stores a backwards span).
*Evidence: event-detail #3,#4; conversion #5,#6. Files: `lib/seo/event-jsonld.ts`,
`lib/submissions.ts`.*

### UX9 — Wayfinding & search polish (S–M)
Cross-month search (surface "N matches in September →" instead of a silent "no
matches"); unify the index-card count with the detail-page span math (a slice
whose only live event is on its closing day currently shows 0 and vanishes);
venue→city link; neighborhood↔venue sibling cross-links; day prev/next; rule-
based `FeedSubscribe` placement (add to `/ongoing` + city pages); preserve
calendar context on the event back-link.
*Evidence: browse #2,#4,#5,#6,#3-consistency; discovery bug #1; event-detail #10.*

### UX10 — Perceived speed & interaction polish (S)
`next/font` migration (removes the render-blocking Google Fonts request + Oswald
CLS); a loading placeholder for the lazy `MapView`; one-tap add-to-calendar
(default the primary tap to the `.ics`, Google as secondary); save confirmation/
destination feedback; back-to-top on long lists; an optional PWA "Install" chip.
*Evidence: cross-cutting #8,#9,#12,#13; event-detail #7,#8.*

### UX11 — URL-addressable state (M)
Reflect range/categories/filters/open-day in the URL query so a reload, a shared
link, and browser Back all work (Back closes an overlay instead of leaving the
site), plus a "make this my default view" for the weekly-returning core. Also
improves SEO for filtered views.
*Evidence: discovery gap #4,#5. File: `EventsExplorer.tsx`.*

---

## What the audit found already-solid (don't "fix")
Honest-emptiness is consistent everywhere · canonicals correct on every page
type · `prefers-reduced-motion` honored globally · mobile keyboards correct
(`type=email`, native date/time) · honeypots textbook · horizontal-scroll
hazards contained · the retention *back-end* (magic-link restore with merge-
don't-lose, one-click unsubscribe, resubscribe-confirm) is well built · no dark
patterns anywhere.

## Suggested sequence
Tier 1 in order (UX1 → UX2 → UX3) banks the trust fixes and unlocks retention,
then UX4 for the mobile-discovery leap, then the rest by appetite. UX3 is the
strategic keystone — it's what turns the F1.3 gate from "wait for traffic" into
"we're feeding it."
