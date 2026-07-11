# Saved events

Roadmap 3.3. A personal list — tap **♡ Save** on any event and it lands on `/saved`. No login required, and it introduces the project's **first per-user row-level security policy**.

## Anonymous identity (no login)

The site is deliberately login-free, so each visitor gets an anonymous, unguessable token (a random UUID) stored in an **httpOnly cookie** (`cpid`, 1 year, `sameSite=lax`, `secure` in production). The cookie is created lazily — on the visitor's *first save*, not on arrival. Nothing personal is stored: the token is the entire identity, and the saved list is keyed by it.

Trade-off worth knowing: saves live with the browser, so they don't follow someone to a new device or survive clearing cookies. That's the honest cost of no accounts, and it's the right call until there's a reason to add logins.

## Pieces

- **`lib/saver.ts`** — `getSaverToken()` (read; safe during render) and `ensureSaverToken()` (create if missing; server actions/routes only, since only those may set cookies).
- **`lib/saved.ts`** — the store: `isSaved`, `saveEvent`, `unsaveEvent`, `getSavedEventIds`, `getSavedEvents`, plus `isValidUuid` (a guard on every id that reaches the DB) and a `SAVED_CAP` of 300.
- **`lib/saved-actions.ts`** — `toggleSaveAction(eventId)`; creates the cookie on first save and returns the new state.
- **`app/api/saved/route.ts`** — returns this visitor's saved ids, so the **SaveButton hydrates client-side**.
- **`components/SaveButton.tsx`** — optimistic toggle (instant fill, reverts if the write fails); self-hydrates unless given an authoritative `saved` prop.
- **`app/saved/page.tsx`** + **`components/SavedList.tsx`** — the list, newest-saved first, with optimistic removal.
- **`lib/events.ts` → `getEventsByIds`** — fetches saved events, preserving saved order (a DB `in (...)` gives no ordering guarantee, so the code re-sorts by the input ids).

## Why the button hydrates client-side

Reading the cookie on the homepage or an event page would force those pages to render per-request and **lose their caching** (they're statically cached / ISR for speed and SEO). So the cached pages never touch the cookie; the button fetches `/api/saved` on mount instead. Only `/saved`, `/api/saved`, and the save action read it. `/saved` is `force-dynamic`, `noindex`, and disallowed in `robots.txt` — it's per-visitor content that must never be cached or crawled.

## Per-user RLS (the first of its kind here)

`saved_events` (`user_token`, `event_id`, `saved_at`) has RLS enabled with a policy scoping rows to one owner:

```sql
create policy saved_events_owner on saved_events
  for all
  using  (user_token = current_setting('request.saver_token', true))
  with check (user_token = current_setting('request.saver_token', true));
```

Unlike the *sealed* tables (subscribers, digest_sends, event_submissions — no anon access at all), this one permits access but only to the caller's own rows; with no token set it matches nothing, so the table is invisible by default. The app connects as the owner (which bypasses RLS) **and** scopes every query by the cookie token, so isolation holds regardless; the policy is defense-in-depth for any other role.

**Verified against real Postgres** (PGlite, mirroring the 1.6/2.2 approach): with no token, 0 rows visible; each visitor sees only their own saves and none of another's; a cross-user `delete` affects 0 rows; and an `insert` impersonating another visitor is rejected by the `with check` clause. Reproduce in Supabase with `db/verify-rls-saved.sql`.

## Notes

- Saves cascade-delete with their event (`on delete cascade`), so removing an event can't leave orphans.
- Saved events that later become drafts simply drop out of the list (`getEventsByIds` returns only visible statuses).
- This is the groundwork for a personalized digest ("your saved events this week") later.
