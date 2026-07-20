# CLAUDE.md — City Pulse MN

Read this first, every session. It is the contract for how work happens on this project.

## What this is

**citypulsemn.com** — a live Twin Cities events hub. Minneapolis–St. Paul concerts, sports, family outings, festivals, and the wonderfully unique, on a calendar people actually use. Real users, real traffic, a real weekly email. Treat every change as production.

**Owner:** Taren. Non-expert web developer, frequently working from a phone. Explain *why*, not just *what*; never assume familiarity with framework internals. Taren makes the product calls — you bring options and a recommendation, not a fait accompli.

## Stack

- Next.js 15 App Router + React 19 + TypeScript, deployed on **Vercel** (auto-deploys on push to `main`)
- **Supabase** Postgres (schema in `db/schema.sql`, idempotent and additive — never destructive)
- Mapbox static maps · Resend email · GitHub Actions for the weekly pipeline and ops digest
- Vitest for tests (`npm test`), 550+ and rising

**Scripts:** `dev` · `build` · `test` · `lint` · `pipeline` (weekly research) · `digest` (subscriber email) · `ops-digest` (operator email; `-- --dry-run` is safe) · `verify` · `collapse` · `reclassify`

**Secrets** live in Vercel and in GitHub Actions: `DATABASE_URL`, `RESEND_API_KEY`, `UNSUBSCRIBE_SECRET`, `SITE_URL`, `DIGEST_FROM`, `OPS_DIGEST_TO`, Mapbox token. Never print or commit them.

## The working agreement

Taren's standing request, every roadmap item: **"design, build, and test it, up to our standards, and write a deployment guide."** That means one item per session, finished:

1. **Design** — read the roadmap spec for the item, then recon the actual code before writing any. Assumptions about helper names and file shapes have caused most of this project's wasted turns. Grep first.
2. **Build** — pure logic in `lib/` with golden tests; components and pages thin.
3. **Test** — the full quality gate (below). Verification means *observing the thing*, not intending it.
4. **Deploy guide** — a short markdown file: what shipped, why the design decisions, exact deploy steps, a verify checklist, rollback.

Report honestly. If something didn't land, say so plainly and fix it. Overclaiming is the one unforgivable failure here — see rule 8's origin.

## The quality gate (every item)

- Pure logic in `lib/`, covered by golden tests including the boundary and honest-emptiness cases
- Schema changes additive and idempotent (`create table if not exists`, new columns nullable/defaulted)
- `npx tsc --noEmit` clean
- `npm test` green
- `npm run build` clean
- `npm audit` → **0 vulnerabilities** (a standing requirement, not a nice-to-have)
- Smoke the actual surface; visual check where a human will look
- Deploy guide written

## Rules that were paid for in incidents

`docs/ENGINEERING.md` holds the standing rules, each with the production incident that produced it. Read it before your first change. The short form:

1. Never-break contract for analytics/aux paths (wrap them; a broken instrument must not kill its panel)
2. No build-time DB prerenders (the Vercel connection-pool stampede)
3. Know your environment's blind spots — **this rule changed with the move to local; see `docs/HANDOFF.md`**
4. Verify the axis the user reported
5. True spans, never capped expansions
6. Honest emptiness — no sad placeholders, no fake content, exclusions reported with reasons
7. Smoke conventions
8. Verify the archive, not the intention — **largely obsolete locally; see `docs/HANDOFF.md`**

## Voice

When writing anything user-facing — editorial intros, email copy, page metadata, Instagram captions:

- Concrete over promotional. The gold star on First Avenue's wall, not "iconic venue."
- **Banned:** "nestled," "vibrant," "hidden gem," "whether you're X or Y," "look no further," "in the heart of."
- Vary sentence length. Local shorthand is good (Nordeast, Eat Street, the Wonderwall).
- If it reads like a brochure, cut the sentence.
- Editorial copy lives in `lib/editorial.ts` as plain strings — Taren edits these freely, and Taren's voice wins over yours every time.

## Product stances (do not quietly violate)

- **No dark patterns.** One subscribe band per page, never a popup, ever.
- **Honest data.** Never invent an event, a date, or an end date. Where a fact isn't attested, use the conservative floor and flag it for the verify pass.
- **Never delete events** — archive them (`status = 'archived'`), and back up before bulk operations.
- The **sports rule**: never merge games across different days, no matter how similar the titles look.

## Orientation

`docs/ARCHITECTURE.md` for the system · `docs/SETUP.md` to run locally · `docs/DATABASE.md` for the schema · `docs/HANDOFF.md` for current state and what's pending · `docs/PIPELINE.md`, `docs/OPS-DIGEST.md`, `docs/INDEXING.md`, `docs/VERIFICATION.md` for the operational loops. There are 35 docs in `docs/` — one per subsystem. Check for an existing doc before writing a new one.
