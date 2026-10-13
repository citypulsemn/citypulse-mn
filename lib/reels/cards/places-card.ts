import { createHash } from "node:crypto";
import { CARD_COPY } from "../../editorial";
import { KIND_COVERAGE, KIND_META, PLACES, type Place, type PlaceKind } from "../../places";
import { isoWeekNumber } from "../keys";
import type { KindConsideration, PlacesCard, PlacesCardRecord } from "./types";

/**
 * The weekly "Five places" still card (docs/REELS-PUBLISH.md, "Still cards"):
 * which kind this week, which five of it, and every word that gets posted.
 * Pure and deterministic — the same date and the same card history always give
 * the same card, so a re-run on post day cannot change what the 06:30 email
 * said would post.
 */

/** A card must never be most of the list. Counted in names, not places. */
const MIN_ELIGIBLE = 10;
/** No kind within 8 weeks: a Wednesday kind may return on the eighth Wednesday after. */
const REPEAT_DAYS = 56;
const DAY_MS = 86_400_000;

/**
 * Card-safe windows ("MM-DD", inclusive), keyed by the registry's season label.
 *
 * Deliberately NARROWER than the registry's month bounds, which are wider than
 * the truth: "Memorial Day–Labor Day" is stored as May–September, and a ±14-day
 * margin, measured, still put beaches on a card before Memorial Day. A window
 * whose start is after its end wraps the new year. A label missing from this
 * table is never card-safe — the test suite fails when the registry gains one.
 */
export const CARD_SAFE_SEASONS: Record<string, readonly [from: string, to: string]> = {
  "Memorial Day–Labor Day": ["06-01", "08-31"],
  "June–August": ["06-15", "08-20"],
  "April–October": ["05-01", "09-30"],
  "May–October": ["06-01", "09-30"],
  "September–May (closed summer)": ["10-01", "04-30"],
  "December–February": ["01-01", "02-14"],
  "December–March": ["01-01", "03-01"],
  "September–October": ["09-15", "10-25"],
  // Ice mid-October to mid-March (one arena): the settled middle of the ice.
  "October–March": ["11-01", "03-10"],
  // Disc golf on ski hills, each the floor of its own page's Wayback captures.
  "May–September": ["06-01", "08-31"],
  "June–October": ["06-15", "09-30"],
};

/**
 * Card-only corrections for single places whose registry season is wider than
 * what a card listing would claim. A window replaces the label's window; null
 * keeps the place off cards until its registry entry is checked again. Each
 * line says what it rests on, and each is a registry fix waiting to happen —
 * when the entry is corrected, its line here should go.
 */
export const CARD_SAFE_BY_SLUG: Record<string, readonly [from: string, to: string] | null> = {
  // Registered year-round beside a par-3 golf course. Its page says "open
  // sunrise to sunset daily" in summer and winter captures alike and nothing
  // about a season, so winter play is not attested either way: warm season
  // only. (Apple Valley Sports Arena and the two Three Rivers disc golf
  // courses had lines here until their registry entries were re-verified
  // against their sources on 6 Oct 2026.)
  "theodore-wirth-disc-golf": ["05-01", "09-30"],
  // Registered year-round; its own intro ends "open the warm months". The
  // window its seasonal sibling museums (May–October) already get.
  "gibbs-farm": ["06-01", "09-30"],
};

/** Can this place go on a card posted on `postDate` (yyyy-mm-dd)? */
export function cardSafe(place: Place, postDate: string): boolean {
  let window: readonly [string, string] | null | undefined;
  if (Object.hasOwn(CARD_SAFE_BY_SLUG, place.slug)) window = CARD_SAFE_BY_SLUG[place.slug];
  else if (place.season.type === "year-round") return true;
  else window = CARD_SAFE_SEASONS[place.season.label];
  if (!window) return false;
  const [from, to] = window;
  const monthDay = postDate.slice(5);
  return from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to;
}

/** ISO-8601 year and week of a local yyyy-mm-dd date, e.g. "2026-W41". */
export function isoYearWeek(postDate: string): string {
  const date = new Date(`${postDate}T12:00:00`); // local noon, as keys.ts expects
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postDate) || Number.isNaN(date.getTime())) {
    throw new Error(`postDate must be yyyy-mm-dd, got "${postDate}"`);
  }
  const week = isoWeekNumber(date);
  // The ISO year is the year of the week's Thursday: early January can still
  // be last year's week 52/53, and late December already next year's week 1.
  const month = date.getMonth();
  const year = date.getFullYear() + (month === 0 && week >= 52 ? -1 : month === 11 && week === 1 ? 1 : 0);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Deterministic shuffle: a different order every week, never the alphabet's. */
function byWeekHash<T>(items: T[], key: (item: T) => string, week: string): T[] {
  return items
    .map((item) => [createHash("sha256").update(key(item) + week).digest("hex"), item] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, item]) => item);
}

/**
 * A name with its location qualifier taken off: the part after a spaced dash
 * ("Vertical Endeavors — Bloomington"), a trailing parenthetical ("Blaine
 * Farmers Market (Saturday)"), then a bare trailing city ("Sky Zone Edina").
 */
function stemOf(place: Place): string {
  const base = place.name.split(" — ")[0].replace(/ \([^)]*\)$/, "");
  return base.endsWith(` ${place.city}`) ? base.slice(0, -place.city.length - 1) : base;
}

/**
 * Which name each place of one kind goes by on a card, keyed by slug, and the
 * names that more than one place shares (`chains`).
 *
 * Five rows are five names. The registry writes a business with several
 * locations three different ways — "Vertical Endeavors — St. Paul", "Sky Zone
 * Edina", "Blaine Farmers Market (Tuesday)" — and the first rule here only saw
 * the dash: three Sky Zones made one simulated card. So this reads the list
 * instead of a fixed set of names: a stem that two places share is a chain,
 * and any name beginning with that stem belongs to it ("Sky Zone St. Paul" is
 * in Oakdale, so its own city never comes off the end).
 */
export function cardNames(ofKind: Place[]): { nameOf: Map<string, string>; chains: Set<string> } {
  const stems = ofKind.map(stemOf);
  const chains = new Set(stems.filter((stem, i) => stems.indexOf(stem) !== i));
  const nameOf = new Map(
    ofKind.map((p, i) => [p.slug, [...chains].find((c) => stems[i].startsWith(`${c} `)) ?? stems[i]]),
  );
  return { nameOf, chains };
}

/**
 * The name as the card row prints it. The city sits on the line below, so a
 * name that only ends in its own city drops that tail instead of printing the
 * city twice: "… — Minneapolis" and "… (Maple Grove)" always, and a bare
 * "Sky Zone Edina" only when what is left is a chain's name. Nothing else is
 * touched: "Vertical Endeavors — Twin Cities Bouldering" is the name.
 */
function rowName(place: Place, chains: Set<string>): string {
  for (const tail of [` — ${place.city}`, ` (${place.city})`]) {
    if (place.name.endsWith(tail)) return place.name.slice(0, -tail.length);
  }
  const bare = ` ${place.city}`;
  if (place.name.endsWith(bare) && chains.has(place.name.slice(0, -bare.length))) {
    return place.name.slice(0, -bare.length);
  }
  return place.name;
}

/**
 * A place as the caption and alt text say it. The caption policy bans em
 * dashes, en dashes and spaced hyphens, and 14 registry names carry one
 * ("Vertical Endeavors — St. Paul"); the card image keeps the real name. The
 * city is not repeated when the name already says it.
 */
function spoken(place: Place): string {
  const clean = (s: string) => s.replace(/\s*[—–]\s*|\s+-\s+/g, ", ");
  const name = clean(place.name);
  const city = clean(place.city);
  return name.includes(city) ? name : `${name} in ${city}`;
}

export function buildPlacesCard(
  postDate: string,
  recent: PlacesCardRecord[],
  opts: { places?: Place[] } = {},
): PlacesCard {
  const week = isoYearWeek(postDate); // also rejects a malformed date before anything is chosen
  const places = opts.places ?? PLACES;
  const today = Date.parse(postDate);

  const kinds = (Object.keys(KIND_META) as PlaceKind[]).flatMap((kind) => {
    const ofKind = places.filter((p) => p.kind === kind);
    if (ofKind.length === 0) return [];
    const eligible = ofKind.filter((p) => cardSafe(p, postDate));
    // Named over the whole kind, not this week's eligible few: what a place
    // is called must not change with the season.
    const { nameOf, chains } = cardNames(ofKind);
    const names = new Set(eligible.map((p) => nameOf.get(p.slug))).size;
    const inSeason = eligible.filter((p) => p.season.type === "seasonal").length * 2 > eligible.length;
    // Only cards posted BEFORE this date count. A record dated today is this
    // card's own from an earlier run; counting it would make a re-run switch kinds.
    const sinceUsed = Math.min(
      ...recent
        .filter((r) => r.kind === kind)
        .map((r) => (today - Date.parse(r.postDate)) / DAY_MS)
        .filter((days) => days > 0),
    ); // Infinity when never used
    const usable = names >= MIN_ELIGIBLE && sinceUsed >= REPEAT_DAYS;
    const note =
      eligible.length === 0 ? "out of season"
      : names < MIN_ELIGIBLE ? `below ${MIN_ELIGIBLE}`
      : sinceUsed < REPEAT_DAYS ? `used ${sinceUsed} days ago`
      : inSeason ? "eligible, in season"
      : "eligible";
    return [{ kind, eligible, names, nameOf, chains, inSeason, sinceUsed, usable, note }];
  });
  const considered: KindConsideration[] = kinds.map((k) => ({
    kind: k.kind,
    eligible: k.names,
    note: k.note,
  }));

  const usable = kinds.filter((k) => k.usable);
  if (usable.length === 0) {
    const short = kinds.filter((k) => k.names < MIN_ELIGIBLE).length;
    return {
      status: "skipped",
      reason:
        `no kind has ${MIN_ELIGIBLE} card-safe names outside the 8-week window ` +
        `(${kinds.length} kinds: ${short} short of ${MIN_ELIGIBLE} names, ${kinds.length - short} used in the last 8 weeks; ` +
        `a name with several locations counts once)`,
      considered,
    };
  }

  // Seasonal first: orchards belong in October, not whenever a rotation
  // reaches them. Then least recently used, then the week's hash.
  const preferred = usable.some((k) => k.inSeason) ? usable.filter((k) => k.inSeason) : usable;
  const longestRest = Math.max(...preferred.map((k) => k.sinceUsed));
  const pick = byWeekHash(preferred.filter((k) => k.sinceUsed === longestRest), (k) => k.kind, week)[0];
  // The week's hash order, with the places on this kind's last card moved to
  // the back: drawn fresh each time, a small kind brought the same rows
  // straight back (four of five nature centers, ten weeks apart, simulated).
  const lastCard = recent
    .filter((r) => r.kind === pick.kind && Date.parse(r.postDate) < today)
    .sort((a, b) => (a.postDate < b.postDate ? 1 : -1))[0];
  // By name, so a chain's other location does not stand in for the one shown.
  const justShown = new Set((lastCard?.slugs ?? []).map((slug) => pick.nameOf.get(slug)));
  const wasShown = (p: Place) => justShown.has(pick.nameOf.get(p.slug));
  const hashed = byWeekHash(pick.eligible, (p) => p.slug, week);
  const ordered = [...hashed.filter((p) => !wasShown(p)), ...hashed.filter(wasShown)];
  // One row per name, in that order.
  const taken = new Set<string | undefined>();
  const five = ordered
    .filter((p) => !taken.has(pick.nameOf.get(p.slug)) && taken.add(pick.nameOf.get(p.slug)))
    .slice(0, 5);

  const curated = KIND_COVERAGE[pick.kind] === "curated";
  const plural = CARD_COPY.kindNames[pick.kind] || KIND_META[pick.kind].plural;
  // Function replacers: a "$" in a place name must not be read as a pattern.
  const fill = (template: string, list = "") =>
    template
      .replaceAll("{PLURAL}", () => plural.toUpperCase())
      .replaceAll("{plural}", () => plural.toLowerCase())
      .replaceAll("{places}", () => list);
  const header = fill(curated ? CARD_COPY.headerCurated : CARD_COPY.headerExhaustive);

  return {
    status: "built",
    kind: pick.kind,
    content: {
      variant: "family",
      header,
      // Name and city only. Tags carry schedule and staffing facts that go
      // stale, and `cost` means admission: "Orchard · Free" reads as free apples.
      events: five.map((p) => ({ name: rowName(p, pick.chains), details: p.city })),
      cta: CARD_COPY.cta,
    },
    caption: fill(
      curated ? CARD_COPY.captionCurated : CARD_COPY.captionExhaustive,
      five.map((p) => `${spoken(p)}.`).join(" "),
    ),
    // Instagram's alt_text limit is 1000 characters.
    altText: `${header.charAt(0)}${header.slice(1).toLowerCase()}. ${five.map(spoken).join("; ")}.`.slice(0, 1000),
    record: { type: "places", kind: pick.kind, slugs: five.map((p) => p.slug), postDate },
    considered,
  };
}
