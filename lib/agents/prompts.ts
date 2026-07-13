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
- Prioritize completeness per venue over commentary. Do not invent shows.
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

  return `You are a VERIFICATION agent for City Pulse MN, a Twin Cities events calendar. These events are happening in the next few days. Re-check each one against its source (and a quick search if the source is unhelpful):

${list}

For EACH event, decide exactly one verdict:
- "confirmed"  — the event still appears as scheduled.
- "cancelled"  — a source explicitly says cancelled/postponed. You MUST include "evidence": the URL or the exact wording you saw. Never infer cancellation.
- "moved"      — the source shows a different date/time. Include "new_start" (ISO 8601) if visible. Do not guess.
- "sold_out"   — still happening, but tickets are gone.
- "not_found"  — you can't find the event anymore. IMPORTANT: a missing page is NOT evidence of cancellation — pages move all the time. Use this verdict and let a human look.

Be conservative: when unsure between two verdicts, pick the less drastic one.

Output ONLY a JSON array inside a single \`\`\`json code block:
[{"id": "...", "verdict": "confirmed"}, {"id": "...", "verdict": "cancelled", "evidence": "https://…"}]`;
}
