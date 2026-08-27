import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ReelsHistory } from "./types";

/**
 * Rotation memory for the Reels pipeline: which Pexels terms, clip ids, and
 * audio files were used, and when. "Fresh" means the *usage* is recent —
 * a fresh key must not be reused yet.
 *
 * Windows (from types.ts): terms 21 days, clips 42 days, audio 28 days.
 * Prune drops anything older than 90 days.
 */

export const TERM_WINDOW_DAYS = 21;
export const CLIP_WINDOW_DAYS = 42;
export const AUDIO_WINDOW_DAYS = 28;
export const PRUNE_AFTER_DAYS = 90;

export interface HistoryDeps {
  /** Read a file as utf8 text; throws when missing. */
  readFile(path: string): string;
  writeFile(path: string, data: string): void;
}

const defaultDeps: HistoryDeps = {
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, "utf8");
  },
};

export function emptyHistory(): ReelsHistory {
  return { terms: {}, clips: {}, audio: {} };
}

/** Keep only string→string entries; anything malformed becomes {}. */
function asDateRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, date] of Object.entries(value)) {
    if (typeof date === "string") out[key] = date;
  }
  return out;
}

/** Missing or corrupt file yields a fresh empty history — never crashes. */
export function loadHistory(
  path: string,
  deps: HistoryDeps = defaultDeps,
): ReelsHistory {
  try {
    const parsed: unknown = JSON.parse(deps.readFile(path));
    if (!parsed || typeof parsed !== "object") return emptyHistory();
    const record = parsed as Record<string, unknown>;
    return {
      terms: asDateRecord(record.terms),
      clips: asDateRecord(record.clips),
      audio: asDateRecord(record.audio),
    };
  } catch {
    return emptyHistory();
  }
}

export function saveHistory(
  history: ReelsHistory,
  path: string,
  deps: HistoryDeps = defaultDeps,
): void {
  deps.writeFile(path, JSON.stringify(history, null, 2) + "\n");
}

export function markTermUsed(
  history: ReelsHistory,
  key: string,
  isoDate: string,
): ReelsHistory {
  history.terms[key] = isoDate;
  return history;
}

export function markClipUsed(
  history: ReelsHistory,
  key: string,
  isoDate: string,
): ReelsHistory {
  history.clips[key] = isoDate;
  return history;
}

export function markAudioUsed(
  history: ReelsHistory,
  key: string,
  isoDate: string,
): ReelsHistory {
  history.audio[key] = isoDate;
  return history;
}

/** UTC midnight ms for a yyyy-mm-dd (or ISO datetime) string; NaN if unparseable. */
function utcDayMs(iso: string): number {
  return Date.parse(iso.slice(0, 10) + "T00:00:00Z");
}

/** Whole days from `lastUsed` to `today`; NaN when either date is unparseable. */
function daysSince(lastUsed: string, todayIso: string): number {
  return (utcDayMs(todayIso) - utcDayMs(lastUsed)) / 86_400_000;
}

/**
 * True when the key's last use is within windowDays — i.e. still too fresh to
 * reuse. Exactly windowDays ago is NOT fresh (the window has fully elapsed).
 * Unknown keys and unparseable dates are not fresh.
 */
function isFresh(
  record: Record<string, string>,
  key: string,
  todayIso: string,
  windowDays: number,
): boolean {
  const lastUsed = record[key];
  if (!lastUsed) return false;
  const days = daysSince(lastUsed, todayIso);
  if (Number.isNaN(days)) return false;
  return days < windowDays;
}

export function isTermFresh(
  history: ReelsHistory,
  key: string,
  todayIso: string,
  windowDays: number = TERM_WINDOW_DAYS,
): boolean {
  return isFresh(history.terms, key, todayIso, windowDays);
}

export function isClipFresh(
  history: ReelsHistory,
  key: string,
  todayIso: string,
  windowDays: number = CLIP_WINDOW_DAYS,
): boolean {
  return isFresh(history.clips, key, todayIso, windowDays);
}

export function isAudioFresh(
  history: ReelsHistory,
  key: string,
  todayIso: string,
  windowDays: number = AUDIO_WINDOW_DAYS,
): boolean {
  return isFresh(history.audio, key, todayIso, windowDays);
}

/**
 * Returns a new history without entries older than 90 days. Exactly 90 days
 * old is kept. Entries with unparseable dates are dropped — recency can no
 * longer be established, so they must not block rotation forever.
 */
export function pruneHistory(
  history: ReelsHistory,
  todayIso: string,
): ReelsHistory {
  const keep = (record: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, date] of Object.entries(record)) {
      const days = daysSince(date, todayIso);
      if (!Number.isNaN(days) && days <= PRUNE_AFTER_DAYS) out[key] = date;
    }
    return out;
  };
  return {
    terms: keep(history.terms),
    clips: keep(history.clips),
    audio: keep(history.audio),
  };
}
