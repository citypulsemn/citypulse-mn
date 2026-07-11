"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleSaveAction } from "@/lib/saved-actions";
import { track } from "@/lib/track";

export function SaveButton({ eventId, saved: savedProp }: { eventId: string; saved?: boolean }) {
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
        setSaved(await toggleSaveAction(eventId));
      } catch {
        setSaved(!optimistic); // revert on failure
      }
    });
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
