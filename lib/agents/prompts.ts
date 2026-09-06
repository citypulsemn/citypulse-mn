import type { CategoryKey } from "../types";

/** The geographic scope every agent researches. */
const METRO_SCOPE =
  "the entire Minneapolis–St. Paul metro, including ALL first- and second-ring suburbs — " +
  "not just the two downtowns. Cover places such as Plymouth, Maple Grove, Brooklyn Park, " +
  "Brooklyn Center, Champlin, Coon Rapids, Blaine, Bloomington, Edina, Eden Prairie, " +
  "Minnetonka, St. Louis Park, Hopkins, Richfield, Roseville, Maplewood, Woodbury, Eagan, " +
  "Burnsville, Apple Valley, Lakeville, Shakopee, Golden Valley, New Hope, Crystal, " +
  "Robbinsdale, White Bear Lake, Inver Grove Heights, Cottage Grove, and Anoka, plus the " +
  "rest of Hennepin, Ramsey, Anoka, Dakota, Washington, Scott, and Carver counties";

const SOURCE_HINTS: Record<CategoryKey, string> = {
  music:
    "First Avenue, The Armory, Palace Theatre, Fine Line, Surly, Paisley Park, Lake Harriet Bandshell, Ticketmaster — plus suburban rooms like Hopkins Center for the Arts and the Ames Center (Burnsville).",
  sports:
    "Minnesota Twins, Wild, Timberwolves, Lynx, MN United, St. Paul Saints, Gophers — plus suburban venues (TCO Stadium Eagan, high-profile college/junior hockey, county fairs' sporting events).",
  family:
    "Como Zoo, Minnesota Zoo, Mall of America / Nickelodeon Universe — plus suburban parks & rec departments, community centers, and library branches across the metro.",
  arts:
    "Guthrie, Walker, Mia, Ordway, History Theatre, Hennepin Theatre Trust — plus suburban arts centers (Bloomington Center for the Arts, Chanhassen Dinner Theatres, Lakeville Area Arts Center).",
  food:
    "Brewery taprooms (metro-wide, including suburban ones), food halls, Midtown Global Market, Eater Twin Cities, Heavy Table, farmers' markets. FOOD-TRUCK FESTIVALS & RALLIES are a demand hotspot and frequently missed — seek them out explicitly: recurring ones like the Minnesota / Anoka / Rosemount food truck festivals, plus 'food truck rally' and 'food truck night' city and brewery events across the suburbs (try 'food truck festival <suburb> <month>'). Also night & street-food markets — Asian night markets, the Little Mekong Night Market, and food/maker markets.",
  weird:
    "The wonderfully-unusual — cast a WIDE net; this is our scarcest, highest-interest category, so dig. Local alt outlets surface what plain APIs miss: Racket (racketmn.com), Southwest Voices, Minnesota Monthly and Meet Minneapolis / Visit Saint Paul 'unusual things to do' lists, plus venue Instagrams. Reliable oddity veins: Can Can Wonderland, Bauhaus Brew Labs, Sisyphus Brewing, Bryant-Lake Bowl (cabaret / variety / markets); roller derby (North Star), silent discos, drag brunches, bar trivia and 'nerd nights', vintage / oddity / maker markets, ghost tours, immersive & experiential pop-ups; and seasonal one-offs (Sever's, the Renaissance Festival, Art-A-Whirl, Northern Spark, novelty pop-ups). Look for the genuinely-odd, not the obviously arts/music.",
  festival:
    "City event calendars and chambers of commerce for EACH suburb (e.g. Plymouth, Edina, Maple Grove, Lakeville), neighborhood associations, Meet Minneapolis, Visit Saint Paul, street fests, city 'days' celebrations, and open streets. CULTURAL, ETHNIC & HERITAGE FESTIVALS are a priority and frequently missed — actively search them out: Festival of Nations, Hmong festivals (Freedom Celebration, MN Hmong New Year), Somali & East African events, Middle Eastern / Lebanese (e.g. St Maron), Greek, Irish (Irish Fair of MN), Scandinavian / Nordic, German (Oktoberfest), Cinco de Mayo / West Side, Juneteenth, powwows, Diwali, and Lunar New Year, plus church / temple / community heritage festivals metro-wide (search '<culture> festival Twin Cities').",
};

export function buildResearchPrompt(
  category: CategoryKey,
  startDate: string,
  endDate: string,
): string {
  return `You are the ${category.toUpperCase()} research agent for City Pulse MN, covering ${METRO_SCOPE}.

Find real, verifiable ${category} events happening between ${startDate} and ${endDate}.
Good sources for this category: ${SOURCE_HINTS[category]}

Be COMPREHENSIVE: return every real event you can verify in the window, across the whole metro and its suburbs — not just downtown highlights. Aim for breadth (often 12–25+ events when the window and category support it). Do not pad with unverifiable entries.

For each event, gather:
- title
- venue (name only)
- address (street address — needed for mapping)
- city (e.g. Minneapolis, St Paul, Plymouth, Bloomington, Maple Grove)
- start (ISO 8601, local time, e.g. 2026-06-20T19:30)
- end (ISO 8601, local time; best estimate if not listed)
- price (display string, e.g. "$45", "$18-$120", "Free")
- ticket_url (link to tickets or the official listing)
- description (1-2 factual sentences)
- source_url (where you found it)
- cancelled (boolean; include and set true ONLY if a source shows a previously-scheduled event is now cancelled or called off — otherwise omit or set false)

Rules:
- Only include events you can verify from a real source. Always include source_url.
- CHECK THE YEAR ON EVERY PAGE YOU READ. Roundup articles live at evergreen URLs
  ("best-fall-concerts", "halloween-events") and get re-used season after season,
  so a page that looks current can be describing LAST year. If a page does not
  state the year of the event, or states a year other than the one you were
  asked about, DO NOT include the event. This is the most damaging mistake made
  here: an entire fall concert season was copied from a previous year's article
  and published with this year's dates — real shows, real venues, wrong year,
  every one of them false.
- A ROUNDUP ARTICLE IS NOT A SCHEDULE. Prefer the venue's own calendar. If all
  you have is an article, the event is only usable when the article names the
  event, the venue AND the full date including the year.
- IF YOU CANNOT NAME WHAT IS HAPPENING, OMIT THE EVENT. Never build a title out of
  the venue and the date. "Show (Aug 26)", "Turf Club Show (Sep 3)" and
  "Fitzgerald Theater Concert Event" are not events — they tell a reader nothing,
  and a missing listing is far better than a hollow one. Knowing a venue is busy
  is not knowing what is on there.
- Spread coverage across the metro: actively look for suburban events, not only the two downtowns.
- If you confirm an event was cancelled, still include it with "cancelled": true so we can remove it.
- Do NOT geocode or assign a price tier — a later step handles that.
- Prefer primary sources (venue / box-office pages) over aggregators.
- Set "category" to what the event genuinely IS (music, sports, family, arts, food, weird, festival) — a later step re-checks this, so report honestly rather than forcing "${category}".

After your research, output ONLY a JSON array of event objects, inside a single \`\`\`json code block, with no other text. If you found nothing, output \`\`\`json\n[]\n\`\`\`.`;
}

/**
 * Venue-anchored sweep (roadmap 4.2). Instead of asking an agent to "find music
 * in the metro" — which no search budget can cover — we hand it a short list of
 * real venues and ask it to walk those calendars. Coverage becomes a function of
 * the venue registry, not of what a generic search happens to surface.
 */
export function buildVenueSweepPrompt(
  category: CategoryKey,
  venues: { name: string; city: string; calendarHint?: string }[],
  startDate: string,
  endDate: string,
): string {
  const list = venues
    .map((v) => `- ${v.name} (${v.city})${v.calendarHint ? ` — calendar: ${v.calendarHint}` : ""}`)
    .join("\n");

  return `You are a VENUE SWEEP agent for City Pulse MN (${category} focus).

Your job is NOT a general search. Work through the following venues ONE BY ONE and list every event on each venue's calendar between ${startDate} and ${endDate}:

${list}

For each venue, look up its official calendar / event listing page (search "<venue name> calendar ${startDate.slice(0, 7)}" or visit its site) and read the scheduled events in the window. Some venues have many shows — list them all, not just the highlights. If a venue has nothing scheduled in the window, simply move on.

For each event, gather:
- title (the act/show name — e.g. the band or artist)
- venue (use the venue name as given above)
- address (street address of the venue)
- city
- start (ISO 8601, local time, e.g. 2026-06-20T19:30)
- end (ISO 8601, local time; best estimate if not listed)
- price (display string, e.g. "$45", "$18-$120", "Free")
- ticket_url
- description (1-2 factual sentences)
- source_url (the venue calendar page you read)
- category (what the event genuinely is — usually ${category}, but a comedy night at a music club is "arts"; report honestly)
- cancelled (true ONLY if a source shows a previously-scheduled event is cancelled)

Rules:
- Only include events you can verify on a real source. Always include source_url.
- CHECK THE YEAR. A venue calendar page can be an archive of a past season, and
  roundup articles live at evergreen URLs that get re-used year after year. If
  the page does not state the event's year, or states a different one, skip it.
  A whole fall season was once copied from a previous year's article and
  published with current dates — right acts, right rooms, wrong year.
- Prioritize completeness per venue over commentary. Do not invent shows.
- IF A CALENDAR SHOWS A DATE IS BUSY BUT DOES NOT NAME THE ACT, SKIP THAT DATE.
  Do not manufacture a title from the venue and the date — "Turf Club Show
  (Sep 3)", "Show (Aug 26)" and "Fitzgerald Theater Concert Event" are not
  events. This is the single most common way this sweep has gone wrong: seeing
  that a room is booked and writing that down as if it were a listing. A missing
  night is honest; a night with a nameless show on it is not.
- Do NOT geocode or assign a price tier — a later step handles that.

Output ONLY a JSON array of event objects inside a single \`\`\`json code block, no other text. If you found nothing, output \`\`\`json\n[]\n\`\`\`.`;
}

/**
 * Verification prompt (roadmap 4.5). Re-check a small batch of near-term events
 * against their sources. The policy asymmetry is deliberate and stated to the
 * agent: cancelling requires evidence; absence of a page proves nothing.
 */
export function buildVerifyPrompt(
  events: { id: string; title: string; venue: string; city: string; start: string; sourceUrl: string; ticketUrl: string }[],
): string {
  const list = events
    .map(
      (e) =>
        `- id: ${e.id}\n  event: ${e.title} @ ${e.venue}, ${e.city} — ${e.start}\n  source: ${e.sourceUrl || e.ticketUrl}`,
    )
    .join("\n");

  return `You are a VERIFICATION agent for City Pulse MN, a Twin Cities events calendar. These events are happening in the next few days. Check each one:

${list}

START WITH THE VENUE'S OWN CALENDAR. For each event, find what the VENUE ITSELF says is in that room that night — its website, or its official ticketing page. That is the authority and it outranks the source we cite.

The "source" line above is where WE got the listing. It is often a roundup article, not a schedule. If it does not actually name this event, it confirms nothing — say so and go to the venue.

For EACH event, decide exactly one verdict:
- "confirmed"   — you SAW this event named on the venue's own calendar or its official ticketing page. Not "the venue exists", not "the source page loaded" — you found this event.
- "wrong_event" — the venue lists a DIFFERENT act in that room that night. Include "evidence" naming what the venue actually has. This is the important one: it means our listing is probably wrong.
- "cancelled"   — a source explicitly says cancelled/postponed. You MUST include "evidence": the URL or the exact wording you saw. Never infer cancellation.
- "moved"       — the source shows a different date/time. Include "new_start" (ISO 8601) if visible. Do not guess.
- "sold_out"    — still happening, but tickets are gone.
- "not_found"   — you could not find the event named anywhere authoritative. A missing page is NOT evidence of cancellation, and it is NOT a confirmation either — pages move all the time. Use this and let a human look.

IF YOU CANNOT FIND THE EVENT NAMED SOMEWHERE AUTHORITATIVE, THAT IS "not_found", NEVER "confirmed". Confirming an event you did not actually find is the one mistake that matters here: it stamps the listing as verified and stops anyone looking again.

Be conservative between the drastic verdicts — but "confirmed" is not the safe default. It is a claim, and it needs to be true.

Output ONLY a JSON array inside a single \`\`\`json code block:
[{"id": "...", "verdict": "confirmed"}, {"id": "...", "verdict": "wrong_event", "evidence": "The Fillmore's calendar lists Masego that night — https://…"}]`;
}

/**
 * PLACES RESEARCH (Sep 2026) — exhaustive enumeration of one kind in the metro.
 *
 * The Places registry is the evergreen half of the site and its honesty contract
 * is stricter than the events pipeline's: every entry carries a `sourceUrl` that
 * a reader could open, and a `verifiedAt` date. So this prompt asks for the one
 * thing that makes an entry usable — an authoritative page naming the place —
 * and tells the agent to drop anything it cannot source.
 *
 * The `known` list is what we already have. It is passed in so the agent spends
 * its search budget on what is MISSING rather than re-describing the registry.
 */
export function buildPlacesResearchPrompt(
  kindLabel: string,
  cities: string[],
  known: string[],
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): string {
  return `You are building an EXHAUSTIVE directory of ${kindLabel} for City Pulse MN, a Twin Cities guide.

AREA — everything inside roughly latitude ${box.minLat}..${box.maxLat}, longitude ${box.minLng}..${box.maxLng}. That runs from Delano and Rockford in the west to Stillwater in the east, Blaine and Coon Rapids in the north, Apple Valley and Burnsville in the south. Suburbs count as much as the two downtowns — most of what is missing is suburban.

${cities.length > 0 ? `Pay particular attention to these cities, which currently have none on file:\n${cities.join(", ")}\n` : ""}
ALREADY ON FILE — do not return these again:
${known.length > 0 ? known.map((k) => `- ${k}`).join("\n") : "(nothing yet)"}

Work from AUTHORITATIVE directories: city and county parks & recreation pages, the park district that runs the site, the operator's own website, the state or governing association's directory. Those are the pages that also serve as the source link.

For EACH place you find that is NOT already on file, return:
- "name": what the operator calls it
- "city": the municipality
- "address": street address if the source gives one, else ""
- "lat" and "lng": decimal degrees. Only include them if you are confident; otherwise omit both and we will geocode.
- "source_url": THE PAGE THAT NAMES IT, on the operator's own site wherever possible. REQUIRED.
- "cost": "free", "paid" or "donation"
- "season": "year-round", or "seasonal" plus "open_month" and "close_month" (1-12) and a short "season_label" like "May–September"
- "note": one or two concrete sentences a local would find useful — what makes this one different. Specific over promotional: the number of holes, the length of the hill, whether the warming house is staffed. Never "hidden gem", "nestled", "vibrant", "a great spot for the whole family".

RULES:
- IF YOU CANNOT FIND A PAGE THAT NAMES THE PLACE, DO NOT RETURN IT. An entry without a real source is worse than a missing entry — the whole registry is built on the source link being openable.
- Do not invent addresses or coordinates. Omitting a field is always allowed; guessing is not.
- Do not return places outside the area, and do not return anything already on file.
- Prefer completeness over commentary. A short honest note beats a paragraph.
- If a place has permanently closed, leave it out.

Output ONLY a JSON array inside a single \`\`\`json code block:
[{"name":"…","city":"…","address":"…","lat":44.9,"lng":-93.2,"source_url":"https://…","cost":"free","season":"year-round","note":"…"}]`;
}
