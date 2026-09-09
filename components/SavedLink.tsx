"use client";

import { useSaved } from "./useSaved";

/**
 * "♥ N" header link to /saved (UX3). Reads the shared saved-set, so the count
 * stays live as you build your list while browsing. Renders NOTHING at zero —
 * honest emptiness, no dangling badge.
 *
 * It used to fetch /api/saved itself and re-fetch on every save broadcast: a
 * second copy of the same request on every page, plus one per toggle. The
 * store already has the answer.
 */
export function SavedLink() {
  const count = useSaved()?.size ?? 0;

  if (!count) return null; // not hydrated, or 0 → show nothing

  return (
    <a className="saved-link" href="/saved" aria-label={`${count} saved event${count === 1 ? "" : "s"}`}>
      <span aria-hidden="true">♥</span> {count}
    </a>
  );
}
