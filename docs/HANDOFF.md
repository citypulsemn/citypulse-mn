# Handoff — current state (4 October 2026)

The single map a new session reads after `CLAUDE.md`. Rewritten today; the
previous version was dated 17 September and every headline number in it had
moved.

## Read the instruments, not this file

Still the most important line here. Since mid-September the system reports its
own state better than any document can, and all of it is one page:

> **`/admin/ops`** — five vendor tiles plus every section of the Monday ops
> email, live. Grey means a check could not run and is never a pass.
> **`/admin/growth`** — subscribers, acquisition, funnel, returning readers.
> **`/admin/submissions`** — now carries each submission's check verdict,
> evidence and proposed corrections.

Open those before proposing work. If they disagree with this file, they are
right.

## Where things stand

| | |
|---|---|
| Published upcoming | 639 |
| Unverified | 54 |
| Open verify flags | 53 |
| Upcoming drafts | 45 |
| Never source-checked | 279 of 639 |
| No ticket link | 3 (honest empties) |
| Self-check | 0 duplicates, 1 clash (a real one — see below) |
| Active subscribers | **39**, and the weekly send is growing: 24 → 32 → 34 |
| Model spend, Oct to date | $10.39 across 4 recorded runs |
| Inbox | **0 pending** submissions, 0 pending reports |

## What shipped in the fortnight to 4 Oct

21 commits. The theme was not building features — it was discovering that
several instruments were reporting success while the thing they measured was
broken.

| | |
|---|---|
| **The inbox** | submissions and reports are checked BEFORE anyone is told, then one email with one-tap decisions. Replaced two channels and deleted a third. `docs/INBOX.md` |
| **Spend ledger** | `model_spend`, seven entrypoints. The verify pass cost more than the pipeline and was recorded nowhere |
| **Dedupe at the write** | `upsertEvents` now refuses a row already on the calendar under another name |
| **Source-check rotation** | a third of the calendar had been exempt from the fabrication check by accident of spelling |
| **Venue fold** | Xcel Energy Center / Grand Casino Arena were two venues; the pin was also 1.7km off |

### Instruments that were lying, and now are not

Worth reading as a set, because the pattern repeats:

- The **collapse** archived ~20 rows every week and the venue importer woke
  them the same run. `collapsed_runs` counted *plans*, not writes, so the panel
  read clean through five failed weeks.
- The **self-check** reported 0 duplicates while 8 sat live, because the
  concurrent-venue skip ran before the duplicate test.
- The **Anthropic tile** read $22.78 in green while the console read $181.87.
- The **Verification section** could not raise a flag, so a dying verify pass
  made the Monday email *greener*.
- A **verify flag written after a stamp** was invisible, because "open" meant
  "on an unverified listing".

The standing lesson, now enforced in several places: *a measurement that knows
it is partial must not render as a pass.*

## Open — the watch list

Nothing here is blocked; everything has an owner.

1. **`DIGEST_POSTAL_ADDRESS` is still unset.** Every weekly send goes out with
   no physical postal address, which CAN-SPAM requires, and stamps
   `NO POSTAL ADDRESS IN FOOTER` in its own record. Sends on 17 and 24 Sep and
   since are non-compliant. **The plumbing is fixed** — `weekly-digest.yml`
   never mapped the secret until 29 Sep, so the instruction in every earlier
   doc *could not have worked*. **Taren: one GitHub Actions secret.**
2. **53 open verify flags**, of which roughly half carry a ready-to-apply date
   or time taken from the venue's own calendar. Two hours of applying answers
   we already have. There is no `/admin/flags` screen; they surface only in the
   Monday email and in SQL.
3. **45 upcoming drafts** with no route back to published, ~20 starting within
   a fortnight.
4. **279 listings never source-checked.** The rotation works; the budget is
   400 pages against 521, so raise `--limit` or wait two runs.
5. **One real clash**: Scream Town's Halloween Market and Attraction, same
   venue and minute, genuinely concurrent. The self-check cannot tell that from
   a double booking. Left visible on purpose.
6. **Taren's money decisions**: the Vercel spend alert (never set) and whether
   to hold an Anthropic Admin API key so the tile can read actual spend rather
   than our own jobs.
7. **~$85/month of Anthropic spend is still unexplained** — $78.84 measured in
   our jobs for September against $181.87 on the console. The per-key breakdown
   in the console is the only thing that can find it. From October the ledger is
   complete going forward, so the remaining gap is the real signal.

## Environment notes (this machine)

- `DATABASE_URL` lives in `.env.local`; every `npm run` script auto-loads it.
  **Taren edits this file from a phone — verify value shapes before trusting
  them** (a `//` once arrived as `..`).
- `git push` needs `GCM_INTERACTIVE=auto` in agent sessions.
- **`.env.local` has no `RESEND_API_KEY`, `MAPBOX_GEOCODING_TOKEN`,
  `UNSUBSCRIBE_SECRET` or `GSC_SERVICE_ACCOUNT_JSON`.** Each has a real
  consequence rather than being a nuisance:
  - no Mapbox → `geocode()` returns null → `submissionToDbEvent` falls back to
    the **metro centre**, a silent wrong pin. Geocode by hand and pass
    `publishSubmission({ geo })`.
  - no signing secret → the inbox email's one-tap buttons are signed with the
    **dev fallback** and production rejects them as expired. Decide a
    locally-checked batch in Admin, or re-run from Actions.
- A `GITHUB_TOKEN` is available in this shell, so Actions state can be queried.
  `head_sha` on a run is how you tell whether it actually had your code.
- Reading secrets out of `.env.local` is blocked by the permission layer. Work
  with the scripts, not around them.

## Conventions worth preserving

- **Recon before writing.** Grep the real export first; guessed helper names
  remain the top source of wasted turns.
- **Measure before diagnosing.** "The database is slow" was printed by a panel
  whose database answered in 534ms. Three separate bugs this fortnight were
  found by running a query rather than reading the code.
- **One definition of a rule.** The dedupe gate imports the self-check's own
  predicate rather than restating it, because two definitions of "same event"
  is exactly how the panel and the writer drifted apart.
- **A failure must never render as data**, and a *partial* measurement must not
  render as a pass. Grey is not green; a floor is not a total.
- **Never delete events** — archive them. Personal data is the exception and
  the opposite.
- **Verify the artifact, and the read-back.** Write → read back → compare.
- **Shell escaping mangles regexes.** `\b` became a literal backspace in
  September and `\d` was silently eaten twice on 4 Oct, shipping a regex that
  matched nothing. Use the Edit tool for anything with backslashes.
- **Tests written against invented data pass while production fails.** A
  duplicate-detection test used a title I shortened by hand; the real string
  had four more words and failed. Use the production string.

## First session opener

> Read `CLAUDE.md` and this file, check memory, then `git log --oneline -10`
> and `npm test`. Then open `/admin/ops` — the tiles know more than the docs do.
