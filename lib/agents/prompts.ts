import type { CategoryKey } from "../types";

const SOURCE_HINTS: Record<CategoryKey, string> = {
  music:
    "First Avenue, The Armory, Palace Theatre, Fine Line, Surly, Paisley Park, Lake Harriet Bandshell, Ticketmaster.",
  sports:
    "Minnesota Twins, Wild, Timberwolves, Lynx, MN United, St. Paul Saints, Gophers schedules.",
  family:
    "Como Zoo, Minnesota Zoo, Mall of America / Nickelodeon Universe, libraries, parks & rec, Children's Museum.",
  arts:
    "Guthrie, Walker Art Center, Mia, Ordway, History Theatre, Fitzgerald Theater, Hennepin Theatre Trust.",
  food:
    "Brewery taprooms, food halls, Midtown Global Market, Eater Twin Cities, Heavy Table, market events.",
  weird:
    "Venue Instagrams and neighborhood newsletters: Can Can Wonderland, The Hook & Ladder, Bauhaus, Pimento, oddity markets. Plain APIs won't surface these.",
  festival:
    "City event calendars, neighborhood associations, Meet Minneapolis, Visit Saint Paul, street fests and open streets.",
};

export function buildResearchPrompt(
  category: CategoryKey,
  startDate: string,
  endDate: string,
): string {
  return `You are the ${category.toUpperCase()} research agent for City Pulse MN, covering the Twin Cities metro (within ~30 miles of downtown Minneapolis).

Find real, verifiable ${category} events happening between ${startDate} and ${endDate}.
Good sources for this category: ${SOURCE_HINTS[category]}

For each event, gather:
- title
- venue (name only)
- address (street address — needed for mapping)
- city (e.g. Minneapolis, St Paul, Bloomington)
- start (ISO 8601, local time, e.g. 2026-06-20T19:30)
- end (ISO 8601, local time; best estimate if not listed)
- price (display string, e.g. "$45", "$18-$120", "Free")
- ticket_url (link to tickets or the official listing)
- description (1-2 factual sentences)
- source_url (where you found it)

Rules:
- Only include events you can verify from a real source. Always include source_url.
- Do NOT geocode or assign a price tier — a later step handles that.
- Prefer primary sources (venue / box-office pages) over aggregators.
- category for every event must be exactly "${category}".

After your research, output ONLY a JSON array of event objects, inside a single \`\`\`json code block, with no other text. If you found nothing, output \`\`\`json\n[]\n\`\`\`.`;
}
