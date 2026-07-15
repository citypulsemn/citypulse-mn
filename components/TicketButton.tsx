"use client";

import { track } from "@/lib/track";
import { sendStat } from "./StatBeacon";
import type { EventRecord } from "@/lib/types";

/**
 * The gold ticket CTA. A client component so the click can be tracked
 * (ticket_click is the north-star metric), used by both the modal and the
 * server-rendered event page.
 */
export function TicketButton({ event }: { event: EventRecord }) {
  if (!event.ticketUrl) {
    return (
      <span className="ticket-btn" style={{ opacity: 0.5, cursor: "default" }}>
        Details to come
      </span>
    );
  }
  return (
    <a
      className="ticket-btn"
      href={event.ticketUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        // Vendor analytics (the 1.4 seam) AND our first-party counter (5.1).
        track("ticket_click", {
          id: event.id,
          category: event.category,
          title: event.title,
        });
        sendStat(event.id, "ticket_click");
      }}
    >
      Tickets &amp; Info
    </a>
  );
}
