import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Query-text tripwires for the magic-link restore (R0.4). The merge insert
 * shipped with `saver_token` — a real column, but on SUBSCRIBERS, not
 * saved_events — and 500'd the flagship merge-don't-lose case for its whole
 * life. Until the R2.6 schema drift guard exists, these assertions are the
 * mechanical check that saved_events references use its actual key column.
 */
const src = readFileSync(join(__dirname, "..", "saved-restore.ts"), "utf8");

describe("mergeAndRestore (R0.4) — saved_events keys on user_token", () => {
  it("the merge insert targets user_token on both sides", () => {
    expect(src).toContain("insert into saved_events (user_token, event_id)");
    expect(src).toContain("where user_token = ${current}");
  });

  it("saver_token never touches saved_events (it belongs to subscribers)", () => {
    expect(src).not.toMatch(/saved_events \(saver_token/);
    expect(src).not.toMatch(/from saved_events\s*\n?\s*where saver_token/);
    // subscribers.saver_token is legitimate and must stay:
    expect(src).toContain("insert into subscribers (email, source, status, saver_token)");
  });
});

describe("requestSavedLink (R2.7) — merge-on-request, merge BEFORE repoint", () => {
  const body = src.slice(
    src.indexOf("export async function requestSavedLink"),
    src.indexOf("export type RestoreResult"),
  );

  it("folds the prior device's list into this token (the union survives)", () => {
    expect(body).toContain("where user_token = ${priorToken}");
    expect(body).toContain("on conflict do nothing");
  });

  it("the merge runs BEFORE the subscribers upsert — a failure never orphans a list", () => {
    const merge = body.indexOf("insert into saved_events");
    const repoint = body.indexOf("insert into subscribers");
    expect(merge).toBeGreaterThan(-1);
    expect(merge).toBeLessThan(repoint);
  });

  it("only a genuinely different prior token triggers the merge", () => {
    expect(body).toContain("priorToken && priorToken !== token");
  });
});
