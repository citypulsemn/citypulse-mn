/**
 * Research the places we are missing, one kind at a time.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/research-places.ts disc-golf
 *   … scripts/research-places.ts rink --out=drafts/rink.ts
 *
 * Hands the agent the coverage box, the cities with none on file, and everything
 * we already have, then asks for what is MISSING — each entry carrying a source
 * page that names it.
 *
 * IT WRITES NOTHING INTO THE REGISTRY. Output is a draft TypeScript block for a
 * human to read, edit and paste. That is deliberate: `lib/places.ts` is the
 * evergreen half of the site and every row in it carries a `sourceUrl` a reader
 * can open and a `verifiedAt` date meaning somebody looked. An agent can find
 * candidates; it cannot award that date.
 *
 * Anything the agent returns without a source URL is dropped here rather than
 * passed along, so the honesty contract survives even a sloppy answer.
 */
import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { PLACES, KIND_META, METRO_BOX, inMetroBox, type PlaceKind } from "../lib/places";
import { buildPlacesResearchPrompt } from "../lib/agents/prompts";

const MAJOR_BOX_CITIES = [
  "Minneapolis", "St. Paul", "Bloomington", "Brooklyn Park", "Plymouth", "Woodbury",
  "Maple Grove", "Blaine", "Lakeville", "Eagan", "Burnsville", "Coon Rapids",
  "Eden Prairie", "Apple Valley", "Minnetonka", "Edina", "St. Louis Park",
  "Shakopee", "Maplewood", "Cottage Grove", "Richfield", "Roseville",
  "Inver Grove Heights", "Andover", "Brooklyn Center", "Savage", "Oakdale",
  "Fridley", "Shoreview", "Ramsey", "Chaska", "Prior Lake", "White Bear Lake",
  "Chanhassen", "Champlin", "Rosemount", "Farmington", "Crystal", "New Brighton",
  "Golden Valley", "Hastings", "Stillwater", "Forest Lake", "Anoka", "New Hope",
  "Columbia Heights", "West St. Paul", "South St. Paul", "Hopkins", "Delano",
  "Rockford", "Waconia", "Monticello", "Elk River", "Mounds View", "Little Canada",
];

interface Draft {
  name: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  source_url: string;
  cost?: string;
  season?: string;
  open_month?: number;
  close_month?: number;
  season_label?: string;
  note?: string;
}

function parseDrafts(text: string): Draft[] {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  let arr: unknown;
  try {
    arr = JSON.parse((m ? m[1] : text).trim());
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: Draft[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const source = typeof o.source_url === "string" ? o.source_url.trim() : "";
    // THE CONTRACT: no source, no entry. Dropped here so a sloppy answer cannot
    // put an unsourced row in front of a human as if it were ready.
    if (!name || !/^https?:\/\//i.test(source)) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    out.push({
      name,
      city: typeof o.city === "string" ? o.city.trim() : "",
      address: typeof o.address === "string" ? o.address.trim() : "",
      lat: num(o.lat),
      lng: num(o.lng),
      source_url: source,
      cost: typeof o.cost === "string" ? o.cost : "free",
      season: typeof o.season === "string" ? o.season : "year-round",
      open_month: num(o.open_month),
      close_month: num(o.close_month),
      season_label: typeof o.season_label === "string" ? o.season_label : undefined,
      note: typeof o.note === "string" ? o.note.trim() : "",
    });
  }
  return out;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function toEntry(d: Draft, kind: PlaceKind, today: string): string {
  const season =
    d.season === "seasonal" && d.open_month && d.close_month
      ? `{ type: "seasonal", openMonth: ${d.open_month}, closeMonth: ${d.close_month}, label: ${JSON.stringify(d.season_label ?? "")} }`
      : `{ type: "year-round" }`;
  const coords =
    d.lat !== undefined && d.lng !== undefined
      ? `    lat: ${d.lat},\n    lng: ${d.lng},`
      : `    // TODO coords — agent did not supply them; geocode before pasting\n    lat: 0,\n    lng: 0,`;
  return `  {
    slug: ${JSON.stringify(slugify(d.name))},
    name: ${JSON.stringify(d.name)},
    kind: ${JSON.stringify(kind)},
${coords}
    address: ${JSON.stringify(d.address ?? "")},
    city: ${JSON.stringify(d.city)},
    neighborhood: null,
    season: ${season},
    cost: ${JSON.stringify(d.cost ?? "free")},
    tags: [],
    intro: ${JSON.stringify(d.note ?? "")},
    sourceUrl: ${JSON.stringify(d.source_url)},
    verifiedAt: ${JSON.stringify(today)}, // CONFIRM against sourceUrl before trusting this date
    venueSlug: null,
  },`;
}

async function main() {
  const kind = process.argv[2] as PlaceKind;
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  if (!KIND_META[kind]) {
    console.error(`unknown kind "${kind}". Known: ${Object.keys(KIND_META).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const have = PLACES.filter((p) => p.kind === kind);
  const inBox = have.filter(inMetroBox);
  const covered = new Set(inBox.map((p) => p.city));
  const gapCities = MAJOR_BOX_CITIES.filter((c) => !covered.has(c));

  console.log(
    `[research-places] ${KIND_META[kind].plural}: ${inBox.length} on file in ${covered.size} cities; ` +
      `${gapCities.length} major cities with none`,
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 14 }] as unknown as Anthropic.Tool[],
    messages: [
      {
        role: "user",
        content: buildPlacesResearchPrompt(
          KIND_META[kind].plural,
          gapCities,
          have.map((p) => `${p.name} (${p.city})`),
          METRO_BOX,
        ),
      },
    ],
  });

  const res = await stream.finalMessage();
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const drafts = parseDrafts(text);
  // Drop anything that duplicates a name we already carry — the agent is told
  // not to, but the registry is the authority on that, not the prompt.
  const known = new Set(have.map((p) => p.name.toLowerCase()));
  const fresh = drafts.filter((d) => !known.has(d.name.toLowerCase()));

  console.log(`[research-places] ${drafts.length} sourced candidate(s); ${fresh.length} not already on file\n`);

  // AN INDEX PAGE IS NOT A SOURCE FOR ONE PLACE. When the same URL is handed
  // back for several entries it is usually a directory — rinkfinder.com's
  // facilities list, a "best outdoor rinks" roundup — and opening it does not
  // show a reader the place it is attached to. Same failure as citing a
  // fall-concerts roundup for one show. Flag it rather than silently listing it.
  const bySource = new Map<string, number>();
  for (const d of fresh) bySource.set(d.source_url, (bySource.get(d.source_url) ?? 0) + 1);
  const shared = [...bySource].filter(([, n]) => n > 2).sort((a, b) => b[1] - a[1]);
  if (shared.length > 0) {
    console.log(`[research-places] ⚠ these look like INDEX pages, not sources — re-source before listing:`);
    for (const [url, n] of shared) console.log(`    ${n}x  ${url}`);
    console.log();
  }
  for (const d of fresh) {
    console.log(`  ${d.name} — ${d.city}${d.lat === undefined ? "  (no coords)" : ""}`);
    console.log(`    ${d.source_url}`);
    if (d.note) console.log(`    ${d.note.slice(0, 150)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const block = fresh.map((d) => toEntry(d, kind, today)).join("\n");
  const path = outArg ? outArg.slice(6) : `places-draft-${kind}.ts`;
  writeFileSync(path, `// DRAFT — review every row, confirm each sourceUrl, then paste into lib/places.ts\n${block}\n`);
  console.log(`\n[research-places] draft written: ${path}`);
  console.log(`[research-places] nothing was added to the registry — that is a human's call.`);
}

main().catch((err) => {
  console.error("[research-places] fatal:", err);
  process.exitCode = 1;
});
