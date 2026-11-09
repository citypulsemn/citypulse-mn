import { DOW, MONTHS, timeLabel } from "../dates";
import { soonestFirstThenRuns } from "../list-view";
import { isMultiDay, multiDayLabel } from "../multiday";
import { KIND_META, type Place } from "../places";
import type { CollectionSpec } from "../collections";
import type { EventRecord, CategoryKey } from "../types";
import type { WeeklyPicks } from "./weekly-picks";

/**
 * Pure caption/hashtag builders. Deterministic so the voice stays consistent
 * and the output is unit-testable. The site CTA is what closes the flywheel
 * (IG post → citypulsemn.com → back into the feed).
 */

export type CardLabel = "week" | "family" | "unique" | "regular";

export const FORMAT_LABEL: Record<CardLabel, string> = {
  week: "THIS WEEK",
  family: "FAMILY PICK",
  unique: "UNIQUELY MN",
  regular: "ON THE RADAR",
};

const SITE_CTA = "Full details + more this week → citypulsemn.com (link in bio)";

const BASE_TAGS = ["#TwinCities", "#Minneapolis", "#MNevents", "#ThingsToDoMN"];

const CAT_TAGS: Record<CategoryKey, string[]> = {
  music: ["#LiveMusic", "#MNmusic"],
  sports: ["#MNsports", "#GameDay"],
  family: ["#FamilyFun", "#KidsMN"],
  arts: ["#MNarts", "#TheatreMN"],
  food: ["#MNfood", "#Foodie"],
  weird: ["#OnlyInMN", "#KeepItWeird"],
  festival: ["#MNfestivals", "#Festival"],
};

const MAJOR_CITIES = new Set(["minneapolis", "st paul", "saint paul", "st. paul"]);

/** Short date like "Sat, Jul 18". */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${DOW[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function hashtagsFor(event: EventRecord): string[] {
  const tags = [...BASE_TAGS, ...(CAT_TAGS[event.category] ?? [])];
  const city = event.city?.trim();
  if (city && !MAJOR_CITIES.has(city.toLowerCase())) {
    tags.push("#" + city.replace(/[^A-Za-z0-9]/g, ""));
  }
  // De-dupe, keep order, cap length.
  return [...new Set(tags)].slice(0, 11);
}

function hook(label: CardLabel, event: EventRecord): string {
  switch (label) {
    case "family":
      return "One for the whole crew this week 👨‍👩‍👧‍👦";
    case "unique":
      return "Only-in-Minnesota energy 👀";
    default:
      return event.priceTier === "Free"
        ? "Free thing worth your weekend 📍"
        : "On our radar this week 📍";
  }
}

export function captionFor(event: EventRecord, label: CardLabel = "regular"): string {
  const lines: string[] = [];
  lines.push(hook(label, event));
  lines.push("");
  lines.push(event.title);
  lines.push(`📅 ${shortDate(event.start)} · ${timeLabel(event)}`);
  lines.push(`📍 ${event.venue}${event.city ? ` · ${event.city}` : ""}`);
  if (event.price && event.price !== "See listing") lines.push(`💵 ${event.price}`);
  lines.push("");
  lines.push(SITE_CTA);
  lines.push("");
  lines.push(hashtagsFor(event).join(" "));
  return lines.join("\n");
}

/** Instagram caption for a Place (the evergreen "where to go" half). Deterministic
 *  and unit-tested, house voice, closing on the /places bio link — the flywheel
 *  from IG to the Places pages we're trying to get discovered. */
export function placeCaptionFor(place: Place): string {
  const lines: string[] = [];
  lines.push("📍 Place of the week");
  lines.push("");
  lines.push(place.name);
  lines.push(`${KIND_META[place.kind].label} · ${place.city}`);
  lines.push("");
  lines.push(place.intro);
  lines.push("");
  lines.push(`Find it on the map → citypulsemn.com/places/${place.kind} (link in bio)`);
  lines.push("");
  const city = place.city?.trim();
  const tags = [...BASE_TAGS, "#ExploreMN"];
  if (city && !MAJOR_CITIES.has(city.toLowerCase())) tags.push("#" + city.replace(/[^A-Za-z0-9]/g, ""));
  lines.push([...new Set(tags)].slice(0, 11).join(" "));
  return lines.join("\n");
}

/** Instagram caption for a collection/topic (e.g. Food Truck Festivals) — the
 *  demand-validated evergreen pages. `sample` is a few of the collection's events
 *  (may be empty; the caption degrades to just the tagline + CTA). Pure/tested. */
/** Rows on a collection's share card. Six fits the 1080×1350 frame. */
export const CARD_ROWS = 6;

/** Rows the matching caption lists. Fewer than the card: a caption is skimmed. */
export const CAPTION_ROWS = 4;

/**
 * Which events a collection's share card lists.
 *
 * Collections went span-aware on 5 Nov 2026 (roadmap S4), so mid-run events
 * reach this card for the first time — and `selectCollection` returns them
 * sorted by start ascending, which puts them FIRST. Taking the first six
 * therefore swapped "what's on soon" for "what started longest ago": the live
 * Date Night card led with an eleven-month gallery rotation and carried no
 * dated event at all. The S4 commit fixed the DATE LABEL on these rows and
 * left the ordering, so the card was wrong in a second way nothing caught —
 * the route renders an image, so no test read it.
 *
 * Soonest-starting first, topped up with runs (ending soonest, via
 * planListView's own order) only when the calendar is thin. A quiet week shows
 * real runs rather than blank rows, which is rule 6.
 */
export function collectionCardRows(
  selected: EventRecord[],
  todayKey: string,
  limit = CARD_ROWS,
): EventRecord[] {
  return soonestFirstThenRuns(selected, todayKey).slice(0, limit);
}

/**
 * The caption that ships BESIDE the collection share card, for the operator to
 * paste. It must list the same events, in the same order, with the same dates as
 * the card at /content/collection/<slug> — they are posted together.
 *
 * It did not. `sample` is selectCollection's output, start-ascending, so
 * slice(0, 4) took the four rows that opened LONGEST AGO, and shortDate(e.start)
 * printed each one's start — a date months before the post. The card was fixed on
 * 6 Nov 2026 (collectionCardRows); the caption beside it was not.
 *
 * Measured 8 Nov 2026: the collection actually wired up (food-truck-festivals) is
 * empty today, so nothing is firing — but 4 of the 8 collections would hand the
 * caption different rows than the card, 3 or 4 of them dated before today.
 */
export function collectionCaptionFor(
  collection: CollectionSpec,
  sample: EventRecord[],
  todayKey: string,
): string {
  const lines: string[] = [];
  lines.push(`🗓️ ${collection.title.toUpperCase()}`);
  lines.push("");
  lines.push(collection.tagline);
  if (sample.length > 0) {
    lines.push("");
    // The card's own rows, labelled the card's own way: a run states its span
    // (app/content/collection/[slug]/route.tsx does exactly this).
    for (const e of collectionCardRows(sample, todayKey, CAPTION_ROWS)) {
      lines.push(`• ${e.title} — ${isMultiDay(e) ? multiDayLabel(e) : shortDate(e.start)}`);
    }
  }
  lines.push("");
  lines.push(`See them all → citypulsemn.com/collections/${collection.slug} (link in bio)`);
  lines.push("");
  lines.push([...BASE_TAGS, "#TwinCitiesEvents"].join(" "));
  return lines.join("\n");
}

export function weeklyCaptionFor(picks: WeeklyPicks): string {
  const lines: string[] = [];
  lines.push("🗓️ THIS WEEK IN THE TWIN CITIES");
  lines.push("");
  lines.push("What's on our radar:");

  if (picks.family) lines.push(`👨‍👩‍👧‍👦 ${picks.family.title} — ${shortDate(picks.family.start)}`);
  if (picks.unique) lines.push(`👀 ${picks.unique.title} — ${shortDate(picks.unique.start)}`);
  for (const e of picks.regular) {
    lines.push(`• ${e.title} — ${shortDate(e.start)} @ ${e.venue}`);
  }

  lines.push("");
  lines.push("Full lineup + details → citypulsemn.com (link in bio)");
  lines.push("");
  lines.push([...BASE_TAGS, "#MNweekend", "#TwinCitiesEvents"].join(" "));
  return lines.join("\n");
}
