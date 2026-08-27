import { chiWallClock } from "../clock";
import type { CandidateEvent, Variant, VariantSelection, WeekWindow } from "./types";

/**
 * Event screening and selection for the Reels pipeline.
 *
 * screenEvent      — the locked brand rules (no political events, no drag events).
 * partitionEvents  — brand screen + window filter, then route into the three
 *                    variant pools (regular / family / weird).
 * selectFive       — deterministic greedy pick of 5 per pool: day spread first,
 *                    category caps on regular, free-first on family.
 *
 * All pure; every drop is reported in `excluded` with its reason (house rule:
 * honest emptiness — exclusions reported, never silent).
 *
 * startAt is an ISO datetime WITH offset (unlike the site's naive wall
 * strings), so we parse it as a real instant and read it back through the
 * shared Chicago clock. All "local" below means the Minneapolis wall frame.
 */

/**
 * Drag events (all of them — locked brand rule). Matched as "drag " + a known
 * drag-event noun so motorsport ("drag racing", "drag strip") and "dragon boat"
 * stay in.
 */
const DRAG_RULE =
  /\bdrag[ -](?:shows?|brunch(?:es)?|bingo|stor(?:y|ies|ytime)|queens?|kings?|nights?|performances?|revues?|cabarets?|artists?|performers?|extravaganzas?)\b/i;

/**
 * Primarily-political events (locked brand rule). The terms come from the
 * owner — rally, march, protest, campaign, partisan, fundraiser for a
 * candidate — but bare word-boundary matches on "march" and "campaign" hit
 * month names and cause marketing ("Campaign for Kindness"), so those two only
 * match in explicitly political collocations. Conservative by design: a missed
 * political event costs less than a wrongly-dropped concert.
 */
const POLITICAL_RULES: RegExp[] = [
  /\brall(?:y|ies)\b/i,
  /\bprotests?\b/i,
  // "bipartisan"/"nonpartisan" have no word boundary; guard the hyphenated form
  /(?<!non-)\bpartisan\b/i,
  // "march" only as a political march, never the month or "marching band"
  /\bmarch(?:es)? (?:for|against)\b/i,
  /\b(?:protest|solidarity|women'?s|pride|resistance) march\b/i,
  // "campaign" only with electoral context
  /\b(?:political|election|re-?election|mayoral|gubernatorial|presidential|senate|senatorial|congressional) campaigns?\b/i,
  /\bcampaigns? (?:rally|kickoff|launch|stop|trail|office|headquarters|fundraiser|volunteers?)\b/i,
  /\bcampaigns? for (?:a |the )?(?:candidate|mayor|governor|senator|congress|president|office|city council)\b/i,
  /\bfundraisers? for (?:a |the |any )?(?:candidate|mayor|governor|senator|congress(?:man|woman)?|representative|president|campaign)s?\b/i,
  /\bcandidate (?:fundraisers?|forums?|town halls?|meet.and.greets?)\b/i,
  // the toolkit's STRICTLY EXCLUDE list names hearings and party ties explicitly
  /\b(?:government|city council|legislative|public) hearings?\b/i,
  /\b(?:DFL|GOP|democratic party|republican party)\b/i,
];

/** The brand screen: exclusion reason, or null when the event is fine. */
export function screenEvent(e: CandidateEvent): string | null {
  const text = `${e.title} ${e.description}`;
  for (const rule of POLITICAL_RULES) {
    const m = rule.exec(text);
    if (m) return `brand rule: political ("${m[0].toLowerCase()}")`;
  }
  const drag = DRAG_RULE.exec(text);
  if (drag) return `brand rule: drag event ("${drag[0].toLowerCase()}")`;
  return null;
}

/** Minneapolis wall clock "YYYY-MM-DDTHH:MM" for startAt, or null if unparseable. */
export function localWall(e: CandidateEvent): string | null {
  const t = Date.parse(e.startAt);
  if (Number.isNaN(t)) return null;
  return chiWallClock(new Date(t));
}

/**
 * The family-card gate: why this event can't ship to parents, or null when it
 * can. Locked rules — nothing starting 7 PM or later, no 21+, no bar venues.
 * Shared by partitionEvents (DB pool) and topUpVariant (web rows), so the gate
 * is enforced in code on BOTH paths, never just by prompt wording.
 */
export function familyGateReason(e: CandidateEvent): string | null {
  const wall = localWall(e);
  if (!wall) return `unparseable startAt "${e.startAt}"`;
  const hour = Number(wall.slice(11, 13));
  if (hour >= 19) return `family gate: starts ${wall.slice(11, 16)} local (7 PM or later)`;
  if (`${e.title} ${e.description}`.includes("21+")) return "family gate: 21+ event";
  if (/\b(?:bar|taproom|brewery|brewpub|pub|nightclub)\b/i.test(e.venue)) {
    return `family gate: bar venue ("${e.venue}")`;
  }
  return null;
}

/** Weekday index 0–6 for a "YYYY-MM-DD" key. Noon-anchored: DST can't shift it. */
function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T12:00:00Z`).getUTCDay();
}

/**
 * Screen, window-filter, and route candidates into the three variant pools.
 *
 * - brand-screened events are excluded first (their reason wins)
 * - the window test is on the LOCAL date of startAt, inclusive both ends
 * - "weird" → weird pool; "family" → family pool only when it starts before
 *   7 PM local and isn't 21+ (the family card is a promise to parents —
 *   an evening or 21+ "family" event is excluded outright, not demoted);
 *   everything else → regular pool
 */
export function partitionEvents(
  events: CandidateEvent[],
  window: WeekWindow,
): { pools: Record<Variant, CandidateEvent[]>; excluded: { title: string; reason: string }[] } {
  const pools: Record<Variant, CandidateEvent[]> = { regular: [], family: [], weird: [] };
  const excluded: { title: string; reason: string }[] = [];

  for (const e of events) {
    const brand = screenEvent(e);
    if (brand) {
      excluded.push({ title: e.title, reason: brand });
      continue;
    }
    const wall = localWall(e);
    if (!wall) {
      excluded.push({ title: e.title, reason: `unparseable startAt "${e.startAt}"` });
      continue;
    }
    const day = wall.slice(0, 10);
    if (day < window.start || day > window.end) {
      excluded.push({
        title: e.title,
        reason: `outside window ${window.start}..${window.end} (local start ${day})`,
      });
      continue;
    }
    if (e.category === "weird") {
      pools.weird.push(e);
      continue;
    }
    if (e.category === "family") {
      const gate = familyGateReason(e);
      if (gate) {
        excluded.push({ title: e.title, reason: gate });
      } else {
        pools.family.push(e);
      }
      continue;
    }
    pools.regular.push(e);
  }

  return { pools, excluded };
}

const PICK_TARGET = 5;

function dedupeKey(e: CandidateEvent): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(e.title)}|${norm(e.venue)}`;
}

/**
 * Score a candidate given the picks so far. Recomputed every round, so the
 * greedy loop always takes the event that helps most RIGHT NOW.
 */
function scoreOf(
  e: CandidateEvent,
  wall: string,
  variant: Variant,
  coveredDays: Set<number>,
  catCount: Map<string, number>,
): number {
  let s = 0;
  if (!coveredDays.has(weekdayOf(wall.slice(0, 10)))) s += 2;
  // heavy penalty, not a hard bar: a 3rd same-category event still beats an
  // empty slot (we never invent events to fill one)
  if (variant === "regular" && (catCount.get(e.category) ?? 0) >= 2) s -= 10;
  if (variant === "family" && e.priceTier === "Free") s += 2;
  if (e.priceTier === "Free" || e.priceTier === "$") s += 1;
  return s;
}

/**
 * Pick up to 5 events from a variant pool. Deterministic: greedy by score,
 * ties broken by local start time ascending, then title. Duplicate title+venue
 * rows collapse to the earliest row AS IS — one existing row is picked, never
 * a merged span (the sports rule: a Tuesday game and a Wednesday game are
 * different events; the card just shows one of them).
 *
 * Returned events are in local start order (card order), picks decided by the
 * greedy loop. Everything not picked lands in `excluded` with a reason.
 */
export function selectFive(pool: CandidateEvent[], variant: Variant): VariantSelection {
  const excluded: { title: string; reason: string }[] = [];
  const walls = new Map<CandidateEvent, string>();
  const parseable: CandidateEvent[] = [];
  for (const e of pool) {
    const wall = localWall(e);
    if (!wall) {
      excluded.push({ title: e.title, reason: `unparseable startAt "${e.startAt}"` });
      continue;
    }
    walls.set(e, wall);
    parseable.push(e);
  }

  const byKey = new Map<string, CandidateEvent>();
  for (const e of parseable) {
    const key = dedupeKey(e);
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, e);
      continue;
    }
    const keep = walls.get(e)! < walls.get(kept)! ? e : kept; // tie → first seen
    const drop = keep === e ? kept : e;
    byKey.set(key, keep);
    excluded.push({
      title: drop.title,
      reason: `duplicate title+venue — kept the ${walls.get(keep)!.slice(0, 10)} row`,
    });
  }

  let remaining = [...byKey.values()];
  const picks: CandidateEvent[] = [];

  const tiebreak = (a: CandidateEvent, b: CandidateEvent): number => {
    const wa = walls.get(a)!;
    const wb = walls.get(b)!;
    if (wa !== wb) return wa < wb ? -1 : 1;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  };

  while (picks.length < PICK_TARGET && remaining.length > 0) {
    const coveredDays = new Set(picks.map((p) => weekdayOf(walls.get(p)!.slice(0, 10))));
    const catCount = new Map<string, number>();
    for (const p of picks) catCount.set(p.category, (catCount.get(p.category) ?? 0) + 1);

    let best = remaining[0];
    let bestScore = scoreOf(best, walls.get(best)!, variant, coveredDays, catCount);
    for (const e of remaining.slice(1)) {
      const s = scoreOf(e, walls.get(e)!, variant, coveredDays, catCount);
      if (s > bestScore || (s === bestScore && tiebreak(e, best) < 0)) {
        best = e;
        bestScore = s;
      }
    }
    picks.push(best);
    remaining = remaining.filter((e) => e !== best);
  }

  for (const e of remaining) {
    const capped =
      variant === "regular" && picks.filter((p) => p.category === e.category).length >= 2;
    excluded.push({
      title: e.title,
      reason: capped
        ? `category cap: already picked 2 ${e.category} events`
        : "not selected — 5 picks made",
    });
  }

  return {
    variant,
    events: [...picks].sort(tiebreak),
    shortfall: Math.max(0, PICK_TARGET - picks.length),
    excluded,
  };
}

/**
 * Fold web top-up events into a short selection. DB picks keep their seats
 * (they're already verified); top-up rows fill remaining slots in local start
 * order. The result is re-sorted into card order and the shortfall recomputed;
 * unused top-up rows are reported, not dropped silently.
 */
export function mergeTopUp(
  selection: VariantSelection,
  topUp: CandidateEvent[],
): VariantSelection {
  const need = Math.max(0, PICK_TARGET - selection.events.length);
  const have = new Set(selection.events.map(dedupeKey));
  const excluded = [...selection.excluded];

  const usable: CandidateEvent[] = [];
  for (const e of topUp) {
    if (have.has(dedupeKey(e))) {
      excluded.push({ title: e.title, reason: "top-up duplicates a picked event" });
      continue;
    }
    if (localWall(e) === null) {
      excluded.push({ title: e.title, reason: `unparseable startAt "${e.startAt}"` });
      continue;
    }
    have.add(dedupeKey(e));
    usable.push(e);
  }
  usable.sort((a, b) => (localWall(a)! < localWall(b)! ? -1 : 1));

  const taken = usable.slice(0, need);
  for (const e of usable.slice(need)) {
    excluded.push({ title: e.title, reason: "top-up not needed — 5 picks made" });
  }

  const events = [...selection.events, ...taken].sort((a, b) => {
    const wa = localWall(a)!;
    const wb = localWall(b)!;
    if (wa !== wb) return wa < wb ? -1 : 1;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });

  return {
    variant: selection.variant,
    events,
    shortfall: Math.max(0, PICK_TARGET - events.length),
    excluded,
  };
}
