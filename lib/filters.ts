import { areaOf, type AreaKey } from "./areas";
import type { EventRecord, PriceTier } from "./types";

/** The price buckets shown in the filter, aligned to the priceTier system. */
export const PRICE_TIERS: PriceTier[] = ["Free", "$", "$$", "$$$"];

export function matchesPrice(event: EventRecord, prices: Set<PriceTier>): boolean {
  return prices.size === 0 || prices.has(event.priceTier);
}

export function matchesArea(event: EventRecord, areas: Set<AreaKey>): boolean {
  return areas.size === 0 || areas.has(areaOf(event));
}

/** Apply price AND area filters (empty sets = no constraint). */
export function applyPriceArea<T extends EventRecord>(
  events: T[],
  prices: Set<PriceTier>,
  areas: Set<AreaKey>,
): T[] {
  if (prices.size === 0 && areas.size === 0) return events;
  return events.filter((e) => matchesPrice(e, prices) && matchesArea(e, areas));
}
