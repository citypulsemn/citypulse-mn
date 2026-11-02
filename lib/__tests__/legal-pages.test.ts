import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SUPPORT } from "../editorial";

/**
 * A privacy policy is a set of factual claims about the code. These pin the
 * ones that would go stale first — so that adding a tracker, an upload form or
 * a payment flow breaks a test instead of quietly making the page a lie.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const privacy = read("app/privacy/page.tsx");
const terms = read("app/terms/page.tsx");
const schema = read("db/schema.sql");

/**
 * Every source file we actually ship, so that a claim ABOUT the code can be
 * checked AGAINST the code rather than against the page restating itself.
 * __tests__ is excluded on purpose: a fixture naming a card field is not a
 * payment flow, and a test that trips on its own neighbours gets deleted.
 */
const appSource = ["app", "components", "lib"]
  .flatMap((d) =>
    readdirSync(join(ROOT, d), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__"))
      .map((f) => read(join(d, f))),
  )
  .join("\n");

describe("the privacy policy matches what the code collects", () => {
  it("names every table that holds a person's email", () => {
    // If a new PII column appears, it belongs on the page.
    for (const col of ["email", "submitter_email", "reporter_email"]) {
      expect(schema, `${col} should still exist, or the policy needs editing`).toContain(col);
    }
    expect(privacy).toMatch(/Subscribing to the weekly email/i);
    expect(privacy).toMatch(/Submitting an event/i);
    expect(privacy).toMatch(/Reporting a wrong listing/i);
  });

  it("describes the saver cookie honestly — pseudonymous, not anonymous", () => {
    // lib/saver.ts sets an httpOnly, one-year cookie carrying a random id that
    // saved_events and place_visits are keyed on. Calling that "anonymous"
    // would be the easy lie.
    const saver = read("lib/saver.ts");
    expect(saver).toContain("httpOnly: true");
    expect(privacy).toContain("httpOnly");
    expect(privacy).toMatch(/pseudonymous rather than anonymous/i);
  });

  it("still tells the truth that analytics are aggregate counts, not per-person rows", () => {
    // event_stats is (event_id, day, action, count). A per-user column here
    // would make the "no row per person" claim false.
    const stats = /create table if not exists event_stats[\s\S]*?\);/.exec(schema)![0];
    expect(stats).not.toMatch(/user_token|session|visitor|ip\b/i);
    expect(privacy).toMatch(/daily totals per event/i);
  });

  it("still tells the truth that rate-limit records are deleted after two days", () => {
    expect(read("lib/rate-limit.ts")).toContain("interval '2 days'");
    expect(privacy).toMatch(/deleted automatically after two days/i);
  });

  it("lists every third party the code actually talks to", () => {
    for (const party of ["Vercel", "Supabase", "Resend", "Mapbox", "Anthropic", "Google"]) {
      expect(privacy, `${party} is used but not disclosed`).toContain(party);
    }
  });

  it("the 'no uploads' and 'no payments' claims are still true", () => {
    // These are load-bearing: they are why several whole categories of
    // obligation don't apply. If either becomes false, the page must change.
    //
    // THIS TEST WAS DEAD FOR ITS WHOLE LIFE. It read:
    //     const appSrc = ["app", "lib"].map((d) => d).join();
    //     expect(appSrc).toBeTruthy();
    // which builds the string "app,lib" and asserts it is truthy. Always true,
    // reading no source at all — so the one test named for catching a payment
    // flow could not see one. Found 2 Nov 2026 while costing the B2 support
    // link, which is to say one commit before a payment link was due to land.
    //
    // WHY THE PAYMENT CHECK READS package.json AND NOT THE SOURCE: B2 puts a
    // payment host's URL (buy.stripe.com/...) in lib/editorial.ts, and that is
    // NOT a payment flow — we link out and never see a card, so the privacy
    // claim stays strictly true. Grepping source for "stripe" would go red the
    // day that link ships, which would teach everyone to delete the test. The
    // claim is about PROCESSING, and processing a card means pulling in an SDK.
    // The dependency list is the narrower signal and the truer one.
    //
    // The quote anchors each name to the START of a package key, which matters:
    // "@braintree/sanitize-url" is a common mermaid dependency and not a
    // payment SDK, so a bare `braintree` match would accuse the wrong thing.
    // But the anchor is also why the SCOPED forms must be listed explicitly —
    // in "@paypal/react-paypal-js" the character after the quote is `@`, so
    // `"paypal` never occurs. Caught 2 Nov 2026 by a review pass: the first
    // version of this list spelled out `@stripe/` and no other scope, so the
    // four SDKs below all escaped it while the test sat green. Modern JS
    // payment SDKs ship scoped, and the mutation test that "proved" this
    // assertion only ever tried the unscoped `stripe`.
    //
    // A scope entry can over-fire (see sanitize-url above). That is the right
    // direction to be wrong in: a wrong accusation costs one glance at a loud
    // message, a miss costs the privacy page its truth.
    const pkg = read("package.json");
    for (const sdk of [
      "stripe", "@stripe/",
      "braintree", "@braintree/",
      "square", "@square/",
      "paypal", "@paypal/",
      "adyen", "@adyen/",
    ]) {
      expect(pkg, `${sdk} is a dependency now — does the privacy page still hold?`)
        .not.toContain(`"${sdk}`);
    }
    expect(appSource, "a file input means we accept uploads").not.toMatch(
      /<input[^>]*type=["']file["']/i,
    );
    expect(appSource, "multipart handling means we accept uploads").not.toMatch(
      /multipart\/form-data/i,
    );
    expect(appSource, "a card field means we ask for payment details").not.toMatch(
      // No TRAILING \b: PayPal's own hosted-field components are <CVVField />
      // and <NumberField />, and /\bcvv\b/ cannot match "CVVField". An
      // iframe-based SDK leaves no card markup in our source at all, which is
      // why the dependency list above is the load-bearing half and this is the
      // belt.
      /\b(cardNumber|card_?number|cvc|cvv)/i,
    );
    expect(privacy).toMatch(/don&rsquo;t accept file uploads/i);
    expect(privacy).toMatch(/don&rsquo;t ask for or store payment details/i);
  });

  it("names the payment host whenever the footer links to one", () => {
    // An implication, and live right now because SUPPORT is set. The bullet
    // above only greps our own sentence back out of the page, so it stayed
    // green while the footer quietly started handing readers to a payment
    // host the page did not name. Found by a review sweep, not by the gate.
    if (SUPPORT === null) return;
    const host = new URL(SUPPORT.url).hostname;
    const brand = host.split(".").slice(-2)[0];
    expect(
      privacy.toLowerCase(),
      `the footer links readers to ${host} — the privacy page must name it`,
    ).toContain(brand);
  });

  it("discloses the AI, and does not oversell it", () => {
    expect(privacy).toMatch(/researched with the help of AI/i);
    // The honest half: it has been wrong, and the reader should check.
    expect(privacy).toMatch(/check with the venue before you\s+drive/i);
    expect(privacy).toMatch(/not used to train any AI\s+model/i);
  });

  it("points at a real contact address", () => {
    expect(privacy).toContain("hello@citypulsemn.com");
    expect(terms).toContain("hello@citypulsemn.com");
  });
});

describe("terms", () => {
  it("leads with the accuracy limit rather than burying it", () => {
    const accuracyAt = terms.indexOf("Accuracy");
    const liabilityAt = terms.indexOf("Liability");
    expect(accuracyAt).toBeGreaterThan(-1);
    expect(accuracyAt).toBeLessThan(liabilityAt);
    expect(terms).toMatch(/They are still sometimes\s*\n?\s*wrong/i);
  });

  it("says the unsubscribe is one click and immediate — matching the code", () => {
    // lib/unsubscribe-token.ts + the /unsubscribe route are a signed one-click
    // link. Claiming that is only safe while it stays true.
    expect(terms).toMatch(/one-click unsubscribe/i);
    expect(privacy).toMatch(/One click, no login/i);
  });
});

describe("both pages are reachable", () => {
  it("are linked from the site footer", () => {
    const footer = read("components/SiteFooter.tsx");
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
  });

  it("are in the sitemap", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain("/privacy");
    expect(sitemap).toContain("/terms");
  });

  it("carry a last-updated date", () => {
    expect(privacy).toMatch(/LAST_UPDATED = "\d{1,2} \w+ \d{4}"/);
    expect(terms).toMatch(/LAST_UPDATED = "\d{1,2} \w+ \d{4}"/);
  });
});
