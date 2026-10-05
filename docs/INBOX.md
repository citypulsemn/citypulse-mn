# The inbox — checking what strangers send us, then telling Taren once

Shipped 4 October 2026. Replaces three separate channels with one.

## What changed, and why

A submission and a report are the same question: *a stranger has told us
something about the calendar — is it true?* They were handled completely
differently.

| | Reports, before | Submissions, before | Both, now |
|---|---|---|---|
| Instant email on arrival | yes, **before any check** | yes, **before any check** | **gone** |
| Automated check | within minutes | **none at all** | within minutes |
| Email you can act on | yes, with two buttons | **never** | yes, with three |
| Worst-case latency | minutes | **seven days** (Monday's ops digest) | minutes |
| Emails per arrival | **two** | one, useless | **one** |

The instant email was the noise. It fired the moment someone hit submit, so it
could say that something had arrived but not whether it was real — the only
action it offered was "go and do some research". For submissions that research
was the whole job: of the two handled by hand in September, one arrived as a
single night that was really a six-performance run, and the other was correct
but the authoritative-looking Mall of America press release that came up first
was *last year's*, and taking it would have turned a right submission into a
wrong listing. Each took about fifteen minutes.

So the check now runs **first**, and the email carries the answer.

## The flow

```
submit → row saved → dispatchReportCheck() kicks the workflow
                          ↓  (or the :07/:37 cron, which is the guarantee)
                   scripts/check-inbox.ts
                     ├─ checkSubmissions()      ← organiser's own page
                     ├─ checkReportedListings() ← venue's own calendar
                     ├─ saves verdict + note + evidence + corrections
                     └─ ONE email, with one-tap buttons
```

Nothing reaches the email unchecked, and nothing is applied without a tap.

## Corrections are the point

A report check returns a verdict. A submission check returns **the corrected
event** — `check_corrections` holds the fields it believes are wrong and what
they should be, and *Publish corrected* applies them. That is the difference
between an email that saves you fifteen minutes and one that tells you to go
and spend them.

The corrected button only appears when there is something to correct, so you
are never choosing between two buttons with the same outcome.

## The rules it holds to

- **`unconfirmed` never recommends rejecting.** A source that cannot be found
  is not evidence that an event is fake — the same asymmetry `lib/verify.ts`
  enforces for cancellations. A false rejection loses a real event, and since
  the form never promises a reply, nobody will ever chase it.
- **Nothing is applied automatically**, even on a clean check. At two or three
  submissions a month a tap costs nothing, and publishing a fabrication
  unattended is the thing this project exists to prevent.
- **GET changes nothing.** Outlook Safe Links and Gmail fetch every URL in a
  message before a human sees it, so the link opens a confirmation page and the
  decision happens on POST. Tokens are HMAC over id **and** action, namespaced
  `submission:` so a report token cannot be replayed as a publish.
- **A failed send fails the job.** This is now the *only* email these items
  produce, so a delivery outage is an outage, not a log line. The verdicts are
  saved before the send, so re-running is safe.
- **A run with nothing pending writes no row and makes no model call.** Both
  queues are usually empty.

## A verdict is one opinion, not a measurement

The first two real runs, minutes apart on identical rows, disagreed on all
three submissions:

| | first run | second run |
|---|---|---|
| Ramsey's Fall Fest | `unconfirmed` — "appears under past events" | `confirmed` — "multiple current 2026 sources" |
| Drive2Compare | `corrected` — fix both URLs | `confirmed` — "match exactly" |
| Hunters Widow's Weekend | `unconfirmed` | `corrected` — venue is "Center", not "Building" |

A hand check settled the first: Ramsey's Fall Fest **is** 10 Oct 2026 at The
Draw, free admission. The second run was right and the first had read a
past-events page.

That is inherent — a web search returns different pages on different days, and
nothing pins which page the check lands on. It is why **nothing here is ever
applied automatically**, and why the email shows the evidence URL next to every
verdict rather than only the conclusion. Treat a verdict as a well-researched
opinion that saves you the first fifteen minutes, not as a measurement. A
`confirmed` on something that matters is still worth the evidence link.

The one correction the first run proposed was also cosmetic: it wanted
`drive2compare.com` rewritten to `morries.com/drive2compare`, and the vanity
domain simply redirects there. Watch for the check proposing churn on URLs that
already work.

## The submitter hears nothing

By choice. The form promises no reply and the inbox sends none — an email
address is optional and one of the September submissions had none at all.
Requiring one would be a barrier on the only free supply of events this site
has.

## Cost

One web-search-backed call per batch of up to five, each side. At 2–3
submissions and 3–7 reports a month that is **under $5/month**, and it lands in
`model_spend` under the `check-reports` job like everything else.

## Deploying

Nothing to set. The workflow already carries `DATABASE_URL`,
`ANTHROPIC_API_KEY`, `RESEND_API_KEY` and `NOTIFY_TO`.

`.github/workflows/check-reports.yml` keeps its **file name on purpose**: the
run history under that path is how the GitHub cron-drop rate was measured, and
`lib/check-dispatch.ts` dispatches it by file name.

### Verify

```bash
npm run inbox -- --dry-run     # checks and prints; writes nothing, sends nothing
```

- [ ] A pending submission prints a verdict and any corrections
- [ ] `/admin/submissions` shows the verdict on the card, and "Not checked yet"
      when it has not run — not a reassuring blank
- [ ] The email has *Publish corrected* only where corrections exist
- [ ] Tapping a button opens a confirm page and changes nothing until you
      submit the form on it
- [ ] A second tap on the same link says "already decided" rather than
      publishing twice

### Rollback

`git revert` the commit. The `event_submissions` check columns are additive and
can stay; nothing reads them if the script is gone.
