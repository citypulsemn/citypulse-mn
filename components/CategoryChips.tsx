"use client";

import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/types";

export function CategoryChips({
  active,
  onToggle,
  onToggleAll,
}: {
  active: Set<CategoryKey>;
  onToggle: (key: CategoryKey) => void;
  onToggleAll: () => void;
}) {
  const allOn = active.size === CATEGORY_KEYS.length;

  return (
    <div className="chips">
      <button
        className={`chip allchip ${allOn ? "on" : ""}`}
        onClick={onToggleAll}
        aria-pressed={allOn}
      >
        <span className="dot" style={{ background: "var(--gold)" }} />
        All Events
      </button>
      {CATEGORY_KEYS.map((k) => {
        const v = CATEGORIES[k];
        const on = active.has(k);
        return (
          <button
            key={k}
            className={`chip ${on ? "on" : ""}`}
            onClick={() => onToggle(k)}
            aria-pressed={on}
          >
            <span className="dot" style={{ background: v.color }} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
