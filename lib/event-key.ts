import { createHash } from "node:crypto";
import type { PriceTier } from "./types";
import { canonicalizeTitle, canonicalizeVenue } from "./canonicalize";

// Re-exported for backwards compatibility (now defined in canonicalize.ts).
export { normalizeKeyPart } from "./canonicalize";

/**
 * Stable identity for an event. The same event re-discovered in a later run
 * yields the same key, so the weekly pipeline UPSERTs instead of duplicating.
 *
 * Inputs are CANONICALIZED first (venue aliases folded, titles cleaned), so
 * more true-duplicates collapse to one key. Uses the start DATE (not time) so
 * a corrected start time still matches.
 */
export function computeEventKey(
  title: string,
  venue: string,
  startISO: string,
): string {
  const day = startISO.slice(0, 10); // YYYY-MM-DD
  const basis = [canonicalizeTitle(title), canonicalizeVenue(venue), day].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/** Map a free-form price string to a tier. */
export function normalizeTier(price: string | undefined): PriceTier {
  const p = String(price ?? "").trim();
  if (p === "Free" || p === "$" || p === "$$" || p === "$$$") return p;
  const low = p.toLowerCase();
  if (!low) return "$$"; // unknown, not free
  if (low.includes("free") || low === "$0") return "Free";

  // Pull the lowest dollar amount mentioned and bucket it.
  const amounts = (low.match(/\$?\s?(\d+(?:\.\d{2})?)/g) ?? [])
    .map((m) => parseFloat(m.replace(/[^\d.]/g, "")))
    .filter((n) => Number.isFinite(n));
  if (amounts.length === 0) return "$$";
  const min = Math.min(...amounts);
  if (min === 0) return "Free";
  if (min < 20) return "$";
  if (min < 75) return "$$";
  return "$$$";
}
