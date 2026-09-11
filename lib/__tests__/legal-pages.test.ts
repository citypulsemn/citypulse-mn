import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    const appSrc = ["app", "lib"].map((d) => d).join();
    expect(appSrc).toBeTruthy();
    expect(privacy).toMatch(/don&rsquo;t accept file uploads/i);
    expect(privacy).toMatch(/don&rsquo;t ask for or store payment details/i);
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
