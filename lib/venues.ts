import type { CategoryKey } from "./types";

/**
 * VENUE REGISTRY (roadmap 4.2).
 *
 * THE PROBLEM: the pipeline gave each category ONE agent with a small web-search
 * budget (8 searches for a 30-day window). That works for festivals — a handful
 * of big, well-indexed events. It fails completely for music, which is the most
 * fragmented category in any city: dozens of independent venues, each with its
 * own calendar, none of them aggregated. The result was a Live Music collection
 * with zero First Avenue / Palace / Turf Club shows in it.
 *
 * THE FIX: anchor discovery to the venues themselves. The pipeline shards this
 * registry across several sub-agents, each sweeping a handful of named venue
 * calendars, so coverage is a function of the venue list rather than of what a
 * generic search happens to surface.
 *
 * Cities here are deliberately ones `lib/areas.ts` knows, so venue-sourced
 * events land in a real area bucket instead of "Elsewhere" (enforced by a test).
 */

export interface Venue {
  name: string;
  city: string;
  category: CategoryKey; // the venue's PRIMARY programming (the classifier still
  // decides each event — a comedy night at a music club is arts)
  /** Optional hint for the agent about where the venue's calendar lives. */
  calendarHint?: string;
}

export const VENUES: Venue[] = [
  // ── Music: the flagship rooms ────────────────────────────────────────────
  { name: "First Avenue & 7th St Entry", city: "Minneapolis", category: "music", calendarHint: "first-avenue.com" },
  { name: "The Armory", city: "Minneapolis", category: "music" },
  { name: "Palace Theatre", city: "St Paul", category: "music" },
  { name: "The Fillmore Minneapolis", city: "Minneapolis", category: "music" },
  { name: "Fine Line", city: "Minneapolis", category: "music" },
  { name: "Varsity Theater", city: "Minneapolis", category: "music" },
  { name: "Uptown Theater", city: "Minneapolis", category: "music" },
  { name: "Turf Club", city: "St Paul", category: "music" },
  { name: "Icehouse", city: "Minneapolis", category: "music" },
  { name: "The Cedar Cultural Center", city: "Minneapolis", category: "music" },
  { name: "Dakota Jazz Club", city: "Minneapolis", category: "music" },
  { name: "The Hook and Ladder Theater", city: "Minneapolis", category: "music" },
  { name: "Berlin", city: "Minneapolis", category: "music" },
  { name: "Amsterdam Bar and Hall", city: "St Paul", category: "music" },
  { name: "Green Room", city: "Minneapolis", category: "music" },
  { name: "331 Club", city: "Minneapolis", category: "music" },
  { name: "Crooners Supper Club", city: "Fridley", category: "music" },
  { name: "Parkway Theater", city: "Minneapolis", category: "music" },
  { name: "Cabooze", city: "Minneapolis", category: "music" },
  { name: "Mystic Lake Amphitheater", city: "Prior Lake", category: "music" },
  { name: "Surly Brewing Festival Field", city: "Minneapolis", category: "music" },
  { name: "Lake Harriet Bandshell", city: "Minneapolis", category: "music" },
  { name: "Como Lakeside Pavilion", city: "St Paul", category: "music" },
  { name: "Orchestra Hall", city: "Minneapolis", category: "music" },
  { name: "Ordway Concert Hall", city: "St Paul", category: "music" },
  { name: "Xcel Energy Center", city: "St Paul", category: "music" },
  { name: "Target Center", city: "Minneapolis", category: "music" },
  { name: "Ames Center", city: "Burnsville", category: "music" },
  { name: "Hopkins Center for the Arts", city: "Hopkins", category: "music" },
  { name: "Paisley Park", city: "Chanhassen", category: "music" },

  // ── Family: the reliable anchors ─────────────────────────────────────────
  { name: "Minnesota Zoo", city: "Apple Valley", category: "family" },
  { name: "Como Park Zoo & Conservatory", city: "St Paul", category: "family" },
  { name: "Minnesota Children's Museum", city: "St Paul", category: "family" },
  { name: "Science Museum of Minnesota", city: "St Paul", category: "family" },
  { name: "Bell Museum", city: "St Paul", category: "family" },
  { name: "Nickelodeon Universe / Mall of America", city: "Bloomington", category: "family" },
  { name: "Minnesota Landscape Arboretum", city: "Chanhassen", category: "family" },
  { name: "Children's Theatre Company", city: "Minneapolis", category: "family" },
  { name: "Hennepin County Library (system-wide events)", city: "Minneapolis", category: "family" },
  { name: "Saint Paul Public Library (system-wide events)", city: "St Paul", category: "family" },
  { name: "Three Rivers Park District", city: "Plymouth", category: "family" },
  { name: "Eagan Community Center", city: "Eagan", category: "family" },
];

/** Venues whose primary programming is a given category. */
export function venuesFor(category: CategoryKey): Venue[] {
  return VENUES.filter((v) => v.category === category);
}

/** Categories that get venue-anchored sweeps (the fragmented ones). */
export const VENUE_ANCHORED: CategoryKey[] = ["music", "family"];

export function isVenueAnchored(category: CategoryKey): boolean {
  return VENUE_ANCHORED.includes(category);
}

/**
 * Split venues into shards, each handled by its own sub-agent. Small shards mean
 * each agent can actually visit every calendar it's given within its budget.
 */
export function shardVenues(venues: Venue[], perShard: number): Venue[][] {
  if (perShard < 1) throw new Error("perShard must be >= 1");
  const shards: Venue[][] = [];
  for (let i = 0; i < venues.length; i += perShard) {
    shards.push(venues.slice(i, i + perShard));
  }
  return shards;
}
