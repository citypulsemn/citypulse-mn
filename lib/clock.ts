/**
 * THE SHARED CHICAGO CLOCK (Roadmap v5, R1.1 — keystone of sprint R1).
 *
 * Event times in this codebase are naive Chicago wall strings
 * ("2026-07-15T20:00"). Rule 10 (docs/ENGINEERING.md): a naive wall string may
 * NEVER be compared against a real instant — `new Date(wallString)` on a UTC
 * server reads 7 PM Chicago as 7 PM UTC and shifts every comparison 5–6 hours.
 * That one mistake is the bug class behind R0.1 and all six R1 findings.
 *
 * The discipline: convert "now" INTO the wall frame (chiNow / chiWallClock)
 * and compare strings, or day keys. Convert a wall string into a real instant
 * (wallToInstant) only at true serialization boundaries — ICS stamps, JSON-LD,
 * SQL parameters — never for "is it past?" logic.
 *
 * Pure, no repo deps. The pieces moved here from their proven homes:
 * chiWallClock (lib/event-view.ts, R0.1), chiDayKey (lib/weekend.ts),
 * chicagoOffset (lib/seo/event-jsonld.ts — upgraded: see below). The old
 * sites re-export for compatibility.
 */

const CHI = "America/Chicago";

/** Chicago wall clock "YYYY-MM-DDTHH:MM" for a real instant. */
export function chiWallClock(instant: Date): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: CHI }).format(instant);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHI,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return `${date}T${time}`;
}

/** Chicago wall clock for RIGHT NOW. The standard "now" for rule-10 comparisons. */
export function chiNow(): string {
  return chiWallClock(new Date());
}

/** YYYY-MM-DD for a Date, evaluated in Chicago. */
export function chiDayKey(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHI }).format(instant);
}

/** Today's Chicago day key. */
export function chiTodayKey(): string {
  return chiDayKey(new Date());
}

/** Wall-to-wall past check. Both arguments must be Chicago wall strings. */
export function isPastWall(wall: string, nowWall: string): boolean {
  return wall < nowWall;
}

function offsetAtInstant(instant: Date): "-05:00" | "-06:00" {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: CHI, timeZoneName: "shortOffset" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  return name.includes("-5") ? "-05:00" : "-06:00";
}

/**
 * Central Time UTC offset for a wall string ("2026-07-15T20:00") or a bare
 * day key ("2026-07-15"). Handles CST/CDT — including DST-transition days,
 * which the old noon-probe version got wrong for small-hours times (a 1 AM
 * time on fall-back day is still CDT; noon that day is CST). Full wall
 * strings resolve by two-pass fixed point on the ACTUAL hour; bare day keys
 * keep the noon-probe behavior (correct for a day-level question). The
 * ambiguous fall-back hour (1:00–1:59 twice) resolves to its first (CDT)
 * occurrence, deterministically.
 */
export function chicagoOffset(local: string): "-05:00" | "-06:00" {
  const dayKey = local.slice(0, 10);
  const time = local.length >= 16 ? local.slice(11, 16) : "12:00";
  // Pass 1: read the wall as if UTC — within an hour or two of the truth.
  const guess = offsetAtInstant(new Date(`${dayKey}T${time}:00Z`));
  // Pass 2: re-probe at the instant the wall would denote under that guess.
  return offsetAtInstant(new Date(`${dayKey}T${time}:00${guess}`));
}

/** The real instant a Chicago wall string denotes. Serialization boundaries only. */
export function wallToInstant(wall: string): Date {
  const dayKey = wall.slice(0, 10);
  const time = wall.length >= 16 ? wall.slice(11, 16) : "00:00";
  return new Date(`${dayKey}T${time}:00${chicagoOffset(wall.length >= 16 ? wall : `${dayKey}T00:00`)}`);
}
