# Deploy — G1.2: /this-week internal linking (SEO + funnel)

*August 2026. Tier 1 (audience). Code-only.*

## What shipped

G1.2 is the ongoing "compound the SEO / internal links" stance. The G1.1
attribution data gave it a concrete first target: **`/this-week` converts 0 so
far — because almost nothing links to it.** Before this, the site's best
conversion surface (the public shop-window for the Thursday email) was reachable
only from the sitemap, the FirstSaveNudge, and the digest footer. Every other
section (This Weekend, Ongoing, Collections, Places, Venues, Neighborhoods,
Cities) sat in the sitewide nav; `/this-week` did not.

- **[TopBar.tsx](../../components/TopBar.tsx)** — added **"This Week"** as the
  first item in the shared section nav → a link on all 16 content pages. Internal
  link equity to an evergreen page + top-of-page discovery.
- **[SiteFooter.tsx](../../components/SiteFooter.tsx)** — added **"This Week"** as
  the first footer link. The footer renders on **every** page including the
  homepage (which keeps its own interactive topbar and has no section nav), so
  this is `/this-week`'s one sitewide link on the site's highest-traffic page.

Both lead with "This Week", with "This Weekend" as its parallel sibling.

## Why this is the right G1.2 move

Sitewide nav + footer is the **maximal** internal-link footprint — every page now
points at `/this-week`. Individual contextual links (from day pages, collections,
etc.) would be marginal on top of that. This is the highest-leverage internal-link
change available, and it directly unblocks the G1.1 finding: give the page traffic
so its conversion rate can actually be judged.

## Verification

Gate: `tsc` clean · **1002** tests (+1; nav test now pins `/this-week` **and** the
previously-unchecked `/places`, plus a new footer tripwire) · `npm run build`
clean · `npm audit` 0.

**Browser-verified (dev):** on `/ongoing`, the section nav renders
`This Week → /this-week` as the first link (ref_2), ahead of This Weekend; the
footer's first link is `This Week -> /this-week`. No new console errors (the only
error is the known, pending R2.2 `featured` table — apply `db/schema.sql`).

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Verify checklist

- [ ] Any content page: "This Week" is the first item in the top section nav and
      the first footer link, and both open `/this-week`.
- [ ] Homepage footer shows "This Week" (the homepage has no section nav by design).
- [ ] Over the coming weeks, watch **Admin → Stats → "Where subscribers come from"**:
      `this-week` should start accruing signups now that it gets traffic.

## Rollback

`git revert`. Pure link additions; nothing else changes.
