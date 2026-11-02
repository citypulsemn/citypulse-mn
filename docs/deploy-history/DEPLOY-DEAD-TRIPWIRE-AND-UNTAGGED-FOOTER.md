# Deploy — a test that could not see what it was named for, and a link that claimed to be measured

**2 Nov 2026.** Two defects found while costing the B2 support link, both in the
blast radius of the change that was about to land. One new pure function, one
call site, one test rewritten from scratch, six new golden tests. No schema
change, no data change, no new secret, no new dependency. Deploy is a push.

Neither of these was the task. The question was "what depends on the payment
destination and how do I set it up", and these are what the recon found.

## 1. The test named for catching a payment flow could not see one

`lib/__tests__/legal-pages.test.ts` opens by stating its own purpose:

> so that adding a tracker, an upload form or **a payment flow** breaks a test
> instead of quietly making the page a lie

The test for the payment half read, in full:

```ts
const appSrc = ["app", "lib"].map((d) => d).join();
expect(appSrc).toBeTruthy();
expect(privacy).toMatch(/don&rsquo;t ask for or store payment details/i);
```

`["app", "lib"].map((d) => d)` is the identity map. `.join()` makes the string
`"app,lib"`. `expect("app,lib").toBeTruthy()` is **always true** and reads no
source at all. The two surviving assertions only grep the privacy page for its
own wording — so the page restates itself and passes. It had been green its
whole life, over a check that was never performed.

Found one commit before a payment link was due to land, which is the only reason
it matters: the privacy page says *"We don't ask for or store payment details"*,
and that claim was about to come under pressure with nothing watching it.

### Why the new check reads `package.json` and not the source

The obvious fix — grep the source for `stripe` — is wrong, and wrong in a way
that would have been worse than the dead test.

B2 puts a payment host's URL (`buy.stripe.com/...`) into `lib/editorial.ts`. That
is **not** a payment flow: we hand the reader a link, the host takes the card, and
nothing financial touches citypulsemn.com. The privacy claim stays strictly true.
A source grep for `stripe` would go red the day that link shipped — and a test
that fails on the correct change is a test everyone learns to delete.

The claim is about **processing**. Processing a card means pulling in an SDK, so
the dependency list is both the narrower signal and the truer one:

```ts
const pkg = read("package.json");
for (const sdk of ["stripe", "@stripe/", "braintree", "square", "paypal"]) {
  expect(pkg).not.toContain(`"${sdk}`);
}
```

The upload half now reads the actual source — `app/`, `components/` and `lib/`,
walked recursively, `__tests__` excluded (a fixture naming a card field is not a
payment flow) — and looks for a file input, multipart handling, or a card field.

### It was proved to fail, not assumed to

Rule 8's lesson applies to tests as much as to archives, and this exact file is
why. Each case was run as a mutation against the new assertion:

| mutation | result | wanted |
|---|---|---|
| unmutated | GREEN | GREEN |
| `"stripe"` in dependencies | **RED** | RED |
| `"@stripe/stripe-js"` | **RED** | RED |
| `"@paypal/react-paypal-js"` | **RED** | RED |
| `"@square/web-sdk"` | **RED** | RED |
| `"@braintree/braintree-web"` | **RED** | RED |
| `"@adyen/adyen-web"` | **RED** | RED |
| `<input type="file" />` under `app/` | **RED** | RED |
| a `<CVVField />` component under `app/` | **RED** | RED |
| a `cardNumber` identifier under `app/` | **RED** | RED |
| **`SUPPORT` set to a real `buy.stripe.com` URL** | **GREEN** | GREEN |

The last row is the one that matters most and the reason the check is shaped this
way. The feature we are about to ship must not trip the guard.

### The first version of this fix had the same hole, narrower

Worth recording, because the first mutation table in this guide had five rows
and declared the assertion proved. **It was proved only for the unscoped name.**
An adversarial review pass of the diff caught it, and two independent verifiers
confirmed it before it counted.

The check matches `` `"${sdk}` `` — the leading quote anchors each name to the
start of a package key. That anchor is deliberate and has to stay:
`@braintree/sanitize-url` is a common mermaid dependency and not a payment SDK,
so a bare `braintree` match would accuse the wrong thing. But the anchor is also
why every **scope** must be spelled out. In `"@paypal/react-paypal-js"` the
character after the quote is `@`, so `"paypal` never occurs. The first list
spelled out `@stripe/` and no other scope, so:

```
ESCAPES  @paypal/react-paypal-js      <- the standard React PayPal package
ESCAPES  @square/web-sdk
ESCAPES  @braintree/braintree-web
ESCAPES  @adyen/adyen-web
CAUGHT   stripe
CAUGHT   @stripe/stripe-js
```

Modern JS payment SDKs ship scoped, so the most likely non-Stripe processor was
exactly the one that slipped through — the dead assertion's failure shape, minus
three of five names.

The same review found the source-side belt could not back it up either. The
pattern was `/\b(…|cvc|cvv)\b/i`, and PayPal's hosted-field components are
`<CVVField />` and `<NumberField />`: `\bcvv\b` cannot match `CVVField`, because
`\b` fails before the `F`. The trailing boundary is gone. And an iframe-based SDK
leaves no card markup in our source at all, which is the real reason the
dependency list is the load-bearing half and the regex is only the belt.

A scope entry can over-fire — `@braintree/sanitize-url` would now trip it. That
is the right direction to be wrong in, and the same call `check-sources` makes: a
wrong accusation costs one glance at a loud message, a miss costs the privacy
page its truth.

## 2. The footer's support link was going out untagged

`DEPLOY-SUPPORT-LINK-AND-PARKING.md:36-40` recorded, on 29 Oct:

> one definition, two campaigns — `utm_campaign=sponsor` and
> `utm_campaign=support`, which also lets us tell an email click from a
> site-footer click without any extra instrumentation

It did not. Both tagged links were `utm_medium=digest`, because `campaignUrl` was
private to `lib/digest.ts` and hard-coded the email source. `components/SiteFooter.tsx`
used the bare URL:

```tsx
<a href={SUPPORT.url} target="_blank" rel="noopener noreferrer">
```

So the two campaigns distinguished a *sponsor* click from a *support* click, both
in email. A footer click was identifiable only by the **absence** of a tag —
indistinguishable from a link someone pasted into a group chat. And a Stripe
payment link records neither UTM nor referrer on the payment object, so there was
no second instrument to fall back on.

This is dark code today (`SUPPORT` is `null`, so the link renders nowhere), which
is exactly why it was worth fixing now: the measurement would have been missing
from the first day there was anything to measure, and the deploy guide would have
told us we had it.

### The shape of the fix

`campaignUrl` moved to [lib/outbound.ts](../../lib/outbound.ts) — the module that
already owns outbound-URL tagging and already documents the append-only
discipline — and gained the two axes it was missing:

```ts
export function campaignUrl(url: string, source: string, medium: string, campaign: string): string
```

`lib/digest.ts` keeps its private two-argument wrapper and delegates, so its two
call sites are untouched. **The email output is byte-identical** and a golden test
pins that: a plain string append, deliberately *not* the `new URL()` round-trip
its neighbour `outboundTicketUrl` uses, because `toString()` normalizes — it adds
a trailing slash to a bare origin and re-encodes reserved characters. Live email
links were worth more than symmetry with the function above it.

A source-grep tripwire pins the call site, in the idiom of the TopBar and
privacy-page tests, because what broke here was not logic — it was a call site
quietly going bare while a document said otherwise.

## What shipped

| file | change |
|---|---|
| [lib/outbound.ts](../../lib/outbound.ts) | `campaignUrl(url, source, medium, campaign)`, exported — the one definition |
| [lib/digest.ts](../../lib/digest.ts) | its private copy now delegates; output byte-identical |
| [components/SiteFooter.tsx](../../components/SiteFooter.tsx) | the support href is tagged `site`/`footer`/`support` |
| `lib/__tests__/legal-pages.test.ts` | the dead assertion replaced with one that reads source and dependencies |
| `lib/__tests__/outbound.test.ts` | +5 golden tests for `campaignUrl`, +1 tripwire on the footer call site |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,946 tests** (2,940 → 2,946), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- The new assertion was mutation-tested in **eleven** directions (table above),
  including the one case it must **not** fire on, and including the four scoped
  SDK names that escaped the first version of this fix

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No secret, no migration, no data step.

## Verify

Both changes are **invisible in production today**, because `SUPPORT` is `null`
and the footer link renders nowhere. That is the honest statement: there is
nothing to observe on the live site, and claiming otherwise would be the
overclaim this project does not forgive.

What is verifiable now is the gate above, plus the mutation table. The footer
tagging becomes observable the day a payment URL is set, and the check then is
that the footer link carries `utm_medium=footer` while the email link carries
`utm_medium=digest`:

```bash
curl -s https://www.citypulsemn.com/ | grep -o 'utm_medium=footer[^"]*'
```

## Rollback

`git revert` and push. `campaignUrl` is additive in `lib/outbound.ts`; reverting
restores the private copy in `lib/digest.ts`, the bare footer href, and the dead
assertion. No data to undo.

## Left open

- **`DEPLOY-SUPPORT-LINK-AND-PARKING.md` carries a correction note** rather than a
  rewritten sentence. It is a record of what shipped on 29 Oct, and what shipped
  was the half-built version.
- **A footer click still cannot be tied to a payment.** The UTM tells us the
  reader reached the host from the footer rather than the email; Stripe's payment
  object carries neither UTM nor referrer, so conversion is unmeasured either
  way. Closing that would mean one Stripe Payment Link per source — a real
  integration, and not worth it for a tip jar.
- **`SiteFooter` has a `subscribe` prop and no `support` prop**, so the support
  link cannot yet be suppressed per page. It will land on `/submit`, `/report`
  and `/venue-report`, where a reader is already doing unpaid work, and on
  `/for-partners` and `/for-venues`, which pitch paid placement. Footer-only is
  still inside the one-ask stance, so this is a judgement call, not a violation.
