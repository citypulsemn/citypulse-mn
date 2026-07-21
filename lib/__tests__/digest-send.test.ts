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
