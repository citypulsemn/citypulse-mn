# Deploy — Emails opt out of Gmail's mobile dark-mode inversion

*Aug 20, 2026. Diagnosed from a real phone screenshot: the weekly digest rendered
in Gmail's mobile app with pale lavender cards, muddy olive headings and grey body
text — nothing like the navy/gold/cream it's designed as. Desktop was fine.*

## Cause
Gmail's **mobile apps** run their own dark-mode transform on any email that doesn't
declare `color-scheme` support, and the transform is a **blanket inversion** — it
never checks whether the email is already dark. Ours are dark by design
(`#0a1020` navy, `#c9a961` gold, `#f1ece0` cream), so Gmail inverted them to light:

| Element | Designed | Gmail mobile rendered |
|---|---|---|
| page background | `#0a1020` near-black navy | pale lavender |
| cards | `#0e1830` dark navy | pale lavender |
| "CITY PULSE MN" | `#c9a961` gold | muddy dark olive |
| body text | `#f1ece0` cream | grey |
| event titles | cream | near-black |

The result stayed perfectly **legible** — it just wasn't the brand. That's why it
never showed up as "broken."

**Gmail on desktop does not do this**, which is the whole reason it went unnoticed:
every check we'd ever made was on a desktop client. The mobile-only asymmetry is
the fingerprint that it's Gmail's renderer and not our CSS.

The irony worth remembering: the phone was in **dark** mode, and Gmail **lightened**
a dark email.

## What shipped
**`lib/email-head.ts`** — one shared `<head>` for every HTML email:

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<style>:root{color-scheme:dark light;supported-color-schemes:dark light;}</style>
```

Declaring `color-scheme` is the opt-in that means *"this email handles dark mode
itself — render my colors as authored."* All three declarations are needed: clients
read different ones and Gmail wants the embedded `<style>`, not just the `<meta>`.
`dark light` (dark first) states the preference while still declaring light support,
so a light-mode client isn't forced into a dark render.

Applied to **all five** senders — digest, ops digest, confirm, saved-restore,
notify. They were each hand-rolling their own head, which is exactly why all five
carried the same bug.

## Verification (observed, not intended)
- Rendered the **real weekly digest** from production data and read the `<head>` —
  all three declarations present.
- **Tests +3** (1256 total): the shared head declares all three; **no email
  hand-rolls a head** (enumerated by scanning `lib/` for `<!doctype html>`, so a
  NEW email that rolls its own fails the test rather than silently reintroducing
  the bug); and dark-first-but-light-supported.
- Gate: `tsc` clean · 1256/1256 · `npm run build` clean · `npm audit` 0.

## The honest limit
**I cannot test inside Gmail's mobile renderer.** I can prove the tags ship; only a
phone can prove Gmail now respects them. This is the standard fix and resolves the
large majority of these cases, but **confirm on your phone after the next send**.

If it's still wrong, the fallback is heavier: Gmail rewrites the DOM during
inversion, adding `data-ogsc` / `data-ogsb` attributes to elements it recolours, and
you can target those with attribute selectors to force colours back. Worth trying
the standard fix first — the fallback is fiddly and client-specific.

## Deploy steps
Merge to `main`. No schema, no secret. Takes effect on the next send.

## Rollback
`git revert`. Purely additive — five head strings and one new module.
