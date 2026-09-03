"use client";

import { useState, useTransition } from "react";
import { toggleVisitAction } from "@/lib/place-visit-actions";
import { PLACE_VISIT_COPY } from "@/lib/editorial";
import { track } from "@/lib/track";
import { useVisited, VISIT_EVENT } from "./useVisited";
import type { PlaceKind } from "@/lib/places";

export { VISIT_EVENT };

/**
 * The "Been there" check (Places P5). Same shape as SaveButton: a pressed
 * button (not a checkbox input), optimistic flip, revert on failure, and a
 * broadcast AFTER the write lands so the shared store and any listener
 * (progress line, nudge) re-read confirmed truth. State comes from the shared
 * useVisited store — one fetch per page, however many rows.
 */
export function VisitButton({
  slug,
  kind,
  variant = "default",
}: {
  slug: string;
  kind: PlaceKind;
  /** "compact" = the small pill for list rows. */
  variant?: "default" | "compact";
}) {
  const visitedSet = useVisited();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  const visited = optimistic ?? visitedSet?.has(slug) ?? false;

  function toggle() {
    const next = !visited;
    setOptimistic(next); // instant feedback
    track("visit_toggle", { slug, kind, visited: next });
    start(async () => {
      try {
        const confirmed = await toggleVisitAction(slug);
        // Broadcast AFTER the write lands; the store applies the confirmed state.
        window.dispatchEvent(new CustomEvent(VISIT_EVENT, { detail: { slug, kind, visited: confirmed } }));
      } catch {
        /* dropping the optimistic override below reverts to the store's truth */
      }
      setOptimistic(null);
    });
  }

  const label = visited ? PLACE_VISIT_COPY.buttonOn : PLACE_VISIT_COPY.button;
  const aria = visited ? `${PLACE_VISIT_COPY.buttonOn} — tap to undo` : `Mark: ${PLACE_VISIT_COPY.button}`;

  return (
    <button
      type="button"
      className={`${variant === "compact" ? "visitbtn-compact" : "visitbtn"}${visited ? " on" : ""}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={visited}
      aria-label={aria}
    >
      <span className="visitbtn-ic" aria-hidden="true">
        {visited ? "✓" : "○"}
      </span>
      {label}
    </button>
  );
}
