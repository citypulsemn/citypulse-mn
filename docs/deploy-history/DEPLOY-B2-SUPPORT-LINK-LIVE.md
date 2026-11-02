# Deploy — the reader support link goes live, and the email is held back on purpose

**2 Nov 2026.** Monetization B2 ships. One config value set, one new pure
function, one call site, six golden tests. No schema change, no data change, no
new dependency, no payment SDK. Deploy is a push.

The owner created a live Stripe Payment Link (pay-what-you-want) and asked for
it to be set up. It is now live **on the site footer only**. The weekly email
deliberately does not carry it yet, for a reason found during the work.

## What is now live

`lib/editorial.ts` — `SUPPORT` is no longer `null`:

```ts
export const SUPPORT: SupportLink | null = {
  url: "https://buy.stripe.com/cNi28k5n0aP1cWFfVBcwg00",
  label: "Support the site",
  digestLine:
    "This site and the email are free and carry no ads. If it's worth something to you, you can chip in.",
};
```

Still no API key, no webhook, no table, no PCI scope. Stripe hosts the checkout
on their own domain; nothing financial touches citypulsemn.com, so the privacy
page's *"We don't ask for or store payment details"* stays strictly true. The
dependency guard in `lib/__tests__/legal-pages.test.ts` confirms it: zero
payment SDKs in `package.json`.

## The thing that was found: the email could not legally carry this yet

Roadmap P1 states the rule — *nothing may be sold into the newsletter until
`DIGEST_POSTAL_ADDRESS` is set.* It had never been enforced anywhere but prose.

Checked against the real last send rather than assumed. From the
`weekly-digest.yml` run of 29 Oct:

```
DIGEST_POSTAL_ADDRESS:
```

Empty. The secret is not set, so the subscriber email currently goes out with no
physical address in its footer — `senderFooterLine` degrades to
`City Pulse MN · Twin Cities, Minnesota`, which is a region, not an address.
`lib/digest-send.ts:167` already warns about this into `digest_sends`.

Adding a request for money is what makes an email unambiguously commercial. So
setting `SUPPORT` would, with no further action, have put a money ask into an
email whose footer has no physical address — precisely what P1 forbids. This is
not legal advice; it is the project's own written rule, applied.

### The guard, and why it is a conditional rather than a comment

`lib/digest.ts`:

```ts
export function digestSupport(
  postalAddress?: string | null,
  support: SupportLink | null = SUPPORT,
): SupportLink | null {
  return missingPostalAddress(postalAddress) ? null : support;
}
```

`lib/digest-send.ts` passes `support: digestSupport(postalAddress)`.

Three properties worth stating:

1. **It encodes the rule instead of documenting it.** P1 was a sentence in a
   roadmap; it is now a function with golden tests.
2. **It is self-healing.** The day `DIGEST_POSTAL_ADDRESS` is set, the email line
   turns on by itself. There is no hardcoded suppression to remember to remove,
   and therefore no second deploy that can be forgotten.
3. **It governs the email only.** A link on a web page raises no CAN-SPAM
   question, so the site footer is deliberately out of scope. This is why the
   feature could ship today at all.

It rides on the existing `opts.support === undefined ? SUPPORT : opts.support`
contract at `lib/digest.ts:393` — explicit `null` forces none, `undefined` takes
the module default. That contract was hardened with tests earlier the same day.

## Verify — observed, not intended

**The email, composed exactly as the send path composes it, with the real env:**

```
SUPPORT is configured:       yes -> https://buy.stripe.com/cNi28k5n0aP1cWFfVBcwg00
DIGEST_POSTAL_ADDRESS:       null
digestSupport() resolves to: null (withheld)

email contains utm_campaign=support?  false
email contains the digest line?       false
email footer sender line:             City Pulse MN · Twin Cities, Minnesota

WITH an address -> utm_campaign=support? true
WITH an address -> digest line present?  true
```

The counterfactual is the important half: the guard withholds, and it stops
withholding the moment an address exists.

**The footer, read out of the running page:**

```
https://buy.stripe.com/cNi28k5n0aP1cWFfVBcwg00?utm_source=site&utm_medium=footer&utm_campaign=support
```

Exactly one support link, in the "Help us" column below Privacy and Terms, with
the single subscribe band above it. `utm_medium=footer` is distinct from the
email's `utm_medium=digest` — the measurement the 29 Oct guide claimed and did
not have until this morning's `campaignUrl` fix.

**The payment page itself** was loaded and read: live mode (*"Payment mode: Live
mode. Test data not accepted."*), branded CityPulseMN, and an editable amount
field — pay-what-you-want, as intended. No card details were entered.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,953 tests** (2,947 → 2,953), green
- `npm run build` — clean, 611 static pages
- `npm audit` — **0 vulnerabilities**
- Footer verified in a running page; email verified by rendering both states

## Deploy

1. Push to `main`. Vercel auto-deploys. The footer link is live immediately.
2. Nothing else is required.

To turn the email line on, later and separately: set `DIGEST_POSTAL_ADDRESS` as
a GitHub Actions secret (a real mailbox or business address — a PO box is fine).
No code change and no deploy; the next digest picks it up.

## Rollback

Set `SUPPORT` back to `null` in `lib/editorial.ts` and push. The link disappears
from the footer; nothing else changes. `digestSupport` is additive and harmless
with a null config. No data to undo.

## Left open

- **A grammar error on the Stripe page, which only the owner can fix.** The
  product description reads *"This site and email are free and **carries** no
  ads"* — plural subject, singular verb. Our own `digestLine` has the corrected
  wording, so the two surfaces currently disagree slightly.
- **No minimum amount.** The page opens at `$0.00` with no floor. Stripe will
  reject a zero charge, so a reader who just hits Pay gets an error rather than a
  thank-you. Setting a minimum, or a few preset amounts, is a dashboard change.
- **Klarna and Cash App Pay are enabled** on the link. Buy-now-pay-later on a tip
  jar is odd but harmless; turning them off is a dashboard toggle.
- **A footer click still cannot be tied to a payment.** Stripe's payment object
  carries neither UTM nor referrer. Closing that means one Payment Link per
  source, which is not worth it for a tip jar.
- **`SiteFooter` has no `support` prop**, so the link cannot be suppressed per
  page. It renders on `/submit` and `/report`, where a reader is already doing
  unpaid work. Footer-only stays inside the one-ask stance, so this is a
  judgement call rather than a violation.
- **The sponsor block has the same latent assertion** —
  `lib/__tests__/digest.test.ts:288` asserts `DIGEST_SPONSOR` is null and will
  fail the build the day a sponsor is sold (R2.1). Left deliberately: whether
  turning on a monetization feature should require a conscious test edit is a
  product call, and it was only made for the support link.

---

## What the adversarial review found after the first write-up

Three lenses reviewed the diff, each finding verified by an independent
refutation agent. Four findings survived. Two mattered, and the first was mine.

### 1. The replacement test had a hole, found by all three lenses separately

The new "omitting the key" equivalence test compared **`.text` only**:

```ts
expect(renderDigestEmail(base).text).toBe(
  renderDigestEmail({ ...base, support: SUPPORT }).text,
);
```

The assertion it replaced had rendered the module-default path and asserted
`out.html` twice. Comparing text alone therefore left the **HTML support slot
with no coverage at all** on that path. The two slots live 50 lines apart in one
long template — `supportLineHtml(support)` at `lib/digest.ts:464`, and
`supportLineText(support)` at `:515` — so a defect that resolved one from
`opts.support` and the other from the resolved `support` renders a money ask in
the plain text and none in the HTML, and passed the entire suite.

That shape is not hypothetical. The commit immediately before this one,
`77a7c1f`, was *"the footer link was untagged"* — the same class of fault: one
of two render paths wired differently from the other.

Fixed by comparing the whole object, and **verified by reproducing the
reviewer's mutation rather than trusting the report**:

```
baseline (clean):  GREEN
M3 — html slot reads opts.support instead of the resolved support:
    RED  <- caught by "omitting the key renders exactly what the module default renders"
lib/digest.ts restored byte-identical: true
```

Worth recording honestly: the whole-object form was considered while writing the
first version and narrowed to `.text` for no good reason. The narrowing is the
whole defect.

One qualification from the verifier, which keeps the severity accurate: the send
path now passes `support` explicitly, so production never takes the
module-default branch. The uncovered surface was the admin digest preview plus
the documented "omit ⇒ use the module SUPPORT" contract — real, but narrower
than the raw claim reads.

### 2. The privacy page no longer described what the footer does

Setting `SUPPORT` puts a link to a payment host on every public page. The
privacy page said only *"We don't ask for or store payment details. Everything
here is free."* and its "Who else touches it" list named Vercel, Supabase,
Resend, Mapbox, Anthropic and Google Search Console — not Stripe.

The bullet was **incomplete rather than false**: no card touches our code, and a
voluntary chip-in does not make the site paid. But the page did not say where we
were sending readers, and its own Changes section promises *"If what we collect
changes, this page changes with it and the date at the top moves"* — while
`LAST_UPDATED` still read 11 September 2026.

Three edits, all in `app/privacy/page.tsx`: the payments bullet now names Stripe
and says the card is entered there and never here; Stripe joins the
subprocessor list; `LAST_UPDATED` moves to 2 November 2026.

And a tripwire, because the existing assertion greps our own sentence back out
of the page and would have stayed green forever:

```ts
it("names the payment host whenever the footer links to one", () => {
  if (SUPPORT === null) return;
  const host = new URL(SUPPORT.url).hostname;      // buy.stripe.com
  const brand = host.split(".").slice(-2)[0];      // "stripe"
  expect(privacy.toLowerCase()).toContain(brand);
});
```

It derives the host from the live config instead of restating it, so it cannot
drift. It is live today, not inert.

### 3 and 4. Two stale comments, now actively wrong

- The comment *"Inert while SUPPORT is null"* described a config state that no
  longer holds, and understated a live test — which is how a real test gets
  deleted as dead code later.
- The test named `"renders nothing anywhere when no payment page is configured"`
  tests an explicit `support: null` argument, not a config state. With a payment
  page now configured, the name had become false. Renamed to
  `"renders nothing anywhere when support is null"`.

### A process note that cost real confusion

The review agents ran their mutations **in the shared working tree**, not in an
isolated worktree. `lib/digest.ts` was observed flipping between mutated and
clean at 12:30:42 and 12:32:13 while the parent session was running its own
gate, and one reviewer correctly warned that a mutated file might get committed.
It did not — the tree was verified byte-identical to HEAD plus the intended
`digestSupport` addition before anything was staged, and the full gate was
re-measured afterwards. Any future review workflow that mutates files gets
`isolation: 'worktree'`.

## Quality gate, re-measured after the review fixes

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,954 tests**, green
- `npm run build` — clean, 611 static pages
- `npm audit` — **0 vulnerabilities**
- Working tree verified against HEAD before measuring, after the shared-tree
  mutation scare
