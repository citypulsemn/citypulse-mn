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
    "Brewery taprooms (metro-wide, including suburban ones), food halls, Midtown Global Market, Eater Twin Cities, Heavy Table, farmers' markets and food-truck events in the suburbs.",
  weird:
    "Venue Instagrams and neighborhood newsletters: Can Can Wonderland, The Hook & Ladder, Bauhaus, Pimento, oddity markets — plus suburban oddities (Sever's, novelty pop-ups). Plain APIs won't surface these.",
  festival:
    "City event calendars and chambers of commerce for EACH suburb (e.g. Plymouth, Edina, Maple Grove, Lakeville), neighborhood associations, Meet Minneapolis, Visit Saint Paul, street fests, city 'days' celebrations, and open streets.",
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
- Spread coverage across the metro: actively look for suburban events, not only the two downtowns.
- If you confirm an event was cancelled, still include it with "cancelled": true so we can remove it.
- Do NOT geocode or assign a price tier — a later step handles that.
- Prefer primary sources (venue / box-office pages) over aggregators.
- category for every event must be exactly "${category}".

After your research, output ONLY a JSON array of event objects, inside a single \`\`\`json code block, with no other text. If you found nothing, output \`\`\`json\n[]\n\`\`\`.`;
}
