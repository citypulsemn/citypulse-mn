import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { VARIANTS, type Variant } from "../types";
import type {
  DayManifest,
  HoldState,
  ManifestOutcome,
  PublishLedger,
  PublishPlanItem,
  PublishResult,
  SlotTimes,
} from "./types";

/**
 * The publisher's brain — every decision about what posts, holds, waits, or
 * skips lives here as pure logic, with all I/O injected. Locked gate policy
 * (docs/REELS-PUBLISH.md): clean reels auto-publish at their slot; anything
 * flagged holds for a human. The published.json ledger makes reruns no-ops,
 * and HOLD files are the human's veto — nothing overrides them, not even
 * --force-held.
 */

export const MANIFEST_FILE = "manifest.json";
export const LEDGER_FILE = "published.json";
export const HOLD_FILE = "HOLD";

/** HOLD blocks the whole day; HOLD.<variant> blocks one reel. */
export function holdFileFor(variant: Variant): string {
  return `${HOLD_FILE}.${variant}`;
}

export interface PublisherFsDeps {
  /** Read a file as utf8 text; throws when missing. */
  readFile(path: string): string;
  writeFile(path: string, data: string): void;
  exists(path: string): boolean;
}

export const defaultPublisherFsDeps: PublisherFsDeps = {
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, "utf8");
  },
  exists: (path) => existsSync(path),
};

/**
 * Outcome fields the gate reads (variant, status, waivedClips, file paths)
 * are validated strictly — a manifest that can't attest them can't be trusted
 * to publish. waivedClips may be absent only on a "skipped" outcome, where
 * nothing shipped so nothing can be waived. Warnings are informational, so
 * malformed entries are dropped rather than poisoning the manifest.
 */
function normalizeOutcome(raw: unknown): ManifestOutcome | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (!VARIANTS.includes(rec.variant as Variant)) return null;
  if (rec.status !== "built" && rec.status !== "skipped") return null;
  let waivedClips: number;
  if (typeof rec.waivedClips === "number" && Number.isFinite(rec.waivedClips)) {
    waivedClips = rec.waivedClips;
  } else if (rec.waivedClips === undefined && rec.status === "skipped") {
    waivedClips = 0;
  } else {
    return null;
  }
  const outcome: ManifestOutcome = {
    variant: rec.variant as Variant,
    status: rec.status,
    warnings: Array.isArray(rec.warnings)
      ? rec.warnings.filter((w): w is string => typeof w === "string")
      : [],
    waivedClips,
  };
  if (typeof rec.reason === "string") outcome.reason = rec.reason;
  if (typeof rec.videoFile === "string") outcome.videoFile = rec.videoFile;
  if (typeof rec.captionFile === "string") outcome.captionFile = rec.captionFile;
  if (typeof rec.durationSec === "number") outcome.durationSec = rec.durationSec;
  return outcome;
}

/**
 * Missing or corrupt manifest.json yields null — the CLI reports "no
 * manifest.json — generation didn't run?" and publishes nothing. Refusing to
 * publish on ambiguity is the fail-safe direction: a manifest that can't
 * attest smoke/status/waivedClips must not post reels.
 */
export function loadManifest(
  dayDir: string,
  deps: PublisherFsDeps = defaultPublisherFsDeps,
): DayManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(deps.readFile(join(dayDir, MANIFEST_FILE)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.day !== "monday" && rec.day !== "friday") return null;
  if (!rec.window || typeof rec.window !== "object" || Array.isArray(rec.window)) return null;
  const win = rec.window as Record<string, unknown>;
  // A manifest that can't attest its window must not publish (object names
  // and day-folder identity both derive from window.start).
  if (typeof win.start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(win.start)) return null;
  if (typeof win.end !== "string" || win.postDay !== rec.day) return null;
  if (typeof rec.generatedAt !== "string") return null;
  if (typeof rec.smoke !== "boolean") return null;
  if (!Array.isArray(rec.outcomes)) return null;
  const outcomes: ManifestOutcome[] = [];
  for (const raw of rec.outcomes) {
    const outcome = normalizeOutcome(raw);
    if (!outcome) return null;
    outcomes.push(outcome);
  }
  return {
    day: rec.day,
    window: rec.window as DayManifest["window"],
    generatedAt: rec.generatedAt,
    smoke: rec.smoke,
    outcomes,
  };
}

/**
 * Missing or corrupt published.json yields an empty ledger — never crash.
 * Losing a ledger at worst re-posts a reel; the HOLD veto and the plan's
 * hold rules are re-checked every run regardless. Malformed entries are
 * dropped individually so one bad line doesn't erase the good ones.
 */
export function loadLedger(
  dayDir: string,
  deps: PublisherFsDeps = defaultPublisherFsDeps,
): PublishLedger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(deps.readFile(join(dayDir, LEDGER_FILE)));
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const rec = parsed as Record<string, unknown>;
  const ledger: PublishLedger = {};
  for (const variant of VARIANTS) {
    const entry = rec[variant];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { containerId, mediaId, publishedAt } = entry as Record<string, unknown>;
    if (
      typeof containerId === "string" &&
      typeof mediaId === "string" &&
      typeof publishedAt === "string"
    ) {
      ledger[variant] = { containerId, mediaId, publishedAt };
    }
  }
  return ledger;
}

export function saveLedger(
  dayDir: string,
  ledger: PublishLedger,
  deps: PublisherFsDeps = defaultPublisherFsDeps,
): void {
  deps.writeFile(join(dayDir, LEDGER_FILE), JSON.stringify(ledger, null, 2) + "\n");
}

/** HOLD file in the day folder = the human's veto; HOLD.<variant> per reel. */
export function detectHolds(
  dayDir: string,
  deps: Pick<PublisherFsDeps, "exists"> = defaultPublisherFsDeps,
): HoldState {
  return {
    global: deps.exists(join(dayDir, HOLD_FILE)),
    variants: new Set(
      VARIANTS.filter((variant) => deps.exists(join(dayDir, holdFileFor(variant)))),
    ),
  };
}

const SLOT_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * LOCAL-time compare at minute precision — the exact minute counts as
 * reached (an 8:30 slot is due at 8:30:00). A malformed slot throws loudly:
 * silently treating it as "not reached" would mean reels never post and
 * nothing ever says why.
 */
export function slotReached(slot: string, now: Date): boolean {
  const match = SLOT_RE.exec(slot);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!match || hours > 23 || minutes > 59) {
    throw new Error(`Invalid slot time "${slot}" — expected "HH:MM" 24h`);
  }
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

/** Meta's rolling-24h cap on API-published posts. */
export const QUOTA_LIMIT = 100;
/** Hold when usage leaves less headroom than this — we never need more than 3. */
export const QUOTA_HOLD_HEADROOM = 5;

export interface PlanOptions {
  /**
   * --force-held: publish reels held ONLY for authenticity-waived clips (the
   * human reviewed them). HOLD files always win — they are the explicit veto.
   */
  forceHeld?: boolean;
  /**
   * Existence check for the manifest's videoFile — a deleted mp4 is the
   * human's veto-by-deletion (docs/REELS-PUBLISH.md), planned as a skip, not
   * an upload-time ENOENT. Defaults to "exists" so planPublish stays pure.
   */
  fileExists?: (path: string) => boolean;
  /**
   * Current content_publishing_limit usage, when the CLI fetched it. At
   * QUOTA_LIMIT - QUOTA_HOLD_HEADROOM or beyond, publishes hold — can't
   * happen at our volume, but checked because the doc promises it.
   */
  quotaUsage?: number;
}

/**
 * One plan item per manifest outcome. First matching rule wins, in this
 * order: smoke → generator-skipped → already in ledger → HOLD file → waived
 * clips → incomplete manifest → slot not reached → publish.
 */
export function planPublish(
  manifest: DayManifest,
  ledger: PublishLedger,
  holds: HoldState,
  slots: SlotTimes,
  now: Date,
  opts: PlanOptions = {},
): PublishPlanItem[] {
  return manifest.outcomes.map((outcome): PublishPlanItem => {
    const { variant } = outcome;
    if (manifest.smoke) {
      return { variant, action: "skip", reason: "smoke run — never published" };
    }
    if (outcome.status === "skipped") {
      return {
        variant,
        action: "skip",
        reason: outcome.reason ?? "skipped by the generator (no reason recorded)",
      };
    }
    const published = ledger[variant];
    if (published) {
      return {
        variant,
        action: "skip",
        reason: `already published (media ${published.mediaId})`,
      };
    }
    if (holds.global || holds.variants.has(variant)) {
      return { variant, action: "hold", reason: "HOLD file present" };
    }
    if (outcome.waivedClips > 0 && !opts.forceHeld) {
      return {
        variant,
        action: "hold",
        reason: `${outcome.waivedClips} authenticity-waived clip(s) — review, then --force-held or remove the flag`,
      };
    }
    if (!outcome.videoFile || !outcome.captionFile) {
      return { variant, action: "hold", reason: "manifest incomplete" };
    }
    if (opts.fileExists && !opts.fileExists(outcome.videoFile)) {
      return {
        variant,
        action: "skip",
        reason: "video file deleted — treated as your veto, not published",
      };
    }
    const slot = slots[variant];
    if (!slotReached(slot, now)) {
      return { variant, action: "wait", reason: `slot ${slot} not reached` };
    }
    if (
      opts.quotaUsage !== undefined &&
      opts.quotaUsage >= QUOTA_LIMIT - QUOTA_HOLD_HEADROOM
    ) {
      return {
        variant,
        action: "hold",
        reason: `API publish quota nearly exhausted (${opts.quotaUsage}/${QUOTA_LIMIT})`,
      };
    }
    return { variant, action: "publish", reason: `due (slot ${slot})` };
  });
}

/** Narrow views of the sibling modules — the CLI adapts host.ts/instagram.ts. */
export interface PublishHostDeps {
  /** Uploads the mp4; returns the public URL Meta will fetch. */
  upload(localFile: string, objectName: string): Promise<string>;
  remove(objectName: string): Promise<void>;
}

export interface PublishIgDeps {
  /** Returns the container id. */
  createReelContainer(videoUrl: string, caption: string): Promise<string>;
  /** Returns the published media id. */
  publish(containerId: string): Promise<string>;
}

export interface ExecuteDeps {
  files: PublisherFsDeps;
  readCaption(captionFile: string): string | Promise<string>;
  buildObjectName(variant: Variant, manifest: DayManifest): string;
  host: PublishHostDeps;
  ig: PublishIgDeps;
  /** Polls until the container is FINISHED; throws on ERROR/EXPIRED/timeout. */
  waitForContainer(containerId: string): Promise<void>;
  /** Injectable clock for the ledger's publishedAt stamps. */
  now(): Date;
}

const ACTION_OUTCOME = {
  wait: "waiting",
  hold: "held",
  skip: "skipped",
} as const;

/**
 * Runs the plan sequentially. The ledger is saved after EACH successful
 * publish so a later failure never loses an earlier one, and each item's
 * failure is caught so the siblings still get their turn. Once a file is
 * hosted, its removal is always attempted — success or failure — so nothing
 * persists publicly beyond the publish window.
 */
export async function executePlan(
  plan: PublishPlanItem[],
  manifest: DayManifest,
  dayDir: string,
  deps: ExecuteDeps,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  const ledger = loadLedger(dayDir, deps.files);

  for (const item of plan) {
    if (item.action !== "publish") {
      results.push({
        variant: item.variant,
        outcome: ACTION_OUTCOME[item.action],
        detail: item.reason,
      });
      continue;
    }

    const outcome = manifest.outcomes.find((o) => o.variant === item.variant);
    if (!outcome?.videoFile || !outcome.captionFile) {
      // planPublish holds incomplete outcomes; only a hand-built plan lands here.
      results.push({
        variant: item.variant,
        outcome: "failed",
        detail: "manifest outcome missing or incomplete — cannot publish",
      });
      continue;
    }

    let hostedObject: string | null = null;
    try {
      const caption = await deps.readCaption(outcome.captionFile);
      const objectName = deps.buildObjectName(item.variant, manifest);
      const url = await deps.host.upload(outcome.videoFile, objectName);
      hostedObject = objectName; // from here a public file exists
      const containerId = await deps.ig.createReelContainer(url, caption);
      await deps.waitForContainer(containerId);
      const mediaId = await deps.ig.publish(containerId);
      ledger[item.variant] = {
        containerId,
        mediaId,
        publishedAt: deps.now().toISOString(),
      };
      let detail = `published (media ${mediaId})`;
      try {
        saveLedger(dayDir, ledger, deps.files);
      } catch {
        // The post IS live — report it published, but flag the rerun risk.
        detail += " — WARNING: published.json save failed; a rerun may double-post";
      }
      results.push({ variant: item.variant, outcome: "published", detail, mediaId });
    } catch (err) {
      results.push({
        variant: item.variant,
        outcome: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (hostedObject) {
        try {
          await deps.host.remove(hostedObject);
        } catch {
          // Cleanup failure must not mask the real outcome, but it can't be
          // silent either: the doc promises nothing persists publicly beyond
          // the publish window. Flag it on this reel's result.
          const last = results[results.length - 1];
          if (last?.variant === item.variant) {
            last.detail += ` — WARNING: hosted file removal failed; ${hostedObject} is still public in the reels-publish bucket`;
          }
        }
      }
    }
  }

  return results;
}

export interface OpsSummary {
  subject: string;
  lines: string[];
}

/**
 * Holds, failures, and degraded successes earn an email — fully clean runs
 * (published, waiting for a later slot, generator-skipped) are silent. A
 * "degraded" run is one whose results carry an embedded WARNING (ledger save
 * failed, hosted file not removed) or whose caller passed warnings (e.g. a
 * token refresh that fell back) — live posts with a problem the inbox must
 * see. The lines carry every result so the email shows the whole day.
 */
export function summarizeForOps(
  results: PublishResult[],
  dayLabel: string,
  extraWarnings: string[] = [],
): OpsSummary | null {
  const failed = results.filter((r) => r.outcome === "failed").length;
  const held = results.filter((r) => r.outcome === "held").length;
  const degraded = results.filter(
    (r) => r.outcome === "published" && r.detail.includes("WARNING:"),
  ).length;
  if (!failed && !held && !degraded && extraWarnings.length === 0) return null;
  const counts = [
    failed ? `${failed} failed` : "",
    held ? `${held} held` : "",
    degraded ? `${degraded} published with warnings` : "",
    !failed && !held && !degraded ? "warnings" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    subject: `Reels publish (${dayLabel}): ${counts}`,
    lines: [
      ...results.map((r) => `${r.variant}: ${r.outcome} — ${r.detail}`),
      ...extraWarnings.map((w) => `⚠ ${w}`),
    ],
  };
}
