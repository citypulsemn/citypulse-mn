import { normalizeKeyPart } from "./canonicalize";
import type { EventRecord } from "./types";

type Searchable = Pick<EventRecord, "title" | "venue" | "city" | "description">;

/**
 * Does an event match a free-text query? Matches across title, venue, city, and
 * description, folding case and accents via normalizeKeyPart ("café" ~ "cafe").
 * Multi-word queries are AND — every word must appear somewhere. An empty or
 * punctuation-only query matches everything (no filter).
 *
 * Client-side and pure; fast enough for the current dataset. The documented
 * upgrade path to Postgres full-text search lives in docs/SEARCH.md.
 */
export function matchesQuery(event: Searchable, q: string): boolean {
  const query = normalizeKeyPart(q);
  if (!query) return true;

  const hay = normalizeKeyPart(
    [event.title, event.venue, event.city, event.description].join(" "),
  );
  const tokens = query.split(" ").filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

/** Filter a list of events by a query (returns the same list when query is empty). */
export function searchEvents<T extends Searchable>(events: T[], q: string): T[] {
  if (!normalizeKeyPart(q)) return events;
  return events.filter((e) => matchesQuery(e, q));
}
