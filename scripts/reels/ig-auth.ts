/**
 * One-time / recovery Instagram auth for the reels publisher.
 *
 * Instagram Platform API, Instagram Login variant (no Facebook Page —
 * docs/REELS-PUBLISH.md "Why this API path"): prints the authorization URL,
 * Taren opens it and approves, pastes the redirect back, and this exchanges
 * code → short-lived → long-lived (60-day) token, verifies it against /me,
 * and writes ig-token.json to Documents\CityPulseMN — never the repo.
 *
 * Needs IG_APP_ID + IG_APP_SECRET in .env.local. The redirect lands on
 * https://localhost/ which serves nothing — that's by design; the code
 * travels in the address bar and Taren copies it from there.
 */
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { TOKEN_PATH, saveToken } from "../../lib/reels/publish/token";
import type { IgToken } from "../../lib/reels/publish/types";

export const IG_SCOPES = "instagram_business_basic,instagram_business_content_publish";
export const REDIRECT_URI = "https://localhost/";

const GRAPH_BASE = "https://graph.instagram.com";

export function buildAuthUrl(appId: string, redirectUri: string): string {
  return (
    "https://www.instagram.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code" +
    `&scope=${IG_SCOPES}`
  );
}

/**
 * Accepts what a person actually pastes: the bare code, or the whole
 * redirected URL from the address bar (https://localhost/?code=...#_ —
 * Instagram appends the "#_"). Throws a plain-language error otherwise.
 */
export function parseRedirectInput(pasted: string): string {
  const input = pasted.trim();
  if (!input) {
    throw new Error("Nothing pasted — expected the code or the full redirected URL.");
  }
  const fromUrl = input.match(/(?:^|[?&])code=([^&#\s]+)/);
  // Decode the URL branch: the address bar shows the code percent-encoded,
  // and the exchange request re-encodes — passing it raw would double-encode.
  if (fromUrl) return decodeURIComponent(fromUrl[1]);
  if (input.includes("://") || input.includes("?") || input.includes("=")) {
    throw new Error(
      "Couldn't find code= in what you pasted — copy the full address-bar URL after " +
        "approving (it looks like https://localhost/?code=...) or just the code value.",
    );
  }
  return input.endsWith("#_") ? input.slice(0, -"#_".length) : input;
}

export interface CodeExchangeRequest {
  url: string;
  /** application/x-www-form-urlencoded */
  body: string;
}

export function buildCodeExchangeRequest(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): CodeExchangeRequest {
  return {
    url: "https://api.instagram.com/oauth/access_token",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }).toString(),
  };
}

export function buildLongLivedUrl(appSecret: string, shortLivedToken: string): string {
  return (
    `${GRAPH_BASE}/access_token?grant_type=ig_exchange_token` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&access_token=${encodeURIComponent(shortLivedToken)}`
  );
}

/** Fresh IgToken — both clocks start now; refresh happens in token.ts later. */
export function buildToken(
  accessToken: string,
  igUserId: string,
  username: string,
  now: Date,
): IgToken {
  const iso = now.toISOString();
  return { accessToken, igUserId, username, obtainedAt: iso, lastRefreshedAt: iso };
}

/**
 * Fetch + parse with honest errors. `what` labels the step; the error carries
 * status + response text (Meta's error JSON) but never a URL — the long-lived
 * exchange URL contains the app secret and token.
 */
async function requestJson(what: string, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${what} failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what}: response was not JSON (HTTP ${res.status})`);
  }
}

async function main() {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "IG_APP_ID and IG_APP_SECRET are required — add them to .env.local " +
        "(Meta app dashboard → Instagram → API setup with Instagram login).",
    );
  }

  console.log("[ig-auth] 1) Open this URL in a browser where @CityPulseMpls is logged in:");
  console.log();
  console.log(`   ${buildAuthUrl(appId, REDIRECT_URI)}`);
  console.log();
  console.log("[ig-auth] 2) Approve. The browser lands on https://localhost/?code=... and the");
  console.log("[ig-auth]    page won't load — that's expected. Copy the whole address bar.");
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question("[ig-auth] 3) Paste the URL (or just the code): ");
  rl.close();
  const code = parseRedirectInput(pasted);

  const exchange = buildCodeExchangeRequest(appId, appSecret, REDIRECT_URI, code);
  const shortRaw = (await requestJson("code → short-lived token", exchange.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: exchange.body,
  })) as {
    access_token?: string;
    user_id?: number | string;
    data?: { access_token?: string; user_id?: number | string }[];
  };
  // Meta has documented this response both bare and wrapped as {data:[...]} —
  // accept either.
  const short = shortRaw.data?.[0] ?? shortRaw;
  if (!short.access_token) throw new Error("code exchange returned no access_token");

  const long = (await requestJson(
    "short → long-lived token",
    buildLongLivedUrl(appSecret, short.access_token),
  )) as { access_token?: string; expires_in?: number };
  if (!long.access_token) throw new Error("long-lived exchange returned no access_token");

  // user_id is the professional-account ID the publishing endpoints need;
  // /me's plain id can be app-scoped. Prefer user_id, cross-checked against
  // the code exchange's own user_id when both exist.
  const me = (await requestJson(
    "identity check (/me)",
    `${GRAPH_BASE}/v23.0/me?fields=user_id,username`,
    { headers: { Authorization: `Bearer ${long.access_token}` } },
  )) as { user_id?: number | string; id?: string; username?: string };
  const igUserId = String(me.user_id ?? me.id ?? "");
  if (!igUserId || !me.username) {
    throw new Error("/me returned no user_id/username — the token works but identity is unclear");
  }
  if (short.user_id && String(short.user_id) !== igUserId) {
    console.warn(
      `[ig-auth] note: /me user_id (${igUserId}) differs from the exchange's user_id (${short.user_id}) — using /me's`,
    );
  }

  const token = buildToken(long.access_token, igUserId, me.username, new Date());
  saveToken(token, TOKEN_PATH);

  // Shape only, never the token itself.
  console.log(`[ig-auth] authorized as @${me.username} (IG user ${me.id})`);
  console.log(`[ig-auth] token saved (${long.access_token.length} chars, 60-day) → ${TOKEN_PATH}`);
  console.log("[ig-auth] done — the publish run refreshes it from here.");
}

// Run only as a CLI entrypoint — the pure helpers above are imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase();

if (invokedDirectly) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error("[ig-auth] fatal:", err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
