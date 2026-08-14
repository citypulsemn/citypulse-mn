# Deploy — M0.1 outbound affiliate-tagging seam

*August 2026. Monetization Tier 0. Code-only.*

## What shipped

A turnkey seam to claim affiliate credit on ticket clicks — built **dormant**,
plus the report that decides whether it's ever worth activating.

- **[lib/outbound.ts](../../lib/outbound.ts)** — `outboundTicketUrl(url)`: appends
  a vendor's affiliate params to its own URL for hosts in the `AFFILIATE` map.
  The map is **empty by design** — until we join a program and add its
  (non-secret) tag, every URL passes through unchanged, so wiring it in is a safe
  no-op. Discipline: only appends query params, never rewrites host/path, never
  clobbers a param the vendor already set, idempotent, pure.
- **[TicketButton.tsx](../../components/TicketButton.tsx)** — the gold ticket CTA
  now renders `outboundTicketUrl(event.ticketUrl)`. No visible change today;
  activates everywhere the instant a tag is added.
- **[lib/stats.ts](../../lib/stats.ts) `getTicketClicksByVendor(days)`** + a
  **"Ticket clicks by vendor"** table on **Admin → Stats** — the immediate value:
  it shows where high-intent clicks actually land. (The retro found most demand is
  the non-affiliate long tail — festivals, box offices — not Ticketmaster/SeatGeek,
  which is exactly why the seam is dormant, not active.)

## How to activate (when a program is joined — owner + a one-line edit)

Add an entry to `AFFILIATE` in `lib/outbound.ts`, e.g.:
```ts
export const AFFILIATE = { "seatgeek.com": { params: { aid: "YOUR_ID" } } };
```
Affiliate IDs are non-secret, so they live in code (not env). Tagging then applies
to every matching ticket link site-wide. Watch the vendor report first to see
which programs are worth the paperwork.

## Verification

Gate: `tsc` clean · **976** tests (+9 golden: passthrough when dormant, tagging
with a joined program, host/path never rewritten, existing-query preserved,
idempotent) · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Verify checklist (production)

- [ ] Ticket links still work (unchanged — the config is empty).
- [ ] Admin → Stats shows "Ticket clicks by vendor" once clicks accrue.

## Rollback

`git revert`. Pure seam; reverting restores raw ticket URLs.
