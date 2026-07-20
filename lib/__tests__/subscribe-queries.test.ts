import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Query-text tripwires for R0.5 (resubscribe). The conflict path must promote
 * status back to 'subscribed' and clear unsubscribed_at — without these, an
 * unsubscribed or pending row stays dead forever while the UI says "already
 * subscribed". Behavior was proven against prod in a rolled-back transaction
 * (see DEPLOY-R0.5); these keep the load-bearing fragments from regressing.
 */
const src = readFileSync(join(__dirname, "..", "subscribe.ts"), "utf8");

describe("addSubscriber (R0.5) — explicit subscribe promotes status", () => {
  it("conflict update promotes to subscribed and clears unsubscribed_at", () => {
    expect(src).toContain("set status = 'subscribed'");
    expect(src).toContain("unsubscribed_at = null");
  });

  it("prior status is read from the pre-statement snapshot for honest reporting", () => {
    expect(src).toContain("select status from subscribers where email");
    expect(src).toMatch(/prior_status === "subscribed" \? "already" : "resubscribed"/);
  });

  it("saver_token coalesce survives (5.3 identity bridge intact)", () => {
    expect(src).toContain("coalesce(excluded.saver_token, subscribers.saver_token)");
  });
});
