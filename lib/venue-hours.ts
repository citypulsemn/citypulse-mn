import { MONTHS } from "./dates";

/**
 * VENUE OPENING HOURS (5 November 2026).
 *
 * WHY THIS EXISTS. The pipeline kept finding a venue's opening hours and filing
 * them as an EVENT: "Como Park Zoo & Conservatory – Daily General Admission,
 * 10 Oct – 10 Nov", "Minnesota Zoo – Daily General Admission (Fall Season)",
 * "Nickelodeon Universe – Daily Indoor Theme Park". Nothing starts and nothing
 * ends; they are standing facts wearing an event's clothes, and they were
 * re-minted every week, so 24 had already been archived by earlier passes and 8
 * were live again. The day-page "Also running" shelf is what made the cost
 * visible: on 10 November four of its six slots were admission rows.
 *
 * The eight rows are archived. The FACT in them was worth keeping, so it lives
 * here instead — on the venue's own page, where someone deciding whether to go
 * can use it, and with the provenance an event row never carried: the venue's
 * own URL and the date a human read it.
 *
 * RULES FOR THIS TABLE, and they are the honest-data rule in miniature:
 *   - Every line is what the VENUE prints on its OWN site. Never a third-party
 *     roundup, never an aggregator, never a number inferred from a ticket page.
 *   - If the venue's own pages disagree with each other, say less. Nickelodeon
 *     Universe quotes three different wristband prices across three of its own
 *     pages, so this table gives the hedged one its visit page actually prints
 *     and links out rather than picking a winner.
 *   - `readOn` is when a person last opened `sourceUrl`. The venue page shows it
 *     and tells the reader to check before travelling, because hours drift and
 *     this table does not auto-refresh.
 *
 * Keyed by venue-page SLUG, like VENUE_INTROS in lib/editorial.ts. A test holds
 * every key to a real venue page.
 */
export interface VenueHours {
  /** Hours as the venue prints them, one line per rule. */
  lines: string[];
  /** What it costs to walk in — only when the venue states it unambiguously. */
  admission?: string;
  /** A caveat the venue itself prints. */
  note?: string;
  /** The venue's own page these were read from. */
  sourceUrl: string;
  /** YYYY-MM-DD a person last read `sourceUrl`. */
  readOn: string;
}

export const VENUE_HOURS: Record<string, VenueHours> = {
  // comozooconservatory.org/visitors/visitor-map-hours/ — "Como Zoo is open from
  // 10AM-4PM daily!"; the Conservatory carries its own Tuesday–Sunday window and
  // a Monday extension with four named exceptions, which is exactly the kind of
  // detail an event row flattened away.
  "como-park-zoo-and-conservatory": {
    lines: [
      "Zoo: 10AM–4PM daily.",
      "Marjorie McNeely Conservatory: 10AM–4PM Tuesday–Sunday, 8 September 2026 – 30 April 2027.",
      "The Conservatory stays open to 6PM on select Mondays — but closes at 4PM on 5 October, 9 November, 21 December 2026 and 22 February 2027 for event rentals.",
      "1 May – Labor Day: 10AM–6PM.",
    ],
    admission:
      "Free. A voluntary donation of $8 for an adult and $5 for a child is appreciated, and you are welcome whether or not you make one.",
    sourceUrl: "https://comozooconservatory.org/visitors/visitor-map-hours/",
    readOn: "2026-11-05",
  },

  // mnzoo.org/plan-a-visit-2/ — "The Minnesota Zoo is open from 10 am to 4 pm.
  // Members have the opportunity to get special member access from 9 - 10:00 am".
  // The online-ticket requirement matters more than the hours for a walk-up.
  "minnesota-zoo": {
    lines: [
      "10am–4pm. Members get in from 9am.",
      "Online tickets are required — buy before you arrive.",
    ],
    admission:
      "$25.95 adults 13–64 · $23.95 65+ · $19.95 ages 3–12 · free for 2 and under. Parking $10 a car, free for members.",
    sourceUrl: "https://mnzoo.org/plan-a-visit-2/",
    readOn: "2026-11-05",
  },

  // nickelodeonuniverse.com/visit/ — a seven-row PARK HOURS table. Sunday is the
  // one that catches people out: it opens an hour later and shuts two hours early.
  "nickelodeon-universe": {
    lines: ["Monday–Saturday: 10 a.m. – 9 p.m.", "Sunday: 11 a.m. – 7 p.m."],
    admission:
      "Unlimited ride wristbands from $41.99 + tax; point passes from $4.25 + tax.",
    note: "The park sometimes opens late or closes early for private events.",
    sourceUrl: "https://nickelodeonuniverse.com/visit/",
    readOn: "2026-11-05",
  },
};

/** The hours for a venue page, or null when nobody has read that venue's site. */
export function venueHours(slug: string): VenueHours | null {
  return VENUE_HOURS[slug] ?? null;
}

/** "5 November 2026" — for the "read on" line under the hours. */
export function readOnLabel(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
