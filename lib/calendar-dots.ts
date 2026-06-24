import { categoryColor } from "./categories";
import type { EventRecord } from "./types";

/**
 * Colors for the compact day dots shown on the calendar (mobile especially):
 * one per event, in category color, capped so a busy day stays tidy.
 */
export function eventDotColors(events: EventRecord[], max = 4): string[] {
  return events.slice(0, max).map((e) => categoryColor(e.category));
}
