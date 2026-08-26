/**
 * Clear the site's caches by hand.
 *
 *   npm run revalidate                       bust the tag + the public tree
 *   npm run revalidate -- --reason="..."     say why, for the server log
 *   npm run revalidate -- --event=<uuid>     also bust one event page (repeatable)
 *
 * Two jobs. First, it is the smoke test for the whole channel: run it after
 * setting REVALIDATE_SECRET and you know within seconds whether the scripts can
 * reach the site. Second, it is the replacement for pushing an empty deploy
 * after a manual DB change — which is what this project actually used to do
 * (see HOTFIX-sports-phantom-games.md).
 *
 * Exits non-zero when the bust did not happen. That is deliberate and the
 * opposite of the in-pipeline calls: those must never fail their job over a
 * cache (rule 1), but a human running this by hand is ASKING whether it worked.
 */
import { revalidateSite } from "../lib/revalidate-client";

async function main() {
  const arg = (name: string) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

  const reason = arg("reason") || "manual run";
  const eventIds = process.argv
    .filter((a) => a.startsWith("--event="))
    .map((a) => a.slice("--event=".length));

  const target = process.env.REVALIDATE_URL || process.env.SITE_URL || "the production site";
  console.log(`[revalidate] → ${target} · reason: ${reason}`);
  if (eventIds.length) console.log(`[revalidate] plus ${eventIds.length} event page(s)`);

  const out = await revalidateSite(reason, eventIds);
  if (out.ok) {
    console.log("[revalidate] ✓ caches cleared");
    return;
  }
  console.error(`[revalidate] ✗ FAILED${out.status ? ` (HTTP ${out.status})` : ""}: ${out.reason}`);
  if (out.reason?.includes("REVALIDATE_SECRET")) {
    console.error("[revalidate]   set REVALIDATE_SECRET in .env.local (and in Vercel + GitHub Actions)");
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("[revalidate] fatal:", err);
  process.exitCode = 1;
});
