import { roomKey } from "./contradictions";

/**
 * Where each room publishes its own schedule.
 *
 * CURATED BY HAND, and it has to be. The obvious move is to derive this from
 * the rows we already hold — whatever strong source most of a venue's
 * listings cite — and on 4 Oct 2026 that was tried and did not survive
 * contact: the data voted for an AXS reseller page for First Avenue, a First
 * Avenue EVENT page for a gig in August for Fine Line, and a Bloomington
 * tourism blog for Valleyfair. An event-specific URL cannot stand in for a
 * venue, and 23% of the calendar citing a roundup means there is no clean
 * majority to vote with.
 *
 * WHY IT MATTERS. 150 of 639 live listings cited a roundup, reseller or
 * social page as their source. That is the page the weekly source check tests
 * them against, so a listing's own evidence was a Songkick entry or a
 * parenting magazine's October round-up — which is also where most of the
 * flag churn comes from.
 *
 * Keyed by `roomKey`, so "Turf Club" and "Turf Club (St Paul)" both find it.
 *
 * EVERY URL HERE WAS OPENED. Two of them (Can Can Wonderland, Minnesota
 * Orchestra) answer 403 to a script and load in a browser; Armory answers a
 * redirect loop to curl and loads in a browser; Valleyfair has moved to
 * valleyfair.enchantedparks.com. A 200 was never the test — the test was
 * whether the page lists that room's events.
 *
 * ponytail: twenty rooms, covering 60% of the weakly-sourced rows. The tail is
 * one-and-two-listing venues where the curation costs more than it returns.
 * Add a room when it shows up near the top of that count, not pre-emptively.
 */
export const VENUE_CALENDARS: Record<string, string> = {
  // First Avenue runs several rooms and gives each its own page.
  "first avenue": "https://first-avenue.com/shows/",
  "palace theatre": "https://first-avenue.com/venue/palace-theatre/",
  "fine line": "https://first-avenue.com/venue/fine-line/",

  "armory": "https://armorymn.com/events/",
  "parkway theater": "https://theparkwaytheater.com/all-events-summary",
  "varsity theater": "https://www.varsitytheater.com/",
  "amsterdam bar and hall": "https://www.amsterdambarandhall.com/",
  "green room": "https://www.greenroommn.com/",
  "dakota jazz club": "https://www.dakotacooks.com/events/",
  "can can wonderland": "https://www.cancanwonderland.com/events",

  // Hennepin Arts operates the State, Orpheum and Pantages from one calendar.
  "state theatre": "https://hennepinarts.org/events",

  "orchestra hall": "https://www.minnesotaorchestra.org/tickets/calendar/",
  "childrens theatre company": "https://childrenstheatre.org/",
  "chanhassen dinner theatres": "https://www.chanhassendt.com/",
  "landmark center": "https://www.landmarkcenter.org/events",

  "valleyfair": "https://valleyfair.enchantedparks.com/events/",
  "como park zoo conservatory": "https://comozooconservatory.org/events/",
  "scream town": "https://screamtown.com/",
  "twin cities harvest festival": "https://twincitiesmaze.com/",
  "minnesota renaissance festival grounds": "https://renaissancefest.com/",
};

/** The room's own calendar, or null when nobody has curated one. */
export function canonicalSourceFor(venue: string): string | null {
  if (!venue) return null;
  return VENUE_CALENDARS[roomKey(venue)] ?? null;
}
