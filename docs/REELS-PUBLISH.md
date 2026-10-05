# REELS-PUBLISH.md — Phase 2 architecture: auto-posting to Instagram

**Status:** BUILT (Aug 27, 2026) — all modules implemented and tested
(142 publish tests; `lib/reels/publish/`, `scripts/reels/publish.ts`,
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

---

# Still cards (feed posts on non-reel days) — DESIGN v2, not built

**Status:** DESIGN (Oct 4, 2026), revised after a three-way adversarial
review that measured the first draft against live data. Recon by four
parallel readers; API rules checked against Meta's current docs; mockups
rendered from the real template. Decisions were locked Oct 5 (bottom).

## What and why

Admin → Content (roadmap 2.1, docs/CONTENT.md) renders Instagram feed cards
that a human must download and post. That human step is the proven
bottleneck: the account went a month without a post. This adds **arch-style
still cards that post themselves on a day the reels don't**, through the gate
the reels already use.

The existing content-tab cards and captions are **not** what gets posted.
They can't be automated honestly: every caption template carries emoji,
hashtags and em dashes (all banned by the reel caption rules), the kit has no
drag/political screen, and card and caption disagree in three places. The tab
stays the manual pull tool it was built to be.

## v1 is one card: "Five places"

The arch template is a five-row list, so cards are **lists of five built from
data alone — no model call**. The first draft proposed two cards. The review
measured both against the live database and they are not equally good:

| | Five places | Free this week |
|---|---|---|
| Overlap with that week's reels | **none** — the reels never touch Places | **5 of 5 rows** already on that week's reels, all three weeks measured |
| Supply | a card in **52 of 52** simulated weeks | 6–10 honest rows in October, the best month; winter unmeasured |
| Honesty hazards with nobody reviewing | registry facts with a source URL each | unverified rows, evergreen "daily admission" listings, events already over by post time, a brand screen with election-season gaps |

So **v1 ships the Places card only** and the Free card is deferred — it is
buildable (hardening list below) but it is a recap of the reels carrying the
most risk. Places is the vertical with no social presence at all.

### How the five are chosen

- **Kind of the week.** One kind per card (orchards, museums, dog parks…).
  Seasonal kinds in their safe season go first — orchards belong in October,
  not whenever a shuffle reaches them — then year-round kinds. A kind needs at
  least 10 eligible places, so a card is never most of the list.
- **No kind repeats within 8 weeks.** That single rule replaces the draft's
  two. The memory is the card folders themselves: each one records the kind
  it posted, and the generator reads the last eight weeks of them. No separate
  history file to lose (the reels' history.json would silently erase it).
- **Card-safe seasons.** Registry seasons are month-level and wider than the
  truth ("Memorial Day–Labor Day" is stored as May–September). A ±14-day
  margin, measured, still put beaches on a card before Memorial Day and after
  Labor Day. Each season gets explicit card-safe dates instead (summer Jun 1–
  Aug 31, winter Jan 1–Feb 14, and so on), with golden tests on the edges.
- **Which five.** Ordered by a hash of the place and the week — deterministic,
  not alphabetical, different every time the kind comes round.
- **What a row says.** Name and city, nothing else. **No tags**: they carry
  schedule and staffing facts (market days, lifeguards, open-skate) that go
  stale. **No cost**: the registry field means admission, and the mockup
  showed what that does — "Pine Tree Apple Orchard · Free" reads as free
  apples.
- **Wording.** Never "best", "top", or anything implying a ranking. For the
  kinds the registry marks as a curated sample, the header says "from our
  list" and the bottom row reads "MORE AT CITYPULSEMN.COM/PLACES" — not
  "FULL GUIDE", which would claim completeness the list doesn't have.

Fewer than five honest rows means **no card that day, never padded**.

### The image, caption and alt text

The reel card is cropped to the arch and placed at about 95% on a 1080×1350
canvas (4:5 is the tallest ratio Instagram's API accepts) over a painted
background, then encoded as JPEG — the only format the API takes. Captions
are deterministic templates under the reel policy (no hashtags, emoji or
dashes), checked at run time by the same four caption rules the reels use;
fixed strings live in `lib/editorial.ts`. Each post carries `alt_text`
listing the five places — the card is an image made of text, so this is
basic accessibility.

## How it moves through the pipeline

**Each card is its own one-post folder, published by its own small entry
script.** The live reel publisher is not edited.

```
06:30 Wed   npm run cards           → Reels\auto\<postDate>_card\
                                       card.jpg · caption.txt · alt.txt · manifest.json
                                      emails the five rows ("posts at 11:45")
11:45 Wed   npm run cards:publish   gate → temp-host JPEG → image container
18:30 Wed   same command (catch-up)   → status check → publish → clean up
```

What the review changed here, and why:

- **A separate script, not a `--cards` flag.** npm silently drops
  `npm run reels:publish --cards` and runs the *reel* publisher, which on a
  Tuesday resolves Monday's folder and would post a leftover Monday reel.
- **No new manifest field.** The draft's `imageFile` is dropped by the
  loader and the card would be held forever. The card manifest is reel-shaped
  instead — the JPEG path goes in the existing media field, the template
  colour is the variant — so the tested gate is reused with zero edits.
- **A date guard.** Nothing in the gate compares a folder's date to today, so
  the card script refuses any manifest not dated today. Preview renders are
  marked as smoke runs, which the gate already refuses.
- **The generator always writes a manifest**, including "skipped, and why".
  A missing manifest then keeps one meaning: generation did not run.
- **Its own labels.** Without them every card email would arrive titled as a
  Monday reel problem.

Code touched: one new request builder in `instagram.ts`, a content type
chosen by file extension in `host.ts` (additive), `renderFeedCardJpeg` in
`card.ts` (no existing line changes), the four caption checks exported from
`validate.ts`, two new scripts, and the selection logic in a new pure module.
All 142 existing publish tests stay as they are.

## Failure modes

| Failure | Behavior |
|---|---|
| Fewer than 10 eligible places in every candidate kind | Manifest says skipped and why; one email. |
| PC asleep at 06:30 | No folder; the publish runs report that generation did not run. Fix: `npm run cards && npm run cards:publish`. |
| Asleep at 11:45 | The 18:30 run posts it. |
| Off all day | Nothing posts and nothing emails. Never posted on a later day. |
| Meta rejects the image | Recorded as failed, emailed, hosted file removed; the 18:30 run tries once more. |
| HOLD file, or `card.jpg` deleted | Veto — same as reels. |

## Known residual risks

- **Every card posts unseen.** The gate's automatic holds are all about
  video clips; for a data-only card nothing is left but the HOLD file, which
  needs hands on the PC. The 06:30 email shows the five rows on a phone, but
  stopping one still means reaching the PC. A phone-side hold needs the admin
  status screen (the other half of this idea) — worth building next.
- Places have not been re-verified since Aug–Sep 2026. Cards use only name,
  city and cost, and the 8-week rule limits how often any one error shows.
- The image path has never run against Meta, 4:5 sits on the allowed
  boundary, and Meta auto-blocked this app once (Sep 18). Dry run and one
  supervised post before scheduling.
- The scheduled tasks do not wake the PC and do not run on battery. So far
  26 of 26 triggers have fired.

## The Free card, if wanted later

Viable, with this hardening (each item measured as necessary): require a
verify stamp; window starts tomorrow, not today; strict-free price text
(shipped today, see below); drop evergreen "daily admission" listings; one
row per venue; a stricter election-season brand screen; start-day-only
labels (shipped today); and a decision on repeating the reels.

## Rollout

1. Build; golden tests for kind choice, season edges, the 8-week rule, row
   wording, the date guard, the image gate.
2. Preview a few weeks of cards for Taren to judge on a phone.
3. `npm run cards:publish -- --dry-run` — a real image container, no post.
4. One supervised real post.
5. Three scheduled tasks on the card day.

## Found by the review — live reels (fixed Oct 4–5)

The reviewers measured the reels' own formatter against live data and found
it printing things the data does not support:

- **"Daily" and "Weekdays".** 12 of 40 rows with a multi-day end date
  printed "Daily"; none ran every day (a one-off parade among them). Five
  past reel days carry the label. Now: the start day, always; "Sat & Sun"
  only for a Saturday start ending the next day.
- **"Free" on conditional prices.** The Free tier is a substring match, so
  "$18; children under 36in free" printed "Free". Now only an unconditional
  price text prints "Free" (`isStrictlyFree` in `lib/price-quality.ts`);
  anything else falls to "Check site".
- **Broken venue cuts** ("Lowell Park &", "Hennepin Avenue (W."). Now cut at
  a natural separator with no dangling connector.
- **"All Day" for an unknown time** (found Oct 5 on that day's weird reel).
  A midnight start was printed as "All Day"; for a web-found event it just
  means the time is unknown. Now printed only when the database attests it.
- **A venue of "TBD"** reached a card through the web top-up. Rows with no
  confirmed venue are now dropped, with the reason in the manifest.

## Follow-ups (separate, small)

- **Brand screen tightened (Oct 5, 2026).** Election, voting, candidate,
  debate and town-hall vocabulary added; soft words (election, political,
  voter registration) now match the TITLE only, because in a description they
  are incidental; innocent look-alikes exempted (pep and stamp rallies, D&D
  and charity "campaign kickoffs", debate tournaments, March Madness).
  Measured against all 4,586 events the table has ever held: it newly blocks
  exactly two listings, both real misses (a Drag Race winner's show; a
  midterms podcast tour), and frees one false positive (a "Stamp Rally"
  scavenger hunt). **It is a floor, not a guarantee:** against 70 crafted
  election-season and drag titles the first draft caught 19 (the old rule
  10). Listings that name a performer or a movement instead of a category
  word ("Results & Brews: Nov. 3 Returns Party") cannot be caught by
  pattern. The proposed answer is a model look at each reel's five
  finalists — open decision, below.
- `/admin/instagram` duplicates the reel selection rules and can drift.
- The site's "Free this week" collection uses the same loose tier.
- Pexels is deprecating the un-versioned video path the reels use.
- The publisher hardcodes Meta's daily limit at 100; Meta's docs also say 50.
- Place-of-the-week rotation repeats in November and feeds the digest
  (flagged as its own task).

## Decisions — locked with Taren (Oct 5, 2026)

1. **Lineup: Places card only, once a week** — Wednesday, 11:45. Add more
   only after Insights shows how it performs.
2. **Background: cream field** in the site palette.
3. **Brand screen: tightened now** for election season (applies to reels and
   cards) — see the rule and its measured effect in the deploy notes.
