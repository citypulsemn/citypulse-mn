import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chiDayKey } from "../../clock";
import { KIND_META, type PlaceKind } from "../../places";
import { isoWeekNumber } from "../keys";
import { loadLedger } from "../publish/publisher";
import type { DayManifest } from "../publish/types";
import type { Variant } from "../types";
import { captionErrors } from "../validate";
import { CARD_WEEKDAY, type PlacesCard, type PlacesCardRecord } from "./types";

/**
 * The seams between the card generator and the card publisher: which day is a
 * card day, what counts as rotation history, when a built card is fit to post,
 * the manifest the publish gate reads, and when the publisher must refuse it.
 * Every decision is here with its tests — both scripts are glue over it.
 */

export const CARD_RECORD_FILE = "card.json";

/**
 * The reel publisher's manifest and ledger are keyed by variant. A card has
 * none; it borrows the key of the template colour it is drawn on.
 */
export const CARD_VARIANT: Variant = "family";

/** Local noon of a yyyy-mm-dd key, or null when it is not a real calendar day. */
function localNoon(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const d = new Date(`${dateKey}T12:00:00`);
  // "2026-02-31" parses to March 3 rather than failing; the round trip catches it.
  return !Number.isNaN(d.getTime()) && dayKeyOf(d) === dateKey ? d : null;
}

function dayKeyOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Cards post on Wednesdays. A malformed date is never a card day. */
export function isCardDay(dateKey: string): boolean {
  return localNoon(dateKey)?.getDay() === CARD_WEEKDAY;
}

/** The first `count` card days on or after `fromKey`. */
export function nextCardDays(fromKey: string, count: number): string[] {
  const d = localNoon(fromKey);
  if (!d) throw new Error(`date must be yyyy-mm-dd, got "${fromKey}"`);
  const days: string[] = [];
  while (days.length < count) {
    if (d.getDay() === CARD_WEEKDAY) days.push(dayKeyOf(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * A card.json read back from a "{date}_card" folder. Anything that cannot
 * attest its kind and its date is not history: a record with a bad date would
 * otherwise be skipped silently by the 8-week rule and let a kind repeat.
 */
export function parseCardRecord(raw: unknown, folderDate: string): PlacesCardRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.type !== "places") return null;
  if (typeof rec.kind !== "string" || !Object.hasOwn(KIND_META, rec.kind)) return null;
  if (rec.postDate !== folderDate || !localNoon(folderDate)) return null;
  if (!Array.isArray(rec.slugs) || !rec.slugs.every((s) => typeof s === "string")) return null;
  return { type: "places", kind: rec.kind as PlaceKind, slugs: rec.slugs, postDate: folderDate };
}

export interface CardFolderFs {
  /** Names inside a folder; an empty list when the folder does not exist. */
  list(dir: string): string[];
  /** utf8 text; throws when the file is missing. */
  readFile(path: string): string;
}

const nodeCardFolderFs: CardFolderFs = {
  list: (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  },
  readFile: (path) => readFileSync(path, "utf8"),
};

/** Did the card in this folder actually go out? The publish ledger is the only proof. */
export function cardWasPosted(cardDir: string, fs: CardFolderFs = nodeCardFolderFs): boolean {
  const ledger = loadLedger(cardDir, { readFile: fs.readFile, writeFile: () => {}, exists: () => true });
  return ledger[CARD_VARIANT] !== undefined;
}

/**
 * The 8-week memory: the record of every card that POSTED, read from the card
 * folders under the output root.
 *
 * A folder with a card.json but no ledger entry is a card that was built and
 * never went out — held, refused by Meta, the PC off at both slots, or a
 * rehearsal. Counting those (the first build did) retired the kind for eight
 * weeks over a post that never happened, and a held orchard card would have
 * ended orchards for the year: their window is six weeks long.
 */
export function readCardHistory(
  root: string,
  fs: CardFolderFs = nodeCardFolderFs,
): { records: PlacesCardRecord[]; warnings: string[] } {
  const records: PlacesCardRecord[] = [];
  const warnings: string[] = [];
  for (const name of fs.list(root)) {
    const folderDate = /^(\d{4}-\d{2}-\d{2})_card$/.exec(name)?.[1];
    if (!folderDate) continue;
    const dir = join(root, name);
    if (!cardWasPosted(dir, fs)) continue;
    let raw: unknown = null;
    try {
      raw = JSON.parse(fs.readFile(join(dir, CARD_RECORD_FILE)));
    } catch {
      // falls through to the same warning as a malformed record
    }
    const record = parseCardRecord(raw, folderDate);
    if (record) records.push(record);
    else warnings.push(`${name} posted, but its ${CARD_RECORD_FILE} is unreadable — that week is missing from the 8-week memory`);
  }
  return { records, warnings };
}

/**
 * Why the publisher must not post this manifest today, or null when it may.
 *
 * Two things have to be true of a card that posts: it is today's, and it was
 * built today. The second matters because a card can be generated ahead with
 * --date: if that Wednesday's own 6:30 run then never happens, the folder
 * still holds a complete card made from last week's registry and last week's
 * history. A rehearsal (--dry-run) skips that check — posting nothing, it may
 * rehearse a card built ahead.
 */
export function cardManifestRefusal(
  manifest: Pick<DayManifest, "window" | "generatedAt">,
  today: string,
  rehearsal = false,
): string | null {
  if (manifest.window.start !== today) {
    return `the manifest is for ${manifest.window.start}, not ${today}`;
  }
  if (rehearsal) return null;
  const made = Date.parse(manifest.generatedAt);
  const madeOn = Number.isNaN(made) ? "an unreadable date" : chiDayKey(new Date(made));
  if (madeOn !== today) {
    return `the card was generated on ${madeOn}, not today — today's 6:30 generation did not run, and a card built ahead may be out of date`;
  }
  return null;
}

/** Why a built card must not post. Empty means fit to post. */
export function cardProblems(card: PlacesCard): string[] {
  if (card.status !== "built") return [];
  const problems: string[] = [];
  const rows = card.content?.events ?? [];
  if (rows.length !== 5) problems.push(`card has ${rows.length} rows (need exactly 5)`);
  if (rows.some((r) => !r.name.trim() || !r.details.trim())) {
    problems.push("a row is missing its name or its city");
  }
  const caption = card.caption?.trim() ?? "";
  // captionErrors("") is clean, so emptiness is checked here.
  if (!caption) problems.push("caption is empty");
  problems.push(...captionErrors(caption));
  if (!card.altText?.trim()) problems.push("alt text is empty");
  if (!card.record) problems.push("card has no record for the rotation memory");
  return problems;
}

export type CardOutcome =
  | { status: "built"; imageFile: string; captionFile: string; warnings?: string[] }
  | { status: "skipped"; reason: string; warnings?: string[] };

/**
 * manifest.json for a card folder, in the reel publisher's exact shape so the
 * same gate (HOLD files, ledger, slot, deleted-file veto) reads it unchanged.
 *
 * Two fields are shims for that shape and carry no meaning for a card:
 * `day` admits only monday|friday, and `variant` is the template colour. The
 * folder name and window.start hold the real post date; the card publisher
 * refuses any manifest whose window.start is not today.
 */
export function buildCardManifest(
  postDate: string,
  generatedAt: string,
  outcome: CardOutcome,
): DayManifest {
  const noon = localNoon(postDate);
  if (!noon) throw new Error(`postDate must be yyyy-mm-dd, got "${postDate}"`);
  return {
    day: "monday",
    window: {
      postDay: "monday",
      start: postDate,
      end: postDate,
      isoWeek: isoWeekNumber(noon),
      shotTypeKey: 0,
      audioLane: 0,
    },
    generatedAt,
    smoke: false,
    outcomes: [
      outcome.status === "built"
        ? {
            variant: CARD_VARIANT,
            status: "built",
            videoFile: outcome.imageFile,
            captionFile: outcome.captionFile,
            warnings: outcome.warnings ?? [],
            waivedClips: 0,
          }
        : {
            variant: CARD_VARIANT,
            status: "skipped",
            reason: outcome.reason,
            warnings: outcome.warnings ?? [],
            waivedClips: 0,
          },
    ],
  };
}
