# Handoff — current state (July 2026)

Written at the move from chat-based development (zip deliverables, ephemeral container) to **Claude Code / Cowork** working directly on the local repo. Read alongside `CLAUDE.md`.

## Where the roadmap stands

The canonical plan is **Roadmap v4 (Build Edition)** — keep a copy at `docs/ROADMAP.md` if it isn't already there.

**Phase 1 — Operator checklist**
- **1.1 Multi-day collapse** — SQL generated and delivered (`COLLAPSE-1.1.sql`: 93 clusters, 159 rows archived, RenFest 19→1, Sever's 15→1, State Fair 6→1). ⏳ *Not yet run by Taren.*
- **1.2 Search Console** — code shipped (homepage canonical, `/api/` disallowed). ⏳ *GSC property + sitemap submission pending.*
- 1.3 bio link · 1.4 lock the Instagram card format from one real post · 1.5 phone spot-checks — ⏳ all Taren-side.

**Phase 2 — The cockpit: COMPLETE**
- 2.1 Ops digest — the keystone. `lib/ops-digest.ts` (pure compose) + `scripts/send-ops-digest.ts` (resilient gather), seven sections, fires after the weekly pipeline on success *or* failure. ⏳ *Needs the `ops_digest_runs` schema paste + `OPS_DIGEST_TO` secret before it can send.*
- 2.2 Ongoing strip + `/ongoing` page — ending-soonest, true-span.
- 2.3 `docs/ENGINEERING.md`.

**Phase 3 — Earn the audience: COMPLETE (code), pending deploys**
- 3.1 Indexing loop (slug canonical audit, ops-digest "Index surface" section, `docs/INDEXING.md`)
- 3.2 Content depth (`lib/editorial.ts` — 17 venue + all 16 neighborhood intros; `lib/related.ts` + `MoreAtVenue`)
- 3.3 OG social cards (`lib/brand/og-card.tsx` + routes for this-weekend, venues, neighborhoods)
- 3.4 Subscribe band, source-tagged (`this-weekend` / `venue-page`), with the ops-digest placement breakdown
- 3.5 Vitals (Mapbox `dns-prefetch`, image dimensions)

**Next up:** Phase 4 (4.1 demand column → 4.2 trending tune → 4.3 for-you via client-side affinity → 4.4 `/for-venues`), or **6.1 iCal feeds**, which the roadmap allows to jump the queue after Phase 3.

## Pending — Taren's queue

Ordered by value. These are the open loops the last chat session couldn't close.

1. **Run `COLLAPSE-1.1.sql`** — STEP 0 pre-flight (expect zero rows), then STEP 1. Count check should read **159**. Backup table + 3-line rollback included.
2. **Deploy anything unpushed** — Phase 3's items shipped as zips; confirm `main` contains `lib/editorial.ts`, `lib/brand/og-card.tsx`, `components/SubscribeBand.tsx`, `docs/INDEXING.md`.
3. **Ops digest bring-up** — paste the `ops_digest_runs` block from `db/schema.sql`, add the `OPS_DIGEST_TO` GitHub secret, run the workflow once with dry-run, then for real.
4. **Search Console** — Domain property, DNS TXT via Vercel, submit `sitemap.xml`. Report the indexed count back; it's the first data point for the Index-surface section.
5. **Post-deploy verifications** — OG cards in a debugger (3.3), a test signup from each band checking `subscribers.source` (3.4), mobile Lighthouse on four pages (3.5).
6. **The Thursday verify pass** — ~14 events have conflicting facts deliberately left in place rather than guessed at (Lynx 7/15 opponents, Twins 9/8 and 9/15, Woodbury Days extras, Uptown Porchfest 8/8 vs 8/15, and others listed in `COLLAPSE-1.1-GUIDE.md`).

## What changes now that work is local

Two engineering rules were shaped by the old chat container. They are not wrong, but their scope changed — a fresh agent should not carry them blindly.

**Rule 3 (environment blind spots) — mostly dissolves.** The container had no database, no egress to the live site or Mapbox, and an old WebKit renderer. A local machine has all three. This unlocks work that was previously impossible:
- Run and verify `COLLAPSE-1.1.sql` against Supabase directly (against a branch/backup first).
- Exercise DB-backed code paths *before* production instead of discovering them there. Every `sql`-touching path in this repo was written defensively precisely because it could never be tested locally — that defensiveness stays, but it can now be verified.
- `npm run ops-digest -- --dry-run` with a real `DATABASE_URL` composes a real email from real data.
- Fetch the live site: OG card previews, sitemap counts, Lighthouse runs.
- **What remains true:** production is still production. Test against a Supabase branch or a backup before running bulk SQL, and keep `.env.local` out of git.

**Rule 8 (verify the archive) — obsolete in its original form.** It existed because deliverables were zip files and an interrupted `zip` shipped a partial archive. Working directly in the repo, there is no archive. **The principle survives and generalizes: verify the artifact, not the intention.** After changes, confirm `git status` / `git diff --stat` actually shows what you believe you changed, and that tests ran against the tree you edited.

**Rule 7 (smoke conventions) — loosens.** One `next start` cycle per build was a container-resource constraint. Locally, `npm run dev` can simply stay running. The RSC caveat still holds: streaming inserts `<!-- -->` between text expressions, so grep for static strings only.

## Conventions worth preserving

They were expensive to learn and they still apply:

- **Recon before writing.** Most wasted effort in this project came from guessed helper names (`venueBySlug`, `currentWeekendDays`, four wrong venue slugs). Grep the real export first.
- **Drift guards.** `lib/__tests__/related.test.ts` asserts every editorial key resolves against the live registries. That test caught four dead keys within a minute of being written. Copy the pattern for any new hand-maintained data.
- **Pure core, thin shell.** Selection logic in `lib/` with golden tests; pages just render. `selectOngoing`, `selectRelated`, `composeOpsDigest`, `assessCoverage` are the model.
- **Resilience wrapping.** Every non-core read is caught and degrades to an honest "unavailable" message. The ops digest composes and sends even with all seven sections down.
- **One item per session, finished.** Design, build, test, deploy guide. Resist bundling.

## First session in Code or Cowork

Suggested opener, once the folder is connected:

> Read `CLAUDE.md` and `docs/HANDOFF.md`, then `git log --oneline -15` and `npm test`, and tell me where the project actually stands versus what the handoff claims. Flag any drift before we start the next roadmap item.

That's deliberately a verification task, not a build task. It confirms the environment works, establishes the real state, and gives the agent a genuine reason to read the codebase before touching it.
