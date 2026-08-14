# Deploy — R2.1 newsletter sponsor slot

*August 2026. Monetization Tier 2 (Revenue). Code-only.*

## What shipped

A **"Presented by ___"** slot in the weekly digest — the first sellable
inventory on the site — built dark, so it costs nothing and shows nothing until
a sponsor is signed.

- **[lib/digest.ts](../../lib/digest.ts)**:
  - `DigestSponsor` type (`name`, optional `url`, optional `tagline`) and
    `DIGEST_SPONSOR` config — **`null` by default**. Taren-editable, exactly like
    editorial copy; set the object when a sponsor signs.
  - `sponsorSlotHtml` / `sponsorSlotText` — pure renderers. `null` ⇒ `""` (no
    band, no "your ad here" placeholder — honest emptiness). When set, an
    email-safe navy/gold card near the top, always under a literal **"Presented
    by"** label so it reads as a sponsor, never as an event (**no dark patterns**).
    The sponsor's link is UTM-tagged (`utm_campaign=sponsor`) so they can see the
    traffic we send.
  - `renderDigestEmail` gained an optional `sponsor` param — defaults to the
    module config; pass `null` to force none, or an object to preview one.

## How to activate (owner + a one-line edit)

In `lib/digest.ts`, set:
```ts
export const DIGEST_SPONSOR: DigestSponsor | null = {
  name: "Surly Brewing",
  url: "https://surlybrewing.com",
  tagline: "Beer hall + patio in Prospect Park.",
};
```
It renders in the very next weekly send. Clear it back to `null` when the run ends.

## Verification

Gate: `tsc` clean · **983** tests (+6) · `npm run build` clean · `npm audit` 0.
Golden tests: dark by default (no band in HTML **or** text), `null` renders `""`,
a set sponsor renders the label + name + tagline + UTM'd link, name-only omits
the link, UTM appends correctly onto a URL that already has a query, and the name
and tagline are HTML-escaped.

## Deploy steps

Push to `main`. Code-only, no schema, no env. Nothing changes in a live send
until `DIGEST_SPONSOR` is set.

## Verify checklist

- [ ] `npm run digest -- --dry-run` with `DIGEST_SPONSOR` still `null` → no
      "Presented by" anywhere in the preview.
- [ ] Temporarily set a test sponsor, dry-run again → the labeled band appears
      near the top; revert to `null`.

## Rollback

`git revert`. Pure additive render; reverting drops the slot entirely.
