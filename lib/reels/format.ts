import { chiWallClock } from "../clock";
import type { CandidateEvent, PostDay, Variant, WeekWindow } from "./types";

/**
 * Deterministic card-text builders for the Reels pipeline. Ground truth is the
 * published reels (r64/r59/r75 frame analysis), not the older toolkit spec:
 * header and date merged into one line, no variant badge, CTA row constant.
 */

export const CTA_LINE = "FULL GUIDE AT CITYPULSEMN.COM";

/** Soft target for a details line; the card renders one clean row at this. */
export const DETAILS_TARGET = 52;
/** Absolute cap — past this the card generator clips. Validator enforces it. */
export const DETAILS_HARD_CAP = 72;

const MONTHS_UPPER = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ordinal(n: number): string {
  const rem100 = n % 100;
  const rem10 = n % 10;
  const suffix =
    rem100 >= 11 && rem100 <= 13 ? "TH"
    : rem10 === 1 ? "ST"
    : rem10 === 2 ? "ND"
    : rem10 === 3 ? "RD"
    : "TH";
  return `${n}${suffix}`;
}

/** Exact header wordings from the live reels — do not "improve" these. */
const HEADERS: Record<PostDay, Record<Variant, string>> = {
  monday: {
    regular: "THIS WEEK IN MPLS",
    family: "THIS WEEK WITH KIDS",
    weird: "THINGS HAPPENING THIS WEEK",
  },
  friday: {
    regular: "THIS WEEKEND IN MPLS",
    family: "THIS WEEKEND WITH KIDS",
    weird: "YOUR WEEKEND JUST GOT INTERESTING",
  },
};

/** "AUGUST 3RD-7TH" same month, "AUGUST 31ST-SEPTEMBER 4TH" across months. */
function rangeLabel(window: WeekWindow): string {
  const [sy, sm, sd] = window.start.split("-").map(Number);
  const [ey, em, ed] = window.end.split("-").map(Number);
  const start = `${MONTHS_UPPER[sm - 1]} ${ordinal(sd)}`;
  return sy === ey && sm === em
    ? `${start}-${ordinal(ed)}`
    : `${start}-${MONTHS_UPPER[em - 1]} ${ordinal(ed)}`;
}

export function headerFor(day: PostDay, variant: Variant, window: WeekWindow): string {
  return `${HEADERS[day][variant]} - ${rangeLabel(window)}`;
}

/**
 * Minneapolis wall clock "YYYY-MM-DDTHH:MM" for an ISO datetime. Parsed as a
 * true instant and read back through the shared Chicago clock — the same
 * contract select-events uses — so a Z- or wrong-offset string from the web
 * top-up still renders the correct local day and time. Unparseable input
 * falls back to the literal digits (better a suspicious time than a crash).
 */
function wallOf(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : chiWallClock(new Date(t));
}

function localClock(iso: string): { h: number; mi: number } {
  const m = /T(\d{2}):(\d{2})/.exec(wallOf(iso));
  return m ? { h: Number(m[1]), mi: Number(m[2]) } : { h: 0, mi: 0 };
}

function dowOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return DOW_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function daySpanCount(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const ms = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
  return Math.round(ms / 86_400_000) + 1;
}

function dayPart(e: CandidateEvent, window: WeekWindow): string {
  const startKey = wallOf(e.startAt).slice(0, 10);
  const endKey = e.endAt ? wallOf(e.endAt).slice(0, 10) : null;
  const multiday = endKey !== null && endKey > startKey;
  if (window.postDay === "friday" && multiday) return "Sat & Sun";
  if (multiday && daySpanCount(startKey, endKey!) >= 3) {
    // "Weekdays" only when the run genuinely covers the whole Mon–Fri window;
    // a mid-week 3-day run is "Daily". Never claimed for shorter spans.
    return startKey <= window.start && endKey! >= window.end ? "Weekdays" : "Daily";
  }
  return dowOf(startKey);
}

function fmtClock(h: number, mi: number): string {
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return mi ? `${h12}:${String(mi).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
}

function timePart(e: CandidateEvent): { full: string; collapsed: string } {
  const { h, mi } = localClock(e.startAt);
  if (h === 0 && mi === 0) return { full: "All Day", collapsed: "All Day" };
  const start = fmtClock(h, mi);
  const sameDayEnd =
    e.endAt !== null && wallOf(e.endAt).slice(0, 10) === wallOf(e.startAt).slice(0, 10);
  if (!sameDayEnd) return { full: start, collapsed: start };
  const end = localClock(e.endAt!);
  return { full: `${start}–${fmtClock(end.h, end.mi)}`, collapsed: start };
}

function pricePart(e: CandidateEvent): string {
  if (e.priceTier === "Free") return "Free";
  const from = /from\s+\$(\d+(?:\.\d{2})?)/i.exec(e.price);
  if (from) return `From $${from[1]}`;
  const bare = e.price.trim();
  if (/^\$\d+(?:\.\d{2})?$/.test(bare)) return bare;
  return "Check site";
}

const firstWords = (s: string, n: number) =>
  s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");

/**
 * "Venue, City · Day · Time · Price" — one line, price ALWAYS present and
 * ALWAYS last (locked rule; a real reel once shipped with the price wrapped
 * onto a phantom second line). Shortening cascade when over DETAILS_TARGET:
 * (1) drop ", City" — also dropped up front when the venue already names it;
 * (2) strip ":00" minutes — the formatter never emits them, so a no-op;
 * (3) truncate the venue to its first 3 words (abbreviations like Thtr read
 *     worse than a clean cut);
 * (4) collapse a time range to its start time.
 * If all that still overruns DETAILS_HARD_CAP, the venue alone is clipped.
 */
export function detailsLine(e: CandidateEvent, window: WeekWindow): string {
  const day = dayPart(e, window);
  const time = timePart(e);
  const price = pricePart(e);
  const venue = e.venue.trim();
  const city = e.city.trim();
  const cityFits =
    city !== "" && !venue.toLowerCase().includes(city.toLowerCase());

  const join = (venuePart: string, timeStr: string) =>
    [venuePart, day, timeStr, price].filter((p) => p !== "").join(" · ");
  const venueWithCity = venue === "" ? city : cityFits ? `${venue}, ${city}` : venue;

  let line = join(venueWithCity, time.full);
  if (line.length <= DETAILS_TARGET) return line;

  line = join(venue, time.full);
  if (line.length <= DETAILS_TARGET) return line;

  const venue3 = firstWords(venue, 3);
  line = join(venue3, time.full);
  if (line.length <= DETAILS_TARGET) return line;

  line = join(venue3, time.collapsed);
  if (line.length <= DETAILS_HARD_CAP) return line;

  // Hard-cap fallback: clip the venue, never the price/day/time.
  const rest = join("", time.collapsed);
  const room = DETAILS_HARD_CAP - (rest.length + " · ".length) - 1;
  return join(`${venue3.slice(0, Math.max(room, 1))}…`, time.collapsed);
}
