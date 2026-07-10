import type { EventRecord } from "./types";

/**
 * Groups Twin Cities metro cities into broad areas for filtering. Pure and
 * data-driven (city name → area). Unmapped cities fall into "other" so events
 * are never dropped. A lat/lng fallback could be added later for new suburbs.
 */

export const AREAS = [
  { key: "mpls", label: "Minneapolis" },
  { key: "stpaul", label: "St. Paul" },
  { key: "north", label: "North metro" },
  { key: "south", label: "South metro" },
  { key: "east", label: "East metro" },
  { key: "west", label: "West metro" },
  { key: "other", label: "Elsewhere" },
] as const;

export type AreaKey = (typeof AREAS)[number]["key"];

/** Lowercase, drop trailing state, fold "saint"→"st", strip periods. */
export function normalizeCity(city: string): string {
  return (city ?? "")
    .toLowerCase()
    .trim()
    .replace(/,?\s*mn$/, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalized city → area. "saint x" is folded to "st x" by normalizeCity.
export const CITY_AREA: Record<string, AreaKey> = {
  minneapolis: "mpls",
  "st paul": "stpaul",

  // North metro
  "brooklyn park": "north", "brooklyn center": "north", "maple grove": "north",
  osseo: "north", champlin: "north", dayton: "north", rogers: "north",
  anoka: "north", andover: "north", ramsey: "north", "coon rapids": "north",
  blaine: "north", "ham lake": "north", "lino lakes": "north", "circle pines": "north",
  lexington: "north", centerville: "north", "spring lake park": "north",
  fridley: "north", "columbia heights": "north", hilltop: "north",
  "mounds view": "north", "new brighton": "north", "arden hills": "north",
  shoreview: "north", "north oaks": "north", roseville: "north",
  "falcon heights": "north", lauderdale: "north", crystal: "north",
  "new hope": "north", robbinsdale: "north", "little canada": "north",
  "st anthony": "north",

  // West metro
  "st louis park": "west", hopkins: "west", minnetonka: "west",
  "eden prairie": "west", plymouth: "west", wayzata: "west", "golden valley": "west",
  chanhassen: "west", chaska: "west", excelsior: "west", orono: "west",
  medina: "west", "maple plain": "west", mound: "west", "long lake": "west",
  deephaven: "west", shorewood: "west", victoria: "west", minnetrista: "west",
  "spring park": "west", "tonka bay": "west", greenwood: "west", woodland: "west",
  independence: "west", edina: "west",

  // South metro
  bloomington: "south", richfield: "south", eagan: "south", burnsville: "south",
  "apple valley": "south", lakeville: "south", savage: "south", "prior lake": "south",
  shakopee: "south", rosemount: "south", farmington: "south",
  "inver grove heights": "south", "mendota heights": "south", "west st paul": "south",
  "south st paul": "south", "sunfish lake": "south", lilydale: "south",
  hastings: "south", jordan: "south",

  // East metro
  maplewood: "east", "north st paul": "east", oakdale: "east", woodbury: "east",
  "cottage grove": "east", newport: "east", "st paul park": "east",
  "lake elmo": "east", stillwater: "east", "oak park heights": "east",
  bayport: "east", mahtomedi: "east", "white bear lake": "east",
  "vadnais heights": "east", "gem lake": "east", hugo: "east", "forest lake": "east",
  afton: "east", lakeland: "east", "grant": "east", dellwood: "east",
};

export function areaOf(event: Pick<EventRecord, "city">): AreaKey {
  return CITY_AREA[normalizeCity(event.city)] ?? "other";
}
