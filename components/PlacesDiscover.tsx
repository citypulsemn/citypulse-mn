"use client";

import { useMemo, useState } from "react";
import { PlacesList } from "./PlacesList";
import {
  filterPlaces,
  crossKindDetailKeys,
  placesByDistance,
  KIND_META,
  PLACE_DETAIL_LABELS,
  NO_PLACE_FILTERS,
  type Place,
  type PlaceKind,
  type PlaceDetails,
  type PlaceFilters,
  type LatLng,
} from "@/lib/places";

/**
 * The cross-kind discovery finder (`/places/discover`). Where a kind page answers
 * "which pool?", this answers "what can we do near us, free, indoor, right now?" —
 * it pools every place and filters on the axes that cut ACROSS kinds: cost,
 * open-this-season, near-me, a kind picker, and the shared verified facts
 * (`crossKindDetailKeys` — a detail offered only when ≥2 kinds carry it, so the
 * finder never lists a single-kind fact like a water slide). List-first by design:
 * 500 mixed places don't belong on one map. All logic is the pure, golden-tested
 * `filterPlaces` / `placesByDistance`; the "Near me" point is never stored.
 */
type GeoStatus = "idle" | "loading" | "error";

export function PlacesDiscover({ places }: { places: Place[] }) {
  const [filters, setFilters] = useState<PlaceFilters>(NO_PLACE_FILTERS);
  const [now] = useState(() => new Date());
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");

  const detailKeys = useMemo(() => crossKindDetailKeys(places), [places]);
  const kinds = useMemo(() => {
    const present = [...new Set(places.map((p) => p.kind))];
    return present.sort((a, b) => KIND_META[a].plural.localeCompare(KIND_META[b].plural));
  }, [places]);
  const filtered = useMemo(() => filterPlaces(places, filters, now), [places, filters, now]);

  const ranked = useMemo(() => (origin ? placesByDistance(filtered, origin) : null), [origin, filtered]);
  const list = ranked ? ranked.map((r) => r.place) : filtered;
  const distances = ranked ? new Map(ranked.map((r) => [r.place.slug, r.miles])) : undefined;

  const kindValue = filters.kinds && filters.kinds.length === 1 ? filters.kinds[0] : "";
  const active =
    filters.cost !== "all" ||
    filters.openNow ||
    (filters.kinds?.length ?? 0) > 0 ||
    filters.details.length > 0 ||
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
      return;
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
    <section className="places-browse" aria-label="Find a place">
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

        <label className="pf-city">
          <span className="pf-city-label">Kind</span>
          <select
            value={kindValue}
            onChange={(e) => set({ kinds: e.target.value ? [e.target.value as PlaceKind] : [] })}
          >
            <option value="">All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].plural}
              </option>
            ))}
          </select>
        </label>

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
        <PlacesList places={list} distances={distances} showKind />
      ) : (
        <div className="places-empty">
          No places match these filters.{" "}
          <button type="button" className="pf-clear" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
