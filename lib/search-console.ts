import { createSign } from "node:crypto";

/**
 * SEARCH CONSOLE — impressions automation (roadmap v5 F2.4).
 *
 * The ops digest's Index line is manual-first: someone glances at the GSC
 * Performance report each week. This wires the DEMAND number the Phase 5
 * revenue gate actually cares about — impressions & clicks — into the digest,
 * so the gate reads itself. The raw "indexed pages" count is deliberately NOT
 * automated: the Search Console API doesn't expose it as a bulk read (it'd need
 * per-URL Inspection sampling, rate-limited), so that stays the manual glance.
 *
 * NO SDK, plain fetch + node:crypto — the project's standing rule (audit 0).
 * The service-account JWT is hand-signed here rather than pulling in
 * googleapis. Auth uses a service account added as a user on the GSC property.
 *
 * BUILD STATE (F2.4): the PURE parts — parseSearchAnalytics, buildJwtClaims,
 * gscDateWindow — are golden-tested, and getSearchImpressions is verified to
 * return null (→ the digest's manual fallback) when no key is configured, which
 * is today's state. The live token exchange + query run only once
 * GSC_SERVICE_ACCOUNT_JSON is set; that path is verified against real data at
 * wire-up time. Everything sits behind the ops digest's never-break wrapper, so
 * a bad key or a Google outage degrades to the manual line — never a dead email.
 */

export interface SearchStats {
  impressions: number;
  clicks: number;
  /** clicks / impressions, 0..1. Derived, so it can't disagree with the parts. */
  ctr: number;
}

/**
 * Sum a Search Console `searchAnalytics.query` response into 7-day totals.
 * Works whether the query used no dimensions (one aggregate row) or
 * dimensions:["date"] (a row per day) — it just sums every row. Returns null
 * for a missing/empty/all-zero response, which the digest renders as "no data
 * yet" rather than a fake zero.
 */
export function parseSearchAnalytics(raw: unknown): SearchStats | null {
  if (!raw || typeof raw !== "object") return null;
  const rows = (raw as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let impressions = 0;
  let clicks = 0;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as { impressions?: unknown; clicks?: unknown };
    if (typeof o.impressions === "number" && Number.isFinite(o.impressions)) impressions += o.impressions;
    if (typeof o.clicks === "number" && Number.isFinite(o.clicks)) clicks += o.clicks;
  }
  if (impressions <= 0 && clicks <= 0) return null; // nothing real to report yet
  return { impressions, clicks, ctr: impressions > 0 ? clicks / impressions : 0 };
}

/** The signed JWT claim set for the service-account → access-token exchange.
 *  Pure and tested — getting iss/scope/aud/exp right is the whole ballgame. */
export function buildJwtClaims(clientEmail: string, nowSec: number) {
  return {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600, // Google caps assertion lifetime at 1 hour
  };
}

/** [startDate, endDate] as YYYY-MM-DD for the query. GSC finalizes data on a
 *  ~2-3 day lag, so the window ends 3 days back — otherwise the recent tail
 *  reads artificially low. Pure/tested; date math only, no wall-clock frame
 *  needed (GSC interprets the strings in the property's own zone). */
export function gscDateWindow(now: Date, days: number): { startDate: string; endDate: string } {
  const key = (offsetDays: number) =>
    new Date(now.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  return { startDate: key(-(days + 2)), endDate: key(-3) };
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** Exchange a service-account assertion for a short-lived access token. LIVE —
 *  exercised only when a key is configured; verified at F2.4 wire-up. */
async function getAccessToken(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify(buildJwtClaims(sa.client_email, nowSec)));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`gsc token ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("gsc token: no access_token in response");
  return json.access_token;
}

/**
 * 7-day Search Console impressions/clicks for the ops digest, or null.
 *
 * null when the service account isn't configured (today's state → the digest
 * shows its manual GSC line), and on ANY failure (never-break: a Google hiccup
 * must not take down the cockpit email). The one moving part at wire-up is the
 * GSC_SERVICE_ACCOUNT_JSON secret; the property defaults to the verified domain
 * property and is overridable via GSC_PROPERTY.
 */
export async function getSearchImpressions(days = 7, now: Date = new Date()): Promise<SearchStats | null> {
  const rawKey = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawKey || !rawKey.trim()) return null; // not wired yet → manual fallback

  try {
    const sa = JSON.parse(rawKey) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) throw new Error("service account JSON missing fields");
    const property = process.env.GSC_PROPERTY || "sc-domain:citypulsemn.com";
    const nowSec = Math.floor(now.getTime() / 1000);

    const token = await getAccessToken(sa, nowSec);
    const { startDate, endDate } = gscDateWindow(now, days);
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions: [] }),
      },
    );
    if (!res.ok) throw new Error(`gsc query ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return parseSearchAnalytics(await res.json());
  } catch (err) {
    console.error("[gsc] impressions read failed (manual fallback):", err);
    return null;
  }
}
