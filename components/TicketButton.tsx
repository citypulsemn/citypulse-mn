"use client";

import { track } from "@/lib/track";
import { sendStat } from "./StatBeacon";
import { outboundTicketUrl } from "@/lib/outbound";
import type { EventRecord } from "@/lib/types";

/**
 * The gold ticket CTA. A client component so the click can be tracked
 * (ticket_click is the north-star metric), used by both the modal and the
 * server-rendered event page.
 */
export function TicketButton({ event }: { event: EventRecord }) {
  if (!event.ticketUrl) {
    // UX1 — a quiet, clearly non-interactive note, not a faded gold button
    // (which read as broken / disabled).
    return <p className="ticket-note">Ticket details coming soon.</p>;
  }
  return (
    <a
      className="ticket-btn"
      href={outboundTicketUrl(event.ticketUrl)}
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
