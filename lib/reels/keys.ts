import type { PostDay, WeekWindow } from "./types";

/**
 * Week keying for the reels pipeline: which ISO week we're in, which dates
 * each posting day covers, and the weekly rotation keys derived from the
 * week number.
 *
 * All arithmetic reads the LOCAL calendar parts of the incoming Date
 * (getFullYear/getMonth/getDate — the runner passes local Minneapolis time),
 * then anchors them at UTC midnight so day-stepping is immune to DST.
 */

const DAY_MS = 86_400_000;

/** UTC midnight of the date's LOCAL calendar day. */
function utcAnchor(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

function addDays(anchored: Date, days: number): Date {
  return new Date(anchored.getTime() + days * DAY_MS);
}

function isoDate(anchored: Date): string {
  return anchored.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing the anchored date (Sunday counts as day 7). */
function mondayOfAnchored(anchored: Date): Date {
  const dow = anchored.getUTCDay() || 7; // Mon 1 .. Sun 7
  return addDays(anchored, 1 - dow);
}

/**
 * ISO-8601 week number = the week number of this week's Thursday, which is
 * always in the week's "owning" year. Handles both year-boundary directions:
 * late-December dates can be week 1, early-January dates week 52/53.
 */
function isoWeekOfAnchored(anchored: Date): number {
  const dow = anchored.getUTCDay() || 7;
  const thursday = addDays(anchored, 4 - dow);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

/** ISO-8601 week number from the date's LOCAL calendar parts. */
export function isoWeekNumber(date: Date): number {
  return isoWeekOfAnchored(utcAnchor(date));
}

/**
 * The posting window for the ISO week containing `today`:
 * monday => Mon–Fri of that week, friday => Sat–Sun of that week.
 * isoWeek is computed from the week's Monday so both windows of one week
 * always share a key, even at year boundaries.
 */
export function buildWeekWindow(today: Date, postDay: PostDay): WeekWindow {
  const monday = mondayOfAnchored(utcAnchor(today));
  const isoWeek = isoWeekOfAnchored(monday);
  const [startOffset, endOffset] = postDay === "monday" ? [0, 4] : [5, 6];
  return {
    postDay,
    start: isoDate(addDays(monday, startOffset)),
    end: isoDate(addDays(monday, endOffset)),
    isoWeek,
    shotTypeKey: (isoWeek % 4) as WeekWindow["shotTypeKey"],
    audioLane: (isoWeek % 3) as WeekWindow["audioLane"],
  };
}

/**
 * Which reel to build when run on `today`: Fri/Sat/Sun runs prepare the
 * weekend (friday) reel, every other day prepares the weekday (monday) one.
 */
export function defaultPostDay(today: Date): PostDay {
  const dow = today.getDay(); // local; 0 Sun .. 6 Sat
  return dow === 5 || dow === 6 || dow === 0 ? "friday" : "monday";
}
