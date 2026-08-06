# Deploy UX7 — touch targets & modal accessibility

*August 2026. UX roadmap item 7, closing Tier 2. The most correctness-for-real-
users item on the board: keyboard and screen-reader users literally couldn't use
the modals, and core controls were below the tap-target minimum on the phones
that are this site's main audience.*

## What shipped

**Modals that are actually modal**
([useModalA11y](../../components/useModalA11y.ts), applied to
[DayPanel](../../components/DayPanel.tsx) and
[EventDetail](../../components/EventDetail.tsx)). They were `role="dialog"
aria-modal` in name only — a keyboard user could Tab straight into the calendar
behind them. Now, on open: focus moves into the dialog, Tab is **trapped**,
body scroll is **locked**, and the background `.wrap` is marked **`inert`**
(unfocusable and unreadable). On close: focus **restores** to the trigger. The
DayPanel also gained an accessible name (`aria-labelledby` → its date heading).

**44px touch targets** ([globals.css](../../app/globals.css)) — the modal close
button (was **30×30** → 44×44), the month arrows (34 → 44), the view toggle,
presets, category chips, filter pills, and filter toggle (all now `min-height:
44px`), and the search-clear (26 → 40). The map marker also gets a visible
focus ring.

**Keyboard-accessible map markers** ([MapView](../../components/MapView.tsx)) —
the bare, unfocusable `<div>` markers are now named `role="button"` elements with
`tabindex="0"` that open their popup on Enter/Space. (The calendar and the new
UX4 list are the fully-accessible alternatives; the map is no longer a dead-end.)

**Contrast fix** — `--gold-dim` (the WHEN/WHERE detail labels) was `#8c7544`,
**3.98:1** on navy — failed WCAG AA. Now `#b89a5e` (≥4.5:1). It's used in exactly
one rule, so the change is contained.

## Verification (observed, not intended)

On a dev server, opening a day panel:
- **focus moved to the close button**, `body` overflow **hidden**, background
  `.wrap` **inert**, `aria-labelledby="daypanel-heading"` — all confirmed.
- On close: dialog removed, scroll **restored**, inert **removed**.
- Touch targets computed: chip 50px, view toggle 44px; `--gold-dim` = `#b89a5e`.
- Tests +9 (841/841): hook (focus-in / Tab-trap / restore / scroll-lock /
  inert), both modals use it + have accessible names, map markers are named
  focusable buttons that open on Enter/Space, the 44px minimums and the contrast
  value are pinned in CSS.
- Gate: tsc clean · 841/841 · build clean · audit 0.

## Limits of local verification (honest)

The headless preview pane reports a **0-width viewport** and unreliable
programmatic focus, so two things are best confirmed on a real device (checklist
below): **focus-restore to the exact trigger cell**, and the **rendered pixel
size** of width-dependent controls (the CSS `min-height: 44px` is correct and
verified in source; a 0-width layout can't be measured).

## Deploy steps

Push to `main`. Code + CSS only, no schema.

## Verify checklist

- [ ] Keyboard: open a day/event modal → Tab stays inside it; Esc/close returns
      focus to the calendar cell you opened from; you can't Tab into the page behind.
- [ ] Phone: the close ✕, presets, chips, and month arrows are all easy to hit
      (≥44px).
- [ ] The WHEN/WHERE labels on an event page read clearly (contrast).
- [ ] Map view: Tab reaches the markers; Enter opens a popup.

## Rollback

`git revert`. CSS + additive a11y wiring; nothing else depends on it.
