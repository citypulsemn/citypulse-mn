/**
 * Re-geocode every place from its own address with two independent providers
 * and report only where BOTH of them agree that our coordinate is wrong.
 *
 *   npx tsx scripts/places-coord-audit.ts
 *   … --threshold=500        metres of disagreement worth reporting (default 500)
 *   … --kind=museum          audit one kind
 *   … --cache=path.json      reuse a previous run's lookups
 *
 * WHY. On 6 Sep 2026 Arneson Acres was found to be 2.7km from its own street
 * address. The coordinate had come from a research agent, and NOTHING CAUGHT IT:
 * it landed in the right city, inside the coverage box, and passed the
 * registry's lat/lng drift guard — which only catches a transposed or garbage
 * pair, not a plausible-but-wrong one. It surfaced only because a second row
 * happened to share the address and geocoded elsewhere. That was luck, and luck
 * is not a check.
 *
 * WHY TWO PROVIDERS. The first version of this script asked Nominatim alone and
 * produced 119 disagreements, most of them the geocoder's fault: it put
 * 2540 Nicollet Ave S in Richfield and Sweetland Orchard in MISSOURI. A list
 * that is mostly noise does not get read, and a list that is mostly noise is
 * how a real error hides. So a single provider disagreeing is a QUESTION;
 * two independent providers agreeing with each other and against us is a
 * FINDING. Nominatim reads OpenStreetMap, the Census geocoder reads TIGER —
 * different data, different failure modes.
 *
 * IT WRITES NOTHING, even for a confirmed finding. For a big park the points can
 * legitimately differ by half a kilometre — one at the entrance, one at the
 * centroid — and only a human can say which one a visitor should be driving to.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PLACES } from "../lib/places";
import { distanceMeters } from "../lib/geo-distance";
import {
  judgeCoordinate,
  looksLikeStreetAddress,
  consensusPoint,
  type CoordVerdict,
  type Hit,
} from "../lib/coord-audit";

const UA = "citypulsemn-places/1.0 (Twin Cities place directory; https://citypulsemn.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const THRESHOLD = Number(arg("threshold") ?? 500);
const KIND = arg("kind");
const CACHE = arg("cache") ?? "places-coord-cache.json";

function loadCache(): Record<string, Hit> {
  if (!existsSync(CACHE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, Hit>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, Hit>) {
  const dir = dirname(CACHE);
  if (dir && dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 0));
}

/** OpenStreetMap. Free, no key, one request a second — hence the cache. */
async function nominatim(q: string): Promise<Hit> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { lat: string; lon: string }[];
    if (!j.length) return null;
    return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  } catch {
    return null;
  }
}

/** US Census TIGER. Street addresses only — it will not resolve a park name,
 *  which is fine: a name has no single right answer to check against anyway. */
async function census(q: string): Promise<Hit> {
  const url =
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` +
    `?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      result?: { addressMatches?: { coordinates?: { x: number; y: number } }[] };
    };
    const c = j.result?.addressMatches?.[0]?.coordinates;
    if (!c || typeof c.x !== "number" || typeof c.y !== "number") return null;
    return { lat: c.y, lng: c.x };
  } catch {
    return null;
  }
}

type Row = {
  p: (typeof PLACES)[number];
  osm: Hit;
  tiger: Hit;
  dOsm: number | null;
  dTiger: number | null;
  between: number | null;
  verdict: CoordVerdict;
};

async function main() {
  const rows = PLACES.filter((p) => (KIND ? p.kind === KIND : true));
  const cache = loadCache();

  const checkable = rows.filter((p) => looksLikeStreetAddress(p.address));
  console.log(
    `[coord-audit] ${rows.length} place(s)${KIND ? ` of kind ${KIND}` : ""}; ` +
      `${checkable.length} have a street address to check against\n`,
  );

  const out: Row[] = [];
  let looked = 0;

  for (const p of checkable) {
    const kOsm = `osm:${p.address}`;
    const kTiger = `tiger:${p.address}`;

    // The first run of this script cached under the bare address; that was
    // Nominatim, so keep those lookups rather than re-asking 567 times.
    if (cache[kOsm] === undefined && cache[p.address] !== undefined) cache[kOsm] = cache[p.address];

    if (cache[kOsm] === undefined) {
      cache[kOsm] = await nominatim(p.address);
      await sleep(1100); // Nominatim policy: one request a second.
      looked++;
    }
    if (cache[kTiger] === undefined) {
      cache[kTiger] = await census(p.address);
      await sleep(250);
      looked++;
    }
    if (looked > 0 && looked % 40 === 0) {
      saveCache(cache);
      console.log(`[coord-audit] …${looked} lookups`);
      looked++; // don't re-log the same count
    }

    const osm = cache[kOsm];
    const tiger = cache[kTiger];
    const verdict = judgeCoordinate(p, osm, tiger, THRESHOLD);
    const d = (h: Hit) => (h ? Math.round(distanceMeters(p.lat, p.lng, h.lat, h.lng)) : null);
    out.push({
      p,
      osm,
      tiger,
      dOsm: d(osm),
      dTiger: d(tiger),
      between: osm && tiger ? Math.round(distanceMeters(osm.lat, osm.lng, tiger.lat, tiger.lng)) : null,
      verdict,
    });
  }
  saveCache(cache);

  const by = (v: CoordVerdict) => out.filter((r) => r.verdict === v);
  console.log(
    `[coord-audit] within ${THRESHOLD}m of at least one provider: ${by("agreed").length}\n` +
      `              BOTH providers say we are wrong, and agree: ${by("confirmed").length}\n` +
      `              both say wrong but disagree with each other: ${by("providers-disagree").length}\n` +
      `              only one provider answered, and it disagrees: ${by("one-provider").length}\n` +
      `              neither provider resolved the address: ${by("no-answer").length}\n`,
  );

  const show = (title: string, list: Row[], note: string) => {
    if (!list.length) return;
    console.log(`\n=== ${title} (${list.length}) ===\n${note}\n`);
    for (const r of list.sort((a, b) => (b.dOsm ?? b.dTiger ?? 0) - (a.dOsm ?? a.dTiger ?? 0))) {
      console.log(`  ${r.p.slug}  (${r.p.kind}, ${r.p.city})  · verified ${r.p.verifiedAt}`);
      console.log(`     address  ${r.p.address}`);
      console.log(`     we say   ${r.p.lat},${r.p.lng}`);
      if (r.osm) console.log(`     osm      ${r.osm.lat.toFixed(5)},${r.osm.lng.toFixed(5)}  (${r.dOsm}m from us)`);
      if (r.tiger) console.log(`     tiger    ${r.tiger.lat.toFixed(5)},${r.tiger.lng.toFixed(5)}  (${r.dTiger}m from us)`);
      if (r.between !== null) console.log(`     the two providers are ${r.between}m apart`);
      if (r.verdict === "confirmed") {
        const c = consensusPoint(r.osm, r.tiger)!;
        console.log(`     they suggest ${c.lat.toFixed(5)},${c.lng.toFixed(5)}`);
      }
      console.log("");
    }
  };

  show(
    "CONFIRMED — two independent providers agree we are wrong",
    by("confirmed"),
    "These are the ones worth acting on. Still check each against the place's own\n" +
      "source URL before editing: a park entrance and a park centroid are both honest.",
  );
  show(
    "UNRESOLVED — both providers disagree with us AND with each other",
    by("providers-disagree"),
    "No consensus to act on. A human decides, or nobody does.",
  );

  console.log(
    `[coord-audit] Nothing was changed. This script only asks the question.`,
  );
}

if (process.argv[1]?.includes("places-coord-audit")) {
  main().catch((err) => {
    console.error("[coord-audit] fatal:", err);
    process.exitCode = 1;
  });
}
