/**
 * Outbound ticket-link tagging seam (Monetization M0.1).
 *
 * Every ticket click hands a vendor a buyer; this is the turnkey place to claim
 * an affiliate credit for the vendors whose programs we've joined. It's a SEAM,
 * built dormant: `AFFILIATE` is empty until we join a program and add its
 * (non-secret) tag here — until then every URL passes through unchanged, so
 * wiring it into the CTA is a safe no-op. When a tag is added, tagging activates
 * everywhere the CTA renders. The immediate payoff is the clicks-by-vendor
 * report (lib/stats.ts) that tells us which programs are even worth joining.
 *
 * Discipline: we only APPEND query params to the vendor's own URL. We never
 * rewrite the host or path (no redirect trickery), and we never overwrite a
 * param the URL already set. Idempotent and pure.
 */

export interface AffiliateTag {
  /** Query params to append (affiliate id, etc.). Non-secret. */
  params: Record<string, string>;
}

/**
 * host (no leading "www.") → tag. EMPTY by design — add an entry once a program
 * is joined, e.g. `"seatgeek.com": { params: { aid: "12345" } }`.
 */
export const AFFILIATE: Record<string, AffiliateTag> = {};

/** The registrable-ish host of a URL, lowercased, "www." stripped. Null if unparseable. */
export function outboundHost(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Tag a ticket URL for its vendor's affiliate program, if we've joined one.
 * Passthrough (unchanged) for empty input, unparseable URLs, or unknown/unjoined
 * hosts. `config` is injectable for tests; defaults to the live (empty) map.
 */
export function outboundTicketUrl(raw: string, config: Record<string, AffiliateTag> = AFFILIATE): string {
  if (!raw) return raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const tag = config[host];
  if (!tag) return raw; // unknown vendor, or no program joined yet
  for (const [k, v] of Object.entries(tag.params)) {
    if (!u.searchParams.has(k)) u.searchParams.set(k, v); // never clobber the vendor's own params
  }
  return u.toString();
}

/**
 * Append campaign params to a link WE place: the weekly email's sponsor and
 * support links, and the site footer's support link.
 *
 * A plain append, NOT the URL round-trip `outboundTicketUrl` uses above, and
 * deliberately so. This replaced a private copy in lib/digest.ts whose output
 * ships in live email, and `new URL().toString()` normalizes — it will add a
 * trailing slash to a bare origin and re-encode reserved characters. Identical
 * bytes out were worth more than symmetry with its neighbour.
 *
 * Why it moved here (2 Nov 2026): the footer's support link was going out
 * UNTAGGED while DEPLOY-SUPPORT-LINK-AND-PARKING.md claimed the UTM scheme
 * "lets us tell an email click from a site-footer click". It did not — both
 * tagged links were utm_medium=digest, and the footer carried no tag at all,
 * so a footer click was identifiable only by the absence of one. Pure.
 */
export function campaignUrl(url: string, source: string, medium: string, campaign: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
}
