# Engineering rules — City Pulse MN

The standing rules, each earned by a production incident. They apply to every build, and every deploy guide assumes them. (Roadmap 2.3.)

## 1. The never-break contract for analytics & aux paths
Any read or write that isn't core to serving events — stats, trending, digest logging, ops gathers — is wrapped: try/catch → empty/no-op + console.error. **Origin:** the 5.1 admin-stats 500 — a live page crashed because a read assumed a table that hadn't been created yet. A missing instrument must never take down the panel it reports to.

## 2. DB-backed pages never prerender at build
On-demand ISR is the default; `generateStaticParams` needs a positive reason. **Origin:** the 5.5 Vercel build stampede — 16 parallel build-time prerenders exhausted the Supabase connection pool; 60s timeouts × 3 retries killed the build. Index pages doing ONE query at build (homepage, /ongoing) are the allowed pattern; per-slug fleets are not.

## 3. The container's blind spots are permanent
The dev container has **no database** (all DB paths ship pre-wrapped and are exercised for the first time in production — write them defensively), an **old WebKit renderer** (no flex-gap; some live CSS bugs won't reproduce here — the background-seam fix was verified by construction, not reproduction), and **no egress to the live site or Mapbox**. Production-only failure modes are named in deploy guides, not discovered by users.

## 4. Verify the axis the user reported
**Origin:** the venue-map fix that centered the pin when the complaint was page layout. A user report names an axis; the fix is verified on THAT axis before shipping. Screenshots beat assumptions.

## 5. True spans, not capped expansions
`daysSpanned` caps at `EXPAND_MAX_DAYS` (14) to keep the calendar grid sane. Any surface asking "is this running on day X?" uses TRUE span intersection (`spanEnd`), never the capped expansion. **Origin:** the 17-day fair invisible on /this-weekend; encoded as regression tests there and in lib/ongoing.

## 6. Honest emptiness
Strips self-hide below minimum (trending, ongoing); pages render honest empty states; generators mark thin cards incomplete rather than padding. No sad placeholders, no fake content, no silent filtering — exclusions are reported with reasons.

## 7. Smoke conventions
One `next start` cycle per build (repeated cycles exhaust the container — use plain `node -e`/tsx for pure-lib checks). RSC streaming inserts `<!-- -->` between text expressions — grep static strings only. wkhtmltoimage for visuals, minding rule 3's renderer caveats.

## Restore & package
```
cd /home/claude && rm -rf citypulse-mn && mkdir citypulse-mn && cd citypulse-mn \
  && unzip -q /mnt/user-data/outputs/citypulse-mn.zip && npm ci
cd /home/claude/citypulse-mn && rm -f /mnt/user-data/outputs/citypulse-mn.zip \
  && zip -rq /mnt/user-data/outputs/citypulse-mn.zip . -x "node_modules/*" ".next/*" ".git/*"
```
Quality gate per item: pure logic in lib/ + golden tests · idempotent additive schema · tsc clean · build clean · audit 0 · one smoke cycle · deploy guide.

## 8. Verify the archive, not the intention
A rate-limit interruption mid-`zip` produces a structurally valid but PARTIAL archive — and a grep that "verifies" it can pass on what it finds while missing what it doesn't. **Origin:** the 3.1 zip shipped without docs/INDEXING.md; the operator caught it, not the build. The rule: after packaging, compare COUNTS — files in tree vs entries in archive — and re-zip on any mismatch:
```
T=$(find . -type f ! -path "./node_modules/*" ! -path "./.next/*" ! -path "./.git/*" | wc -l)
Z=$(unzip -l /mnt/user-data/outputs/citypulse-mn.zip | grep -cE "^\s+[0-9]+\s+[0-9-]+ [0-9:]+   .+[^/]$")
echo "tree=$T zip=$Z"; [ "$T" = "$Z" ] && echo PARITY || echo "MISMATCH - re-zip"
```
