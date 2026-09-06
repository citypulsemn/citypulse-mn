/**
 * Fill in the coordinates a research draft is missing.
 *
 *   npx tsx scripts/places-geocode-draft.ts drafts/rink.ts
 *
 * `research-places` leaves `lat: 0, lng: 0` behind a TODO comment whenever the
 * agent would not commit to coordinates — omitting is allowed, guessing is not.
 * This fills those in from Nominatim (OpenStreetMap's geocoder), which is free,
 * needs no key, and is a SECOND provider: where the agent did supply
 * coordinates, disagreement between the two is worth looking at.
 *
 * A result outside METRO_BOX is reported and NOT written. That is the check
 * that catches "Central Park" resolving to Manhattan.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inMetroBox } from "../lib/places";

const UA = "citypulsemn-places/1.0 (Twin Cities place directory; https://citypulsemn.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const field = (block: string, key: string) =>
  (block.match(new RegExp(`${key}: "([^"]*)"`)) ?? [])[1] ?? "";

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { lat: string; lon: string }[];
  if (!j.length) return null;
  return {
    lat: Math.round(Number(j[0].lat) * 1e5) / 1e5,
    lng: Math.round(Number(j[0].lon) * 1e5) / 1e5,
  };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: places-geocode-draft <draft.ts>");
  const src = readFileSync(path, "utf8");
  const head = src.slice(0, src.indexOf("  {"));
  const blocks = src
    .slice(src.indexOf("  {"))
    .split(/\n(?=  \{)/)
    .filter((b) => b.trim());

  const out: string[] = [];
  let filled = 0;
  let missed = 0;
  for (let b of blocks) {
    const name = field(b, "name");
    const city = field(b, "city");
    const address = field(b, "address");
    if (!/TODO coords/.test(b)) {
      out.push(b);
      continue;
    }
    // Address first — a street address geocodes far better than a facility name.
    // But agents usually return a FULL address already, and appending the city
    // and state again produces "…, Farmington, MN 55024, Farmington, MN", which
    // Nominatim simply fails to match. Only add what is missing.
    const hasCity = address.toLowerCase().includes(city.toLowerCase());
    const hasState = /\b(MN|Minnesota)\b/i.test(address);
    const query = address
      ? [address, hasCity ? "" : city, hasState ? "" : "MN"].filter(Boolean).join(", ")
      : `${name}, ${city}, Minnesota`;
    const hit = await geocode(query);
    await sleep(1100); // Nominatim policy: at most one request a second.
    if (!hit) {
      console.log(`  MISS  ${name}  (${query})`);
      missed++;
      out.push(b);
      continue;
    }
    if (!inMetroBox(hit)) {
      console.log(`  OUT   ${name}  ${hit.lat},${hit.lng} — outside the box, left for a human`);
      missed++;
      out.push(b);
      continue;
    }
    console.log(`  ok    ${name}  ${hit.lat},${hit.lng}`);
    b = b.replace(
      /\s*\/\/ TODO coords[^\n]*\n\s*lat: 0,\n\s*lng: 0,/,
      `\n    lat: ${hit.lat},\n    lng: ${hit.lng},`,
    );
    filled++;
    out.push(b);
  }

  const joined = head + out.join("\n");
  writeFileSync(path, joined);
  console.log(`\nfilled ${filled}, still missing ${missed}`);
}

main().catch((err) => {
  console.error("[geocode-draft] fatal:", err);
  process.exitCode = 1;
});
