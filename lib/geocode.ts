/**
 * Server-side geocoding via the Mapbox Geocoding API.
 * Uses a server token if provided (recommended), else falls back to the
 * public map token. Never call this from the browser.
 */

const TOKEN =
  process.env.MAPBOX_GEOCODING_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
  const query = [address, city, state].filter(Boolean).join(", ");
  if (!query.trim()) return null;

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
