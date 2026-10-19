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
npm run reels:publish -- --dry-run --variant=regular
```

5. **First supervised real publish** of one reel on a posting day:

```bash
npm run reels:publish -- --variant=regular
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

# Still cards (feed posts on non-reel days) — BUILT, not scheduled

**Status:** BUILT Oct 5, 2026 and rehearsed against Instagram three times.
**Not scheduled, by decision** — the 19 Oct retro (`docs/RETRO-INSTAGRAM-OCT-2026.md`)
found the account sending 10 readers in five weeks, and Taren chose to keep
the reels running as a presence and add nothing. The go-live steps at the
bottom ("Go-live: the Places card") stay for the day that changes. Designed Oct 4 and revised after a three-way
adversarial review that measured the first draft against live data;
decisions were locked Oct 5. The build then had its own four-way review, each
finding independently reproduced: 21 confirmed, all fixed or handed to Taren
("Found by the build review", below).

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
  it carried, and the generator reads them. No separate history file to lose
  (the reels' history.json would silently erase it). **Only a card that
  actually posted counts** — a folder whose `published.json` shows the post.
  A card that was built and then held, refused by Meta, or missed because the
  PC was off does not retire its kind: the first build counted those, and one
  held orchard card would have ended orchards for the year (their window is
  six weeks, the rule is eight).
- **Card-safe seasons.** Registry seasons are month-level and wider than the
  truth ("Memorial Day–Labor Day" is stored as May–September). A ±14-day
  margin, measured, still put beaches on a card before Memorial Day and after
  Labor Day. Each season gets explicit card-safe dates instead (summer Jun 1–
  Aug 31, winter Jan 1–Feb 14, and so on), with golden tests on the edges.
- **Two single places are corrected by hand** (`CARD_SAFE_BY_SLUG`), each
  with its evidence in the code: Theodore Wirth disc golf cards in the warm
  season only (its page says "open sunrise to sunset daily" in summer and
  winter captures alike, so winter play is attested neither way); Gibbs Farm
  ("open the warm months") cards in summer. **These are registry errors
  showing through** — see "Left for Taren" below. Five more lines have
  already come out because the registry itself was corrected: the two South
  St. Paul pools on 5 Oct 2026, and on 6 Oct Apple Valley Sports Arena
  (October–March, the city's "ice from mid-October to mid-March") and the two
  Three Rivers disc golf courses on ski hills (Hyland May–September, Elm
  Creek June–October — each the floor of what its own page's Wayback Machine
  captures attest). Their windows now live in `CARD_SAFE_SEASONS` by label.
- **Which five.** Ordered by a hash of the place and the week — deterministic,
  not alphabetical, different every time the kind comes round. The places on
  that kind's last card go to the back of the order, so a kind never brings
  the same names straight back (drawn fresh each time, a simulated nature
  center card repeated four of its five rows ten weeks later).
- **What a row says.** Name and city, nothing else. **No tags**: they carry
  schedule and staffing facts (market days, lifeguards, open-skate) that go
  stale. **No cost**: the registry field means admission, and the mockup
  showed what that does — "Pine Tree Apple Orchard · Free" reads as free
  apples.
- **Five rows are five names.** The registry lists some businesses once per
  location, and writes them three ways: "Vertical Endeavors — St. Paul",
  "Sky Zone Edina", "Blaine Farmers Market (Tuesday)". A multi-location name
  takes one row, and the 10-place floor counts names, so a chain cannot carry
  a thin kind over it. The rule reads the list rather than a fixed set of
  names: a stem two places share is a chain, and any name that begins with it
  belongs to it ("Sky Zone St. Paul" is in Oakdale).
  **This costs one kind.** The 17 trampoline and climbing gyms are 7
  businesses, so that kind is under the floor and no longer cards. The first
  version of this rule only saw the dash and reported "no kind drops below
  10" — that was wrong, and it would have put three Sky Zones on one card in
  week eleven. Measured now: three years of Wednesdays from each of four
  go-live dates build a card every week with no business twice.
- **The city prints once.** A name that only ends in its own city drops that
  tail on the card row, since the city is the line below: "Bouldering Project
  — Minneapolis" and "Central Park Playground (Maple Grove)" always, a bare
  "Sky Zone Edina" only when what is left is a chain's name. Any other tail
  is the name and stays.
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
script.** The reel publisher's decisions are reused, not forked. (Two fixes
from the build review did land in the shared gate and so apply to reels too:
hold files named the way Windows really names them, and the refusal to run
when npm has swallowed a flag. Both are below.)

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
- **Today's card, built today.** Nothing in the gate compares a folder's date
  to today, so the card publisher refuses any manifest that is not for today
  — and any that was not *generated* today. The second half matters because
  `npm run cards -- --date=…` can build a coming Wednesday's folder ahead:
  if that Wednesday's own 6:30 run then never happened, the folder would
  still hold a complete card made from last week's registry. A card built
  ahead is a rehearsal prop, nothing more; the morning run rebuilds it.
  `--date` on the publisher works only with `--dry-run`.
- **Previews cannot be published.** `npm run cards -- --preview=N` renders
  the next N Wednesdays into `_card-previews` as loose images with no
  manifest, so there is nothing there for a publisher to read.
- **Wednesdays only.** The generator does nothing on any other day and
  refuses a past date. Once a card has posted, running the generator again
  that day rebuilds nothing: the folder is the record of what went out.
- **The generator always writes a manifest**, including "skipped, and why".
  A missing manifest then keeps one meaning: generation did not run.
- **Its own labels.** Without them every card email would arrive titled as a
  Monday reel problem.

Code: the selection in `lib/reels/cards/places-card.ts`; every rule about
days, history and refusal in `lib/reels/cards/card-day.ts`; two scripts that
are glue over those; one new request builder in `instagram.ts`; a content
type chosen by file extension in `host.ts`; `renderFeedCardJpeg` in
`card.ts`; the four caption checks exported from `validate.ts`. In the
shared gate: `detectHolds` in `publisher.ts` and the flag check in
`lib/reels/cli.ts`.

## Failure modes

| Failure | Behavior |
|---|---|
| Fewer than 10 eligible places in every candidate kind | Manifest says skipped and why; one email. |
| PC asleep at 06:30 | No folder; the publish runs report that generation did not run. Fix: `npm run cards`, then `npm run cards:publish`. |
| The generator crashes | Emailed at once ("Card generation crashed"), and again at 11:45 as "nothing to publish". |
| A folder built ahead with `--date`, and that morning's run never happens | The publisher refuses it ("generated on …, not today") and emails. Nothing stale posts. |
| A flag typed without npm's `--` (`npm run cards:publish --dry-run`) | Refused, nothing done, the correct command printed. Without this check that line was a real post. |
| Asleep at 11:45 | The 18:30 run posts it. |
| Off all day | Nothing posts and nothing emails. Never posted on a later day. |
| Meta rejects the image | Recorded as failed, emailed, hosted file removed; the 18:30 run tries once more. |
| HOLD file, or `card.jpg` deleted | Veto — same as reels. `HOLD.txt` counts: that is what Explorer makes when you name a new text file HOLD. |
| `published.json` cannot be saved after a successful post | The post is live; the 11:45 email says so and says to add a HOLD file before 18:30, because the catch-up run cannot see the post and would post it again. The ledger is written whole-or-nothing, so a cut-off write cannot leave a half file. Inherited from the reel gate. |
| `caption.txt` emptied by hand | The publish fails with "caption.txt is empty"; a card never posts without its caption. |

## Known residual risks

- **Every card posts unseen.** The gate's automatic holds are all about
  video clips; for a data-only card nothing is left but the HOLD file or
  deleting `card.jpg`, and both need hands on the PC. The 06:30 email shows
  the five rows on a phone, but stopping one still means reaching the PC. A
  phone-side hold needs the admin status screen (the other half of this
  idea) — worth building next.
- **The card folders are the memory — keep them.** The 8-week rule reads the
  last eight weeks of `_card` folders, and "never straight back" reads each
  kind's last card, which for a seasonal kind can be a year old. Deleting old
  card folders loses that memory; nothing else breaks.
- **The PC's clock is Central.** The slot (11:45) is judged on the PC's local
  time and "today" on the Minneapolis calendar. They agree because the PC is
  in Minneapolis; moving it to another timezone would need both to change.
- **The rotation has no slack.** Eight kinds can card on any day of the year
  and the rule is eight weeks: exactly enough for a card every week. Lose one
  more kind in winter (a registry change, a stricter rule) and some winter
  Wednesdays become honest skips. The three-year simulation in the tests
  fails if that happens.
- Places have not been re-verified since Aug–Sep 2026. Cards use only name,
  city, and the 8-week rule limits how often any one error shows.
- The image path has run against Meta twice, as rehearsals (Oct 5: a real
  image container was created and reached FINISHED both times; nothing was
  posted). No card has actually been published yet, and Meta auto-blocked
  this app once (Sep 18). One supervised post before scheduling.
- The scheduled tasks do not wake the PC and do not run on battery. So far
  26 of 26 triggers have fired.

## The Free card, if wanted later

Viable, with this hardening (each item measured as necessary): require a
verify stamp; window starts tomorrow, not today; strict-free price text
(shipped today, see below); drop evergreen "daily admission" listings; one
row per venue; a stricter election-season brand screen; start-day-only
labels (shipped today); and a decision on repeating the reels.

## Rollout

1. ~~Build; golden tests for kind choice, season edges, the 8-week rule, row
   wording, the date guard, the image gate.~~ Done Oct 5.
2. ~~Preview a few weeks of cards.~~ Twelve weeks rendered Oct 5 (after the
   build review's fixes), in
   `Documents\CityPulseMN\Reels\auto\_card-previews` — Taren to judge.
3. ~~`npm run cards:publish -- --dry-run` — a real image container, no
   post.~~ Passed Oct 5, twice.
4. One supervised real post. **Waiting on Taren.**
5. Three scheduled tasks on the card day. **Waiting on Taren.**

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

## Reels lost to repairable failures (fixed Oct 5)

Testing the model check end to end failed twice on things that had nothing to
do with it, so the run log was tallied. Across the 12 generation runs to date
(about 36 reels), **7 reels were never built**, from three causes:

| Cause | Reels lost | What it was | Now |
|---|---|---|---|
| A dash in the caption | 2 | A house-style rule, failed twice in a row by the copywriter | An aside dash becomes a comma before validation (`tidyCaption`); see the note below |
| A six-word b-roll search term | 2 | A stock-footage search heuristic, one word over | Trimmed to five words (`clampTerm`); the subject leads, so the tail goes |
| Pexels answered 500 | 3 | One failed search out of about twenty killed the reel | A server error is retried twice, three seconds apart; a bad key or a rate limit never is |

**The dash repair must not change what a caption says**, and the first
version did: it turned every dash into a comma, so a range the model copied
from the locked details ("Sat 10 AM–2 PM") would have posted as "Sat 10 AM, 2
PM" — two start times the data never gave. The build review caught it before
any reel ran with it. Now an aside becomes a comma; an en dash between two
values reads "to"; and anything that could be either a range or a name
("Tuesday–Friday", "Minneapolis–St. Paul", "Doors 9 - 5") is left in, so the
validator rejects the caption and the model is asked again, as before.

None of the three is an honesty rule, which is why they are repaired rather
than fatal. The validator still checks the caption and the terms afterwards,
so anything the repair cannot fix (a one-word term, a hashtag) still stops
the reel. The honesty rules — exactly five events, the price line, no
invented venue — are untouched and still fatal.

## The model check on reel finalists (built Oct 5)

The pattern screen cannot catch a listing that names a performer or a
movement instead of a category word. So after the five finalists are chosen,
one small model call reads their titles and descriptions against the two
brand rules (nothing primarily political, no drag events) and answers per
event. `lib/reels/finalist-screen.ts`:

- A flagged event is **swapped out** for the next one in the pool and the
  replacement is checked too. The swap and its reason are written to the
  manifest's exclusions and to the run log.
- **A flag covers the whole listing.** A three-night stand is three rows in
  the database. Flagging one row let the next night step into the seat, which
  spent a round per night and could return four events from a pool of dozens;
  the listing now leaves in one go.
- A reply the code cannot read is **asked for once more** before the reel
  falls back to patterns. A reply with no true/false answer in it at all (a
  wrong key) is treated as unreadable, not as five blocks.
- A selection that is still short after the web top-up is not checked at all:
  that reel is skipped whatever the model says.
- **The pattern screen stays as the floor.** The model only ever removes
  events; it cannot bring one back.
- **If the model call fails**, the reel goes ahead on the pattern screen
  alone and says so in its warnings. A broken instrument must not cost the
  reel (engineering rule 1).
- A verdict the code cannot read counts as a block, not a pass.

Measured before wiring it in: of 12 titles the pattern screen misses, it
caught 12; of 12 innocent look-alikes, it blocked none. About a cent per
reel. That is one small sample, not a guarantee — a model can miss, and a
swapped-out event is named in the manifest so a wrong call is visible.

## Found by the build review (Oct 5) — what it caught

Four reviewers read the finished build from four angles (the live reel path,
what a card can say, how a card can mis-post, whether the tests pin the
rules), and a second agent tried to refute each finding by reproducing it. 21
were confirmed. Nothing wrong had posted; the reel-path ones were live code
for a few hours. What they were, plainly:

**In my own same-day work**

- The dash repair changed meaning (above). Fixed before any reel ran with it.
- The model check flagged a row, not a listing (above). Fixed.
- "Five rows are five names" only recognised chains written with a dash, and
  the test for it restated the rule it was testing, so it could not fail.
  Rewritten to read the list; the tests now judge sameness by the names'
  opening words, independently of the rule.
- A card that was built but never posted counted as posted for 8 weeks. Now
  only the publish ledger counts.
- A folder built ahead with `--date` could post a week later if that
  morning's run never happened. Now refused.
- Nothing tested that the caption and search-term repairs were actually
  wired into the pipeline; un-wiring either passed every test. Now tested
  end to end.

**In code that was already live**

- **A HOLD file made the normal Windows way did not hold.** Explorer hides
  extensions on this PC, so a new text file renamed HOLD is `HOLD.txt` on
  disk, and the gate only looked for the bare name. No reel is known to have
  been affected (no hold has been needed yet), but the veto would have failed
  the first time it was used. `HOLD`, `HOLD.txt` and `HOLD.txt.txt` all
  hold now, for reels and cards.
- **`npm run reels:publish --dry-run` was a real publish.** Without the bare
  `--`, npm keeps the flag and the script starts with none. All four reel
  scripts now notice and refuse. Measured on npm 11: a flag npm does not own
  shows up as `npm_config_<name>`; `--day=friday` arrives as the bare word
  "friday" (also refused); a flag npm owns leaves no trace at all, which is
  why the reel publisher's `--only` became `--variant`.

**In the registry (showing through the card)** — see "Left for Taren".

**Second pass (Oct 6).** The fixes were themselves re-checked by agents
reproducing each original failure against the new code, plus a fresh read of
the card selection. Two of the first-pass fixes were incomplete and are now
closed: the dash repair still turned ranges written in other shapes into
lists ("Oct 9–Oct 11", "noon–2 PM", "Tuesday - Friday"), so it now decides by
the words on either side of the dash and leaves in anything that touches a
time, date, weekday or month unless it is an unspaced en dash between two of
them; and the model check's second ask now says what was unreadable about the
first reply. New: Gibbs Farm (museum, "open the warm months") was reaching
winter museum cards and is corrected by hand; the skip wording said "places"
where it counts names; a drift guard now fails if any place that is card-safe
all year says in its own intro that it closes. The same pass found the two
South St. Paul pool corrections already made in the registry on main, and
their lines came out.

## Left for Taren

- **Registry corrections.** The card works around these in
  `CARD_SAFE_BY_SLUG`, but the public Places pages still carry them: Gibbs
  Farm is listed year-round while its entry ends "open the warm months".
  When an entry is corrected, its line in `CARD_SAFE_BY_SLUG` should come
  out — as happened for the two South St. Paul pools (Northview pulled,
  Lorraine on the pool summer; main, 90d89a3) and, on 6 Oct 2026, for Hyland
  Hills, Elm Creek and Apple Valley Sports Arena (re-verified against their
  own pages; see `docs/deploy-history/DEPLOY-PLACES-SEASONS-REVERIFIED.md`).
  Theodore Wirth disc golf keeps its line: its page attests no season either
  way, so the registry's year-round stands and the card stays conservative.
  Richfield Ice Arena's entry says skating is paused through 1 November
  2026 — true today, stale on 2 November; the card leaves it alone because a
  one-off closure is not a season.
- **Winter cards of outdoor kinds.** Nothing false, but the rotation will
  post "Five playgrounds" in mid-January and "Five dog parks" in early
  February, because those places are open year-round. A per-kind winter
  window would stop it and cost some winter Wednesdays (the rotation has no
  slack). A taste call.
- **Trampoline and climbing gyms no longer card** (7 businesses, floor is
  10). Lowering the floor for that one kind, or adding businesses to the
  registry, would bring it back.
- **Outdoor rinks get one card a winter at most.** Rinks are also a
  year-round kind (eleven indoor arenas), so the kind often takes its turn in
  December and the 8-week rule then covers most of the outdoor rinks' Jan 1
  to Feb 14 window; some winters get none. Holding rinks back until January
  would fix it and cost a skipped Wednesday in late autumn (no slack). A
  taste call.
- **"this week" in the captions.** "Five parks from our list this week" is
  the only thing that makes an evergreen list read as a claim about the
  week. The strings are in `lib/editorial.ts` (`CARD_COPY`), yours to edit.
  Also there: the orchard card now says "Orchards & Pumpkin Patches" rather
  than the registry's bare "Orchards & Patches".

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
  pattern. The answer, approved and built Oct 5, is a model look at each
  reel's five finalists — see "The model check on reel finalists".
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
4. **Model check on each reel's five finalists: add it** (same day).
5. **Build the Places card**, then previews and a dry run before anything is
   scheduled (same day).

## Go-live: the Places card

**What shipped.** `npm run cards` builds Wednesday's "Five places" card from
the Places registry (no model call, no network) into its own folder and
emails what will post. `npm run cards:publish` posts it at 11:45 through the
same gate the reels use. Nothing runs until the tasks in step 3 exist.

**Why it is built this way** is the design above; the short form: one card a
week from data that has a source URL per row; its own folder and its own
script, reusing the reel publisher's gate; a manifest every Wednesday so "no
manifest" only ever means "generation did not run"; and the publisher only
ever posts today's card, built today.

**Type the `--`.** Every flag below sits after a bare `--`. Without it npm
keeps the flag for itself; the scripts notice and refuse rather than run as
if no flag was typed.

### Steps (in order)

1. **Look at the previews** (already rendered, safe to re-run any time —
   previews cannot be published):

```bash
npm run cards -- --preview=12
```

   They land in `Documents\CityPulseMN\Reels\auto\_card-previews`, one image
   and one text file (rows, caption, alt text) per Wednesday.

2. **One supervised post**, on a Wednesday, at the PC. Generate, read the
   email, then publish once the clock passes 11:45:

```bash
npm run cards
```

```bash
npm run cards:publish
```

   Before 11:45 the second command answers "slot 11:45 not reached" and posts
   nothing. To rehearse without posting at any hour, add `-- --dry-run`
   (the full chain against Instagram, minus the final publish call).

3. **Schedule** three Wednesday tasks (generate, publish, catch-up):

```bash
schtasks /Create /TN "CityPulse Card Wednesday" /SC WEEKLY /D "WED" /ST 06:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run cards >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\cards.log 2>&1"
```

```bash
schtasks /Create /TN "CityPulse Card Publish 1145" /SC WEEKLY /D "WED" /ST 11:45 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run cards:publish >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\cards.log 2>&1"
```

```bash
schtasks /Create /TN "CityPulse Card Publish 1830" /SC WEEKLY /D "WED" /ST 18:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run cards:publish >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\cards.log 2>&1"
```

### Verify (first scheduled Wednesday)

- 06:30 — an email titled "Card for <date>: FIVE … — posts at 11:45" with
  the five rows, the caption, and how to stop it. A skip week says "no card
  this week" and why.
- `Reels\auto\<date>_card\` holds `card.jpg`, `caption.txt`, `alt.txt`,
  `card.json`, `manifest.json`.
- After 11:45 — the post is on @citypulsemn, `published.json` appears in the
  folder, and no email arrives (a clean publish is silent, like the reels).
- 18:30 — `cards.log` shows "already published"; nothing posts twice.

### To stop one card

Before 11:45, in that Wednesday's `_card` folder, either delete `card.jpg`
or make a file named `HOLD` (right-click, New, Text Document, name it HOLD —
the `.txt` Windows adds is fine). Either is a veto. A HOLD is emailed back to
you as held; a deleted image is skipped without an email, since deleting it
was the message. A held card does not count against its kind, so it can come
back the following week.

### Rollback

```bash
schtasks /Delete /TN "CityPulse Card Wednesday" /F
```

```bash
schtasks /Delete /TN "CityPulse Card Publish 1145" /F
```

```bash
schtasks /Delete /TN "CityPulse Card Publish 1830" /F
```

With the three tasks gone nothing card-related runs. The reel pipeline does
not import the card scripts, so removing them changes nothing for reels. A
posted card is deleted in the Instagram app like any post.
