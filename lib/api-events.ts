/**
 * The cap on `/api/events` (29 Oct 2026).
 *
 * WHAT THAT ENDPOINT IS: an operator convenience. `docs/SETUP.md` uses it to
 * tell a real local database from the sample fallback, and a takedown check has
 * used it to confirm an archived event stopped appearing.
 *
 * WHAT IT IS NOT: a public API. It is undocumented, unversioned,
 * robots-disallowed, and `/for-partners` says in writing that the published
 * interface is the iCal feed and nothing else. Roadmap 6.2 — a real public read
 * API — is parked until there is demonstrated demand.
 *
 * Until today it returned the entire published table on every request: measured
 * live at **542,226 bytes across 764 events**, unauthenticated, with
 * `cache-control: max-age=0, must-revalidate` so nothing downstream would even
 * cache it. This project has a database-egress overage and a compute overage
 * already on its record; an uncapped half-megabyte read path with no cache is
 * the same bill waiting to be run up by anything that loops.
 *
 * Two deliberate non-features:
 *
 *  - **No `offset`.** This is a ceiling, not a speed bump — nobody walks the
 *    table 20 rows at a time.
 *  - **No `?limit=` either.** Reading a search param makes the route dynamic,
 *    so every distinct query string becomes its own cache key and its own
 *    function invocation. A fixed slice keeps the route prerenderable, which is
 *    the cheaper and less abusable shape.
 *
 * If a partner ever needs the whole set, that is 6.2 with a decision behind it,
 * not an accident of an endpoint nobody documented.
 */
export const API_EVENTS_LIMIT = 20;
