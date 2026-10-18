import { sql } from "./db";
import { geocode, type GeoResult } from "./geocode";
import { roomKey } from "./contradictions";

/**
 * THE COORDINATE FOR A ROOM, DECIDED ONCE.
 *
 * `geocode()` used to be called per EVENT, in the pipeline loop, on whatever
 * address string the finding agent supplied — and agents spell one address
 * several ways. Mapbox answers differently for each spelling, nothing cached the
 * result, and nothing reconciled them afterwards. Measured 18 Oct 2026: 14 rooms
 * held 2–4 pins across 95 live listings. The Minnesota Children's Museum had two
 * pins 8.2km apart carrying the SAME address, and one coordinate was serving
 * both Grand Casino Arena and the Science Museum because "W Kellogg Blvd"
 * resolved to a street centroid with the house number ignored.
 *
 * So the pin is now keyed by the ROOM, not the address string. First caller to
 * ask for a room settles it; everyone after reads the stored answer and makes no
 * network call at all. `scripts/venue-pins.ts` can overwrite any room with a
 * two-geocoder answer, and that correction then applies to every event that
 * ever lands there.
 *
 * `source` is recorded honestly: a pin established here comes from ONE geocoder
 * and says so, which is how `npm run pins` knows which rooms are still only a
 * single opinion.
 */

/** Within one process, ask the database once per room, not once per event. */
const memo = new Map<string, GeoResult | null>();

/** Only for tests and long-lived processes that outlive a pipeline run. */
export function clearRoomPinMemo(): void {
  memo.clear();
}

export async function roomPin(
  venue: string,
  address: string,
  city = "",
): Promise<GeoResult | null> {
  const key = roomKey(venue);
  if (!key) return geocode(address, city);
  if (memo.has(key)) return memo.get(key)!;

  // A stored pin wins over anything a geocoder would say now. That is the point:
  // the room's location does not depend on how this week's agent typed it.
  if (sql) {
    try {
      const [row] = await sql<{ lat: number; lng: number }[]>`
        select lat::float as lat, lng::float as lng from venue_coords where room_key = ${key}
      `;
      if (row) {
        const hit = { lat: row.lat, lng: row.lng };
        memo.set(key, hit);
        return hit;
      }
    } catch (err) {
      // Rule 1: the cache must not break the thing it speeds up. Fall through
      // to a live geocode rather than dropping the event.
      console.warn(`[pin] venue_coords unreadable for "${venue}", geocoding live:`, err);
    }
  }

  // Unknown room. Try the address, then the venue NAME — a name often resolves
  // when a mangled address does not, and a null here used to mean the listing
  // was dropped entirely (run-pipeline.ts "no geocode, skipping").
  let hit = await geocode(address, city);
  if (!hit && venue.trim()) hit = await geocode(venue, city);
  memo.set(key, hit);

  if (hit && sql) {
    try {
      await sql`
        insert into venue_coords (room_key, lat, lng, label, source, agreed_m)
        values (${key}, ${hit.lat}, ${hit.lng}, ${venue.slice(0, 300)}, 'mapbox(single opinion)', null)
        on conflict (room_key) do nothing
      `;
    } catch (err) {
      console.warn(`[pin] could not record the pin for "${venue}":`, err);
    }
  }
  return hit;
}
