# Deploy F2.4 — Search Console impressions (tested core; live read one secret away)

*August 2026. Roadmap v5 F2.4. The data gate (GSC accumulating data, ~Jul 27) has
passed; the remaining gate is the service account. Per Taren's call: build the
tested core now, wire the live read later. This ships everything except the
secret.*

## What shipped

**[lib/search-console.ts](../../lib/search-console.ts)** — the demand side of the
indexing loop, reading itself into the ops digest:

- `parseSearchAnalytics(response)` — sums a Search Console `searchAnalytics.query`
  response into 7-day impressions/clicks (+ derived CTR). Pure, golden-tested.
- `buildJwtClaims` / `gscDateWindow` — the service-account assertion and the
  query window (ends 3 days back for GSC's finalization lag). Pure, tested.
- `getSearchImpressions(7)` — the entry point. **Returns null when the service
  account isn't configured (today's state → the digest keeps its manual GSC
  line)**, and null on ANY failure (never-break). No SDK — the JWT is
  hand-signed with `node:crypto` and exchanged via plain fetch, per the repo's
  audit-0 rule.

**Ops digest** ([lib/ops-digest.ts](../../lib/ops-digest.ts)): the Index surface
section shows `N GSC impressions · M clicks (7d) (WoW)` when the read succeeds,
and falls back to the existing manual glance line when it doesn't. Impressions
are stored in the WoW baseline (`ops_digest_runs.totals.search_impressions`,
additive key). **Deliberately NOT automated: the raw "indexed pages" count** —
the API doesn't expose it as a bulk read, so that stays the manual glance.

**Workflow** ([ops-digest.yml](../../.github/workflows/ops-digest.yml)): passes
`GSC_SERVICE_ACCOUNT_JSON` through from secrets. Missing secret resolves to an
empty string → `getSearchImpressions` returns null → manual line. **So adding
the secret is the only step to go live — no code change.**

## Why "impressions", not "indexed count"

The spec said "indexed count & impressions." Only impressions/clicks are a clean
API read (`searchanalytics`); the indexed-pages number would need per-URL
Inspection API sampling (rate-limited, 2000/day). Impressions is also the number
the Phase 5 revenue gate actually watches — so we automate that and leave the
indexed count as the (cheap) manual glance.

## Verification (observed, not intended)

- **The pre-wire state, end-to-end on real data:** `npm run ops-digest --
  --dry-run` → Index surface renders `1129 URLs in the live sitemap (+8% WoW)`
  and the manual `demand side: check GSC…` line — exactly the never-break
  fallback, because no key is configured.
- Tests +15 (772/772): parseSearchAnalytics (aggregate row, per-day sum, honest
  emptiness, junk/NaN rows ignored, no divide-by-zero); buildJwtClaims
  (iss/scope/aud/exp); gscDateWindow (3-day lag); getSearchImpressions null on
  no-key / blank / malformed; ops-digest Index section both wired and unwired,
  with WoW and first-report.
- **NOT yet verified (by design):** the live token exchange + GSC query. Those
  run only once a real key exists and are verified against real data at wire-up.
  They sit behind the never-break wrapper, so an outage or bad key degrades to
  the manual line — never a dead email.
- Gate: tsc clean · 772/772 · build clean · audit 0.

## Bundled security fix: Next 15.5.22 + postcss 8.5.26

`npm audit` went 0 → 2 high mid-session on newly published Next.js (SSRF / cache
/ DoS advisories) and postcss (path traversal) CVEs — pre-existing, unrelated to
F2.4. Non-breaking `audit fix`-level bumps: `next ^15.5.22` and the postcss
override `^8.5.26` (Next stays 15.x). Committed separately so it can be reverted
on its own. Audit back to 0; tests + build green on the new toolchain.

## Go-live checklist (the "later" — ~15 min, mostly Google Cloud clicking)

1. **Google Cloud** → create/pick a project → **APIs & Services** → enable the
   **Google Search Console API**.
2. **Create a service account** (any name) → **Keys** → **Add key** → **JSON** →
   download. This file has a `client_email` and a `private_key`.
3. **Search Console** → your property → **Settings → Users and permissions** →
   **Add user** → paste the service account's `client_email` → role **Full** (or
   Restricted; read-only is enough).
4. **GitHub** → repo → **Settings → Secrets and variables → Actions** → **New
   secret** → name `GSC_SERVICE_ACCOUNT_JSON`, value = the ENTIRE contents of the
   JSON file. (Optional: `GSC_PROPERTY` if not `sc-domain:citypulsemn.com`.)
5. Tell me — I'll run the ops-digest dry run and confirm real impressions render,
   then it's live on the next Monday send.

## GO-LIVE — Aug 15, 2026 (the "later" happened; it's live)

Wired up and verified live via `Actions → Ops Digest → Run workflow (dry_run)`.
First real report: **`4732 GSC impressions · 182 clicks (7d)`** (3.85% search CTR).
Auto-runs every Monday now; no code change was needed to go live (as designed).

**Three gotchas that cost real time — record them for the next Google setup:**

1. **The org-policy block ≠ an IAM-role problem.** Creating the service-account
   JSON key was blocked by the org policy `iam.disableServiceAccountKeyCreation`.
   Granting the service account **Owner** did nothing — **org policies sit ABOVE
   IAM roles; no role, not even Owner or Org Admin, overrides a policy.** You must
   change the *policy*, not the roles.
2. **Organization *Administrator* ≠ Organization *Policy* Administrator.** Editing
   the org policy needs the separate role `roles/orgpolicy.policyAdmin`. The owner
   (org admin) had to grant himself that role first, then set
   `iam.disableServiceAccountKeyCreation` to **Not enforced**, then create the key.
3. **The Performance API needs "Full", not "Restricted."** Adding the service
   account to the GSC property as a **Restricted** user still 403'd
   (`User does not have sufficient permission for site 'sc-domain:citypulsemn.com'`
   — a 403, not a 401, so the credential chain was already proven working).
   Bumping the property user to **Full** fixed it. **Checklist step 3 above is
   wrong** — read-only/Restricted is NOT enough for `searchAnalytics.query`; use
   **Full**.

Property is a Domain property, so the default `sc-domain:citypulsemn.com` was
correct and `GSC_PROPERTY` stayed unset.

## Rollback

`git revert`. `getSearchImpressions` returning null is inert; the digest simply
keeps its manual line.
