# Search

City Pulse search is **client-side** (roadmap 1.3). The full published event set is already in the browser (the explorer holds it for the calendar/map), so filtering is a pure in-memory pass — no backend round-trip, instant results.

## How it works

- `lib/search.ts` → `matchesQuery(event, q)` and `searchEvents(list, q)`.
- Matches across **title, venue, city, description**, folding case and accents via `normalizeKeyPart` (so "café" ~ "cafe", "Como" ~ "como").
- Multi-word queries are **AND** — every word must appear somewhere.
- `EventsExplorer` owns the query string and defers the filter with React's `useDeferredValue`, so the input stays responsive while typing. The searched set is threaded into all three surfaces (calendar dots, map pins, day lists) plus the match-count whisper.
- Search terms are sent through `lib/track.ts` (`track("search", …)`) — a no-op until roadmap 1.4 wires analytics.

## Scale & the Postgres FTS upgrade path

Client-side search is comfortable to roughly **2–3k live events**. Beyond that (shipping the full set to the browser gets heavy, and filtering per keystroke starts to cost), move search server-side with Postgres full-text search. It's an additive change — the read boundary already lives in `lib/events.ts`.

1. **Schema** — add a generated `tsvector` column and a GIN index (idempotent block in `db/schema.sql`):
   ```sql
   alter table events add column if not exists fts tsvector
     generated always as (
       to_tsvector('english',
         coalesce(title,'') || ' ' || coalesce(venue,'') || ' ' ||
         coalesce(city,'')  || ' ' || coalesce(description,''))
     ) stored;
   create index if not exists idx_events_fts on events using gin (fts);
   ```
2. **Read** — add `getEvents(q?)` that, when `q` is present, filters with
   `where status='published' and fts @@ websearch_to_tsquery('english', ${q})`
   (keep the current path for the empty query).
3. **API** — extend `/api/events` (and the future public API) with a `q` param so the explorer fetches matches instead of filtering locally.
4. **UI** — swap the in-memory filter for a debounced fetch; the `SearchBox` and match-count UI stay as-is.

Accent folding at that point shifts to an `unaccent` extension (`create extension if not exists unaccent;` and an `unaccent`-based config) if needed; for the current English-heavy dataset the client `normalizeKeyPart` folding is sufficient.

Do this only when event volume actually crosses the threshold — not before.
