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
 * WHO READS THIS. `buildVerifyPrompt` (lib/agents/prompts.ts) hands the agent
 * the room's own calendar instead of making it search for one. That wiring
 * arrived 21 Oct 2026, nine days after the table did — until then NOTHING
 * consumed it outside the one-off repair that created it, and the table was
 * inert while reading as though it were doing something. If you add a room
 * here, that is the consumer you are feeding.
 *
 * ponytail: twenty rooms, covering 60% of the weakly-sourced rows. The tail is
 * one-and-two-listing venues where the curation costs more than it returns.
 * Add a room when it shows up near the top of that count, not pre-emptively.
 */
export const VENUE_CALENDARS: Record<string, string> = {
  // First Avenue runs SIX rooms and gives each its own page. Three of them were
  // missing until 21 Oct 2026, which was simply an oversight when this table was
  // written — and the three missing ones were the biggest: 7th St Entry (42
  // upcoming listings), Turf Club (28) and the Fitzgerald (17), together 87 of
  // the 407 listings no curated calendar reached. All six pages opened and
  // confirmed to filter to their own room.
  //
  // `first avenue` pointed at /shows/, which lists EVERY room — the same flaw
  // this file's docstring warns about for Fine Line. /venue/first-avenue/ is
  // the Mainroom's own page.
  "first avenue": "https://first-avenue.com/venue/first-avenue/",
  // `7th street entry`, not `7th st entry`: canonicalizeVenue expands St to
  // Street. Keyed off what roomKey actually returns for the 93 rows that carry
  // this room, not off how the venue writes its own name.
  "7th street entry": "https://first-avenue.com/venue/7th-st-entry/",
  "turf club": "https://first-avenue.com/venue/turf-club/",
  "fitzgerald theater": "https://first-avenue.com/venue/the-fitzgerald-theater/",
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

  // THE ONE PRE-EMPTIVE ENTRY, against the rule above, and deliberately.
  // Taren asked on 21 Oct 2026 whether to take this calendar. We carry ZERO
  // listings at this room, so by the rule it does not belong here yet — but it
  // is a primary source for a venue nothing else covers, and Anoka IS reached
  // by the roundups we already treat as weak (familyfuntwincities,
  // 365twincities). So when one of its shows arrives by that route, the verify
  // agent gets the room's real schedule instead of searching and landing on a
  // listing site. Costs a line; the alternative was a weak_source flag in
  // perpetuity.
  //
  // NOT added to lib/venues.ts, so the pipeline does not sweep it: music sits
  // at exactly 30 venues = 6 full shards of VENUES_PER_SHARD, and venue 31
  // opens a 7th shard holding one room that still spends a full 10-search
  // budget 1.83x a week — about $4.76/month to re-find the same ~4 in-horizon
  // events. Worth doing only batched with four or five more rooms.
  //
  // CAUTION for whoever verifies against it: the page prints NO YEAR for
  // near-term dates (only 2027+ are labelled). The weekday/date pairs did check
  // out for 2026 on 21 Oct — Oct 23 a Friday, Nov 21 and Dec 5 Saturdays — but
  // that has to be re-established, never assumed. It also publishes no street
  // address and no prices; OSM has the room at 2665 4th Avenue, Anoka.
  "heart of the city music factory": "https://heartofthecity.org/events-calendar",
};

/** The room's own calendar, or null when nobody has curated one. */
export function canonicalSourceFor(venue: string): string | null {
  if (!venue) return null;
  return VENUE_CALENDARS[roomKey(venue)] ?? null;
}
