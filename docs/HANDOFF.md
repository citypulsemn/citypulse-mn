# Handoff — current state (July 20, 2026, end of night)

Originally written at the move from chat-based development to Claude Code on the local
repo; rewritten after the July 20 session, which closed every open loop the original
version listed. Read alongside `CLAUDE.md`.

## Where the roadmap stands

The canonical plan is **Roadmap v5, Repair & Ripen** (`docs/ROADMAP-v5.md`, adopted Jul 20
evening) — three repair sprints (R0 data-loss/trust, R1 the Chicago clock, R2 hardening),
then v4's ripening schedule unchanged. v4 (`docs/ROADMAP.md`) stands as history; an earlier
file circulating as "CITYPULSE-ROADMAP-v5.md" was identical to v4 and is superseded too.

**ALL THREE SPRINTS SHIPPED the same night they were adopted** (commits `R0.1` … `R2.7`,
one deploy guide each in `docs/deploy-history/`): R0 killed the live data-loss bugs
(ended-banner, archive predicate, dedupe frame, restore column, resubscribe, JSON-LD
escape, sports-span repair) · R1 unified every "is it past?" on `lib/clock.ts` (rule 10)
· R2 hardened the perimeter — rate limits on all public write paths (`rate_events`
table live in prod), red-digest on missing key, ops-digest key collisions +
zero-poisoning + HTML escaping, true-span ICS + Google DATE links + octet folding, the
schema drift guard (109 refs swept), and the housekeeping batch (SSRF remotePatterns
closed, canonical origin aligned to `www`, `digest_sends` honesty, keep-list
merge-on-request per Taren's call). Suite went 556 → 684 tests today. **Next code work:
F1 ripening (mid-August) or the F2 proposals — nothing is urgent.**

- **Phases 1–3: COMPLETE and verified live.** Cockpit sends (twice so far), Phase 3
  surfaces (editorial intros, OG cards, subscribe bands, canonicals) confirmed serving
  in production. Search Console: domain verified, sitemap (121 URLs, www host)
  submitted **Jul 20**.
- **6.1 iCal feeds: SHIPPED Jul 20** (`1.6.1.0`) — `/feeds/<slug>` for this-weekend,
  categories, collections, venues, neighborhoods. `docs/FEEDS.md`.
- **4.4 /for-venues: SHIPPED Jul 20** (`1.4.4.0`) — copy in `lib/editorial.ts`
  (`FOR_VENUES`), Taren-editable.
- **Everything ungated is now shipped.** 4.1/4.2 ripen with ~4 weeks of `event_stats`
  (mid-August); 4.3 follows 4.2; Phase 5's eight-green-weeks clock is countable starting
  with the Jul 21 digest; 6.2+ parked by design.

## What the July 20 session fixed (context for the commits `1.2.1.1` → `1.4.4.0`)

1. **Ops digest WoW math was silently dead** (jsonb double-stringify; every email would
   have said "first report" forever) and the Index section couldn't fetch in CI. Fixed;
   the Jul 21 digest is the first fully-correct one.
2. **The pipeline was re-creating collapsed duplicates weekly** — start-day-only
   clustering couldn't see run cards' spans. `planCollapse` in `lib/multiday.ts` is now
   span-aware with parent-child folding (Taren's call: sub-events fold into the parent).
   32 fresh duplicates archived; RenFest/Sever's/State Fair at one card each.
3. **The Thursday verify pass was done early with web evidence** — all 13 outstanding
   conflicts resolved against official sources (16 archived, 12 verified, 3 spans, 1 time).
4. **Engineering rule 9 discovered and codified**: postgres.js types ISO-shaped string
   params as timestamptz — always `::text::timestamp at time zone 'America/Chicago'`.
   Admin time edits carried this bug; fixed in code, but **any event whose time was
   hand-edited in admin before Jul 20 may still be stored +5/6h late** (data spot-check
   pending, below).

## Pending — the watch list (nothing is blocked; everything here has a date or an owner)

1. **Mon Jul 21** — pipeline + digest. Check: `folded N sub-event group(s)` in the log,
   festivals still one card each, WoW percentages (not "first report"), a sitemap count
   in the Index line. **New (R2.7): open the delivered digest in Gmail → "Show
   original" → confirm `List-Unsubscribe` + `List-Unsubscribe-Post` headers survived
   Resend's batch endpoint** — if absent, switch to per-recipient sends (noted in
   DEPLOY-R2.7). Also glance at `rate_events` (`select * from rate_events limit 10`) —
   human-sized numbers mean R2.1 is breathing normally.
2. **~Jul 27** — first Search Console Pages numbers. Report the indexed count; it seeds
   the digest's Index line and starts the Phase 5 impressions gate.
3. **Taren, anytime**: subscribe one feed in a real calendar app (last 6.1 verify) ·
   Sever's true end date (extend the card's `multi_day_end`; the two Oct weekend rows
   then fold automatically next run) · roadmap 1.3 bio link · 1.4 paste a real card to
   lock `formatCard` · 1.5 phone checks · reword `FOR_VENUES` to taste.
   *(The rule-9 admin-edit spot check closed Jul 20 by evidence: `admin_audit` has zero
   `edit` actions ever, so no hand-edited times exist to fix.)*
4. **Mid-August** — build 4.1 (demand column), then 4.2 (trending calibration), then 4.3.

## Environment notes (this machine, learned the hard way — details in memory files)

- `DATABASE_URL` lives in `.env.local`; every `npm run` script auto-loads it. **Taren
  edits this file from a phone — verify value shapes before trusting them** (a `//`
  once arrived as `..`).
- `git push` needs `$env:GCM_INTERACTIVE = 'auto'` in agent sessions. `gh` CLI is not
  installed, so GitHub Actions state can't be checked from the shell.
- Raw one-off prod UPDATEs may be blocked by the permission layer — prefer the repo's
  own scripts, or hand Taren SQL for the Supabase editor. Back up touched rows to the
  scratchpad first; today's backups: `collapse-backup-20260720.json`,
  `verify-pass-backup-20260720.json` (session scratchpad, ephemeral — rollback SQL is
  in the deploy guides).
- Commit subjects are bare version numbers: 4-part `1.<phase>.<item>.<patch>` for v4
  items, 3-part for maintenance of pre-v4 items. One deploy guide per item in
  `docs/deploy-history/`.

## Conventions worth preserving (unchanged, still paying rent)

- **Recon before writing.** Grep the real export first; guessed helper names remain the
  top source of wasted turns (Jul 20's two test failures were both guessed assumptions).
- **Drift guards** for hand-maintained data (`related.test.ts`, `feeds.test.ts` pattern).
- **Pure core, thin shell** — `planCollapse`, `composeOpsDigest`, `selectFeedEvents` are
  the model.
- **Verify the artifact, and the read-back.** Rule 9 was caught only because the session
  re-read what it had just written to prod. Write → read back → compare, every time.
- **One item per session, finished**: design, build, test, deploy guide.

## First session opener

> Read `CLAUDE.md` and `docs/HANDOFF.md`, check memory, then `git log --oneline -10` and
> `npm test`. If it's after Jul 21, read the latest ops digest state (`ops_digest_runs`,
> `pipeline_runs`) before proposing work — the instruments now know more than the docs.
