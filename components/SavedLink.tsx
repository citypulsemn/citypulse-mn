"use client";

import { useEffect, useState } from "react";
import { SAVE_EVENT } from "./SaveButton";

/**
 * "♥ N" header link to /saved (UX3). Hydrates from /api/saved and re-reads on
 * every save broadcast, so the count stays live as you build your list while
 * browsing. Renders NOTHING at zero — honest emptiness, no dangling badge.
 */
export function SavedLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/saved")
        .then((r) => r.json())
        .then((d) => {
          if (alive && Array.isArray(d?.ids)) setCount(d.ids.length);
        })
        .catch(() => {});
    load();
    window.addEventListener(SAVE_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(SAVE_EVENT, load);
    };
  }, []);

  if (!count) return null; // null (not hydrated) or 0 → show nothing

  return (
    <a className="saved-link" href="/saved" aria-label={`${count} saved event${count === 1 ? "" : "s"}`}>
      <span aria-hidden="true">♥</span> {count}
    </a>
  );
}
