/**
 * Coverage report for the Places registry against METRO_BOX.
 *
 *   npm run places-coverage            per-kind counts inside the box
 *   npm run places-coverage -- --gaps  also list the box cities with nothing of a kind
 *
 * "Be exhaustive" is a feeling until it is a number. This turns the registry
 * into per-kind counts inside Taren's stated area, plus the cities that have
 * nothing of a given kind — which is where the next research run should go.
 *
 * It reads the registry only. No database, no network, no writes.
 */
import { PLACES, KIND_META, METRO_BOX, inMetroBox, type PlaceKind } from "../lib/places";

const showGaps = process.argv.includes("--gaps");

/** Cities with enough of a park system that a missing kind is a real gap rather
 *  than a fact about the town. Ordered roughly by size. */
const MAJOR_BOX_CITIES = [
  "Minneapolis", "St. Paul", "Bloomington", "Brooklyn Park", "Plymouth", "Woodbury",
  "Maple Grove", "Blaine", "Lakeville", "Eagan", "Burnsville", "Coon Rapids",
  "Eden Prairie", "Apple Valley", "Minnetonka", "Edina", "St. Louis Park",
  "Moundsview", "Shakopee", "Maplewood", "Cottage Grove", "Richfield", "Roseville",
  "Inver Grove Heights", "Andover", "Brooklyn Center", "Savage", "Oakdale",
  "Fridley", "Shoreview", "Ramsey", "Chaska", "Prior Lake", "White Bear Lake",
  "Chanhassen", "Champlin", "Elk River", "Rosemount", "Farmington", "Crystal",
  "New Brighton", "Golden Valley", "Hastings", "Stillwater", "Forest Lake",
  "Anoka", "New Hope", "Columbia Heights", "West St. Paul", "South St. Paul",
  "Hopkins", "Delano", "Rockford", "Waconia", "Northfield", "Monticello",
];

function main() {
  const inBox = PLACES.filter(inMetroBox);
  const outBox = PLACES.filter((p) => !inMetroBox(p));

  console.log(
    `METRO_BOX  lat ${METRO_BOX.minLat}..${METRO_BOX.maxLat}  lng ${METRO_BOX.minLng}..${METRO_BOX.maxLng}`,
  );
  console.log(
    `anchors    W ${METRO_BOX.anchors.west.join("/")} · E ${METRO_BOX.anchors.east.join("/")} · ` +
      `N ${METRO_BOX.anchors.north.join("/")} · S ${METRO_BOX.anchors.south.join("/")}\n`,
  );
  console.log(`${PLACES.length} places total · ${inBox.length} inside the box · ${outBox.length} outside\n`);

  const kinds = Object.keys(KIND_META) as PlaceKind[];
  const counts = new Map<PlaceKind, number>();
  for (const p of inBox) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);

  console.log("kind                 in-box   cities");
  for (const k of kinds) {
    const of = inBox.filter((p) => p.kind === k);
    const cities = new Set(of.map((p) => p.city)).size;
    console.log(`  ${k.padEnd(20)} ${String(of.length).padStart(5)}   ${cities}`);
  }

  if (outBox.length > 0) {
    console.log(`\noutside the box (kept, not dropped):`);
    const byCity = new Map<string, number>();
    for (const p of outBox) byCity.set(p.city, (byCity.get(p.city) ?? 0) + 1);
    for (const [c, n] of [...byCity].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${c}`);
  }

  if (!showGaps) {
    console.log(`\n(run with --gaps for the per-kind city gaps)`);
    return;
  }

  console.log(`\n─── gaps: major box cities with NO place of a kind ───`);
  for (const k of kinds) {
    if (k === "music-venue") continue; // points at venue pages; not a research target
    const have = new Set(inBox.filter((p) => p.kind === k).map((p) => p.city));
    const missing = MAJOR_BOX_CITIES.filter((c) => !have.has(c));
    if (missing.length === 0) {
      console.log(`\n${KIND_META[k].plural}: every major city covered`);
      continue;
    }
    console.log(`\n${KIND_META[k].plural} — missing in ${missing.length}/${MAJOR_BOX_CITIES.length}:`);
    console.log(`  ${missing.join(", ")}`);
  }
}

main();
