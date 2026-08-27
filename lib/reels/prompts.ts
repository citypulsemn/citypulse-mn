import { chicagoOffset } from "../clock";
import type { CandidateEvent, PostDay, Variant, WeekWindow } from "./types";
import { SHOT_TYPES } from "./types";

/**
 * Prompt builders for the reels copywriter and the top-up researcher.
 * Pure string builders, exported for golden tests. The voice rules are the
 * owner's toolkit wording — keep them faithful, do not "improve" them.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(window: WeekWindow): string {
  return MONTH_NAMES[Number(window.start.slice(5, 7)) - 1];
}

// Superset of the validator's BANNED_BROLL list so a compliant first reply
// also passes validation instead of burning the one retry.
const BANNED_TERM_WORDS =
  "palm, beach, ocean, tropical, mountain, europe, cobblestone, desert, terracotta, coastline";

function voiceRules(variant: Variant, day: PostDay): string {
  const weekWord = day === "monday" ? "week" : "weekend";
  switch (variant) {
    case "regular":
      return [
        `NAMES: Title Case, clear and appealing, never gimmicky, 7 words or fewer. The feel: "Twins vs. LA Dodgers", "Live Jazz at the Dakota".`,
        day === "friday"
          ? `CAPTION: friendly local voice, high energy — "Weekend is here, Minneapolis" energy. List the 5 events briefly, then end by asking which one they're going to.`
          : `CAPTION: friendly local voice, calm and upbeat — easing people into the week, not shouting at them. List the 5 events briefly, then end by asking which one they're adding to their week.`,
      ].join("\n");
    case "family":
      return [
        `NAMES: warm, parent-to-parent, instantly readable as kid-appropriate, 7 words or fewer. The feel: "Toddler Story Time at the Library".`,
        day === "friday"
          ? `CAPTION: one tired parent texting another a lifeline. Work in "your weekend is sorted". End by asking them to tag another parent who needs this.`
          : `CAPTION: one tired parent texting another a lifeline. Open with "Here's your week, parents" energy. End by asking them to tag another parent who needs this.`,
      ].join("\n");
    case "weird":
      return [
        `NAMES: rewrite each event for absurdity as short phrases separated by periods — accurate to the real event, 60 characters or fewer. The feel: "72 Corgis. One Racetrack. A Professional Announcer.", "Putt-Putt. Hot Dog Hole. Art Museum."`,
        `CAPTION: irreverent, "Minneapolis, what are you doing?" energy. One line per event. End by asking who they're dragging along.`,
      ].join("\n");
  }
}

/** One "- Line N (label): shot type" row per b-roll line, rotation applied. */
function shotTypeAssignments(window: WeekWindow, eventCount: number): string {
  const total = eventCount + 2; // HOOK + events + CTA
  const rows: string[] = [];
  for (let i = 0; i < total; i++) {
    const label = i === 0 ? "HOOK" : i === total - 1 ? "CTA" : `event ${i}`;
    rows.push(`- Line ${i + 1} (${label}): ${SHOT_TYPES[(window.shotTypeKey + i) % 4]}`);
  }
  return rows.join("\n");
}

export function buildCopywriterPrompt(
  day: PostDay,
  variant: Variant,
  window: WeekWindow,
  events: CandidateEvent[],
  detailsLines: string[],
): string {
  const dayLabel =
    day === "monday" ? "Monday (weekday events, Mon-Fri)" : "Friday (weekend events, Sat-Sun)";
  const numbered = events
    .map(
      (e, i) =>
        `${i + 1}. ${e.title} — ${e.venue}, ${e.city}. ${e.description}\n` +
        `   Details line (locked, already on the card): "${detailsLines[i] ?? ""}"`,
    )
    .join("\n");
  const brollCount = events.length + 2;

  return `You are the copywriter for @CityPulseMpls, a Minneapolis events page on Instagram. Write the ${dayLabel} ${variant} reel covering ${window.start} to ${window.end}: a card name for each event, the caption, and Pexels b-roll search terms.

The ${events.length} events, numbered, with their locked details lines (you write the NAME for each; the details line is final — never rewrite it):
${numbered}

VOICE for this reel:
${voiceRules(variant, day)}

CAPTION RULES (every reel): under 100 words. No hashtags. No emojis. No em dashes, no en dashes, no spaced hyphens (" - "); hyphens inside proper names are fine.

B-ROLL: exactly ${brollCount} lines, in this order: HOOK, one line per event (label = your name for that event, in event order), CTA. Each line: exactly 3 Pexels search terms, most to least specific, each 2-5 words. HOOK and CTA are wide establishing Minneapolis shots: skyline, Stone Arch Bridge, Mississippi river, the chain of lakes, the Grain Belt sign. Every term must lead with a Minneapolis / Minnesota / named-landmark or clearly Midwestern subject — authenticity beats variety; a real Minneapolis frame beats a prettier anywhere-shot. Vary subjects and angles line to line — mix crowds, details, motion, architecture, nature; not seven wide shots of different places.

Shot type per line this week — bake the assigned shot type into at least 2 of that line's 3 terms:
${shotTypeAssignments(window, events.length)}

It is ${monthName(window)} in Minnesota — outdoor terms must match the current season. Banned words in any term: ${BANNED_TERM_WORDS}.

Return ONLY fenced JSON in exactly this shape, no other text before or after:
\`\`\`json
{
  "names": ["event 1 name", "event 2 name", "event 3 name", "event 4 name", "event 5 name"],
  "caption": "...",
  "broll": [
    { "label": "HOOK", "terms": ["t1", "t2", "t3"] },
    { "label": "<your event 1 name>", "terms": ["t1", "t2", "t3"] },
    { "label": "<one line per event, in order>", "terms": ["t1", "t2", "t3"] },
    { "label": "CTA", "terms": ["t1", "t2", "t3"] }
  ]
}
\`\`\`
"names" must have exactly ${events.length} entries, in event order. "broll" must have exactly ${brollCount} lines.`;
}

const VARIANT_FIT: Record<Variant, string> = {
  regular:
    "general-interest adult events — concerts, games, festivals, food, arts; things a broad Minneapolis audience would actually go to",
  family:
    "kid- and toddler-appropriate — daytime and early evening only, nothing that starts past 7pm, free events preferred",
  weird:
    "genuinely strange, niche, or unexpected — oddity markets, obscure competitions, one-off spectacles; the wonderfully unusual, not merely quirky marketing",
};

export function buildTopUpPrompt(
  variant: Variant,
  window: WeekWindow,
  need: number,
  haveTitles: string[],
): string {
  const have =
    haveTitles.length > 0
      ? `Already on the card — do NOT return any of these, or near-duplicates of them:\n${haveTitles.map((t) => `- ${t}`).join("\n")}`
      : "Nothing is on the card yet.";

  return `You are a web-search researcher for City Pulse MN's Instagram reels, covering the Minneapolis-St. Paul metro. The ${variant} reel is short of events. Find ${need} MORE real events happening between ${window.start} and ${window.end} (inclusive), anywhere in the metro.

Category fit for this reel: ${VARIANT_FIT[variant]}.

${have}

Rules:
- Every event must be real and verified against a working source URL (venue page, box office, official listing). If you cannot verify ${need} events, return fewer — never invent one.
- STRICTLY EXCLUDE political events and drag events. This is a locked brand rule with no exceptions.
- Times are local Minneapolis; write startAt and endAt as ISO 8601 with the ${chicagoOffset(`${window.start}T12:00`)} offset (e.g. ${window.start}T19:00:00${chicagoOffset(`${window.start}T12:00`)}). Use null for endAt when the source lists no end time.
- priceTier is one of "Free" | "$" | "$$" | "$$$" (roughly: $ under $15, $$ $15-50, $$$ over $50).
- category is what the event genuinely is: music | sports | family | arts | food | weird | festival.

Return ONLY a fenced JSON array, no other text — [] if you found nothing verifiable:
\`\`\`json
[
  {
    "title": "...",
    "category": "music",
    "venue": "...",
    "city": "...",
    "startAt": "${window.start}T19:00:00${chicagoOffset(`${window.start}T12:00`)}",
    "endAt": null,
    "price": "$25",
    "priceTier": "$$",
    "sourceUrl": "https://...",
    "description": "1-2 factual sentences"
  }
]
\`\`\``;
}
