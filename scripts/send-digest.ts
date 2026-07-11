import { sendWeeklyDigest } from "../lib/digest-send";

/** Weekly digest sender. `npm run digest` sends; `-- --dry-run` logs only. */
const dryRun = process.argv.includes("--dry-run");

sendWeeklyDigest({ dryRun })
  .then((result) => {
    console.log("[digest] result:", JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("[digest] fatal:", err);
    process.exit(1);
  });
