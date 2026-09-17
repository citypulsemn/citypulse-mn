# Handoff — current state (17 September 2026)

The single map a new session reads after `CLAUDE.md`. Rewritten today; the previous
version was dated 20 July and had gone two months stale while pointing every new
session at itself.

## Read the instruments, not this file

This is the most important line here. Since mid-September the system reports its own
state better than any document can, and all of it is one page:

> **`/admin/ops`** — five vendor tiles plus every section of the Monday ops email,
> live. Grey means a check could not run and is never a pass.
> **`/admin/growth`** — subscribers, acquisition, funnel, returning readers.

Open those before proposing work. If they disagree with this file, they are right.

## Where things stand

**Audience is growing.** 31 subscribers, 0 churned, first on 10 July. By week:
`1 2 1 0 0 1 8 1 9 5 1` — the last four weeks brought 16 against 9 in the four before.
The August retro's "the blocker is audience, at 5 subscribers" is out of date.

**Acquisition is search.** Referrer counting started 14 Sep: 58% search (Google 310 of
592 arrivals), 23% direct, 17% internal, 1% social.

**The calendar is clean.** 980 live upcoming events. Every data guard reads zero:
no listing cites an aggregator index, none ends before it starts, none has a `TBD`
price or an unusable venue, and the self-check finds no clashes or duplicates.

**~17% of upcoming listings are unverified**, and there are 47 drafted and 125 open
verify flags. That is the standing backlog, not an incident.

## What shipped in the week to 17 Sep

| | |
|---|---|
| `/admin/ops` | vendor tiles + the ops email live, streaming, deadlined |
| `/admin/growth` | the audience view; every rate earned or an em dash |
| Source check | every listing tested against the page it cites, weekly in CI |
| Referrers | attribution with no new privacy category |
| Deletion path | `npm run delete-personal-data` — the code behind `/privacy` |
| Guards | span trigger, price normaliser, venue quality, `color-scheme: dark` |

Each has a deploy guide in `docs/`: `DEPLOY-OPS-DASHBOARD.md`, `SOURCE-CHECK.md`,
`ANALYTICS.md`, `PRIVACY-OPS.md`.

## Open — the watch list

Nothing here is blocked; everything has an owner or a date.

1. **Unproven in CI.** The source check and the pipeline cost recording both landed
   *after* the 14 Sep run. Neither has ever executed. **First real test: Monday 21 Sep.**
   Check `pipeline_runs.cost_usd` is non-null and the sweep logged a summary.
2. **`DIGEST_POSTAL_ADDRESS` is not set.** Until it is, the weekly email goes out with
   no physical postal address, which CAN-SPAM requires. Every send now records
   `NO POSTAL ADDRESS IN FOOTER` in its note, visible on `/admin/digest`. **Taren:
   one env var in Vercel and GitHub Actions secrets.**
3. **Resend tile: removed** (17 Sep). Reading `/domains` needs a *Full access* key,
   and the Weekly email tile answers the same question from our own `digest_sends`
   rows with no key at all. Five tiles now. Vercel's spend stays grey on purpose —
   **Vercel's own budget alert is the right instrument**, not an API token here:
   Vercel → the project → Settings → Billing → Spend Management → set an amount and
   an email. **Taren: not set yet.**
4. **Search Console on `/admin/growth` is dark in production.** It works in Actions
   because `GSC_SERVICE_ACCOUNT_JSON` is a GitHub secret; Vercel does not have it.
   The page already says so rather than showing a clean zero. **Taren: paste the
   service-account JSON file's whole contents into Vercel → Settings → Environment
   Variables → `GSC_SERVICE_ACCOUNT_JSON` (Production), then redeploy.**
5. **Backlogs**: 47 drafted upcoming (13 wrong-event, 12 with no audit trail at all,
   9 source-hold), 125 open verify flags, ~167 unverified upcoming.
   Two of these closed on 17 Sep:
   - *00:00 placeholder starts*: 17 → 5, and the 5 are **correct**. No operator
     publishes a time for them (two Gophers games are TBA on gophersports.com, the
     Guthrie prints no time for The Purpose Pursuit anywhere including its own
     ticketing, Lowry Bookworms' session is closed, and the Christmas Market is a
     five-weekend run with no 2026 hours announced). The remaining count is honest
     emptiness, not a backlog.
   - *No ticket link*: 22 → 0. All 22 were sports, and the cause was the importer,
     not the rows — the feeds carry no per-game ticket URL, so it claimed none.
     `SportsSource.tickets` now holds each club's own tickets page (all eight
     checked for 200), the importer uses it, and the live rows were backfilled.
6. **Offered, undecided**: scrollbar affordance on reader-facing pill strips; the
   price vocabulary that says the same thing four ways across ~500 live fields.

## Environment notes (this machine)

- `DATABASE_URL` lives in `.env.local`; every `npm run` script auto-loads it. **Taren
  edits this file from a phone — verify value shapes before trusting them** (a `//`
  once arrived as `..`).
- `git push` needs `GCM_INTERACTIVE=auto` in agent sessions.
- `.env.local` has **no** `RESEND_API_KEY` or `GSC_SERVICE_ACCOUNT_JSON`. That is why
  the Resend tile and Search Console read "not set" locally and work in production —
  do not chase it as a bug.
- A `GITHUB_TOKEN` is available in this shell, so Actions state *can* be queried now.
  `head_sha` on a workflow run is how you tell whether a run actually had your code.
- Reading secrets out of `.env.local` is blocked by the permission layer. Work with the
  scripts, not around them.

## Conventions worth preserving

- **Recon before writing.** Grep the real export first; guessed helper names remain the
  top source of wasted turns.
- **Pure core, thin shell.** `composeOpsDigest`, `checkTitleOnPage`, `buildFunnel`,
  `judgeDigest` are the model: policy in `lib/` with golden tests, I/O at the edge.
- **A failure must never render as data.** A broken query showed as four clean zeros on
  the growth page; a laptop typo showed as a failed send on the digest panel. Both were
  fixed by making "could not tell" its own state.
- **An instrument must not be killable by the thing it measures**, and must not be
  silent when blind. Grey is not green.
- **Never delete events** — archive them. Personal data is the exception and the
  opposite: a deletion request is honoured by deleting.
- **Verify the artifact, and the read-back.** Write → read back → compare, every time.
- **Shell escaping mangles regexes.** `\b` became a literal backspace byte twice this
  week. Use the Edit tool or a quoted heredoc for anything with backslashes.

## First session opener

> Read `CLAUDE.md` and this file, check memory, then `git log --oneline -10` and
> `npm test`. Then open `/admin/ops` — the tiles know more than the docs do.
