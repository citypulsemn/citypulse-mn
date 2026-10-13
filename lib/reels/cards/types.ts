import type { PlaceKind } from "../../places";
import type { CardContent } from "../types";

/**
 * Contracts for the weekly still card (docs/REELS-PUBLISH.md, "Still cards").
 *
 * v1 is one card: "Five places" — five places of one kind from the Places
 * registry, built from data alone (no model call), posted as a 1080x1350 JPEG
 * feed post on Wednesdays. Decisions locked with the owner Oct 5, 2026.
 */

/**
 * What a posted card was, written next to it as card.json. The generator
 * reads the last eight weeks of these to enforce "no kind within 8 weeks" —
 * the card folders ARE the rotation memory (the reels' history.json is
 * rewritten by the reel run and would silently erase anything stored there).
 */
export interface PlacesCardRecord {
  type: "places";
  kind: PlaceKind;
  /** The five place slugs, in card order. */
  slugs: string[];
  /** Local post date, yyyy-mm-dd. */
  postDate: string;
}

/** Why a kind was or wasn't usable this week — goes in the manifest. */
export interface KindConsideration {
  kind: PlaceKind;
  /** Card-safe places of this kind on the post date, a multi-location name counted once. */
  eligible: number;
  note: string;
}

export interface PlacesCard {
  status: "built" | "skipped";
  /** Present when skipped: the honest reason, emailed and written to the manifest. */
  reason?: string;
  kind?: PlaceKind;
  /** variant is always "family" (the forest template). */
  content?: CardContent;
  /** Instagram caption — reel policy: no hashtags, emoji or dashes, under 100 words. */
  caption?: string;
  /** alt_text for the image post, at most 1000 characters. */
  altText?: string;
  record?: PlacesCardRecord;
  considered: KindConsideration[];
}

/** Wednesday is the card day (owner's decision). 0 = Sunday. */
export const CARD_WEEKDAY = 3;

/** One slot for every card: inside the Tue–Thu 10–3 band the studies favour. */
export const CARD_SLOT = "11:45";

/** The catch-up firing on the same day; a card built after it has no run left. */
export const CARD_CATCH_UP = "18:30";
