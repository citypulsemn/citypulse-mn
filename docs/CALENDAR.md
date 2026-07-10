# Add to calendar

Roadmap 2.3. Every event detail (modal + shareable page) has an **Add to calendar** button offering an **.ics download** (Apple Calendar, Outlook, and any standard calendar app) and a **Google Calendar** link. It's a retention feature — the event lands in the user's own calendar with a link back to the event page.

## How it works

- `lib/ics.ts` (pure, unit-tested) builds the calendar data:
  - `eventToICS(event)` — a full RFC 5545 VCALENDAR/VEVENT document (CRLF endings, escaped text, 75-char line folding, stable UID, event URL, and `STATUS:CANCELLED` for cancelled events).
  - `googleCalendarUrl(event)` — a Google Calendar "add event" template link.
  - Times are emitted in **UTC** (computed from the event's Central wall-clock via the shared `toIsoWithOffset` helper, so CST/CDT is handled). Every calendar app converts UTC to the viewer's local zone, so no fragile VTIMEZONE block is needed.
- `app/event/[id]/calendar/route.ts` serves the `.ics` at `/event/{id}/calendar` with `text/calendar` + an attachment filename. Draft/missing events → 404.
- `components/AddToCalendar.tsx` (client) renders the two options in a `<details>` menu and fires the **`ics_download`** analytics event (`target: ics | google`) — the seam reserved back in roadmap 1.4, now live.

## Verification

Beyond the 12 unit tests, the generated `.ics` was parsed with a real iCalendar library (node-ical) which extracted the correct summary, start/end instant, location, UID, URL, and status — confirming broad calendar-app compatibility.

## Notes

- The button is hidden for archived (past) events.
- Default duration is 2 hours when an event has no explicit end time.
- `ics_download` shows up in the Vercel Analytics custom-events breakdown alongside ticket clicks and shares.
