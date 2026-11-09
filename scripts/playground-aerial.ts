/**
 * Fetch the April 2025 aerial photo for every playground in PLAYGROUND_FACTS
 * that has one, into public/places/aerial/<slug>.jpg.
 *
 *   npm run playground-aerial              fetch the missing ones
 *   npm run playground-aerial -- --force   re-fetch all (after a pin moves)
 *   npm run playground-aerial -- <slug>    one playground
 *
 * met25 only (lib/playground-facts.ts says why). The photo is centred on the
 * place's pin, which is the playground itself — move the pin, re-run this.
 * The server renders on request; one at a time, a second apart.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeBySlug } from "../lib/places";
import { PLAYGROUND_FACTS, aerialCropUrl, aerialPath } from "../lib/playground-facts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

async function main() {
  const slugs = Object.keys(PLAYGROUND_FACTS).filter(
    (s) => PLAYGROUND_FACTS[s].aerial && (only.length === 0 || only.includes(s)),
  );
  mkdirSync(join("public", "places", "aerial"), { recursive: true });
  for (const slug of slugs) {
    const place = placeBySlug(slug);
    if (!place) throw new Error(`${slug} is not in the registry`);
    const out = join("public", aerialPath(slug));
    if (existsSync(out) && !force) {
      console.log(`  cached  ${out}`);
      continue;
    }
    const { url } = aerialCropUrl(place.lat, place.lng);
    const res = await fetch(url, { headers: { "User-Agent": "citypulsemn-aerial/1.0 (citypulsemn.com)" } });
    const type = res.headers.get("content-type") ?? "";
    // A bad WMS request answers 200 with an XML ServiceException, not an image.
    if (!res.ok || !type.startsWith("image/")) {
      throw new Error(`${slug}: ${res.status} ${type} — ${(await res.text()).slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(out, buf);
    console.log(`  fetched ${out} (${Math.round(buf.length / 1024)} KB)`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
