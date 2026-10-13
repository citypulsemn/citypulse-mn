/**
 * Still-card publisher — posts today's card to Instagram at its slot (11:45).
 * A separate script from the reel publisher on purpose: a flag on a shared
 * script is one typo away from posting the wrong thing. The decisions are the
 * reel publisher's own (lib/reels/publish/publisher.ts: HOLD files, the
 * published.json ledger, the slot, the deleted-file veto) plus the card's two
 * (lib/reels/cards/card-day.ts: today's card, built today). This file is glue.
 *
 *   npm run cards:publish                 publish today's card if it is due
 *   npm run cards:publish -- --dry-run    the full chain except the final
 *                                         publish call; no ledger write; the
 *                                         slot is ignored
 *   npm run cards:publish -- --dry-run --date=2026-10-14
 *                                         rehearse a card built ahead with
 *                                         `npm run cards -- --date=…`.
 *                                         --date is refused without --dry-run:
 *                                         a real post is always today's.
 *
 * The bare "--" matters: without it npm keeps the flags and the script would
 * start as a real publish. It checks for that and refuses.
 *
 * Scheduled twice on Wednesdays (11:45 and 18:30): the second firing is the
 * catch-up, and a no-op once the ledger shows the card posted.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chiDayKey } from "../../lib/clock";
import { cardManifestRefusal, isCardDay } from "../../lib/reels/cards/card-day";
import { CARD_SLOT } from "../../lib/reels/cards/types";
import { swallowedFlagsMessage } from "../../lib/reels/cli";
import { cardDirFor } from "../../lib/reels/paths";
import { makeSupabaseHost, randomSuffix } from "../../lib/reels/publish/host";
import { makeContainerWaiter, makeInstagramClient } from "../../lib/reels/publish/instagram";
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

const argOf = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** The shared gate speaks in reels, videos and variants; a card email must not. */
const cardWords = (s: string) =>
  s
    .replace("Reels publish", "Card publish")
    .replace(/^family: /, "card: ")
    .replace("video file deleted", "card image deleted");

async function main() {
  // `npm run cards:publish --dry-run` (no bare "--") would be a REAL publish.
  const kept = swallowedFlagsMessage("cards:publish", ["dry-run", "date"]);
  if (kept) {
    console.error(`[cards:publish] ${kept}`);
    // Emailed as well: if this ever fires in a scheduled run, nothing else would say so.
    await sendOpsEmail({ subject: "Card publish: refused to run", lines: [kept] });
    process.exit(2);
  }

  const dryRun = process.argv.includes("--dry-run");
  const dateArg = argOf("date");
  if (dateArg && !dryRun) {
    // A typo at the keyboard, not a crash: say so here and send no email.
    console.error("[cards:publish] --date only works with --dry-run — a real post is always today's card");
    process.exit(2);
  }

  const now = new Date();
  const today = dateArg ?? chiDayKey(now);
  const dir = cardDirFor(today);
  const label = `card ${today}`;
  const warnings: string[] = [];

  // Token first, every firing — publish runs are also the 60-day keep-alive.
  const token = await ensureFreshToken(TOKEN_PATH, now, undefined, warnings).catch(
    async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cards:publish] token: ${msg}`);
      await sendOpsEmail({
        subject: `Card publish (${label}): token failure`,
        lines: [msg, "Nothing was posted. If a card was built today it is still in its folder:", dir],
      });
      process.exit(1);
    },
  );

  const manifest = loadManifest(dir);
  if (!manifest) {
    if (!isCardDay(today)) {
      console.log(`[cards:publish] ${today} is not a Wednesday and has no card — nothing to do`);
      return;
    }
    const msg = `no readable manifest.json in ${dir} — did the 6:30 card generation run?`;
    console.error(`[cards:publish] ${msg}`);
    await sendOpsEmail({ subject: `Card publish (${label}): nothing to publish`, lines: [msg] });
    process.exit(1);
  }
  const refusal = cardManifestRefusal(manifest, today, dryRun);
  if (refusal) {
    const msg = `not posting the card in ${dir}: ${refusal}`;
    console.error(`[cards:publish] ${msg}`);
    await sendOpsEmail({
      subject: `Card publish (${label}): refused`,
      lines: [msg, "To build and post today's card by hand: npm run cards, then npm run cards:publish"],
    });
    process.exit(1);
  }

  const slot = dryRun ? "00:00" : CARD_SLOT; // a rehearsal tests the chain, not the clock
  const plan = planPublish(
    manifest,
    loadLedger(dir),
    detectHolds(dir),
    { regular: slot, family: slot, weird: slot },
    now,
    { fileExists: existsSync },
  );

  if (!plan.some((p) => p.action === "publish")) {
    for (const p of plan) console.log(`[cards:publish] ${p.action} — ${cardWords(p.reason)}`);
    const held = plan.filter((p) => p.action === "hold");
    if ((held.length || warnings.length) && !dryRun) {
      const summary = summarizeForOps(
        plan.map((p) => ({
          variant: p.variant,
          outcome: p.action === "hold" ? ("held" as const) : p.action === "wait" ? ("waiting" as const) : ("skipped" as const),
          detail: p.reason,
        })),
        label,
        warnings,
      );
      if (summary) {
        const sent = await sendOpsEmail({ subject: cardWords(summary.subject), lines: summary.lines.map(cardWords) });
        console.log(`[cards:publish] ops summary ${sent}`);
      }
    }
    console.log(`[cards:publish] done — ${dir}${dryRun ? " (DRY RUN)" : ""}`);
    return;
  }

  const altFile = path.join(dir, "alt.txt");
  const altText = existsSync(altFile) ? readFileSync(altFile, "utf8").trim() : "";
  if (!altText) warnings.push("alt.txt is missing or empty — the card posts without alt text");
  const client = makeInstagramClient(token.accessToken);
  const host = makeSupabaseHost();
  await host.ensureBucket();

  const results = await executePlan(plan, manifest, dir, {
    files: dryRun
      ? { ...defaultPublisherFsDeps, writeFile: () => {} } // no ledger writes
      : defaultPublisherFsDeps,
    readCaption: (f) => {
      const caption = readFileSync(f, "utf8").trim();
      if (!caption) throw new Error(`${f} is empty — a card never posts without its caption`);
      return caption;
    },
    // Its own name: the manifest's "monday" and "family" are shims that mean nothing here.
    buildObjectName: () => `${today}_card_${randomSuffix()}.jpg`,
    host,
    ig: {
      // The gate's "reel container" slot carries an image container here.
      createReelContainer: (imageUrl, caption) =>
        client.createImageContainer(token.igUserId, { imageUrl, caption, altText: altText || undefined }),
      publish: dryRun
        ? async (containerId) => `dry-run:${containerId}`
        : (containerId) => client.publish(token.igUserId, containerId),
    },
    // An image is ready in seconds; the reels' one-minute polling would idle.
    waitForContainer: makeContainerWaiter(client, { intervalMs: 5_000, maxAttempts: 12 }),
    now: () => new Date(),
  });

  for (const r of results) {
    console.log(
      `[cards:publish] ${r.outcome}${dryRun && r.outcome === "published" ? " (DRY RUN — not actually posted)" : ""} — ${r.detail}`,
    );
  }
  for (const w of warnings) console.warn(`[cards:publish] ${w}`);
  const summary = dryRun ? null : summarizeForOps(results, label, warnings);
  if (summary) {
    const sent = await sendOpsEmail({ subject: cardWords(summary.subject), lines: summary.lines.map(cardWords) });
    console.log(`[cards:publish] ops summary ${sent}`);
  }
  if (results.some((r) => r.outcome === "failed")) process.exitCode = 1;
  console.log(`[cards:publish] done — ${dir}${dryRun ? " (DRY RUN)" : ""}`);
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  async (err) => {
    console.error("[cards:publish] fatal:", err);
    // Nobody reads this log on a Wednesday; a crash has to reach the inbox.
    await sendOpsEmail({
      subject: "Card publish: crashed before posting",
      lines: [err instanceof Error ? err.message : String(err)],
    });
    process.exit(1);
  },
);
