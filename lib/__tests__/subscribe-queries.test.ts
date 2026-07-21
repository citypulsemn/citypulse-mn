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

describe("getSubscriberStats (R2.7) — count who actually gets mailed", () => {
  it("totals are status = 'subscribed', not everyone-but-unsubscribed", () => {
    const start = src.indexOf("export async function getSubscriberStats");
    const next = src.indexOf("export async function", start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);
    expect(body).toContain("where status = 'subscribed'");
    expect(body).not.toContain("status <> 'unsubscribed'");
  });
});

function fnBody(name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const next = src.indexOf("export async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("addSubscriber (F2.3) — only an EXPLICIT unsubscribe forces reconfirm", () => {
  const body = fnBody("addSubscriber");

  it("the reconfirm predicate is unsubscribed_at set AND not currently subscribed", () => {
    // both the status and unsubscribed_at CASE arms guard on the same condition
    const arms = body.match(
      /subscribers\.unsubscribed_at is not null and subscribers\.status <> 'subscribed'/g,
    );
    expect(arms?.length).toBe(2);
  });

  it("that branch parks the row at 'pending' and KEEPS unsubscribed_at (not back until confirmed)", () => {
    expect(body).toContain("then 'pending'");
    expect(body).toContain("then subscribers.unsubscribed_at");
  });

  it("every other conflict promotes to subscribed and clears unsubscribed_at (single opt-in intact)", () => {
    expect(body).toContain("else 'subscribed'");
    expect(body).toContain("else null");
  });

  it("reports reconfirm off the POST-update status, resubscribed/already off the prior snapshot", () => {
    expect(body).toContain('row.new_status === "pending"');
    expect(body).toContain('row.prior_status === "subscribed" ? "already" : "resubscribed"');
  });
});

describe("confirmSubscriber (F2.3) — a stale link can't resurrect the departed", () => {
  const body = fnBody("confirmSubscriber");

  it("promotes ONLY a pending row (scoped update), setting confirmed_at", () => {
    expect(body).toContain("where id = ${id} and status = 'pending'");
    expect(body).toContain("confirmed_at = now()");
    expect(body).toContain("unsubscribed_at = null");
  });

  it("distinguishes confirmed / already / expired from the actual row state", () => {
    expect(body).toContain('return "confirmed"');
    expect(body).toContain('current_status === "subscribed") return "already"');
    expect(body).toContain('return "expired"');
  });

  it("guards the id shape before touching SQL", () => {
    expect(body).toContain('/^\\d+$/.test(String(id))');
  });
});

describe("subscribe-actions (F2.3) — the reconfirm send is bomb-guarded", () => {
  const actions = readFileSync(join(__dirname, "..", "subscribe-actions.ts"), "utf8");

  it("caps confirm emails per TARGET address before sending", () => {
    expect(actions).toContain('emailBucket("subscribe-confirm"');
    // the cap gates the send; throttled path sends nothing
    expect(actions.indexOf("emailBucket")).toBeLessThan(actions.indexOf("sendConfirmEmail"));
  });

  it("only builds a confirm link when there's a row id", () => {
    expect(actions).toContain("if (id == null)");
  });
});
