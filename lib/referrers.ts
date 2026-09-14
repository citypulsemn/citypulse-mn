/**
 * Where a reader arrived from — attribution without identity.
 *
 * WHY THIS SHAPE. `docs/ANALYTICS.md` states the rule this project analytics
 * runs on: `event_stats` holds no user identifiers, and "this is the design,
 * not a policy layered on top". Referrers keep that promise exactly:
 *
 *   - The BROWSER extracts the hostname and sends only that. The full referring
 *     URL never leaves the page, so a query string carrying someone's search
 *     terms or a session id cannot reach our logs, our infrastructure, or us.
 *   - The server stores one counter per (day, host). Like `event_stats`, the
 *     table cannot answer "who" — only "how many".
 *
 * So this adds attribution and adds no new privacy category. It is the reason
 * uniques are NOT here: a unique visitor count needs an identifier, and that
 * is a different promise to readers than the one currently made.
 */

/** Hosts that are us. A reader moving between our own pages is not a referral. */
const SELF = ["citypulsemn.com", "localhost", "127.0.0.1"];

/**
 * A raw hostname from the browser, reduced to something safe to store.
 *
 * Returns "direct" for no referrer (typed the URL, a bookmark, an app, or a
 * privacy setting that strips it), "internal" for our own pages, and a bare
 * lowercased host otherwise. Null for anything that is not plausibly a host —
 * the beacon is public, so this is a trust boundary, not a formatter.
 */
export function normalizeReferrer(raw: unknown, selfHosts: string[] = SELF): string | null {
  if (raw === undefined || raw === null) return "direct";
  if (typeof raw !== "string") return null;
  let host = raw.trim().toLowerCase();
  if (host === "") return "direct";

  // Accept a full URL too, and keep only its host. Belt and braces: the client
  // is supposed to send a bare hostname, but the endpoint is public.
  if (host.includes("/") || host.includes(":")) {
    try {
      host = new URL(host.includes("//") ? host : `https://${host}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  if (host.startsWith("www.")) host = host.slice(4);
  if (host.length > 120) return null;
  // A hostname, and nothing that could carry a path, a query or an identifier.
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) {
    return selfHosts.includes(host) ? "internal" : null;
  }
  if (selfHosts.some((s) => host === s || host.endsWith(`.${s}`))) return "internal";
  return host;
}

/**
 * Group hosts into the names a person actually thinks in, for display only.
 *
 * Storage keeps the raw host so nothing is lost; this is the reading layer.
 * Without it "google.com", "www.google.co.uk" and "news.google.com" sit as
 * three lines when the answer you want is "Google".
 */
const BRANDS: [RegExp, string][] = [
  // FIRST, deliberately. "mail.google.com" matches the Google pattern below,
  // and a click from Gmail is not a search result — attributing it to search
  // would overstate the one channel this dashboard exists to measure.
  [/(^|\.)(mail\.google\.com|outlook\.|mail\.yahoo\.|mail\.proton\.me)/, "Email client"],
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)search\.yahoo\./, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "X / Twitter"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "LinkedIn"],
  [/(^|\.)nextdoor\.com$/, "Nextdoor"],
  [/(^|\.)pinterest\./, "Pinterest"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
];

export function referrerLabel(host: string): string {
  if (host === "direct") return "Direct / none";
  if (host === "internal") return "Within the site";
  for (const [re, name] of BRANDS) if (re.test(host)) return name;
  return host;
}

/** Search engines, so acquisition can be split from social and everything else. */
const SEARCH = new Set(["Google", "Bing", "DuckDuckGo", "Yahoo", "Ecosia"]);
const SOCIAL = new Set([
  "Facebook", "Instagram", "Reddit", "X / Twitter", "LinkedIn",
  "Nextdoor", "Pinterest", "TikTok", "YouTube",
]);

export type ReferrerChannel = "search" | "social" | "email" | "direct" | "internal" | "referral";

export function referrerChannel(host: string): ReferrerChannel {
  if (host === "direct") return "direct";
  if (host === "internal") return "internal";
  const label = referrerLabel(host);
  if (SEARCH.has(label)) return "search";
  if (SOCIAL.has(label)) return "social";
  if (label === "Email client") return "email";
  return "referral";
}

/** Roll raw (host, count) rows up into channels, biggest first. */
export function byChannel(
  rows: { host: string; count: number }[],
): { channel: ReferrerChannel; count: number; share: number }[] {
  const total = rows.reduce((n, r) => n + (Number.isFinite(r.count) ? r.count : 0), 0);
  const acc = new Map<ReferrerChannel, number>();
  for (const r of rows) {
    if (!Number.isFinite(r.count)) continue;
    const c = referrerChannel(r.host);
    acc.set(c, (acc.get(c) ?? 0) + r.count);
  }
  return [...acc.entries()]
    .map(([channel, count]) => ({ channel, count, share: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}
