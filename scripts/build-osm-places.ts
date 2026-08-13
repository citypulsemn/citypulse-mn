/**
 * Build the "every one" OSM bulk layers for the Places map (F2.7 hybrid).
 *
 * Queries the OpenStreetMap Overpass API for a `leisure=*` feature across the
 * metro bounding box and writes a compact GeoJSON FeatureCollection to
 * public/osm/<kind>.json. These are COMMUNITY data (unverified, mostly
 * name-only) — the map renders them as a zoom-gated layer clearly labeled as
 * OpenStreetMap, distinct from the hand-verified registry. Regenerate manually
 * (`npx tsx scripts/build-osm-places.ts playground`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Metro bounding box: S,W,N,E (matches the registry drift-guard box).
const BBOX = "44.5,-94.0,45.4,-92.6";
const ENDPOINT = "https://overpass-api.de/api/interpreter";

// leisure value per Places kind we bulk-map.
const LEISURE: Record<string, string> = { playground: "playground", park: "park" };

async function main() {
  const kind = process.argv[2] || "playground";
  const leisure = LEISURE[kind];
  if (!leisure) throw new Error(`no OSM mapping for kind "${kind}"`);

  const query = `[out:json][timeout:180];(node["leisure"="${leisure}"](${BBOX});way["leisure"="${leisure}"](${BBOX}););out center tags;`;
  console.log(`Querying Overpass for leisure=${leisure} in the metro…`);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      // Overpass 406s requests without a descriptive User-Agent.
      "User-Agent": "citypulsemn-places/1.0 (Twin Cities place directory; https://citypulsemn.com)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { elements?: Array<Record<string, unknown>> };
  const elements = data.elements ?? [];

  const seen = new Set<string>();
  const features: Array<{ type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { name: string } }> = [];
  for (const el of elements) {
    const lat = (el.lat as number) ?? (el.center as { lat?: number } | undefined)?.lat;
    const lon = (el.lon as number) ?? (el.center as { lon?: number } | undefined)?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const lng = Math.round(lon * 1e5) / 1e5;
    const la = Math.round(lat * 1e5) / 1e5;
    const key = `${lng},${la}`;
    if (seen.has(key)) continue; // dedupe node+way overlaps
    seen.add(key);
    const name = ((el.tags as { name?: string } | undefined)?.name || "").slice(0, 80);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, la] }, properties: { name } });
  }

  const fc = { type: "FeatureCollection", features };
  const dir = join(process.cwd(), "public", "osm");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${kind}.json`);
  writeFileSync(out, JSON.stringify(fc));
  const named = features.filter((f) => f.properties.name).length;
  console.log(`OSM ${kind}: ${elements.length} elements → ${features.length} points (${named} named). Wrote ${out} (${(JSON.stringify(fc).length / 1024).toFixed(0)} KB).`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
