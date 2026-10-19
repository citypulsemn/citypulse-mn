# Retro — the Instagram account (@citypulsemn), 19 Oct 2026

The question asked: is it worth it, or should it be shut down? Everything
below was measured on 19 Oct 2026 — the account's own numbers through the
Instagram API (the same token the publisher uses), the site's referrer and
subscriber tables, and the reels' spend ledger. Nothing is estimated unless
it says so.

## What the account has produced

| | Number |
|---|---|
| Reels posted since 27 May 2026 | **96** (76 by hand through 17 Aug, then the pipeline: 23 since 18 Sep, scheduled Mon + Fri) |
| Followers today | **8** (follows 0) |
| Lifetime views, all 96 reels | **920** — median **5** per reel; best 126 (25 Sep, a weird reel), 114 (12 Jun) |
| Lifetime likes / comments / saves / shares | **2 / 0 / 0 / 0** |
| Last 30 days | reach 166, views 195, **accounts engaged 0, interactions 0, profile-link taps 0** |
| The 23 auto-posted reels | 193 views in total, median 3; **8 of 23 have 0 views** |

The hand-made era and the automated era perform the same: 76 reels in
Taren's own voice, posted at up to 27 a month, median 6 views; 23 pipeline
reels, median 3. Content, cadence and voice are not the variable.

The pipeline is doing its job: every reel is shared to the profile feed
(`is_shared_to_feed` true on each one checked), 23 of 23 scheduled posts
since 18 Sep went out on time, and since the 5 Oct repairs 12 of 12
generated reels built. The machine works. It is pointed at an empty room.

## What the account sends back to the site

The site records the referring host on every event-page view (Chicago day,
host, count; since 14 Sep).

| Source, 14 Sep – 19 Oct | Event-page views |
|---|---|
| Google | 3,013 |
| Direct | 2,218 |
| DuckDuckGo + Bing + Yahoo | 700 |
| **Nextdoor** | **75** — in bursts of ~15 on 17 Sep, 24 Sep, 1 Oct, i.e. about one post a week, which stopped after 3 Oct |
| Facebook (all hosts) | 16 |
| **Instagram (all hosts)** | **10** — 0.13% of 7,551 referred views |

**Subscribers:** 45 all-time, every one from a page on the site (event
pages 22, this-week 6, home 5, venue pages 5, …). None is attributable to
Instagram. The weekly email, not the reels, is the thing the site's audience
actually joined.

Five Nextdoor posts sent seven times the traffic of twenty-three reels.

## What it costs

- **Money:** $6.05 of model calls in October for 13 generation runs (about
  70¢ a run; the one run that needed web search cost $1.21). Pexels is free,
  the Supabase hosting is transient. Call it **$7 a month** at the scheduled
  cadence. The site's other model spend is ~$80 a month, so the reels are
  under 10% of it.
- **Taren's time:** close to zero now — the point of the automation.
- **Engineering time:** large and already spent — two phases, a weekly
  still card built and reviewed, and a standing stream of review fixes
  (`docs/REELS-PUBLISH.md`). This is sunk; it should not decide what happens
  next, but it is why the question is worth asking now rather than later.
- **Risk:** every post goes out with nobody looking. The gate is good and
  the brand screens have held, but a wrong post would be a wrong post. With
  eight followers the exposure is small; it is not zero.

## Why it is not working (the honest read)

Instagram shows a new account's reels to almost nobody until the account
has engagement signals to amplify, and this account has none: 0
interactions in 30 days, 0 follows, no venue collaborations, no hashtags
(a locked rule), no trending audio (the owner's call), no cross-posting. The
reels are good enough — the one that reached 126 accounts is not different
in kind from the ones that reached 0. What it lacks is distribution, and
distribution on Instagram is bought with a human's attention: engaging with
local accounts, tagging venues so they reshare, answering comments there
aren't any of yet. That is exactly the time the automation was built to
save.

Meanwhile the channels that do work needed nothing: Google sends ~600 views
a week on its own, and a Nextdoor post sends ~15 readers for two minutes of
typing.

## Options

**A. Stop the reels, keep the account (recommended if the plan is "no more time on Instagram").**
Delete the five scheduled tasks; never create the card tasks. Leave the
account and its 96 reels up — a visitor who finds it sees a real, if
dormant, page; deleting it buys nothing. Cost goes to $0, risk goes to 0,
the code stays in the repo for the day there is an audience to point it at.
Redirect the two minutes a week to a Nextdoor (and one or two Facebook
group) post of the week's picks — the still card and caption the pipeline
already produces are ready-made for it.

**B. Leave the reels running as a presence.**
About $7 a month, no human time, the unreviewed-post risk accepted. Honest
expected value: a few hundred views a month and nothing measurable on the
site. Do not add the card: it is more supply into a channel with no demand.

**C. One measured audience experiment, six weeks, then A or keep.**
Keep the reels running and spend the human time on distribution instead of
content: a weekly Nextdoor + Facebook-group post with the bio link (both
already proven to send readers); venue collaborations on each reel so venues
reshare (the API takes `collaborators`; it needs venue handles we do not
store yet); 15 minutes a week following and engaging with local accounts;
the bio link to `/this-weekend?utm_source=instagram` so link taps are
counted on our side. **Gate at six weeks:** 100 followers or 50 link taps
in a month, else option A. Without a gate this becomes option B with extra
work.

## Recommendation

Option A, with the Nextdoor habit. The site's audience problem is real
(`docs/ROADMAP-MONETIZATION.md`: 45 subscribers against a 500 gate) and
Instagram has had five months and 96 posts to show it can help; it sent 10
readers in five weeks and 0 subscribers ever. The one social channel with a
measured return sent 7× the readers from 5 posts. If Taren would rather give
Instagram a fair, human-powered shot first, option C with its gate is the
honest version of that — not more automation.

What this does **not** say: that the reels are bad, or that the build was
wasted. The pipeline is the cheapest, most reliable content machine the
project has, and the still card renders the Places pages into something a
Nextdoor post can carry. If an audience ever turns up — a venue partnership,
a press mention, a viral post — the machine is ready and costs $7 a month to
switch back on.

## Decision (Taren, 19 Oct 2026): option B

The reels keep running as a presence — the five scheduled tasks stay, about
$7 a month, posts go out unreviewed as before. The weekly Places card is
**not** scheduled. Nothing else changes. Revisit when something changes the
audience picture (a venue partnership, a press mention, a post that travels)
or at the next retro; the steps for option A stay below for that day.

## If option A is chosen later: the exact steps

```bash
schtasks /Delete /TN "CityPulse Reels Monday" /F
```

```bash
schtasks /Delete /TN "CityPulse Reels Friday" /F
```

```bash
schtasks /Delete /TN "CityPulse Reels Publish 0830" /F
```

```bash
schtasks /Delete /TN "CityPulse Reels Publish 1145" /F
```

```bash
schtasks /Delete /TN "CityPulse Reels Publish 1830" /F
```

Nothing else changes: no code is removed, the token file stays (it expires
on its own after 60 days without a refresh run), the output folders are
yours to keep. To switch back on, recreate the tasks from `docs/REELS.md`
and `docs/REELS-PUBLISH.md` and run `npm run reels:auth` if the token has
lapsed.
