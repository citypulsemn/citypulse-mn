"use client";

import { MONTHS } from "@/lib/dates";
import type { RangeKey } from "@/lib/types";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export function ControlBar({
  range,
  year,
  month,
  onRange,
  onMonth,
}: {
  range: RangeKey;
  year: number;
  month: number;
  onRange: (r: RangeKey) => void;
  onMonth: (delta: number) => void;
}) {
  return (
    <div className="controls">
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={`preset ${range === p.key ? "active" : ""}`}
            onClick={() => onRange(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="monthnav">
        <button onClick={() => onMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="label">
          {MONTHS[month]} {year}
        </span>
        <button onClick={() => onMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>
    </div>
  );
}
