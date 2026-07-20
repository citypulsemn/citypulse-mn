# Deploy Guide — Roadmap 2.3: Add to Calendar

Adds an **Add to calendar** button to every event — an `.ics` download (Apple Calendar, Outlook, any standard app) and a Google Calendar link. It gets events into people's personal calendars with a link back to the event page, and lights up the `ics_download` analytics event that's been reserved since 1.4.

**Code-only** update: no database migration, no environment variables, no dependencies.

---

## What you're deploying

- On every event detail (modal + shareable page): a **＋ Add to calendar** menu with:
  - **Apple · Outlook (.ics)** — downloads a standards-compliant calendar file.
  - **Google Calendar** — opens the "add event" screen prefilled.
- Both fire the **`ics_download`** analytics event (with `target: ics | google`), so it now shows up in your Vercel custom-events breakdown next to ticket clicks and shares.
- The `.ics` includes correct Central-time handling (CST/CDT → UTC), venue/address, a link back to the event page, and marks cancelled events as cancelled.

Full reference: `docs/CALENDAR.md`.

## Quality bar (all green)
- 157 automated tests pass (12 new: timezone conversion, escaping, line folding, VCALENDAR structure, default duration, cancelled status, Google URL).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- The generated `.ics` was **parsed by a real iCalendar library** (node-ical), which extracted the correct summary, start/end instant, location, UID, URL, and status — confirming broad calendar-app compatibility. The route returns proper `text/calendar` headers; missing/draft events → 404.

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

   New files to confirm: `lib/ics.ts`, `app/event/[id]/calendar/`, `components/AddToCalendar.tsx`.

2. **Push.** GitHub Desktop → commit (`Add to calendar (roadmap 2.3)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

---

## Verify on the live site

- [ ] Open any event → tap **＋ Add to calendar** → the two options appear.
- [ ] **Apple · Outlook (.ics)** downloads a file / opens your calendar's "add event" sheet (on iPhone, tapping it usually opens Apple Calendar directly). The event title, time, and location are correct.
- [ ] **Google Calendar** opens Google's add-event screen with the details prefilled.
- [ ] Open `https://citypulsemn.com/event/{id}/calendar` directly → it downloads a `.ics`.
- [ ] After a day of traffic, `ics_download` appears in **Vercel → Analytics → Custom Events** (you can split it by `target` to see Apple/Outlook vs Google).

---

## Notes

- **Timezone is handled:** times are written in UTC computed from Central (CST/CDT aware), which every calendar app converts to the viewer's local zone — reliable across apps and devices.
- The button is hidden on **archived (past)** events. Cancelled events export with a cancelled status.
- Events with no listed end time default to a **2-hour** block.

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant.

---

## What's next on the roadmap
That's the acquisition + utility layer filling in nicely. Natural next: **2.5 Price/Area filters** (the last quick UX win — client-side, and it unblocks Collections later), or move into **Phase 3 (community)** and the **weekly email digest** that your 2.2 subscriber list is built to feed.
