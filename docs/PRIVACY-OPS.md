# Privacy operations — honouring what `/privacy` promises

Two things the policy page tells readers, and the code that now backs them.

## 1 · "Write to us and we'll delete it"

```bash
npm run delete-personal-data -- --email=someone@example.com           # dry run
npm run delete-personal-data -- --email=someone@example.com --apply   # honour it
```

Before 17 Sep 2026 there was no code behind that sentence. Honouring a request meant
somebody remembering to hand-write SQL against production, correctly, from memory.

### What it clears

| table | what happens |
|---|---|
| `saved_events` | deleted, found via `subscribers.saver_token` |
| `subscribers` | deleted, including the saver token |
| `event_submissions` | `submitter_email` blanked, the submission kept |
| `event_reports` | `reporter_email` blanked, the report kept |

Submissions and reports are cleared of the **person**, not the **record**: the listing
they sent is site content and may already be published. Blanking the address back to the
column's own default (`''`) leaves the submission intact and holds nothing about who
sent it.

`rate_events` holds IP-keyed buckets but ages itself out in days, which is exactly what
the policy already describes, so it is not part of a request.

### The guard that matters

`submitter_email` and `reporter_email` are `not null default ''`. **An anonymous
submission IS the empty string.** A deletion keyed on a blank address would match every
anonymous submission and every anonymous report in the database and quietly delete the
lot. `normalizeRequestEmail` refuses blank, whitespace, multiple addresses, wildcards
and anything that is not unambiguously one address — and the script exits 1 rather than
guessing. That is the single most-tested function in `lib/data-deletion.ts`.

### The audit row does not undo the deletion

Writing the address into `admin_audit` would leave the data in the database under
another name, which is not deletion. The row records counts plus a salted
12-character reference. That ties to the original request only for someone who still has
that email in their inbox, and is useless to anyone who does not — so reply from the
original thread.

### Order matters

`saved_events` is cleared **before** `subscribers`. `subscribers.saver_token` is the only
route from an email to that browser's saved events; delete the subscriber first and the
saves are orphaned, unreachable, still in the database, and still theirs. A test asserts
the ordering.

## 2 · CAN-SPAM — the postal address

**Status: NOT YET SET. Taren has to supply this.**

CAN-SPAM §7704(a)(5) requires every commercial email to carry "the valid physical postal
address of the sender". Until 17 Sep 2026 the digest footer read
*"City Pulse MN · Twin Cities, Minnesota"* — a region, which is not an address.

Set **`DIGEST_POSTAL_ADDRESS`** in Vercel *and* in GitHub Actions secrets (the weekly
send runs in Actions, so Actions is the one that actually matters):

```
DIGEST_POSTAL_ADDRESS=1234 Example Ave, Suite 5, Minneapolis, MN 55403
```

A PO box registered to the sender is acceptable under the Act; a city is not.

### Why it is not in the repo

It is a real-world fact about Taren that this codebase cannot know, and a
plausible-looking invented address in a legal footer is the same class of mistake as a
plausible-looking invented event. So the footer **degrades to the old region line**
rather than printing a placeholder, and the absence is made loud instead:

- the sender logs a warning, and
- every send records `· NO POSTAL ADDRESS IN FOOTER (CAN-SPAM)` in its `digest_sends`
  note, which surfaces on **`/admin/digest`** and in the Monday ops email's
  `last digest:` line.

No new plumbing — it rides the note that already reaches both places. Once the variable
is set the marker disappears on the next send, which is how you confirm it took.
