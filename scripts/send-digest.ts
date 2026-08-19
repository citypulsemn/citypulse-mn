import { sendWeeklyDigest, hasSentDigestToday } from "../lib/digest-send";

/**
 * Weekly digest sender.
 *   npm run digest                          → send
 *   npm run digest -- --dry-run             → compose + log only
 *   npm run digest -- --skip-if-sent-today  → stand down if one already went out
 *
 * The last flag exists for the Thursday-afternoon SAFETY NET run. GitHub's hosted
 * runners dropped the Aug 6 2026 job entirely (never acquired, timed out, zero
 * steps), so the schedule alone is not reliable. The retry re-attempts a few hours
 * later and this guard is what keeps it from ever mailing the list twice.
 *
 * The primary run and manual dispatches do NOT pass the flag, so their behaviour
 * is byte-for-byte what it has always been.
 */
const dryRun = process.argv.includes("--dry-run");
const skipIfSentToday = process.argv.includes("--skip-if-sent-today");

async function main() {
  if (skipIfSentToday && !dryRun) {
    if (await hasSentDigestToday()) {
      console.log("[digest] a send already succeeded today — safety-net run standing down");
      process.exit(0);
    }
    console.log("[digest] no send recorded today — safety-net run proceeding");
  }

  const result = await sendWeeklyDigest({ dryRun });
  console.log("[digest] result:", JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("[digest] fatal:", err);
  process.exit(1);
});
