# Deploy UX3 — save from anywhere (the retention unlock)

*August 2026. UX roadmap item 3, the Tier-1 keystone. The audit found the save
control lived ONLY on the event-detail page — the calendar/list cards had no ♡.
That almost certainly explains the near-zero save volume (≈4/30 days) that gates
F1.3 personalization and the "most saved" digest line. Open the front door.*

## What shipped

- **A compact ♡ on every event card** ([EventDayCard](../../components/EventDayCard.tsx)).
  The save button is a **sibling** of the card anchor (a button nested in an
  `<a>` is invalid and would hijack the tap), positioned over the top-right
  corner. Suppressible via `showSave={false}` on the `/saved` page, where each
  row already has its own ✕ remove. `SaveButton` gained an icon-only `compact`
  variant.
- **A live "♥ N" count in the header** ([SavedLink](../../components/SavedLink.tsx)),
  linking to `/saved`. It hydrates from `/api/saved` and **re-reads on every
  save broadcast**, so the count follows you as you build the list. Renders
  **nothing at zero** — honest emptiness, no dangling badge. In the homepage
  topbar (full coverage across page types lands with UX6's shared TopBar).
- **A live save broadcast** ([SaveButton](../../components/SaveButton.tsx)):
  every toggle dispatches a `citypulse:save` window event AFTER the write
  confirms, so the header count (and the nudge) react anywhere on the page.
- **A one-time first-save nudge** ([FirstSaveNudge](../../components/FirstSaveNudge.tsx),
  mounted globally in the layout): the first time someone saves, a dismissible
  bottom strip points them at the keep-list magic link so their list survives a
  cookie-clear or device switch — the durability feature the audit found buried.
  No dark pattern: it appears only after a deliberate save, is a status strip
  (never a modal), and never returns once dismissed (localStorage).
- **A restore hint on the empty `/saved` state** ([SavedList](../../components/SavedList.tsx)):
  a cleared-cookie visitor who once emailed themselves a link is told how to
  bring the list back, instead of reading "nothing saved" as data loss.

## Verification (observed, not intended)

Driven on a dev server against real data:
- /ongoing: **12 ♡ overlays**, each a sibling of its card anchor.
- Clicking a ♡ → filled ♥, aria "Saved — tap to remove", and **navigation did
  not fire** (stayed on /ongoing) — the sibling structure works.
- The first-save nudge appeared with the keep-list link + dismiss.
- Homepage topbar then showed **"♥ 1"** → /saved.
- /saved: card shown with **0 ♡ overlays** and its ✕ remove; keep-list form present.
- Removed the test save → empty state with the restore hint; **DB back to 0**
  (no synthetic rows left).
- Tests +12 (812/812): compact variant + broadcast-after-confirm; card renders
  the button as a sibling (not nested) and is suppressible; SavedLink re-reads on
  broadcast and is null at 0; nudge is save-only / dismissible / persistent /
  status-not-dialog; restore hint present.
- Gate: tsc clean · 812/812 · build clean · audit 0.

## Why this is the keystone

Saves feed everything downstream: keep-list durability, the digest leading with
your own saved events (5.3), and **F1.3 "for you" ordering, which is gated on
save volume.** Making saving a one-tap browse action — instead of a detail-page-
only action — is the highest-leverage lever on that whole chain.

## Deploy steps

Push to `main`. Code-only, no schema (`saved_events` + the saver-token cookie
already exist).

## Verify checklist

- [ ] Browse the calendar/any list on a phone → tap a card's ♡ → it fills, no
      navigation; the header shows "♥ N".
- [ ] First save shows the keep-list nudge once; dismiss sticks.
- [ ] /saved lists them with ✕ removes (no redundant ♡); empty state shows the
      restore hint.
- [ ] Watch save volume in the ops digest over the next weeks — this is the
      number that unblocks F1.3.

## Rollback

`git revert`. Additive; the detail-page SaveButton and the save back-end are
unchanged.
