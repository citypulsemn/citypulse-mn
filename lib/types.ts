export type CategoryKey =
  | "music"
  | "sports"
  | "family"
  | "arts"
  | "food"
  | "weird"
  | "festival";

export type PriceTier = "Free" | "$" | "$$" | "$$$";

export type EventStatus = "draft" | "published" | "archived" | "cancelled";

/**
 * One event = one row in the Google Sheet.
 * Column headers in the published CSV must match these keys (snake_case in the
 * sheet, mapped to camelCase here — see lib/events.ts).
 */
export interface EventRecord {
  id: string;
  title: string;
  category: CategoryKey;
  venue: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  start: string; // ISO 8601, e.g. 2026-06-14T20:00
  end: string; // ISO 8601
  price: string; // display string, e.g. "$45" or "Free"
  priceTier: PriceTier;
  ticketUrl: string;
  description: string;
  image: string; // https URL, or a CSS gradient (sample data only)
  sourceUrl: string;
  status: EventStatus;
  /** Last day of a multi-day run (roadmap 4.4); null/absent for single-day events. */
  multiDayEnd?: string | null;
  /** Date-only event — display "All day" instead of a clock time (roadmap 4.6). */
  allDay?: boolean;
  /** Neighborhood key derived from coordinates at the read path (roadmap 5.5). */
  neighborhood?: string | null;
}

/** What the pipeline writes to the database (one upsert row). */
export interface DbEventInput {
  event_key: string;
  title: string;
  category: CategoryKey;
  venue: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  start_at: string;
  all_day?: boolean; // ISO
  end_at: string | null;
  price: string;
  priceTier: PriceTier;
  ticket_url: string;
  description: string;
  image: string;
  source_url: string;
  status: EventStatus;
}

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  color: string;
}

export type RangeKey = "today" | "weekend" | "week" | "month";

export interface ViewState {
  range: RangeKey;
  year: number;
  month: number; // 0-indexed
}
