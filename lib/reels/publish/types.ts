import type { PostDay, Variant, WeekWindow } from "../types";

/**
 * Shared contracts for phase 2 — auto-publishing generated reels to
 * Instagram via the Instagram Platform API (Instagram Login variant, no
 * Facebook Page). Architecture and locked decisions: docs/REELS-PUBLISH.md.
 *
 * Publishing is driven by manifest.json, the machine-readable record the
 * generator writes next to manifest.md — the gate parses data, never
 * markdown.
 */

/** The generator's machine-readable day record (manifest.json). */
export interface DayManifest {
  day: PostDay;
  window: WeekWindow;
  generatedAt: string;
  /** Smoke runs are never publishable. */
  smoke: boolean;
  outcomes: ManifestOutcome[];
}

export interface ManifestOutcome {
  variant: Variant;
  status: "built" | "skipped";
  reason?: string;
  /** Absolute paths, present when built. */
  videoFile?: string;
  captionFile?: string;
  durationSec?: number;
  warnings: string[];
  /** Count of clips that shipped with authenticity "waived" — a hold trigger. */
  waivedClips: number;
}

/** ig-token.json in Documents\CityPulseMN — never in the repo. */
export interface IgToken {
  accessToken: string;
  igUserId: string;
  username: string;
  /** ISO datetime of the original auth. */
  obtainedAt: string;
  /** ISO datetime of the last successful 60-day refresh. */
  lastRefreshedAt: string;
}

/** published.json in the day folder — the double-post guard. */
export type PublishLedger = Partial<
  Record<Variant, { containerId: string; mediaId: string; publishedAt: string }>
>;

/** Per-variant local publish times, "HH:MM" 24h — tunable constants. */
export type SlotTimes = Record<Variant, string>;

/** Locked with Taren (reach review, Aug 2026): staggered so the three reels
 * never compete in the same first-hour window. */
export const DEFAULT_SLOTS: SlotTimes = {
  regular: "08:30",
  family: "11:45",
  weird: "18:30",
};

export interface HoldState {
  /** HOLD file in the day folder — blocks everything. */
  global: boolean;
  /** HOLD.<variant> files — block one reel each. */
  variants: Set<Variant>;
}

export type PlanAction = "publish" | "wait" | "hold" | "skip";

export interface PublishPlanItem {
  variant: Variant;
  action: PlanAction;
  /** Human-readable, lands in logs and the ops email. */
  reason: string;
}

export interface PublishResult {
  variant: Variant;
  outcome: "published" | "held" | "skipped" | "waiting" | "failed";
  detail: string;
  mediaId?: string;
}
