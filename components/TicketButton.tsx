"use client";

import { track } from "@/lib/track";
import { sendStat } from "./StatBeacon";
import { outboundTicketUrl } from "@/lib/outbound";
import { eventLinks, type EventLink } from "@/lib/event-links";
import type { EventRecord } from "@/lib/types";

/**
 * The event CTA, official-site-first (U4). Leads with the official page when the
 * ticket link is a third-party platform, and offers a secondary "Tickets" button so
 * people can still buy. A client component so the click can be tracked (ticket_click
 * is the north-star metric); used by both the modal and the server-rendered page.
 */
export function TicketButton({ event }: { event: EventRecord }) {
  const { primary, secondary } = eventLinks(event);
  if (!primary) {
    // UX1 — a quiet, clearly non-interactive note, not a faded gold button
    // (which read as broken / disabled).
    return <p className="ticket-note">Ticket details coming soon.</p>;
  }
  return (
    <>
      <CtaLink event={event} link={primary} className="ticket-btn" />
      {secondary && <CtaLink event={event} link={secondary} className="ticket-btn ticket-btn-secondary" />}
    </>
  );
}

function CtaLink({ event, link, className }: { event: EventRecord; link: EventLink; className: string }) {
  // Only ticket links are affiliate-tagged (M0.1) and count as the ticket_click
  // metric (5.1); an "official site" click is a different intent, tracked for vendor
  // analytics only so it doesn't inflate ticket_click (M0.2 honesty).
  const href = link.kind === "tickets" ? outboundTicketUrl(link.url) : link.url;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const props = { id: event.id, category: event.category, title: event.title };
        if (link.kind === "tickets") {
          track("ticket_click", props);
          sendStat(event.id, "ticket_click");
        } else {
          track("official_click", props);
        }
      }}
    >
      {link.label}
    </a>
  );
}
