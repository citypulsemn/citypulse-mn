# REELS-PUBLISH.md — Phase 2 architecture: auto-posting to Instagram

**Status:** BUILT (Aug 27, 2026) — all modules implemented and tested
(141 publish tests; `lib/reels/publish/`, `scripts/reels/publish.ts`,
`scripts/reels/ig-auth.ts`). Awaiting the one-time Meta setup below, then
the supervised rollout. Phase 1 (docs/REELS.md) generates finished reels on
schedule; this phase makes them post themselves.

## The shape of it

```
6:30 AM   Task: "CityPulse Reels Monday/Friday"  (exists today)
          └─ npm run reels  →  Reels\auto\<window>_<day>\{regular,family,weird}.mp4
                               + captions + manifest.md

8:30 AM ┐
11:45 AM ├ Task: "CityPulse Reels Publish"       (new — one task, three triggers)
6:30 PM ┘ └─ npm run reels:publish
             publishes each reel whose SLOT time has passed and isn't posted yet:
               regular → 8:30 AM · family → 11:45 AM · weird → 6:30 PM
             per reel:
               1. gate     — manifest clean? not already published? HOLD file absent?
               2. host     — upload mp4 to temporary public storage → public URL
               3. contain  — POST /<IG_ID>/media  (media_type=REELS, video_url, caption)
               4. poll     — container status once/min until FINISHED (≤5 min)
               5. publish  — POST /<IG_ID>/media_publish
               6. clean    — delete hosted file; record media id in published.json
             anything held or failed → ops email, honest and specific
```

The two hours between generation and the first publish are the human
override: reels are watchable in the output folder from 6:30, and dropping a
file named `HOLD` into the day folder (or deleting a reel) stops its
publish. Touch nothing and the system runs itself.

### Why staggered slots, and why these

2026 engagement studies agree on two daily surges (morning wake/commute,
evening wind-down) with Reels windows at roughly 8 AM–12 PM, 2–4 PM, and
6–9 PM — and all of them add that your own audience's rhythm wins. Three
reels dropped simultaneously also compete with each other in the same
followers' feeds during the first-hour window the algorithm uses to seed
distribution. So each card gets the slot its audience and purpose point to:

- **regular 8:30 AM** — commute/coffee scroll; Monday it's "plan your
  week", Friday it's the start of weekend planning. Inside the morning-rush
  window, and 2h after generation.
- **family 11:45 AM** — parents' phones come out at lunch/nap time, not
  during the school-run scramble; also inside the studies' top 10 AM–3 PM
  band.
- **weird 6:30 PM** — the group-chat share window ("we HAVE to go to
  this"), evening wind-down peak; on Friday that's exactly
  deciding-what-to-do-tonight-and-tomorrow hour.

Slot times are constants in publisher config — after 4–6 weeks, compare
against IG Insights' follower-activity chart and reel reach, and tune. The
late slots also make the day resilient: each trigger publishes anything due
and unposted, so a PC asleep at 11:45 gets caught up at 6:30 PM.

## Why this API path

Meta's **Instagram Platform API with Instagram Login** (launched July 2024)
publishes Reels for a professional account **without the old Facebook Page
requirement** — the account authorizes the app directly and gets an Instagram
User token with scopes `instagram_business_basic` +
`instagram_business_content_publish`. The older Facebook-Login/Page route
still exists but adds setup surface for zero benefit to us.

Constraints that shape the design (verified against current docs):
- The API fetches the video from a **publicly accessible URL** (`video_url`)
  — it cannot take a local file. Hence the temporary-hosting step.
- Container processing is async: poll ~once/minute, up to 5 minutes.
- Quota: **100 API-published posts per rolling 24h** (we use 3, twice a
  week); check via `GET /<IG_ID>/content_publishing_limit`.
- Reels via API: max 90s (ours are 33.07s), 9:16 H.264/AAC MP4 — the
  pipeline's exact output format.
- Tokens are long-lived (60 days) and refreshable. Publishing to your OWN
  account works with the app in Development Mode with you in an app role —
  no Meta app review. (Re-verify at implementation; Meta moves.)

## Components (all new code in `lib/reels/publish/`)

| Module | Job | Notes |
|---|---|---|
| `token.ts` | Load, refresh, persist the IG user token | Token lives in `Documents\CityPulseMN\ig-token.json` (NOT the repo). Refresh whenever >7 days old — each refresh restarts the 60-day clock, and we run twice weekly, so it stays perpetually fresh. Expired (PC off >60 days) ⇒ clear error + ops email: "re-run reels:auth". |
| `host.ts` | Put the mp4 somewhere Meta can fetch, then remove it | Interface with one default impl (decision below). Upload → URL → publish → delete. Nothing persists publicly beyond the publish window. |
| `instagram.ts` | The three Graph calls + quota check | Thin, typed, no retry magic — container errors carry Meta's error message verbatim into the manifest/ops email. |
| `publisher.ts` | Orchestrate one day folder | Pure-logic gate decisions (unit-testable): manifest parsing, hold policy, idempotency via `published.json` ledger (reel → media id, timestamp) so a rerun never double-posts. Publishes the three reels sequentially. |
| `scripts/reels/publish.ts` | CLI: `npm run reels:publish` | `--dry-run` does everything except `media_publish` (container is created and polled — proves the whole chain against the real API without posting). `--force-held` overrides a hold. |
| `scripts/reels/ig-auth.ts` | One-time + recovery auth helper | Prints the authorization URL; Taren opens it, approves, pastes back the redirect code; script exchanges code → short-lived → long-lived token → writes ig-token.json. |

## The gate (what publishes without a human)

Recommended policy — **clean reels post themselves; flagged reels wait**:

- Publish automatically: reel built, manifest shows no `⚠ AUTHENTICITY
  WAIVED` clip and no failed/skipped sibling weirdness affecting it.
- Hold + ops email: any reel with a waived-authenticity clip (the one case
  where wrong-looking footage could ship), or any publish-step failure.
- Never invented: a reel that wasn't built can't be published; the email
  says which and why (the manifest already knows).

The ops email reuses the Resend account from the site's digests. That means
`RESEND_API_KEY` joins `.env.local` (it's currently only in GitHub Actions).
Without it the hold still works — it just tells you via `run.log` and the
manifest instead of your inbox.

## One-time setup (Taren, ~30 min, guided)

1. Switch @CityPulseMpls to a **professional account** (Business) in the
   Instagram app. Free; keeps the grid; enables insights anyway.
2. developers.facebook.com → create an app → add the **Instagram** product
   ("API setup with Instagram login") → note the app ID/secret → add
   yourself as the Instagram tester and accept the invite in the IG app.
3. Run `npm run reels:auth`, follow the two prompts. Done — the scheduled
   publish task takes it from there.

## Failure modes, honestly

| Failure | Behavior |
|---|---|
| Token expired (PC off >60 days) | Publish run stops before uploading anything; ops email: re-run auth. Reels sit in the folder, postable manually. |
| Container rejected (spec/URL issue) | That reel held with Meta's error verbatim; siblings continue. |
| Hosting upload fails | Held; nothing was created on Meta's side. |
| PC asleep at a trigger | That firing is missed; each later slot trigger publishes anything still due (the 6:30 PM one is the day's catch-all). Fully missed day: `npm run reels && npm run reels:publish`. |
| Publish task reruns (manual + scheduled) | `published.json` ledger makes it a no-op. |
| Quota exhausted | Can't happen at our volume (6/week vs 100/day) — checked anyway, held with the count. |

## Decisions — locked with Taren (Aug 27, 2026)

1. **Temporary hosting: Supabase Storage** — public bucket `reels-publish`,
   delete-after-publish. Egress ≈ one Meta fetch per reel ≈ 150–250MB/week;
   trivial once the Pro upgrade lands. Needs the Supabase service-role key
   added to `.env.local`.
2. **Gate policy: clean-auto / flagged-hold** (as described above).
3. **Publish timing: staggered slots** — regular 8:30 AM, family 11:45 AM,
   weird 6:30 PM (rationale in "Why staggered slots"); Taren asked for the
   reach review that produced this schedule; slots are tunable constants.

## Go-live (in order — steps 1–2 are Taren's, ~30 min)

1. **Env**: add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY` (Supabase
   dashboard → Settings → API), `IG_APP_ID` + `IG_APP_SECRET` (from step 2).
   Optional but recommended: `RESEND_API_KEY` (same account as the digests)
   so holds/failures reach your inbox — without it they go to run.log only.
2. **Meta app**: switch @CityPulseMpls to a professional account (Instagram
   app → Settings). Then developers.facebook.com → Create App → add the
   "Instagram" product (API setup with Instagram login) → set redirect URI
   `https://localhost/` → copy the app ID/secret → add your Instagram
   account as an Instagram Tester and accept the invite in the IG app.
3. **Auth**: `npm run reels:auth` — open the printed URL, approve, paste the
   address-bar URL back. Token lands in `Documents\CityPulseMN\ig-token.json`.
4. **Dry run** (proves the whole chain, posts nothing):

```bash
npm run reels:publish -- --dry-run --only=regular
```

5. **First supervised real publish** of one reel on a posting day:

```bash
npm run reels:publish -- --only=regular
```

6. **Schedule** the three slot triggers (Mon+Fri each):

```bash
schtasks /Create /TN "CityPulse Reels Publish 0830" /SC WEEKLY /D "MON,FRI" /ST 08:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run reels:publish >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\publish.log 2>&1"
```

```bash
schtasks /Create /TN "CityPulse Reels Publish 1145" /SC WEEKLY /D "MON,FRI" /ST 11:45 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run reels:publish >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\publish.log 2>&1"
```

```bash
schtasks /Create /TN "CityPulse Reels Publish 1830" /SC WEEKLY /D "MON,FRI" /ST 18:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run reels:publish >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\publish.log 2>&1"
```

7. Watch one full week's manifests + publish.log, then it's hands-off.

Roadmap note: the same architecture carries City Pulse Plymouth later — the
publisher is per-account (token file + IG user id), everything else shared.
