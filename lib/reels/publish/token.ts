import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { dirname } from "node:path";
import type { IgToken } from "./types";

/**
 * Instagram user-token lifecycle: load, refresh, persist. The token file
 * lives outside the repo (Documents\CityPulseMN) and holds a 60-day
 * long-lived token; every successful refresh restarts the 60-day clock, and
 * the publisher runs twice weekly, so a healthy token never expires.
 *
 * Secrets rule: the access token goes into the refresh URL (Meta's contract
 * puts it in the query string) but must never appear in error messages,
 * warnings, or logs.
 */

export const TOKEN_PATH = path.join(
  os.homedir(),
  "Documents",
  "CityPulseMN",
  "ig-token.json",
);

/** Refresh once the last refresh is more than this many days behind. */
export const REFRESH_AFTER_DAYS = 7;

/**
 * A token that WON'T refresh but is younger than this keeps publishing (the
 * next run retries). At 50+ days it is within 10 days of the 60-day expiry —
 * stop and re-auth instead of limping toward a mid-week death.
 */
export const REAUTH_THRESHOLD_DAYS = 50;

export interface FetchJsonResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface TokenFileDeps {
  /** Read a file as utf8 text; throws when missing. */
  readFile(path: string): string;
  writeFile(path: string, data: string): void;
}

export interface RefreshDeps {
  fetchJson(url: string): Promise<FetchJsonResult>;
}

export interface TokenDeps extends TokenFileDeps, RefreshDeps {}

export const defaultTokenDeps: TokenDeps = {
  readFile: (p) => readFileSync(p, "utf8"),
  writeFile: (p, data) => {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data, "utf8");
  },
  fetchJson: async (url) => {
    const res = await fetch(url);
    let body: unknown = null;
    try {
      // Meta sends JSON on errors too — keep it for the error message.
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  },
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Missing or corrupt file yields null — the caller decides whether that
 * means "run reels:auth". A file missing any required field counts as
 * corrupt: a token that can't publish must not pretend it can.
 */
export function loadToken(
  tokenPath: string,
  deps: TokenFileDeps = defaultTokenDeps,
): IgToken | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(deps.readFile(tokenPath));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!isNonEmptyString(record.accessToken)) return null;
  if (!isNonEmptyString(record.igUserId)) return null;
  if (typeof record.username !== "string") return null;
  if (typeof record.obtainedAt !== "string") return null;
  if (typeof record.lastRefreshedAt !== "string") return null;
  return {
    accessToken: record.accessToken,
    igUserId: record.igUserId,
    username: record.username,
    obtainedAt: record.obtainedAt,
    lastRefreshedAt: record.lastRefreshedAt,
  };
}

export function saveToken(
  token: IgToken,
  tokenPath: string,
  deps: TokenFileDeps = defaultTokenDeps,
): void {
  deps.writeFile(tokenPath, JSON.stringify(token, null, 2) + "\n");
}

/** Days since lastRefreshedAt; NaN when the stored date is unparseable. */
function ageDays(token: IgToken, now: Date): number {
  return (now.getTime() - Date.parse(token.lastRefreshedAt)) / 86_400_000;
}

/**
 * True when the last refresh is more than REFRESH_AFTER_DAYS ago. Exactly
 * 7 days is NOT yet due. An unparseable date IS due — refreshing rewrites
 * lastRefreshedAt with a valid one, which is the only way to self-heal.
 */
export function needsRefresh(token: IgToken, now: Date): boolean {
  const days = ageDays(token, now);
  if (Number.isNaN(days)) return true;
  return days > REFRESH_AFTER_DAYS;
}

/** Meta error bodies: graph uses { error: { message } }, OAuth { error_message }. */
function apiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const error = record.error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (isNonEmptyString(message)) return message;
    }
    if (isNonEmptyString(record.error_message)) return record.error_message;
  }
  return `HTTP ${status}`;
}

/**
 * One GET to Meta's refresh endpoint; returns a fully-updated token (new
 * accessToken, lastRefreshedAt = now) or throws — never a half-updated one.
 * The input token is not mutated.
 */
export async function refreshToken(
  token: IgToken,
  now: Date,
  deps: RefreshDeps = defaultTokenDeps,
): Promise<IgToken> {
  const url =
    "https://graph.instagram.com/refresh_access_token" +
    `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token.accessToken)}`;
  const res = await deps.fetchJson(url);
  if (!res.ok) {
    // Scrub the token even if Meta echoes it back inside the error body —
    // the module's contract is that the secret never reaches a log line.
    const message = apiErrorMessage(res.body, res.status).split(token.accessToken).join("<token>");
    throw new Error(`Instagram token refresh failed: ${message}`);
  }
  const body = res.body as Record<string, unknown> | null;
  const accessToken = body?.access_token;
  if (!isNonEmptyString(accessToken)) {
    throw new Error("Instagram token refresh failed: response had no access_token");
  }
  return { ...token, accessToken, lastRefreshedAt: now.toISOString() };
}

/**
 * The publisher's entry point: load the token, refresh it when due, persist
 * the refresh. A failed refresh on a young token (< 50 days) is a warning,
 * not a stop — publishing still works and the next run retries. A failed
 * refresh at 50+ days (or unknown age) stops the run before anything is
 * uploaded: the token is about to expire and needs a re-auth.
 */
export async function ensureFreshToken(
  tokenPath: string,
  now: Date,
  deps: TokenDeps = defaultTokenDeps,
  warnings?: string[],
): Promise<IgToken> {
  const token = loadToken(tokenPath, deps);
  if (!token) {
    throw new Error('no Instagram token — run "npm run reels:auth" (docs/REELS-PUBLISH.md)');
  }
  if (!needsRefresh(token, now)) return token;

  let refreshError: string;
  try {
    const refreshed = await refreshToken(token, now, deps);
    saveToken(refreshed, tokenPath, deps);
    return refreshed;
  } catch (err) {
    refreshError = err instanceof Error ? err.message : String(err);
  }

  const age = ageDays(token, now);
  if (age < REAUTH_THRESHOLD_DAYS) {
    warnings?.push(
      `Instagram token refresh failed (${refreshError}) — token is ` +
        `${Math.floor(age)} days old and still valid, so publishing continues; ` +
        `the next run retries the refresh.`,
    );
    return token;
  }
  // NaN age (unparseable lastRefreshedAt) lands here too: recency can't be
  // established, so treat it as about-to-expire rather than publish blind.
  const ageLabel = Number.isNaN(age) ? "of unknown age" : `${Math.floor(age)} days old`;
  throw new Error(
    `Instagram token refresh failed (${refreshError}) and the token is ` +
      `${ageLabel} — it expires at 60. Re-run "npm run reels:auth" ` +
      `(docs/REELS-PUBLISH.md).`,
  );
}
