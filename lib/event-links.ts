import { outboundHost } from "./outbound";

/**
 * Choosing the event's outbound link(s) — "official site first" (Roadmap UX2 U4).
 *
 * An event carries two URLs: `ticketUrl` (tickets or the official listing the
 * pipeline found) and `sourceUrl` (where we found it — often the venue, sometimes a
 * news/tourism/listing site). Until now only `ticketUrl` was shown, so events whose
 * ticketUrl is a third-party platform (Ticketmaster, a resale site) sent people to
 * the aggregator even when we knew the venue's own page.
 *
 * This leads with the official page and keeps a secondary "Tickets" link. The signal
 * that a `sourceUrl` really is the official page is a **venue-name match**: the
 * source's host contains a distinctive word from the event's own `venue` name
 * (fillmoreminneapolis.com ↔ "The Fillmore Minneapolis"). This was validated against
 * live data — every genuine venue source matched, and the news/tourism/family-listing
 * sources (aol.com, exploreminnesota.com, twincitiesfamily.com …) did NOT, so they're
 * correctly left alone rather than mislabeled "Official site". A host denylist alone
 * was whack-a-mole; the venue match is the honest, high-coverage gate.
 *
 * The robust long-term fix is an explicit verified official-URL field captured by the
 * pipeline (roadmap UX2 U4 "Option B"); this is the no-migration render-side win.
 */

/**
 * Hosts that are never an event's official page — ticketing platforms, resale, and
 * discovery aggregators. Used to (a) recognize that a ticketUrl is a third party and
 * (b) make sure a matched source isn't itself one of these. The venue-name match is
 * the primary gate, so this list does NOT need to enumerate news/tourism sites.
 */
export const AGGREGATOR_HOSTS = new Set<string>([
  "ticketmaster.com", "livenation.com", "axs.com", "seatgeek.com", "eventbrite.com",
  "eventbrite.ca", "dice.fm", "etix.com", "ticketweb.com", "universe.com",
  "tickettailor.com", "see-tickets.us", "seetickets.com", "showclix.com",
  "brownpapertickets.com", "frontgatetickets.com", "ticketon.com",
  "stubhub.com", "vividseats.com", "viagogo.com", "tickpick.com", "gametime.co",
  "ticketnetwork.com", "ticketliquidator.com",
  "songkick.com", "bandsintown.com", "allevents.in", "eventful.com",
]);

/** True when the URL's host is (or is a subdomain of) a known aggregator/ticketing host. */
export function isAggregatorUrl(raw: string): boolean {
  const host = outboundHost(raw);
  if (!host) return false;
  for (const h of AGGREGATOR_HOSTS) {
    if (host === h || host.endsWith(`.${h}`)) return true;
  }
  return false;
}

// Words too generic to prove a host is a given venue's own site: venue-type nouns,
// AND metro geography (a content site like exploreMINNESOTA.com or downtownSTPAUL.com
// would otherwise "match" any venue whose name carries the place name).
const GENERIC_VENUE_WORDS = new Set([
  "the", "and", "bar", "hall", "club", "park", "field", "arena", "center", "centre",
  "theater", "theatre", "stage", "room", "live", "music", "events", "event", "house",
  "venue", "lounge", "cafe", "grill", "hotel", "amphitheater", "amphitheatre", "pavilion",
  // metro geography
  "minnesota", "minneapolis", "saint", "paul", "twin", "cities", "metro", "downtown",
  "uptown", "north", "south", "east", "west", "lake", "lakes", "river", "valley",
]);

/**
 * Does `host` look like the official site of `venue`? True when the flattened host
 * contains a distinctive (≥4-char, non-generic) word from the venue name — e.g.
 * "allianzfield.com" ↔ "Allianz Field" via "allianz". Conservative: a miss just means
 * we don't promote (safe), a false match would need a non-aggregator host that happens
 * to contain a venue's distinctive word.
 */
export function hostMatchesVenue(host: string | null, venue: string | null | undefined): boolean {
  if (!host || !venue) return false;
  const flat = host.replace(/[^a-z0-9]/g, "");
  const tokens = venue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 4 && !GENERIC_VENUE_WORDS.has(t));
  return tokens.some((t) => flat.includes(t));
}

export interface EventLink {
  url: string;
  label: string;
  kind: "official" | "tickets";
}
export interface EventLinks {
  primary: EventLink | null;
  secondary: EventLink | null;
}

/**
 * The link(s) to show for an event, official-first. `primary === null` means we have
 * nothing to link to (the caller shows a "coming soon" note).
 */
export function eventLinks(event: {
  ticketUrl?: string | null;
  sourceUrl?: string | null;
  venue?: string | null;
}): EventLinks {
  const ticket = (event.ticketUrl ?? "").trim();
  const source = (event.sourceUrl ?? "").trim();
  const sourceHost = source ? outboundHost(source) : null;
  const ticketHost = ticket ? outboundHost(ticket) : null;

  // The source is the venue's own official page (and not itself an aggregator).
  const sourceIsOfficial =
    source !== "" && !isAggregatorUrl(source) && hostMatchesVenue(sourceHost, event.venue);
  // The ticket link is somewhere OTHER than the venue's own site (aggregator/third party).
  const ticketElsewhere =
    ticket !== "" && sourceHost !== ticketHost && !hostMatchesVenue(ticketHost, event.venue);

  // 1) We have the venue's official page AND the ticket link is a third party →
  //    official first, tickets second.
  if (sourceIsOfficial && ticketElsewhere) {
    return {
      primary: { url: source, label: "Official site", kind: "official" },
      secondary: { url: ticket, label: "Tickets", kind: "tickets" },
    };
  }
  // 2) A ticket link exists (official ticketing, or nothing better to prefer) → show it.
  if (ticket !== "") {
    return { primary: { url: ticket, label: "Tickets & Info", kind: "tickets" }, secondary: null };
  }
  // 3) No ticket, but the source is the venue's official page → surface it (beats
  //    "coming soon"). A non-venue source with no ticket is left as "coming soon"
  //    rather than promoting an unverified listing.
  if (sourceIsOfficial) {
    return { primary: { url: source, label: "Official site", kind: "official" }, secondary: null };
  }
  return { primary: null, secondary: null };
}
