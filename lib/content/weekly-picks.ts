import { evDate } from "../dates";
import { chiWallClock, chiDayKey } from "../clock";
import type { EventRecord } from "../types";

/**
 * The flywheel: turn the event database into the week's Instagram picks.
 * Pure and deterministic so it's unit-testable and produces the same feed
 * rhythm every week — a "Regular" set plus a Family pick and a Unique pick.
 */

export interface WeeklyPicks {
  weekStartKey: string;
  weekEndKey: string;
  regular: EventRecord[];
  family: EventRecord | null;
  unique: EventRecord | null;
  all: EventRecord[];
}

const DAY_MS = 86_400_000;

/** Shareability heuristic (no popularity data yet — that's roadmap 5.4). */
export function scoreEvent(e: EventRecord): number {
  let s = 0;
  if (e.ticketUrl) s += 2;
  if (e.description && e.description.length > 40) s += 2;
  if (e.image && e.image.startsWith("http")) s += 1;
  const dow = evDate(e).getDay(); // 0 Sun … 6 Sat
  if (dow === 5 || dow === 6 || dow === 0) s += 2; // weekend draws
  if (e.priceTier === "Free") s += 1; // free = broadly shareable
  return s;
}

/** Deterministic ordering: score desc, then sooner, then title. */
function byRank(a: EventRecord, b: EventRecord): number {
  const d = scoreEvent(b) - scoreEvent(a);
  if (d !== 0) return d;
  const t = evDate(a).getTime() - evDate(b).getTime();
  if (t !== 0) return t;
  return a.title.localeCompare(b.title);
}

export function weeklyPicks(
  events: EventRecord[],
  now: Date,
  opts: { days?: number; regularCount?: number } = {},
): WeeklyPicks {
  const days = opts.days ?? 7;
  const regularCount = opts.regularCount ?? 5;
  // R1.4 (rule 10): window in the Chicago wall frame. The old epoch compare
  // dropped everything between send time (10 AM CT on the Actions runner) and
  // ~3 PM CT wall from the send-day picks.
  const nowWall = chiWallClock(now);
  const endWall = chiWallClock(new Date(now.getTime() + days * DAY_MS));

  const inWindow = events
    .filter((e) => e.status === "published")
    .filter((e) => e.start >= nowWall && e.start <= endWall)
    .sort(byRank);

  const family = inWindow.find((e) => e.category === "family") ?? null;
  const unique = inWindow.find((e) => e.category === "weird") ?? null;

  const taken = new Set<string>();
  if (family) taken.add(family.id);
  if (unique) taken.add(unique.id);

  // Regular = top general picks, spread out: max one per venue, max two per day.
  const perVenue = new Set<string>();
  const perDay = new Map<string, number>();
  const regular: EventRecord[] = [];
  for (const e of inWindow) {
    if (regular.length >= regularCount) break;
    if (taken.has(e.id)) continue;
    const venueKey = e.venue.trim().toLowerCase();
    const day = e.start.slice(0, 10); // the event's wall day, frame-pure
    if (venueKey && perVenue.has(venueKey)) continue;
    if ((perDay.get(day) ?? 0) >= 2) continue;
    regular.push(e);
    if (venueKey) perVenue.add(venueKey);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return {
    weekStartKey: chiDayKey(now),
    weekEndKey: endWall.slice(0, 10),
    regular,
    family,
    unique,
    all: inWindow,
  };
}
