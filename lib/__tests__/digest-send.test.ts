import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sendWeeklyDigest } from "../digest-send";
import { RUN_BUDGET_MS } from "../verify";

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
    // Anchor is splitDigestEvents() since the week was split into two halves;
    // the property is unchanged — no event selection before the key check.
    const compose = src.indexOf("splitDigestEvents(");
    expect(compose).toBeGreaterThan(-1);
    expect(src.indexOf("!dryRun && !apiKey")).toBeLessThan(compose);
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
    // while it was still queued. This ceiling is QUEUE SLACK, not run time.
    //
    // The verify step now runs inside this job, so the slack is what is LEFT
    // after verification's own budget. Asserting a literal number here would
    // have passed a 30-minute ceiling with a 20-minute verify step inside it —
    // ~9 minutes of slack, quietly re-creating the Aug 6 failure. Assert the
    // relationship instead.
    const timeout = Number(wf.match(/timeout-minutes:\s*(\d+)/)?.[1]);
    expect(timeout).toBeGreaterThan(0);

    const verifyBudgetMin = RUN_BUDGET_MS / 60_000;
    const slack = timeout - verifyBudgetMin;
    // 29 = the slack this job had before the verify step existed (30 minus a
    // ~1-minute healthy send). Never regress below what Aug 6 bought us.
    expect(slack).toBeGreaterThanOrEqual(29);
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

/**
 * Verification must happen BEFORE the email, and cron cannot promise that —
 * this repo has seen the scheduler drift by up to +3h52m. The ordering is a
 * step order inside one job, which is why it is worth a drift guard: someone
 * "tidying" these two steps apart would silently restore the old failure.
 */
describe("the digest verifies before it sends", () => {
  const wf = readFileSync(
    join(__dirname, "..", "..", ".github/workflows/weekly-digest.yml"),
    "utf8",
  );
  const verifyAt = wf.indexOf("name: Verify upcoming events before sending");
  const sendAt = wf.indexOf("name: Send weekly digest");

  it("runs the verify step, ahead of the send step", () => {
    expect(verifyAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(sendAt);
  });

  it("a failed verification never costs the list its email", () => {
    // Unverified content is a worse-than-usual digest. No digest is a missed
    // week — the exact failure this workflow was rebuilt around in August.
    const step = wf.slice(verifyAt, sendAt);
    expect(step).toContain("continue-on-error: true");
  });

  it("skips the safety-net run and dry runs", () => {
    const step = wf.slice(verifyAt, sendAt);
    // The primary already verified; a second full pass five hours later would
    // spend its budget re-checking rows it just confirmed.
    expect(step).toContain("github.event.schedule != '0 20 * * 4'");
    // A preview must not write verified_at.
    expect(step).toContain("github.event.inputs.dry_run != 'true'");
  });

  it("has the key it needs to call the agent", () => {
    const step = wf.slice(verifyAt, sendAt);
    expect(step).toContain("ANTHROPIC_API_KEY");
    expect(step).toContain("DATABASE_URL");
  });

  it("no longer pays for a second full pass an hour later", () => {
    // The Thursday cron moved into this workflow. Leaving it in verify-events
    // would run a full pass an hour after this one already ran.
    const verifyWf = readFileSync(
      join(__dirname, "..", "..", ".github/workflows/verify-events.yml"),
      "utf8",
    );
    const crons = [...verifyWf.matchAll(/- cron: "([^"]+)"/g)].map((m) => m[1]);
    expect(crons).toEqual(["0 12 * * 1"]);
  });
});
