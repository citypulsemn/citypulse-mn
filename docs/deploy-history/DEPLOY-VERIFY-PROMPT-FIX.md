# Deploy — the verify pass stops confirming events it never found (5 Sep 2026)

## What was wrong

The freshness pass **confirmed a fabricated event**. On 3 Sep it stamped
`verified_at` on our listing for *Damian 'Jr. Gong' Marley & Stephen Marley* at
The Fillmore Minneapolis. The venue had Masego that night, Live Nation had no
Damian Marley dates anywhere, and the roundup article we cited never mentioned
the Marleys. A reader caught it on 5 Sep, hours before the doors.

**The prompt was the cause.** It said:

> Re-check each one against its source … "confirmed" — the event still appears
> as scheduled.

When the source is an article that never named the event, that question is
unanswerable — and the agent answered `confirmed` anyway. Worse, the stamp is not
inert: `verified_at` is what the never-verified-first ordering uses to decide
what to look at next, so confirming a fabrication actively stops anyone
re-checking it.

## Three changes

### 1. The prompt asks the venue

The question the report checker uses — *what does the venue itself say is in that
room that night?* — is now the verify pass's first instruction, and it outranks
the source we cite. A roundup that does not name the event confirms nothing, and
the prompt says so.

`confirmed` now means "I saw this event named on the venue's own calendar or its
official ticketing page", with the failure spelled out:

> IF YOU CANNOT FIND THE EVENT NAMED SOMEWHERE AUTHORITATIVE, THAT IS
> "not_found", NEVER "confirmed". … "confirmed" is not the safe default. It is a
> claim, and it needs to be true.

### 2. A new verdict: `wrong_event`

The venue lists a **different act** in that room that night, with evidence naming
what it actually has. Distinct from `not_found` ("I couldn't find it") and from
`cancelled` ("it was real and got called off").

**It flags; it does not hide.** It is the strongest negative the pass can
produce, but it is still one instrument, and a support act, a co-headline or a
renamed billing can all look like "a different act". The house standard for
hiding is two instruments agreeing (`scripts/resolve-conflicts.ts`), and
`import-venues` flags rather than hides for exactly this reason. What it
guarantees is that `verified_at` is **not** stamped — which is the specific
failure here.

### 3. A missing verdict no longer means "confirmed"

`parseVerdicts` read:

```ts
const verdict = typeof o.verdict === "string" ? (o.verdict as Verdict) : "confirmed";
```

A malformed answer — no `verdict` field, or a non-string — stamped `verified_at`
on an event nobody had checked. It now skips the entry. **Silence is not a
confirmation.**

## And the flags are now visible

Separately discovered while fixing this: **every `verify_flag` row ever written
was invisible.** They go into `admin_audit` and nothing read the table — a pass
raising its hand into a void. `moved`, `sold_out`, `not_found` and now
`wrong_event` have all been accumulating unseen.

The ops digest **Queue** section now carries flagged listings that are still
published and still unverified, `wrong_event` first, and **alerts** on them.
Self-clearing the same way the music-review count is: open is computed from the
listing's current state, not from how many times it has been flagged.

## Proof

The same listing, the same source URL, the same agent, re-run after the change:

```
VERDICT : wrong_event
EVIDENCE: The Fillmore Minneapolis's own website (fillmoreminneapolis.com) lists
          'Masego: Fix Your Face Tour' for Saturday, September 5, 2026 — not
          Damian 'Jr. Gong' Marley & Stephen Marley.
ACTION  : flag
STAMPS verified_at? no
```

Before the change the same input returned `confirmed`.

## Deploy steps

1. Merge to `main`. No schema change, no new secrets, nothing build-time.
2. Nothing to enable — the next scheduled run (Monday 12:00 UTC, and the
   pre-send step inside the Thursday digest) uses the new prompt.

## Verify

```bash
npm run verify -- --dry-run --cap=8
```

Read the verdicts. `confirmed` should now be attached to events the agent
actually located; anything it could not find should read `not_found` rather than
`confirmed`. If a `wrong_event` appears, the ops digest Queue section will alert
on it the following Monday.

## Rollback

Three edits in two files: the `wrong_event` case in `actionFor` and the
`VERDICTS` entry (`lib/verify.ts`), the `parseVerdicts` guard (same file), and
`buildVerifyPrompt` (`lib/agents/prompts.ts`). The digest's flag visibility is
the `verifyFlags` block in `scripts/send-ops-digest.ts` and the Queue lines in
`lib/ops-digest.ts`. Reverting the prompt alone restores the old behaviour —
including the old bug.

## Quality gate

`npx tsc --noEmit` clean · **1927/1927** tests (+14) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · the fix proven by re-running the real agent
against the exact listing that fooled it.

## What this still does not do

**It does not stop the listing being created.** The research pipeline invented
this event and attached a citation that does not support it; this change means
the freshness pass will now catch it rather than bless it. Making the pipeline
itself refuse to write an event its own source does not name is a separate and
larger change.

**The Fillmore still has no primary-source importer.** It is a Live Nation room,
so the outstanding Ticketmaster key would cover it — along with the Armory, Xcel,
Target Center, Orpheum, State, Ordway and Mystic Lake.

**A retroactive sweep has not been run.** Anything `verified_at` stamped under
the old prompt carries a confirmation that may not mean what it says. The 14
other listings seeded by that same article are unverified and untouched.
