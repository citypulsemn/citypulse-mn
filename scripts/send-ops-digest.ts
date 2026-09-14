/**
 * Ops digest sender (roadmap 2.1). Gather → compose → send → record baseline.
 *
 * THE RESILIENCE CONTRACT: every gather is independently caught; a failed
 * source becomes an "unavailable" section, never a dead email. The one thing
 * that fails LOUDLY is the send itself (exit 1) — per the 5.4 lesson, infra
 * failures are reported honestly, not swallowed.
 *
 * Usage: npm run ops-digest [-- --dry-run]
 */
import { sql } from "../lib/db";
import { composeOpsDigest } from "../lib/ops-digest";
// The gather moved to lib/ so /admin/ops can render the same inputs through
// the same formatter. One gatherer, one formatter, no drift.
import { gatherOpsInputs } from "../lib/ops-inputs";

const dryRun = process.argv.includes("--dry-run");
async function main() {
  const inputs = await gatherOpsInputs();
  const { subject, html, text } = composeOpsDigest(inputs, new Date());

  console.log(`[ops-digest] ${subject}`);
  console.log(text);

  if (dryRun) {
    console.log("[ops-digest] dry run — not sending, not recording");
    return;
  }

  const to = process.env.OPS_DIGEST_TO;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM;
  if (!to || !key || !from) {
    console.error("[ops-digest] missing OPS_DIGEST_TO / RESEND_API_KEY / DIGEST_FROM");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error(`[ops-digest] send FAILED: ${res.status} ${await res.text()}`);
    process.exit(1); // loud, per the 5.4 lesson
  }
  console.log("[ops-digest] sent ✓");

  // R2.3 — never write a poisoned baseline: if engagement failed this run,
  // the last GOOD baseline stands and next week compares against that.
  if (inputs.errors.engagement) {
    console.warn("[ops-digest] engagement failed this run — baseline NOT written (last good baseline stands)");
  } else if (sql) {
    try {
      // Baseline for next week's WoW: engagement totals + sitemap size in one
      // jsonb (additive key — old rows without sitemap_urls read as null,
      // which wowLabel renders as "first report").
      const baseline = {
        ...inputs.engagement.totals,
        sitemap_urls: inputs.sitemapUrls ?? undefined,
        // F2.4 — additive key; absent on old rows → next-week WoW "first report".
        search_impressions: inputs.search?.impressions ?? undefined,
      };
      await sql`insert into ops_digest_runs (totals) values (${sql.json(baseline)})`;
      console.log("[ops-digest] WoW baseline recorded");
    } catch (err) {
      console.error("[ops-digest] baseline record failed (email already sent):", err);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
