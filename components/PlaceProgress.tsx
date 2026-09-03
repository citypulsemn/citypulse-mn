"use client";

import { placeProgress, progressLine } from "@/lib/place-progress";
import { useVisited } from "./useVisited";
import type { PlaceKind } from "@/lib/places";

/**
 * "Been to 12 of 50 splash pads in the metro" on a kind page (Places P5).
 * Hydrates from the shared store so the statically built page stays
 * byte-identical for every visitor; renders NOTHING until hydrated and
 * nothing at zero — no empty bar, no "0 of 50", no nudge to start.
 */
export function PlaceProgress({ kind }: { kind: PlaceKind }) {
  const visited = useVisited();
  if (!visited) return null;
  const p = placeProgress(kind, visited);
  const line = progressLine(p);
  if (!line) return null;
  const pct = Math.max(2, Math.round((p.visited / p.total) * 100));
  return (
    <div className="place-progress" role="status">
      <span className="place-progress-line">{line}</span>
      <div className="place-progress-bar" aria-hidden="true">
        <div className="place-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
