/**
 * The shared <head> for every HTML email we send.
 *
 * WHY THIS EXISTS (Aug 2026, from a screenshot of the real thing): Gmail's MOBILE
 * apps run their own dark-mode transform on any email that doesn't declare
 * color-scheme support, and the transform is a blanket inversion — it never checks
 * whether the email is already dark. Our emails are dark by design (#0a1020 navy,
 * #c9a961 gold, #f1ece0 cream), so Gmail inverted them to LIGHT: pale lavender
 * cards, muddy olive gold, grey body text. Legible, but not the brand at all.
 * Gmail on DESKTOP does not do this, which is why it looked fine everywhere we
 * checked and wrong on a phone.
 *
 * Declaring `color-scheme` is the opt-in that means "this email handles dark mode
 * itself — render my colors as authored." Both the <meta> tags and the :root rule
 * are needed: different clients read different ones, and Gmail wants the embedded
 * style. `dark light` (dark first) states our preference while still declaring
 * light support, so a light-mode client isn't forced into a dark render.
 *
 * Keep every email on this one head so a fix here reaches all of them at once —
 * they were all broken the same way because they each hand-rolled their own.
 */
export const EMAIL_HEAD =
  '<meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="color-scheme" content="dark light">' +
  '<meta name="supported-color-schemes" content="dark light">' +
  "<style>:root{color-scheme:dark light;supported-color-schemes:dark light;}</style>";
