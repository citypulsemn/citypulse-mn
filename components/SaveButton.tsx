"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleSaveAction } from "@/lib/saved-actions";
import { track } from "@/lib/track";

/** Broadcast a save/unsave so the header count (and the first-save nudge) can
 *  react anywhere on the page — UX3. Detail carries the confirmed state. */
export const SAVE_EVENT = "citypulse:save";

export function SaveButton({
  eventId,
  saved: savedProp,
  variant = "default",
}: {
  eventId: string;
  saved?: boolean;
  /** "compact" = icon-only, for the overlay on event cards. */
  variant?: "default" | "compact";
}) {
  const [saved, setSaved] = useState(savedProp ?? false);
  const [pending, start] = useTransition();

  // If the parent knows the state (e.g. the /saved page), trust it. Otherwise
  // hydrate client-side so cached pages (home, event) needn't read the cookie.
  useEffect(() => {
    if (savedProp !== undefined) {
      setSaved(savedProp);
      return;
    }
    let alive = true;
    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.ids)) setSaved(d.ids.includes(eventId));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [savedProp, eventId]);

  function toggle() {
    const optimistic = !saved;
    setSaved(optimistic); // instant feedback
    track("save_toggle", { id: eventId, saved: optimistic });
    start(async () => {
      try {
        const confirmed = await toggleSaveAction(eventId);
        setSaved(confirmed);
        // Broadcast AFTER the write lands so listeners re-read authoritative state.
        window.dispatchEvent(new CustomEvent(SAVE_EVENT, { detail: { id: eventId, saved: confirmed } }));
      } catch {
        setSaved(!optimistic); // revert on failure
      }
    });
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        className={`savebtn-compact ${saved ? "on" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Saved — tap to remove" : "Save this event"}
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`savebtn ${saved ? "on" : ""}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Saved — tap to remove" : "Save this event"}
    >
      <span className="savebtn-ic" aria-hidden="true">
        {saved ? "♥" : "♡"}
      </span>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
