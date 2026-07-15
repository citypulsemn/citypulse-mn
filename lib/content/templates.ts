import { DOW, MONTHS, timeLabel } from "../dates";
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
