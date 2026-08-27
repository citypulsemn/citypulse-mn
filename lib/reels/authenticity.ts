import Anthropic from "@anthropic-ai/sdk";

/**
 * Vision authenticity gate for b-roll candidates: Claude looks at each Pexels
 * poster image and answers whether the footage could pass as Minneapolis /
 * Minnesota. This automates the check the owner does by eye — the toolkit's
 * hard rule is "wrong b-roll kills credibility instantly" (no palm trees, no
 * mountains, no ocean, no European streets, no desert, no non-MN landmarks).
 *
 * Fail-open on API failure: the manual pipeline had no vision gate at all,
 * and the search terms are already Minneapolis-specific, so a broken screen
 * degrades to the manual baseline — with a warning pushed so the manifest
 * says so honestly.
 */

let client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 120_000,
    maxRetries: 3,
  });
  return client;
}

/**
 * The seasonal half of the screen (the owner's rule: "no video shots with
 * snow in the summer — things like that"). The toolkit's seasonal lock is
 * absolute for outdoor footage; indoor scenes are always season-neutral.
 * Wordings are Minnesota-aware: what counts as out-of-season follows the
 * toolkit's four seasonal pools, not the calendar's idea of the weather.
 */
export function seasonScreenNote(month: number): string {
  if (month === 12 || month <= 2) {
    return `It is WINTER in Minnesota. Additionally REJECT any outdoor scene that reads as another season: lush green trees or lawns, blooming flowers, open-water swimming or kayaking or paddleboarding, beach or patio crowds in summer clothing, autumn foliage.`;
  }
  if (month <= 5) {
    return `It is SPRING in Minnesota. Additionally REJECT any outdoor scene that reads as another season: heavy snow cover, frozen lakes, outdoor ice skating, sledding, autumn foliage.`;
  }
  if (month <= 8) {
    return `It is SUMMER in Minnesota. Additionally REJECT any outdoor scene that reads as another season: snow, ice, frozen lakes, bare leafless trees, people in winter coats and hats, autumn foliage.`;
  }
  return `It is FALL in Minnesota. Additionally REJECT any outdoor scene that reads as another season: heavy snow cover, frozen lakes, spring blossoms, open-water swimming or beach crowds in summer clothing.`;
}

export function buildScreenPrompt(seasonNote: string): string {
  return `You screen stock-footage thumbnails for a Minneapolis, Minnesota local events page. For EACH image, in order, answer whether it could plausibly pass as CURRENT Minneapolis / Minnesota / generic-Midwest footage to a local viewer.

REJECT (false) anything showing: palm trees, tropical settings, ocean or sea coastline, mountains, desert, European architecture (cobblestones, terracotta roofs, old-world plazas), or a recognizable landmark that is NOT in Minnesota.
${seasonNote}
ACCEPT (true) anything that reads as plausibly Midwestern and in-season: flat or gently rolling terrain, lakes and rivers, brick or glass architecture, generic interiors (concerts, markets, kitchens, museums — interiors are always season-neutral), people close-ups where the setting is neutral.

Reply with ONLY a JSON array of booleans, one per image, in order. Example: [true, false, true]`;
}

/** Parses the model's verdict array; throws descriptively on any mismatch. */
export function parseScreenVerdicts(text: string, expected: number): boolean[] {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error(`vision screen reply had no JSON array: "${text.slice(0, 120)}"`);
  const parsed: unknown = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length !== expected) {
    throw new Error(
      `vision screen returned ${Array.isArray(parsed) ? parsed.length : "no"} verdicts for ${expected} images`,
    );
  }
  return parsed.map((v) => v === true);
}

export async function screenImagesWithClaude(
  imageUrls: string[],
  seasonNote: string,
): Promise<boolean[]> {
  if (imageUrls.length === 0) return [];
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: buildScreenPrompt(seasonNote) },
    ...imageUrls.map(
      (url): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "url", url },
      }),
    ),
  ];
  const res = await anthropicClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{ role: "user", content }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseScreenVerdicts(text, imageUrls.length);
}

/**
 * Wraps the Claude screen with fail-open degradation: any error accepts the
 * whole candidate set and records one warning, so a vision outage can't kill
 * a Monday run — it just reverts that term to the manual level of scrutiny.
 */
export function makeScreenImages(
  warnings: string[],
  seasonNote: string,
  screen: (urls: string[], seasonNote: string) => Promise<boolean[]> = screenImagesWithClaude,
): (urls: string[]) => Promise<boolean[]> {
  return async (urls: string[]) => {
    try {
      return await screen(urls, seasonNote);
    } catch (err) {
      warnings.push(
        `authenticity/season screen unavailable (${err instanceof Error ? err.message : String(err)}) — accepted ${urls.length} candidate(s) unscreened`,
      );
      return urls.map(() => true);
    }
  };
}
