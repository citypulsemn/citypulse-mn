/**
 * Server-side geocoding via the Mapbox Geocoding API.
 * Uses a server token if provided (recommended), else falls back to the
 * public map token. Never call this from the browser.
 */
import { envValue } from "./env";

const TOKEN =
  envValue("MAPBOX_GEOCODING_TOKEN", "NEXT_PUBLIC_MAPBOX_TOKEN");

// Bias results toward downtown Minneapolis.
const PROXIMITY = "-93.2650,44.9778";

export interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocode(
  address: string,
  city = "",
  state = "MN",
): Promise<GeoResult | null> {
  if (!TOKEN) return null;
  // A blank address must not become a query for the city. "Minneapolis, MN" gets a
  // confident answer, and roomPin stores it as that room's pin for good. The old
  // guard tested the joined query, which always holds the state, so it never fired.
  if (!address.trim()) return null;
  const query = [address, city, state].filter(Boolean).join(", ");

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${TOKEN}&country=US&limit=1&proximity=${PROXIMITY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { center?: [number, number] }[];
    };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    const [lng, lat] = center;
    return { lat, lng };
  } catch {
    return null;
  }
}
