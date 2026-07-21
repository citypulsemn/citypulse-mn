"use client";

import { track } from "@/lib/track";
import { sendStat } from "./StatBeacon";
import { googleCalendarUrl } from "@/lib/ics";
import type { EventRecord } from "@/lib/types";

/**
 * "Add to calendar" — offers an .ics download (Apple/Outlook/etc.) and a Google
 * Calendar link. Uses a <details> disclosure so no JS state is needed; both
 * options fire the ics_download analytics event (the seam from roadmap 1.4).
 *
 * Both options also fire the first-party 'calendar' stat on the HUMAN click
 * (5.1). The .ics link used to be counted server-side in its download route,
 * but crawlers and calendar-app pollers hit that route ~11× per real view, so
 * counting moved here to the click — bounded by the R2.1 beacon cap, like
 * view/ticket_click.
 */
export function AddToCalendar({ event }: { event: EventRecord }) {
  const icsHref = `/event/${event.id}/calendar`;
  const gcalHref = googleCalendarUrl(event);

  return (
    <details className="addcal">
      <summary className="addcal-btn">＋ Add to calendar</summary>
      <div className="addcal-menu">
        <a
          href={icsHref}
          download={`citypulse-${event.id}.ics`}
          onClick={() => {
            track("ics_download", { id: event.id, target: "ics" });
            sendStat(event.id, "calendar");
          }}
        >
          Apple · Outlook (.ics)
        </a>
        <a
          href={gcalHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            track("ics_download", { id: event.id, target: "google" });
            sendStat(event.id, "calendar");
          }}
        >
          Google Calendar
        </a>
      </div>
    </details>
  );
}
