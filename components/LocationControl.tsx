"use client";

import { RADIUS_OPTIONS_MI, type MetroLocation } from "@/lib/location";

/**
 * "Near me" control (U7): pick your city, then a radius, and the explorer keeps the
 * events within that circle. A FILTER (not a sort), so the chronological list keeps
 * its day grouping. Persisted in localStorage by the parent so it sticks between
 * visits (it's a standing preference, not a transient filter).
 */
export function LocationControl({
  locations,
  value,
  radiusMi,
  onPick,
  onRadius,
  onClear,
}: {
  locations: MetroLocation[];
  value: MetroLocation | null;
  radiusMi: number;
  onPick: (loc: MetroLocation | null) => void;
  onRadius: (mi: number) => void;
  onClear: () => void;
}) {
  return (
    <div className={`locctl ${value ? "on" : ""}`}>
      <span className="locctl-icon" aria-hidden="true">📍</span>
      <label className="locctl-field">
        <span className="sr-only">Show events near your city</span>
        <select
          value={value?.key ?? ""}
          onChange={(e) => onPick(locations.find((l) => l.key === e.target.value) ?? null)}
        >
          <option value="">Anywhere in the metro</option>
          {locations.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {value && (
        <>
          <span className="locctl-within">within</span>
          <label className="locctl-field">
            <span className="sr-only">Radius in miles</span>
            <select value={radiusMi} onChange={(e) => onRadius(Number(e.target.value))}>
              {RADIUS_OPTIONS_MI.map((mi) => (
                <option key={mi} value={mi}>
                  {mi} mi
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="linklike locctl-clear" onClick={onClear}>
            clear
          </button>
        </>
      )}
    </div>
  );
}
