# Deploy Guide — Roadmap 5.1: First-Party Analytics

**Phase 5 opens here.** Until now, every content decision — what to cover, which venues to sweep, what the digest should feature — has been a judgment call. This is the instrument that turns it into a measurement: which events people **view**, which ticket links they **click**, what they **save**, and what they **add to their calendars** — counted in *your* database, joinable against your own data, not locked in a vendor dashboard.

**One database step (one table), one deploy. No new secrets, no backfill.**

---

## Privacy by schema — the design decision

`event_stats` holds one counter per **(event, day, action)**. That's the entire table. No user identifiers, no IPs, no cookies, no sessions. It *cannot* answer "who did what" — only "how many" — so there's nothing to leak and nothing to comply about. For a site whose whole brand is being a trustworthy local guide, this is the right shape, and it's enforced by the schema rather than promised by a policy.

## How each count works (the asymmetry is deliberate)

| Action | Counted | Why |
|---|---|---|
| **Views** | Client beacon on the event page | Client-side means prefetches and non-JS crawlers don't inflate it |
| **Ticket clicks** | Client beacon in the ticket button | The click leaves your site; `sendBeacon` survives the navigation |
| **Calendar adds** | Server-side in the `.ics` download route (+ beacon for the Google link) | The route *is* the download — exact count |
| **Saves** | **Inside the save server-action only** | The public beacon *rejects* `save` — the one metric tied to real user state can't be inflated with a curl loop |

The beacon endpoint answers **204 to everything** — valid hits, junk, probe attempts alike — so it never breaks a page and gives nothing away. I verified this live: valid payloads, a `save` smuggle attempt, malformed JSON, and a SQL-injection-shaped id all returned uniform 204s, with only the valid ones countable.

One honest note (in `docs/ANALYTICS.md` too): the public counters *can* be inflated by a determined script — that's true of every first-party beacon on the web. These are directional instruments for editorial decisions, not billing records.

## Where you read it

**Admin → Stats** now ends with an **Engagement** section: five totals (views, ticket clicks, view→ticket **CTR**, saves, calendar adds), a **top events** table with per-event CTR, and a **by-day** table — over a 7-day / 30-day toggle. Until data arrives it shows a graceful "no engagement recorded yet" note. Verified with a rendered screenshot, not just a status code.

## Quality bar (all green)
- **386 tests pass (8 new)** — the beacon validator is the public surface, so it gets the adversarial cases: the `save` rejection, SQLi-shaped ids, junk bodies, truncated UUIDs.
- Typecheck clean, build clean, **0 vulnerabilities**.
- Live smoke: beacon endpoint exercised with curl (valid + hostile payloads), admin page rendered and screenshotted, event page confirmed rendering with the beacon mounted.
- Analytics can never break the site by contract: every write is fire-and-forget, every failure swallowed, the endpoint never errors.

---

## Step 1 — Database

**Supabase → SQL Editor** → run `db/schema.sql` (idempotent). Adds the `event_stats` table and its index. Nothing else changes.

## Step 2 — Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`First-party analytics (roadmap 5.1)`) → push.

## Step 3 — Watch it come alive

Counters start the moment the deploy is live. Open any event page on your phone, tap the ticket link, then check **Admin → Stats**: you should see your own view and click within seconds. That's the whole verification.

- [ ] Your test view/click appears in the Engagement section.
- [ ] The 7d/30d toggle switches windows.
- [ ] `curl -X POST https://citypulsemn.com/api/beacon -d '{"id":"x","action":"save"}' -H "content-type: application/json"` → returns 204 and records nothing (the hardening working).

## Rollback
Roll back the deploy; the table just stops receiving writes. It's additive — nothing else references it.

---

## What this unlocks

In a week or two of data you'll be able to answer, for the first time with numbers: which categories actually earn their coverage floors, whether venue-swept club shows get clicked, and what people save but don't buy tickets to. And the next roadmap items consume this table directly: **5.2 Trending** ranks by these counters, and **5.3 the personalized digest** uses saves as its signal. The feedback loop is now closed — everything after this gets smarter because of it.
