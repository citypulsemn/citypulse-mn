"use client";

import { track } from "@/lib/track";
import { sendStat } from "./StatBeacon";
import { googleCalendarUrl } from "@/lib/ics";
import type { EventRecord } from "@/lib/types";

/**
 * "Add to calendar" — UX10: ONE TAP. The primary control is the .ics download
 * itself (Apple/Outlook/iOS Calendar all consume it, and most phones offer
 * "Add to Calendar" the instant the file lands), instead of the old two-tap
 * disclosure menu. Google Calendar rides alongside as a quieter secondary link
 * for the people who live in it.
 *
 * Both fire the ics_download analytics event (the seam from roadmap 1.4) and the
 * first-party 'calendar' stat on the HUMAN click (5.1). The .ics link used to be
 * counted server-side in its download route, but crawlers and calendar-app
 * pollers hit that route ~11× per real view, so counting lives on the click —
 * bounded by the R2.1 beacon cap, like view/ticket_click.
 */
export function AddToCalendar({ event }: { event: EventRecord }) {
  const icsHref = `/event/${event.id}/calendar`;
  const gcalHref = googleCalendarUrl(event);

  return (
    <div className="addcal">
      <a
        className="addcal-btn"
        href={icsHref}
        download={`citypulse-${event.id}.ics`}
        onClick={() => {
          track("ics_download", { id: event.id, target: "ics" });
          sendStat(event.id, "calendar");
        }}
      >
        ＋ Add to calendar
      </a>
      <a
        className="addcal-gcal"
        href={gcalHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          track("ics_download", { id: event.id, target: "google" });
          sendStat(event.id, "calendar");
        }}
      >
        Google Calendar ↗
      </a>
    </div>
  );
}
