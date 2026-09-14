import { describe, it, expect } from "vitest";
import {
  TOKEN_PATH,
  REFRESH_AFTER_DAYS,
  REAUTH_THRESHOLD_DAYS,
  loadToken,
  saveToken,
  needsRefresh,
  refreshToken,
  ensureFreshToken,
  type TokenDeps,
  type FetchJsonResult,
} from "../token";
import type { IgToken } from "../types";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const PATH = "/secrets/ig-token.json";
const SECRET = "IGQVJ-secret-token-value-000111";

function token(overrides: Partial<IgToken> = {}): IgToken {
  return {
    accessToken: SECRET,
    igUserId: "17841400000000000",
    username: "citypulsempls",
    obtainedAt: "2026-07-01T12:00:00.000Z",
    lastRefreshedAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

/** In-memory fs + canned fetch; every fetched URL is captured. */
function fakeDeps(opts: {
  files?: Record<string, string>;
  fetchJson?: (url: string) => Promise<FetchJsonResult>;
} = {}) {
  const files = new Map<string, string>(Object.entries(opts.files ?? {}));
  const urls: string[] = [];
  const deps: TokenDeps = {
    readFile: (p) => {
      const data = files.get(p);
      if (data === undefined) throw new Error(`ENOENT: ${p}`);
      return data;
    },
    writeFile: (p, data) => {
      files.set(p, data);
    },
    fetchJson: async (url) => {
      urls.push(url);
      if (!opts.fetchJson) throw new Error("unexpected network call");
      return opts.fetchJson(url);
    },
  };
  return { deps, files, urls };
}

const refreshOk = (newToken: string) => async (): Promise<FetchJsonResult> => ({
  ok: true,
  status: 200,
  body: { access_token: newToken, token_type: "bearer", expires_in: 5_183_944 },
});

const refreshFail = async (): Promise<FetchJsonResult> => ({
  ok: false,
  status: 400,
  body: { error: { message: "Error validating access token", type: "OAuthException", code: 190 } },
});

describe("TOKEN_PATH", () => {
  it("points at ig-token.json under Documents\\CityPulseMN, outside the repo", () => {
    expect(TOKEN_PATH).toContain("CityPulseMN");
    expect(TOKEN_PATH.endsWith("ig-token.json")).toBe(true);
  });
});

describe("loadToken — missing or corrupt means null, never a broken token", () => {
  it("round-trips what saveToken wrote", () => {
    const { deps } = fakeDeps();
    saveToken(token(), PATH, deps);
    expect(loadToken(PATH, deps)).toEqual(token());
  });

  it("missing file is null", () => {
    const { deps } = fakeDeps();
    expect(loadToken(PATH, deps)).toBeNull();
  });

  it("corrupt JSON is null", () => {
    const { deps } = fakeDeps({ files: { [PATH]: "{ not json !!" } });
    expect(loadToken(PATH, deps)).toBeNull();
  });

  it("non-object JSON is null", () => {
    const { deps } = fakeDeps({ files: { [PATH]: '"just a string"' } });
    expect(loadToken(PATH, deps)).toBeNull();
  });

  it("a token missing accessToken is corrupt, not usable", () => {
    const { accessToken: _dropped, ...rest } = token();
    const { deps } = fakeDeps({ files: { [PATH]: JSON.stringify(rest) } });
    expect(loadToken(PATH, deps)).toBeNull();
  });

  it("an empty-string accessToken is corrupt", () => {
    const { deps } = fakeDeps({
      files: { [PATH]: JSON.stringify(token({ accessToken: "" })) },
    });
    expect(loadToken(PATH, deps)).toBeNull();
  });
});

describe("saveToken format", () => {
  it("writes pretty JSON with a trailing newline", () => {
    const { deps, files } = fakeDeps();
    saveToken(token(), PATH, deps);
    const raw = files.get(PATH)!;
    expect(raw.endsWith("}\n")).toBe(true);
    expect(raw).toBe(JSON.stringify(token(), null, 2) + "\n");
  });
});

describe("needsRefresh — 7-day boundary", () => {
  it("6 days 23 hours old is not due", () => {
    const t = token({ lastRefreshedAt: "2026-08-20T13:00:00.000Z" });
    expect(needsRefresh(t, NOW)).toBe(false);
  });

  it("exactly 7 days old is not due (the window has not been exceeded)", () => {
    const t = token({ lastRefreshedAt: "2026-08-20T12:00:00.000Z" });
    expect(needsRefresh(t, NOW)).toBe(false);
  });

  it("7 days 1 minute old is due", () => {
    const t = token({ lastRefreshedAt: "2026-08-20T11:59:00.000Z" });
    expect(needsRefresh(t, NOW)).toBe(true);
  });

  it("a garbage lastRefreshedAt is due — refreshing is the only self-heal", () => {
    const t = token({ lastRefreshedAt: "not-a-date" });
    expect(needsRefresh(t, NOW)).toBe(true);
  });

  it("the exported window is 7 days", () => {
    expect(REFRESH_AFTER_DAYS).toBe(7);
  });
});

describe("refreshToken", () => {
  it("happy path rewrites accessToken and lastRefreshedAt, nothing else", async () => {
    const { deps, urls } = fakeDeps({ fetchJson: refreshOk("IGQVJ-new-token-222") });
    const before = token();
    const after = await refreshToken(before, NOW, deps);
    expect(after).toEqual({
      ...token(),
      accessToken: "IGQVJ-new-token-222",
      lastRefreshedAt: NOW.toISOString(),
    });
    // Never a half-updated token: the input is untouched.
    expect(before).toEqual(token());
    expect(urls).toEqual([
      "https://graph.instagram.com/refresh_access_token" +
        `?grant_type=ig_refresh_token&access_token=${SECRET}`,
    ]);
  });

  it("non-OK response throws with Meta's error message, never the token", async () => {
    const { deps } = fakeDeps({ fetchJson: refreshFail });
    const err = await refreshToken(token(), NOW, deps).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Error validating access token");
    expect((err as Error).message).not.toContain(SECRET);
  });

  it("non-OK with a non-JSON body falls back to the HTTP status", async () => {
    const { deps } = fakeDeps({
      fetchJson: async () => ({ ok: false, status: 500, body: null }),
    });
    await expect(refreshToken(token(), NOW, deps)).rejects.toThrow("HTTP 500");
  });

  it("an OK response without access_token throws — never a half-updated token", async () => {
    const { deps } = fakeDeps({
      fetchJson: async () => ({ ok: true, status: 200, body: { expires_in: 5000 } }),
    });
    await expect(refreshToken(token(), NOW, deps)).rejects.toThrow(/no access_token/);
  });
});

describe("ensureFreshToken", () => {
  it("missing file throws the reels:auth message", async () => {
    const { deps } = fakeDeps();
    await expect(ensureFreshToken(PATH, NOW, deps)).rejects.toThrow(
      'no Instagram token — run "npm run reels:auth" (docs/REELS-PUBLISH.md)',
    );
  });

  it("a fresh token is returned as-is with no network call", async () => {
    const t = token({ lastRefreshedAt: "2026-08-25T12:00:00.000Z" });
    const { deps, urls } = fakeDeps({ files: { [PATH]: JSON.stringify(t) } });
    expect(await ensureFreshToken(PATH, NOW, deps)).toEqual(t);
    expect(urls).toEqual([]);
  });

  it("a due token is refreshed and the refresh persisted", async () => {
    const t = token({ lastRefreshedAt: "2026-08-10T12:00:00.000Z" });
    const { deps, files } = fakeDeps({
      files: { [PATH]: JSON.stringify(t) },
      fetchJson: refreshOk("IGQVJ-new-token-333"),
    });
    const result = await ensureFreshToken(PATH, NOW, deps);
    expect(result.accessToken).toBe("IGQVJ-new-token-333");
    expect(result.lastRefreshedAt).toBe(NOW.toISOString());
    expect(JSON.parse(files.get(PATH)!)).toEqual(result);
    expect(files.get(PATH)!.endsWith("\n")).toBe(true);
  });

  it("refresh failure on a young token falls back to the existing token with a warning", async () => {
    // 17 days old: due for refresh, far from the 60-day expiry.
    const t = token({ lastRefreshedAt: "2026-08-10T12:00:00.000Z" });
    const stored = JSON.stringify(t, null, 2) + "\n";
    const { deps, files } = fakeDeps({
      files: { [PATH]: stored },
      fetchJson: refreshFail,
    });
    const warnings: string[] = [];
    expect(await ensureFreshToken(PATH, NOW, deps, warnings)).toEqual(t);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Error validating access token");
    expect(warnings[0]).not.toContain(SECRET);
    // Nothing rewritten: the next run retries the refresh.
    expect(files.get(PATH)).toBe(stored);
  });

  it("boundary: 49 days 23 hours old still falls back", async () => {
    const t = token({ lastRefreshedAt: "2026-07-08T13:00:00.000Z" });
    const { deps } = fakeDeps({
      files: { [PATH]: JSON.stringify(t) },
      fetchJson: refreshFail,
    });
    const warnings: string[] = [];
    expect(await ensureFreshToken(PATH, NOW, deps, warnings)).toEqual(t);
    expect(warnings).toHaveLength(1);
  });

  it("refresh failure at exactly 50 days throws re-auth, never the token value", async () => {
    expect(REAUTH_THRESHOLD_DAYS).toBe(50);
    const t = token({ lastRefreshedAt: "2026-07-08T12:00:00.000Z" });
    const { deps } = fakeDeps({
      files: { [PATH]: JSON.stringify(t) },
      fetchJson: refreshFail,
    });
    const err = await ensureFreshToken(PATH, NOW, deps).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("reels:auth");
    expect((err as Error).message).toContain("Error validating access token");
    expect((err as Error).message).not.toContain(SECRET);
  });

  it("refresh failure with an unparseable lastRefreshedAt throws — age unknowable", async () => {
    const t = token({ lastRefreshedAt: "??" });
    const { deps } = fakeDeps({
      files: { [PATH]: JSON.stringify(t) },
      fetchJson: refreshFail,
    });
    await expect(ensureFreshToken(PATH, NOW, deps)).rejects.toThrow(/reels:auth/);
  });
});
