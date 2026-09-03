"use client";

import { useMemo, useState } from "react";
import { PlacesList } from "./PlacesList";
import { PlacesMapInteractive } from "./PlacesMapInteractive";
import { useVisited } from "./useVisited";
import { PLACE_VISIT_COPY } from "@/lib/editorial";
import {
  filterPlaces,
  placeCities,
  placesByDistance,
  activeDetailKeys,
  PLACE_DETAIL_LABELS,
  NO_PLACE_FILTERS,
  type Place,
  type PlaceDetails,
  type PlaceFilters,
  type LatLng,
} from "@/lib/places";

/**
 * The filterable list surface for a /places/[kind] page (P4.3). A 470-entry
 * directory is only useful if you can narrow it: cost, open-this-season, city,
 * and — the P4.3 follow-up — sort nearest-first from the browser's location.
 * All from data the registry already carries; the "Near me" point comes from the
 * geolocation API and is never stored. The map above stays the full geographic
 * overview (mount-once by design); this filters/sorts the *content* (the list).
 * The heavy lifting is pure + golden-tested (`filterPlaces`, `placesByDistance`).
 */
type GeoStatus = "idle" | "loading" | "error";

/** Before hydration (and for a cookieless visitor) every row renders unchecked. */
const NO_VISITS: ReadonlySet<string> = new Set();

export function PlacesBrowser({ places, plural }: { places: Place[]; plural: string }) {
  const [filters, setFilters] = useState<PlaceFilters>(NO_PLACE_FILTERS);
  const [now] = useState(() => new Date());
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  // "Been there" (P5): one shared fetch per page, live on every toggle.
  const visited = useVisited() ?? NO_VISITS;

  const cities = useMemo(() => placeCities(places), [places]);
  const detailKeys = useMemo(() => activeDetailKeys(places), [places]);
  const filtered = useMemo(
    () => filterPlaces(places, filters, now, visited),
    [places, filters, now, visited],
  );

  // Near-me: rank the FILTERED set nearest-first and carry each row's distance.
  const ranked = useMemo(() => (origin ? placesByDistance(filtered, origin) : null), [origin, filtered]);
  const list = ranked ? ranked.map((r) => r.place) : filtered;
  const distances = ranked ? new Map(ranked.map((r) => [r.place.slug, r.miles])) : undefined;

  const active =
    filters.cost !== "all" ||
    filters.openNow ||
    filters.city !== null ||
    filters.details.length > 0 ||
    filters.been !== undefined ||
    origin !== null;
  const set = (patch: Partial<PlaceFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleDetail = (k: keyof PlaceDetails) =>
    setFilters((f) => ({
      ...f,
      details: f.details.includes(k) ? f.details.filter((d) => d !== k) : [...f.details, k],
    }));
  const clearAll = () => {
    setFilters(NO_PLACE_FILTERS);
    setOrigin(null);
    setGeo("idle");
  };

  const requestLocation = () => {
    if (origin) {
      setOrigin(null);
      return; // toggle off
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("error");
      return;
    }
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo("idle");
      },
      () => setGeo("error"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <section className="places-browse" aria-label={`Filter ${plural.toLowerCase()}`}>
      <PlacesMapInteractive places={places} visible={filtered} />

      <div className="places-filter">
        <div className="pf-group" role="group" aria-label="Cost">
          {(["all", "free", "paid"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`pf-chip${filters.cost === c ? " is-on" : ""}`}
              aria-pressed={filters.cost === c}
              onClick={() => set({ cost: c })}
            >
              {c === "all" ? "All" : c === "free" ? "Free" : "Paid"}
            </button>
          ))}
        </div>

        <label className="pf-toggle">
          <input
            type="checkbox"
            checked={filters.openNow}
            onChange={(e) => set({ openNow: e.target.checked })}
          />
          Open this season
        </label>

        {cities.length > 1 && (
          <label className="pf-city">
            <span className="pf-city-label">City</span>
            <select value={filters.city ?? ""} onChange={(e) => set({ city: e.target.value || null })}>
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        {detailKeys.length > 0 && (
          <div className="pf-group pf-details" role="group" aria-label="Features">
            {detailKeys.map((k) => (
              <button
                key={k}
                type="button"
                className={`pf-chip${filters.details.includes(k) ? " is-on" : ""}`}
                aria-pressed={filters.details.includes(k)}
                onClick={() => toggleDetail(k)}
              >
                {PLACE_DETAIL_LABELS[k]}
              </button>
            ))}
          </div>
        )}

        {/* The chips exist only once there is something to filter by — a
            visitor with no check-offs never sees an empty "Been there" axis. */}
        {visited.size > 0 && (
          <div className="pf-group" role="group" aria-label={PLACE_VISIT_COPY.button}>
            {(["been", "not-yet"] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={`pf-chip${filters.been === b ? " is-on" : ""}`}
                aria-pressed={filters.been === b}
                onClick={() => set({ been: filters.been === b ? undefined : b })}
              >
                {b === "been" ? PLACE_VISIT_COPY.filterBeen : PLACE_VISIT_COPY.filterNotYet}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`pf-chip pf-nearme${origin ? " is-on" : ""}`}
          aria-pressed={origin !== null}
          disabled={geo === "loading"}
          onClick={requestLocation}
        >
          {geo === "loading" ? "Locating…" : origin ? "✓ Nearest first" : "📍 Near me"}
        </button>

        <div className="pf-status">
          <span className="pf-count">
            {list.length} of {places.length}
          </span>
          {active && (
            <button type="button" className="pf-clear" onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
      </div>

      {geo === "error" && (
        <p className="pf-geo-note">Couldn&apos;t get your location — check that location access is allowed.</p>
      )}

      {list.length > 0 ? (
        <PlacesList places={list} distances={distances} visited={visited} />
      ) : (
        <div className="places-empty">
          No {plural.toLowerCase()} match these filters.{" "}
          <button type="button" className="pf-clear" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
