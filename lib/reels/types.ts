import type { CategoryKey } from "../types";

/**
 * Shared contracts for the Reels automation pipeline.
 *
 * The pipeline replicates the manual weekly operation documented in
 * Documents/CityPulseMN (toolkit + b-roll finder + card generator + CapCut):
 * two posting days (Monday = weekday events Mon–Fri, Friday = weekend events
 * Sat–Sun), three variants per day (regular / family / weird), each reel a
 * static "arch card" of exactly 5 events over 7 rotating Pexels b-roll clips
 * (HOOK + 5 events + CTA), ~33s total at 1080×1920 30fps.
 *
 * Ground truth for the visual format is the actual published reels
 * (r64/r59/r75 et al.), NOT the older toolkit spec: no variant badges (card
 * color signals the variant), header and date merged into one line, CTA row
 * "FULL GUIDE AT CITYPULSEMN.COM".
 */

export type Variant = "regular" | "family" | "weird";

/** monday covers Mon–Fri of the current week; friday covers Sat–Sun. */
export type PostDay = "monday" | "friday";

export const VARIANTS: Variant[] = ["regular", "family", "weird"];

/** Card fill colors measured from the live card generator / real reels. */
export const CARD_COLORS: Record<Variant, string> = {
  regular: "#1F2F49", // navy
  family: "#213430", // forest green
  weird: "#431E28", // burgundy
};

/** The four shot types, cycled clip-to-clip; weekly key sets the start. */
export const SHOT_TYPES = [
  "aerial drone",
  "handheld street level",
  "slow motion close up",
  "timelapse cinematic",
] as const;

export interface WeekWindow {
  postDay: PostDay;
  /** Inclusive ISO dates (yyyy-mm-dd), local Minneapolis time. */
  start: string;
  end: string;
  isoWeek: number;
  /** isoWeek % 4 — starting shot type for every reel this week. */
  shotTypeKey: 0 | 1 | 2 | 3;
  /** isoWeek % 3 — which audio lane's terms to use this week. */
  audioLane: 0 | 1 | 2;
}

/** An event candidate, normalized from the site DB or from web top-up. */
export interface CandidateEvent {
  /** DB uuid, or null when found by the web top-up agent. */
  id: string | null;
  title: string;
  category: CategoryKey;
  venue: string;
  city: string;
  /** ISO datetime with offset. */
  startAt: string;
  endAt: string | null;
  price: string;
  priceTier: "Free" | "$" | "$$" | "$$$";
  sourceUrl: string;
  description: string;
}

export interface VariantSelection {
  variant: Variant;
  /** Exactly 5 once complete; may be shorter before top-up. */
  events: CandidateEvent[];
  /** How many events short of 5 the DB pool was (0 = none needed). */
  shortfall: number;
  /** Events considered but excluded, with the reason — honest reporting. */
  excluded: { title: string; reason: string }[];
}

/** One rendered row on the card. */
export interface CardEventLine {
  /** Line 1 — Title Case; weird variant uses periods-as-beats rewrites. */
  name: string;
  /** Line 2 — "Venue, Neighborhood · Day · Time · Price", always one line. */
  details: string;
}

export interface CardContent {
  variant: Variant;
  /** Merged header + date, e.g. "THIS WEEKEND IN MPLS - AUGUST 8TH-9TH". */
  header: string;
  /** Exactly 5. */
  events: CardEventLine[];
  /** Bottom row; currently "FULL GUIDE AT CITYPULSEMN.COM". */
  cta: string;
}

/** One line of the b-roll plan (HOOK, 5 events, CTA — 7 total per reel). */
export interface BrollLine {
  label: string;
  /**
   * 2–5 word Pexels queries, most to least specific (the toolkit says 2–4;
   * the extra word is the shot-type modifier baked into the term).
   */
  terms: string[];
  /** Index into SHOT_TYPES assigned by the clip-to-clip rotation. */
  shotType: 0 | 1 | 2 | 3;
}

/** Everything the copywriter produces for one reel. */
export interface ReelContent {
  day: PostDay;
  variant: Variant;
  card: CardContent;
  /** Instagram caption — variant voice, <100 words, no hashtags, no dashes. */
  caption: string;
  /** Exactly 7, in reel order. */
  broll: BrollLine[];
}

/** A downloaded, accepted b-roll clip. */
export interface PickedClip {
  pexelsId: number;
  /** Local path of the downloaded file. */
  file: string;
  width: number;
  height: number;
  durationSec: number;
  termUsed: string;
  /** "passed" the vision authenticity gate, or "waived" with a warning. */
  authenticity: "passed" | "waived";
  creditName: string;
  creditUrl: string;
}

export interface TimelineSlot {
  index: number;
  /** Seconds into the reel the crossfade INTO this clip starts (fully visible at startSec + fadeSec). */
  startSec: number;
  /** Trimmed duration of the source clip used for this slot. */
  durationSec: number;
}

/**
 * Fixed reel timeline. Matches the published reels: ~33.07s total,
 * 7 slots with 0.4s crossfades (slots overlap by the fade).
 */
export interface Timeline {
  fps: number;
  fadeSec: number;
  slots: TimelineSlot[];
  totalSec: number;
}

/** Rotation memory persisted between weeks (never repeat too soon). */
export interface ReelsHistory {
  /** Pexels search term → last-used ISO date. Do not reuse within 21 days. */
  terms: Record<string, string>;
  /** Pexels video id → last-used ISO date. Do not reuse within 42 days. */
  clips: Record<string, string>;
  /** Audio filename → last-used ISO date. Do not reuse within 28 days. */
  audio: Record<string, string>;
}

/** Per-reel build record written next to the outputs — the honest report. */
export interface ReelResult {
  day: PostDay;
  variant: Variant;
  videoFile: string;
  captionFile: string;
  cardFile: string;
  audioFile: string | null;
  clips: PickedClip[];
  warnings: string[];
}
