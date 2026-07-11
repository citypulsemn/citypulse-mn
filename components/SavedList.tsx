"use client";

import { useState, useTransition } from "react";
import { EventDayCard } from "./EventDayCard";
import { toggleSaveAction } from "@/lib/saved-actions";
import type { EventRecord } from "@/lib/types";

export function SavedList({ events: initial }: { events: EventRecord[] }) {
  const [events, setEvents] = useState(initial);
  const [, start] = useTransition();

  function remove(id: string) {
    setEvents((evs) => evs.filter((e) => e.id !== id)); // optimistic
    start(async () => {
      try {
        await toggleSaveAction(id);
      } catch {
        /* best-effort; a reload will reconcile */
      }
    });
  }

  if (events.length === 0) {
    return (
      <div className="day-empty">
        You haven&apos;t saved any events yet. Tap <strong>♡ Save</strong> on any event to
        keep it here.
        <br />
        <a className="more-day-all" href="/">
          Browse events →
        </a>
      </div>
    );
  }

  return (
    <div className="saved-list">
      {events.map((e) => (
        <div key={e.id} className="saved-row">
          <div className="saved-row-card">
            <EventDayCard event={e} />
          </div>
          <button
            type="button"
            className="saved-remove"
            onClick={() => remove(e.id)}
            aria-label={`Remove ${e.title} from saved`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
