import { requireSql } from "../db";
import type { CategoryKey } from "../types";
import type { CandidateEvent, WeekWindow } from "./types";

/**
 * Loads the window's published events from the site database as reel
 * candidates. The DB is the pipeline's primary source — these events were
 * researched, geocoded, and verified by the weekly site pipeline — with the
 * web top-up only filling pools the DB leaves short (weird, usually).
 *
 * start_at is timestamptz (a true instant); it goes out as an ISO instant
 * string and every consumer reads it through the shared Chicago wall clock.
 */

const TIERS: readonly CandidateEvent["priceTier"][] = ["Free", "$", "$$", "$$$"];

interface Row {
  id: string;
  title: string;
  category: string;
  venue: string;
  city: string;
  start_at: Date;
  end_at: Date | null;
  price: string;
  price_tier: string;
  source_url: string;
  description: string;
}

export async function loadWindowEvents(window: WeekWindow): Promise<CandidateEvent[]> {
  const sql = requireSql();
  const rows = await sql<Row[]>`
    select id, title, category, venue, city, start_at, end_at,
           price, price_tier, source_url, description
    from events
    where status = 'published'
      and (start_at at time zone 'America/Chicago')::date >= ${window.start}::date
      and (start_at at time zone 'America/Chicago')::date <= ${window.end}::date
    order by start_at asc`;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category as CategoryKey,
    venue: r.venue,
    city: r.city,
    startAt: r.start_at.toISOString(),
    endAt: r.end_at ? r.end_at.toISOString() : null,
    price: r.price,
    priceTier: (TIERS as readonly string[]).includes(r.price_tier)
      ? (r.price_tier as CandidateEvent["priceTier"])
      : "$$",
    sourceUrl: r.source_url,
    description: r.description,
  }));
}
