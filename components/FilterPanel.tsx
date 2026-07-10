"use client";

import { useState } from "react";
import { PRICE_TIERS } from "@/lib/filters";
import { AREAS, type AreaKey } from "@/lib/areas";
import type { PriceTier } from "@/lib/types";

export function FilterPanel({
  prices,
  areas,
  onTogglePrice,
  onToggleArea,
  onClear,
}: {
  prices: Set<PriceTier>;
  areas: Set<AreaKey>;
  onTogglePrice: (t: PriceTier) => void;
  onToggleArea: (a: AreaKey) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = prices.size + areas.size;

  return (
    <div className="filterpanel">
      <button
        type="button"
        className={`filter-toggle ${count > 0 ? "on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Filters{count > 0 ? ` · ${count}` : ""} <span className="filter-caret">{open ? "▲" : "▾"}</span>
      </button>

      {open && (
        <div className="filter-body">
          <div className="filter-group">
            <span className="filter-label">Price</span>
            <div className="filter-pills">
              {PRICE_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`filter-pill ${prices.has(t) ? "active" : ""}`}
                  onClick={() => onTogglePrice(t)}
                  aria-pressed={prices.has(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Area</span>
            <div className="filter-pills">
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={`filter-pill ${areas.has(a.key) ? "active" : ""}`}
                  onClick={() => onToggleArea(a.key)}
                  aria-pressed={areas.has(a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {count > 0 && (
            <button type="button" className="linklike filter-clear" onClick={onClear}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
