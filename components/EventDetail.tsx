"use client";

import { EventDetailBody } from "./EventDetailBody";
import { ShareButton } from "./ShareButton";
import type { EventRecord } from "@/lib/types";

/**
 * The in-app detail modal. Shares its inner layout with the standalone page
 * (app/event/[id]) via EventDetailBody so the two never drift.
 */
export function EventDetail({
  event,
  onClose,
}: {
  event: EventRecord;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="marquee" role="dialog" aria-modal="true" aria-label={event.title}>
        <button className="closebtn" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <EventDetailBody
          event={event}
          actions={<ShareButton url={`/event/${event.id}`} title={event.title} eventId={event.id} />}
        />
      </div>
    </div>
  );
}
