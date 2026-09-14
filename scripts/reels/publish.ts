/**
 * Reels publisher — posts a generated day's reels to Instagram at their
 * slots (regular 8:30 AM, family 11:45 AM, weird 6:30 PM). Architecture and
 * locked decisions: docs/REELS-PUBLISH.md. All decisions live in
 * lib/reels/publish/publisher.ts — this file is glue.
 *
 *   npm run reels:publish                    publish whatever is due now
 *   npm run reels:publish -- --dry-run       full chain except media_publish;
 *                                            no ledger writes
 *   npm run reels:publish -- --only=regular  restrict to one variant
 *   npm run reels:publish -- --force-held    publish authenticity-waived holds
 *                                            (HOLD files still always win)
 *   npm run reels:publish -- --day-dir=PATH  explicit day folder (testing)
 *
 * Scheduled via Task Scheduler with triggers at each slot time — each firing
 * publishes anything due and unposted, so a missed trigger is caught by the
 * next one. Every run also keeps the 60-day Instagram token fresh.
 */
import { existsSync, readFileSync } from "node:fs";
import { defaultPostDay, buildWeekWindow } from "../../lib/reels/keys";
import { dayDirFor } from "../../lib/reels/paths";
import type { Variant } from "../../lib/reels/types";
import { VARIANTS } from "../../lib/reels/types";
import { makeSupabaseHost, objectNameFor } from "../../lib/reels/publish/host";
import {
  makeContainerWaiter,
  makeInstagramClient,
} from "../../lib/reels/publish/instagram";
import { sendOpsEmail } from "../../lib/reels/publish/notify";
import {
  defaultPublisherFsDeps,
  detectHolds,
  executePlan,
  loadLedger,
  loadManifest,
  planPublish,
  summarizeForOps,
} from "../../lib/reels/publish/publisher";
import { TOKEN_PATH, ensureFreshToken } from "../../lib/reels/publish/token";
import { DEFAULT_SLOTS } from "../../lib/reels/publish/types";

const argOf = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const forceHeld = process.argv.includes("--force-held");
  const only = argOf("only") as Variant | null;
  if (only && !VARIANTS.includes(only)) throw new Error(`--only must be one of ${VARIANTS.join("|")}`);

  const now = new Date();
  const day = defaultPostDay(now);
  const window = buildWeekWindow(now, day);
  const dayDir = argOf("day-dir") ?? dayDirFor(window.start, day);
  const dayLabel = `${day} ${window.start}`;

  const warnings: string[] = [];

  // Token first, every trigger — publish runs are also the 60-day keep-alive.
  const token = await ensureFreshToken(TOKEN_PATH, now, undefined, warnings).catch(
    async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[publish] token: ${msg}`);
      await sendOpsEmail({
        subject: `Reels publish (${dayLabel}): token failure`,
        lines: [msg, "Reels are generated and sit in the day folder — postable manually."],
      });
      process.exit(1);
    },
  );

  const manifest = loadManifest(dayDir);
  if (!manifest) {
    const msg = `no readable manifest.json in ${dayDir} — did the 6:30 generation run?`;
    console.error(`[publish] ${msg}`);
    await sendOpsEmail({ subject: `Reels publish (${dayLabel}): nothing to publish`, lines: [msg] });
    process.exit(1);
  }

  const holds = detectHolds(dayDir);
  const ledger = loadLedger(dayDir);
  const baseOpts = { forceHeld, fileExists: existsSync };
  let plan = planPublish(manifest, ledger, holds, DEFAULT_SLOTS, now, baseOpts);

  const wantsPublish = plan.some(
    (p) => p.action === "publish" && (!only || p.variant === only),
  );

  if (wantsPublish) {
    const client = makeInstagramClient(token.accessToken);
    // Quota is an aux check — a failure to READ it must not block publishing.
    try {
      const quotaUsage = await client.getQuotaUsage(token.igUserId);
      plan = planPublish(manifest, ledger, holds, DEFAULT_SLOTS, now, {
        ...baseOpts,
        quotaUsage,
      });
    } catch (err) {
      warnings.push(
        `quota check failed (${err instanceof Error ? err.message : String(err)}) — proceeded without it`,
      );
    }

    if (only) {
      plan = plan.map((p) =>
        p.variant === only || p.action !== "publish"
          ? p
          : { ...p, action: "skip" as const, reason: `not in --only=${only}` },
      );
    }

    const host = makeSupabaseHost();
    await host.ensureBucket();

    const results = await executePlan(plan, manifest, dayDir, {
      files: dryRun
        ? { ...defaultPublisherFsDeps, writeFile: () => {} } // no ledger writes
        : defaultPublisherFsDeps,
      readCaption: (f) => readFileSync(f, "utf8").trim(),
      buildObjectName: objectNameFor,
      host,
      ig: {
        createReelContainer: (videoUrl, caption) =>
          client.createReelContainer(token.igUserId, { videoUrl, caption }),
        publish: dryRun
          ? async (containerId) => `dry-run:${containerId}`
          : (containerId) => client.publish(token.igUserId, containerId),
      },
      waitForContainer: makeContainerWaiter(client),
      now: () => new Date(),
    });

    for (const r of results) {
      console.log(`[publish] ${r.variant}: ${r.outcome}${dryRun && r.outcome === "published" ? " (DRY RUN — not actually posted)" : ""} — ${r.detail}`);
    }
    const summary = dryRun ? null : summarizeForOps(results, dayLabel, warnings);
    if (summary) {
      const sent = await sendOpsEmail(summary);
      console.log(`[publish] ops summary ${sent}`);
    }
    if (results.some((r) => r.outcome === "failed")) process.exitCode = 1;
  } else {
    for (const p of only ? plan.filter((x) => x.variant === only) : plan) {
      console.log(`[publish] ${p.variant}: ${p.action} — ${p.reason}`);
    }
    const held = plan.filter((p) => p.action === "hold");
    if ((held.length || warnings.length) && !dryRun) {
      const summary = summarizeForOps(
        plan.map((p) => ({
          variant: p.variant,
          outcome: p.action === "hold" ? ("held" as const) : ("skipped" as const),
          detail: p.reason,
        })),
        dayLabel,
        warnings,
      );
      if (summary) console.log(`[publish] ops summary ${await sendOpsEmail(summary)}`);
    }
  }

  console.log(`[publish] done — ${dayDir}${dryRun ? " (DRY RUN)" : ""}`);
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("[publish] fatal:", err);
    process.exit(1);
  },
);
