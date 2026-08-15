import { distanceMeters } from "./geo-distance";
import { normalizeCity } from "./areas";
import { displayCityName } from "./cities";
import type { EventRecord } from "./types";

/**
 * "Tailor my view to my area" (Roadmap UX2 U7). The user picks their city and we
 * keep the events within a radius of it.
 *
 * The centroid for each city is computed from that city's OWN events' coordinates —
 * every published event is geocoded (non-null lat/lng, the pipeline skips failures),
 * so this needs no external dataset and invents no coordinates. That's the honest,
 * self-contained MVP; a real zip→coords table (Census ZCTA) or the browser
 * geolocation API can later feed the same `{ lat, lng }` center without touching the
 * filter (U7 follow-ups).
 */

export interface MetroLocation {
  key: string; // normalized city name (the stable id)
  label: string; // display name, e.g. "St. Paul"
  lat: number;
  lng: number;
  count: number; // # of events in this city (busiest first)
}

const MILE_METERS = 1609.344;

/** Radius choices (miles) for the near-me filter. */
export const RADIUS_OPTIONS_MI = [5, 10, 25, 50] as const;
export const DEFAULT_RADIUS_MI = 25;

/**
 * The metro cities that currently have events, each with a centroid = the mean of
 * its events' coordinates. Sorted busiest-first, then alphabetical.
 */
export function cityLocations(events: EventRecord[]): MetroLocation[] {
  const acc = new Map<string, { label: string; sumLat: number; sumLng: number; count: number }>();
  for (const e of events) {
    const key = normalizeCity(e.city ?? "");
    if (!key) continue;
    const cur = acc.get(key) ?? { label: displayCityName(key), sumLat: 0, sumLng: 0, count: 0 };
    cur.sumLat += e.lat;
    cur.sumLng += e.lng;
    cur.count += 1;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([key, v]) => ({ key, label: v.label, lat: v.sumLat / v.count, lng: v.sumLng / v.count, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Keep only events within `radiusMi` miles of the center point (FILTER, so the
 *  chronological day-grouped list stays intact — no reordering). */
export function filterByDistance<T extends { lat: number; lng: number }>(
  events: T[],
  center: { lat: number; lng: number },
  radiusMi: number,
): T[] {
  const maxMeters = radiusMi * MILE_METERS;
  return events.filter((e) => distanceMeters(center.lat, center.lng, e.lat, e.lng) <= maxMeters);
}
