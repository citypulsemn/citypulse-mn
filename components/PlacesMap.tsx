import { placesStaticMapUrl, type Place } from "@/lib/places";

/**
 * The numbered static map atop a kind page. Pins are numbered 1..N in the SAME
 * order as PlacesList, so a pin and its list entry share a number. Server-
 * rendered <img> — zero JS, phone-friendly (an interactive map is P4.2, gated on
 * a vitals check). Renders nothing when there's no Mapbox token (dev) or no
 * places — the list below still stands on its own.
 */
export function PlacesMap({ places, token }: { places: Place[]; token: string | undefined }) {
  const url = placesStaticMapUrl(places, token);
  if (!url) return null;
  return (
    <figure className="places-map">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Map of ${places.length} locations across the Twin Cities, numbered to match the list below`}
        width={720}
        height={480}
        loading="lazy"
      />
    </figure>
  );
}
