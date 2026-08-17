"use client";

import { useMemo, useState } from "react";
import { PlacesList } from "./PlacesList";
import {
  filterPlaces,
  placeCities,
  NO_PLACE_FILTERS,
  type Place,
  type PlaceFilters,
} from "@/lib/places";

/**
 * The filterable list surface for a /places/[kind] page (P4.3). A 470-entry
 * directory is only useful if you can narrow it: cost, open-this-season, and
 * city — all from data the registry already carries, so no curation and no DB.
 * The map above stays the full geographic overview (it's mount-once by design);
 * this filters the *content* (the list), which the component contract calls the
 * source of truth. Filter logic is the pure `filterPlaces` (golden-tested); this
 * is just the control surface + honest-empty state.
 */
export function PlacesBrowser({ places, plural }: { places: Place[]; plural: string }) {
  const [filters, setFilters] = useState<PlaceFilters>(NO_PLACE_FILTERS);
  // Stable "now" for the season check — fixed at mount, month-granular anyway.
  const [now] = useState(() => new Date());

  const cities = useMemo(() => placeCities(places), [places]);
  const filtered = useMemo(() => filterPlaces(places, filters, now), [places, filters, now]);

  const active =
    filters.cost !== "all" || filters.openNow || filters.city !== null;
  const set = (patch: Partial<PlaceFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <section className="places-browse" aria-label={`Filter ${plural.toLowerCase()}`}>
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
            <select
              value={filters.city ?? ""}
              onChange={(e) => set({ city: e.target.value || null })}
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="pf-status">
          <span className="pf-count">
            {filtered.length} of {places.length}
          </span>
          {active && (
            <button type="button" className="pf-clear" onClick={() => setFilters(NO_PLACE_FILTERS)}>
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <PlacesList places={filtered} />
      ) : (
        <div className="places-empty">
          No {plural.toLowerCase()} match these filters.{" "}
          <button type="button" className="pf-clear" onClick={() => setFilters(NO_PLACE_FILTERS)}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
