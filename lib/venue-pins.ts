import { distanceMeters } from "./geo-distance";
import { roomKey } from "./contradictions";

/**
 * ONE PIN PER ROOM.
 *
 * `geocode()` ran once per EVENT, inside the pipeline loop, on whatever address
 * string the finding agent supplied. Agents spell an address several ways, the
 * geocoder answers differently for each, nothing was cached and nothing
 * reconciled the results. Measured 18 Oct 2026: 14 rooms held 2–4 pins across
 * 95 live listings, and the worst was 25km apart.
 *
 * The lesson carried over from the places audit (74 of 567 place pins were
 * wrong, worst 10.5km) is the rule enforced here: **one geocoder is a question,
 * two agreeing is a finding** — and two queries to the SAME geocoder is still
 * one geocoder, which is why `agreeingPin` requires different providers.
 *
 * Pure. The geocoding and the writes live in scripts/venue-pins.ts.
 */

/** A geocoder's answer, tagged with who said it. */
export interface Hit {
  provider: string;
  query: string;
  lat: number;
  lng: number;
  label?: string;
}

/**
 * How close two providers must land before we believe them.
 *
 * 300m, not tighter: a large venue legitimately geocodes to its entrance, its
 * parcel centroid or its marquee, and Allianz Field's two sources sat 207m
 * apart while both plainly meaning the stadium. Tighter would have rejected
 * every arena. Looser starts accepting the street-centroid answers that caused
 * this.
 */
export const AGREE_METRES = 300;

/** Two pins disagree enough to be worth fixing. Below this it is noise. */
export const DISAGREE_METRES = 500;

export interface Agreement {
  lat: number;
  lng: number;
  metres: number;
  by: string;
  label?: string;
}

/**
 * The tightest pair of hits from DIFFERENT providers that agree within
 * `AGREE_METRES`, or null.
 *
 * Returning null is a real answer — four of the fourteen rooms needed a better
 * query before they resolved, and one (Dead End Hayride) only resolved after
 * reading the attraction's own site, where the address turned out to be on a
 * different road entirely from the one guessed for it.
 */
export function agreeingPin(hits: Hit[], within = AGREE_METRES): Agreement | null {
  let best: Agreement | null = null;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i];
      const b = hits[j];
      if (a.provider === b.provider) continue; // same geocoder twice is one opinion
      const m = Math.round(distanceMeters(a.lat, a.lng, b.lat, b.lng));
      if (m > within) continue;
      if (!best || m < best.metres) {
        best = { lat: a.lat, lng: a.lng, metres: m, by: `${a.provider}(${a.query}) + ${b.provider}(${b.query})`, label: a.label };
      }
    }
  }
  return best;
}

/** A stored pin and how many listings carry it. */
export interface StoredPin {
  lat: number;
  lng: number;
  count: number;
}

/** How far apart the two most distant pins for one room are. */
export function pinSpreadMetres(pins: StoredPin[]): number {
  let max = 0;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      max = Math.max(max, distanceMeters(pins[i].lat, pins[i].lng, pins[j].lat, pins[j].lng));
    }
  }
  return Math.round(max);
}

/** Does this room need looking at? */
export function roomDisagrees(pins: StoredPin[], threshold = DISAGREE_METRES): boolean {
  return pins.length > 1 && pinSpreadMetres(pins) > threshold;
}

/**
 * Group listings by room. Folded with `roomKey`, so "Varsity Theater" and
 * "Varsity Theater (Minneapolis)" are one room — the same fold the duplicate
 * detector and the curated calendar registry use, so there is one definition of
 * "the same room" rather than three.
 */
export function groupByRoom<T extends { venue: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = roomKey(r.venue);
    const at = out.get(k);
    if (at) at.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/** Distinct pins in a set of listings, commonest first. */
export function distinctPins(rows: { lat: number | null; lng: number | null }[]): StoredPin[] {
  const by = new Map<string, StoredPin>();
  for (const r of rows) {
    if (r.lat === null || r.lng === null) continue;
    const k = `${r.lat},${r.lng}`;
    const at = by.get(k);
    if (at) at.count++;
    else by.set(k, { lat: r.lat, lng: r.lng, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}

/**
 * Which addresses in a room's listings are worth sending to a geocoder.
 *
 * Longest first, because the longest spelling is usually the most complete, and
 * dropping the ones with no digit or an obvious placeholder matters: "See
 * listing", "Main Street" and "Wyoming, MN (see website)" all appeared in the
 * affected rooms, and a geocoder answers those with a street centroid or
 * another town rather than failing, which is how a wrong pin looks confident.
 */
export function usableAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  return addresses
    .map((a) => (a ?? "").trim())
    .filter((a) => a.length > 0)
    .filter((a) => /\d/.test(a))
    .filter((a) => !/see (the )?(listing|website|site)|tbd|various|multiple/i.test(a))
    .filter((a) => (seen.has(a.toLowerCase()) ? false : (seen.add(a.toLowerCase()), true)))
    .sort((a, b) => b.length - a.length);
}
