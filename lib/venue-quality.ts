/**
 * Does this listing actually say where to go?
 *
 * WHY. On 12 Sep 2026 the site was publishing listings whose venue field was
 * "Saint Paul (location TBD)", "TBD – Bloomington", "Various Locations, City of
 * Eagan". Ten were live. They came overwhelmingly from one index page —
 * festivalguidesandreviews.com/minnesota-festivals/, which had produced 272 rows
 * and 43 of the site's 53 placeholder venues — because that page lists a
 * festival's NAME, CITY and DATES but not its venue, and the research agent
 * filled the gap with a hedge instead of leaving it alone.
 *
 * THE HEDGE IS WORSE THAN A BLANK. Those rows still carry an address and a
 * precise lat/lng, so the event page renders a map pin and a Directions button
 * that sends a reader to a specific coordinate the listing itself admits is
 * unknown. "Saint Paul (location TBD)" shipped with the address 175 W Kellogg
 * Blvd; "Minneapolis (specific venue TBD)" shipped with an address in
 * Bloomington. A confident wrong answer, from a field whose own text says it
 * does not know.
 *
 * The line drawn here is narrow on purpose: a venue is unknown when it SAYS it
 * is unknown. "Como Park / Como Lakeside Pavilion area" and "Uptown (Hennepin
 * Ave & Lake St area)" are vague and perfectly usable — a reader can find them.
 * Vagueness is not the defect; the admission of ignorance is.
 */

/**
 * Strings that are an admission the venue is not known.
 *
 * `various …? locations` rather than the literal pair: the first version of this
 * checked `\bvarious locations\b` and a restore pass walked straight through it
 * with "Various NAMED locations in Eagan's Art Block area, including Caponi Art
 * Park, Wescott Library, …". One intervening word was enough.
 *
 * `including` is the other half of that lesson. A venue field is a NAME. The
 * moment it starts listing examples it has stopped naming a place and started
 * describing a region, and no real venue has "including" in its name.
 */
const ADMITS_UNKNOWN =
  /\b(tbd|tba)\b|\bto be (announced|determined|confirmed)\b|\bvarious\b[^,.]{0,24}\blocations?\b|\blocation unknown\b|\bincluding\b|\bmultiple (locations|venues|sites)\b/i;

/**
 * True when the listing cannot say where the event is.
 *
 * `city` is optional; when given, a venue that is merely the city name again
 * counts as unknown — it names no venue, it just repeats the town.
 */
export function venueIsUnknown(venue: string | null | undefined, city?: string | null): boolean {
  const v = String(venue ?? "").trim();
  if (v === "") return true;
  if (ADMITS_UNKNOWN.test(v)) return true;
  const c = String(city ?? "").trim();
  if (c !== "" && v.toLowerCase() === c.toLowerCase()) return true;
  return false;
}

/**
 * What to do about it, for the pipeline log and the ops digest. Null when the
 * venue is fine.
 */
export function unknownVenueReason(venue: string | null | undefined, city?: string | null): string | null {
  if (!venueIsUnknown(venue, city)) return null;
  const v = String(venue ?? "").trim();
  if (v === "") return "no venue at all — nothing to tell a reader";
  const c = String(city ?? "").trim();
  if (c !== "" && v.toLowerCase() === c.toLowerCase()) {
    return `venue is just the city ("${v}") — names no place to go`;
  }
  return `venue says it is unknown ("${v}") — a map pin here would be a guess`;
}
