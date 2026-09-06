/**
 * Find places we are MISSING, exhaustively, for one kind.
 *
 *   npx tsx scripts/places-candidates.ts disc-golf
 *   npx tsx scripts/places-candidates.ts rink --near=250
 *
 * Asks OpenStreetMap (Overpass) for every feature of a kind inside METRO_BOX,
 * then subtracts what the registry already has — by proximity, not by name,
 * because "Bryant Lake Regional Park DGC" and "Bryant Lake Disc Golf" are the
 * same course and a name match would miss it.
 *
 * WHAT THIS IS AND IS NOT. It is a WORKLIST: OSM is community data, so a hit
 * here is a lead, not a fact. Nothing it prints goes into the registry
 * unchecked — each entry still needs its own authoritative source page and a
 * `verifiedAt` date, which is the whole honesty contract of `lib/places.ts`.
 * What OSM buys is the one thing search cannot: a defensible claim that we
 * looked at EVERY feature in the box rather than the ones that happened to
 * surface.
 */
import { PLACES, METRO_BOX, type PlaceKind } from "../lib/places";
import { distanceMeters } from "../lib/geo-distance";

const ENDPOINT = "https://overpass-api.de/api/interpreter";

/**
 * Overpass selectors per kind. Several kinds need more than one tag — a
 * community ice rink is `leisure=ice_rink`, but a municipal arena is often
 * tagged `sport=ice_hockey` on a building, and missing those is how a "complete"
 * sweep quietly isn't.
 */
const SELECTORS: Partial<Record<PlaceKind, string[]>> = {
  "disc-golf": ['["leisure"="disc_golf_course"]', '["sport"="disc_golf"]'],
  "dog-park": ['["leisure"="dog_park"]'],
  rink: ['["leisure"="ice_rink"]', '["sport"="ice_hockey"]'],
  pool: ['["leisure"="swimming_pool"]["access"!="private"]', '["leisure"="water_park"]'],
  museum: ['["tourism"="museum"]'],
  garden: ['["leisure"="garden"]["garden:type"!="residential"]', '["tourism"="garden"]'],
  "nature-center": ['["leisure"="nature_reserve"]', '["amenity"="nature_center"]'],
  beach: ['["natural"="beach"]', '["leisure"="beach_resort"]'],
  "splash-pad": ['["leisure"="water_park"]', '["amenity"="fountain"]["fountain"="splash_pad"]'],
  "ski-hill": ['["landuse"="winter_sports"]', '["piste:type"="downhill"]'],
  orchard: ['["landuse"="orchard"]', '["shop"="farm"]'],
  "golf-course": ['["leisure"="golf_course"]'],
  playground: ['["leisure"="playground"]'],
  park: ['["leisure"="park"]'],
  "farmers-market": ['["amenity"="marketplace"]'],
  sledding: ['["piste:type"="sled"]', '["leisure"="sledding"]'],
  "indoor-playground": ['["leisure"="indoor_play"]'],
  "trampoline-climbing": ['["leisure"="trampoline_park"]', '["sport"="climbing"]'],
};

interface Candidate {
  name: string;
  lat: number;
  lng: number;
  city: string;
  website: string;
  tags: Record<string, string>;
}

async function overpass(selectors: string[]): Promise<Candidate[]> {
  const bbox = `${METRO_BOX.minLat},${METRO_BOX.minLng},${METRO_BOX.maxLat},${METRO_BOX.maxLng}`;
  const parts = selectors
    .flatMap((sel) => [`node${sel}(${bbox});`, `way${sel}(${bbox});`, `relation${sel}(${bbox});`])
    .join("");
  const query = `[out:json][timeout:180];(${parts});out center tags;`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      // Overpass 406s a request with no descriptive User-Agent.
      "User-Agent": "citypulsemn-places/1.0 (Twin Cities place directory; https://citypulsemn.com)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { elements?: Record<string, unknown>[] };

  const out: Candidate[] = [];
  for (const el of data.elements ?? []) {
    const lat = (el.lat as number) ?? (el.center as { lat?: number } | undefined)?.lat;
    const lon = (el.lon as number) ?? (el.center as { lon?: number } | undefined)?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const tags = (el.tags ?? {}) as Record<string, string>;
    out.push({
      name: (tags.name ?? "").trim(),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lon * 1e5) / 1e5,
      city: (tags["addr:city"] ?? "").trim(),
      website: (tags.website ?? tags["contact:website"] ?? "").trim(),
      tags,
    });
  }
  return out;
}

async function main() {
  const kind = process.argv[2] as PlaceKind;
  const nearArg = process.argv.find((a) => a.startsWith("--near="));
  const NEAR_M = nearArg ? Number(nearArg.slice(7)) : 400;

  const selectors = SELECTORS[kind];
  if (!selectors) {
    console.error(`no OSM selector for "${kind}". Known: ${Object.keys(SELECTORS).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const have = PLACES.filter((p) => p.kind === kind);
  console.log(`[candidates] ${kind}: registry has ${have.length}; asking OSM for the whole box…`);

  const found = await overpass(selectors);
  // Unnamed features are noise for a directory — a place a reader cannot be told
  // the name of is not a listing (the same rule the events pipeline follows).
  const named = found.filter((c) => c.name.length > 1);

  const missing = named.filter(
    (c) => !have.some((p) => distanceMeters(p.lat, p.lng, c.lat, c.lng) < NEAR_M),
  );
  // Dedupe OSM's own node/way/relation overlaps for the same feature.
  const uniq: Candidate[] = [];
  for (const c of missing) {
    if (uniq.some((u) => distanceMeters(u.lat, u.lng, c.lat, c.lng) < NEAR_M)) continue;
    uniq.push(c);
  }

  console.log(
    `[candidates] OSM returned ${found.length} (${named.length} named); ` +
      `${uniq.length} not already in the registry within ${NEAR_M}m\n`,
  );
  uniq.sort((a, b) => (a.city || "zzz").localeCompare(b.city || "zzz") || a.name.localeCompare(b.name));
  for (const c of uniq) {
    console.log(
      `  ${c.name}\n    ${c.lat},${c.lng}  ${c.city || "(no city tag)"}  ${c.website || ""}`,
    );
  }
  console.log(`\n[candidates] ${uniq.length} leads — each still needs a real source page before it is listed.`);
}

main().catch((err) => {
  console.error("[candidates] fatal:", err);
  process.exitCode = 1;
});
