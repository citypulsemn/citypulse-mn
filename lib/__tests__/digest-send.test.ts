import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendWeeklyDigest } from "../digest-send";

/**
 * R2.2 — a missing RESEND_API_KEY must turn the digest workflow RED.
 * The old code folded the missing key into the dry-run branch: ok true,
 * exit 0, green workflow, zero subscribers mailed.
 */

const saved = process.env.RESEND_API_KEY;
beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});
afterEach(() => {
  if (saved === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = saved;
});

describe("sendWeeklyDigest without RESEND_API_KEY", () => {
  it("a REAL run fails: ok false, honestly not a dry run, nothing counted as sent", async () => {
    const result = await sendWeeklyDigest({ dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.sent).toBe(0);
    expect(result.note).toContain("no RESEND_API_KEY");
  });

  it("a DRY run stays green — rehearsing without a key is legitimate", async () => {
    const result = await sendWeeklyDigest({ dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.sent).toBe(0);
  });
});

describe("wiring tripwires", () => {
  const src = readFileSync(join(__dirname, "..", "digest-send.ts"), "utf8");

  it("the key check fires BEFORE any composition (no DB work on a doomed run)", () => {
    expect(src.indexOf("!dryRun && !apiKey")).toBeGreaterThan(-1);
    expect(src.indexOf("!dryRun && !apiKey")).toBeLessThan(src.indexOf("digestEvents("));
  });

  it("the old fold — missing key treated as dry-run — is gone", () => {
    expect(src).not.toContain("dryRun || !apiKey");
  });

  it("the runner script exits nonzero when ok is false", () => {
    const script = readFileSync(
      join(__dirname, "..", "..", "scripts", "send-digest.ts"),
      "utf8",
    );
    expect(script).toContain("process.exit(result.ok ? 0 : 1)");
  });
});

describe("R2.7 — digest_sends bookkeeping honesty", () => {
  const src = readFileSync(join(__dirname, "..", "digest-send.ts"), "utf8");
  const recordBody = src.slice(src.indexOf("async function record"));

  it("dry runs leave NO row (a rehearsal must never pose as the last digest)", () => {
    const skip = recordBody.indexOf("if (result.dryRun) return result;");
    const insert = recordBody.indexOf("insert into digest_sends");
    expect(skip).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(insert);
  });

  it("the recipients column records ATTEMPTED, not the possibly-partial sent count", () => {
    expect(recordBody).toContain("values (${result.attempted}");
    expect(recordBody).not.toContain("values (${result.sent}");
  });

  it("a partial failure names how far it got", () => {
    expect(src).toContain("sent ${sent} of ${recipients.length} before failure");
  });
});

describe("the Thursday safety-net run (Aug 6 2026 no-show)", () => {
  const ROOT = join(__dirname, "..", "..");
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const wf = read(".github/workflows/weekly-digest.yml");
  const script = read("scripts/send-digest.ts");
  const lib = read("lib/digest-send.ts");

  it("schedules a second attempt a few hours after the primary", () => {
    expect(wf).toContain('cron: "0 15 * * 4"'); // the real send
    expect(wf).toContain('cron: "0 20 * * 4"'); // the safety net
  });

  it("ONLY the safety-net schedule passes the guard flag", () => {
    // The primary run and every manual dispatch must behave exactly as before.
    expect(wf).toContain("IS_SAFETY_NET: ${{ github.event.schedule == '0 20 * * 4' }}");
    expect(wf).toMatch(/IS_SAFETY_NET" = "true" \]; then ARGS="\$ARGS --skip-if-sent-today"/);
  });

  it("the timeout is high enough to survive a slow runner acquisition", () => {
    // Aug 6 wasn't slow — it never started, and a 15-minute ceiling cancelled it
    // while it was still queued.
    expect(wf).toContain("timeout-minutes: 30");
    expect(wf).not.toContain("timeout-minutes: 15");
  });

  it("the guard runs BEFORE the send, and only when the flag is passed", () => {
    const guardAt = script.indexOf("hasSentDigestToday()");
    const sendAt = script.indexOf("sendWeeklyDigest(");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(sendAt);
    expect(script).toContain("skipIfSentToday && !dryRun"); // a dry run still previews
  });

  it("the guard FAILS SAFE — an unreadable check stands down rather than risk a duplicate", () => {
    // Deliberately the opposite of rateAllow's fail-open: a false negative here
    // would mail the whole list twice, and that cannot be un-sent.
    expect(lib).toMatch(/catch \(err\)[\s\S]{0,220}return true;/);
    expect(lib).toMatch(/if \(!sql\)[\s\S]{0,160}return true;/);
    expect(lib).toContain("standing down");
  });

  it("a dry run is never counted as a send by the guard", () => {
    expect(lib).toMatch(/ok = true and recipients > 0[\s\S]{0,200}America\/Chicago/);
  });
});
