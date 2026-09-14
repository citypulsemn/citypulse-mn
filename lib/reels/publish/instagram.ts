/**
 * Thin, typed client for the Graph calls that publish a reel, plus the quota
 * check — Instagram Platform API, Instagram Login variant (no Facebook Page).
 * Endpoints per docs/REELS-PUBLISH.md, verified against Meta docs Aug 2026.
 *
 * No retry magic here: a failed call throws with Meta's error.message
 * verbatim so the manifest/ops email can show it. The access token travels
 * only in the Authorization header at execution time — request builders never
 * see it, and thrown messages are scrubbed so the value can never ride an
 * error into run.log or an email.
 */

export const GRAPH = "https://graph.instagram.com/v23.0";

/** Container processing is async — poll every 20s, up to 15 checks (~5 min). */
// Meta's recommendation and the locked architecture agree: poll once per
// minute, give up after ~5 minutes.
export const POLL_INTERVAL_MS = 60_000;
export const MAX_POLL_ATTEMPTS = 5;

/** A Graph call before the token is attached. Body is form-encoded. */
export interface GraphRequest {
  url: string;
  method: "GET" | "POST";
  body?: string;
}

export function buildCreateContainerRequest(
  igUserId: string,
  opts: { videoUrl: string; caption: string },
): GraphRequest {
  return {
    url: `${GRAPH}/${igUserId}/media`,
    method: "POST",
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: opts.videoUrl,
      caption: opts.caption,
    }).toString(),
  };
}

export function buildStatusRequest(containerId: string): GraphRequest {
  return {
    url: `${GRAPH}/${containerId}?fields=status_code,status`,
    method: "GET",
  };
}

export function buildPublishRequest(igUserId: string, containerId: string): GraphRequest {
  return {
    url: `${GRAPH}/${igUserId}/media_publish`,
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId }).toString(),
  };
}

export function buildQuotaRequest(igUserId: string): GraphRequest {
  return {
    url: `${GRAPH}/${igUserId}/content_publishing_limit?fields=quota_usage,config`,
    method: "GET",
  };
}

export interface GraphFetchResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface InstagramDeps {
  fetchJson(req: GraphRequest, headers: Record<string, string>): Promise<GraphFetchResult>;
}

export const defaultInstagramDeps: InstagramDeps = {
  fetchJson: async (req, headers) => {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.body
        ? { ...headers, "Content-Type": "application/x-www-form-urlencoded" }
        : headers,
      body: req.body,
    });
    // Meta sends JSON error bodies — parse regardless of status so the
    // caller can surface error.message.
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  },
};

export interface ContainerStatus {
  /** FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED. */
  statusCode: string;
  /** Meta's extended status text — the verbatim detail for the ops email. */
  detail: string;
}

export interface InstagramClient {
  /** Returns the container id. */
  createReelContainer(
    igUserId: string,
    opts: { videoUrl: string; caption: string },
  ): Promise<string>;
  getContainerStatus(containerId: string): Promise<ContainerStatus>;
  /** Returns the published media id. */
  publish(igUserId: string, containerId: string): Promise<string>;
  /** API-published posts in the rolling 24h window (limit is 100). */
  getQuotaUsage(igUserId: string): Promise<number>;
}

function metaErrorMessage(body: unknown): string | null {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" && message ? message : null;
}

export function makeInstagramClient(
  accessToken: string,
  deps: InstagramDeps = defaultInstagramDeps,
): InstagramClient {
  // Errors are scrubbed so the token value can never leak into a thrown
  // message — even if Meta echoes it back in error.message.
  const scrub = (text: string): string =>
    accessToken ? text.split(accessToken).join("<token>") : text;

  async function execute(req: GraphRequest): Promise<unknown> {
    const res = await deps.fetchJson(req, { Authorization: `Bearer ${accessToken}` });
    if (!res.ok) {
      throw new Error(scrub(metaErrorMessage(res.body) ?? `Instagram API error ${res.status}`));
    }
    return res.body;
  }

  return {
    async createReelContainer(igUserId, opts) {
      const body = (await execute(buildCreateContainerRequest(igUserId, opts))) as {
        id?: unknown;
      } | null;
      if (typeof body?.id !== "string" || !body.id) {
        throw new Error("Instagram /media returned no container id");
      }
      return body.id;
    },

    async getContainerStatus(containerId) {
      const body = (await execute(buildStatusRequest(containerId))) as {
        status_code?: unknown;
        status?: unknown;
      } | null;
      return {
        statusCode: typeof body?.status_code === "string" ? body.status_code : "",
        detail: typeof body?.status === "string" ? body.status : "",
      };
    },

    async publish(igUserId, containerId) {
      const body = (await execute(buildPublishRequest(igUserId, containerId))) as {
        id?: unknown;
      } | null;
      if (typeof body?.id !== "string" || !body.id) {
        throw new Error("Instagram /media_publish returned no media id");
      }
      return body.id;
    },

    async getQuotaUsage(igUserId) {
      const body = (await execute(buildQuotaRequest(igUserId))) as {
        quota_usage?: unknown;
        data?: { quota_usage?: unknown }[];
      } | null;
      // Meta wraps limit fields in { data: [ ... ] }; tolerate a bare shape
      // too, but never invent a count from a response that has neither.
      const usage = body?.data?.[0]?.quota_usage ?? body?.quota_usage;
      if (typeof usage !== "number") {
        throw new Error("Instagram content_publishing_limit response had no quota_usage");
      }
      return usage;
    },
  };
}

export interface WaitForContainerOpts {
  intervalMs?: number;
  maxAttempts?: number;
  /** Injectable for tests; defaults to a real setTimeout wait. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll a container until Meta reports it terminal. FINISHED — and PUBLISHED,
 * for a rerun that lost track after publishing — resolve; ERROR/EXPIRED throw
 * with Meta's detail verbatim; anything else (IN_PROGRESS, or a status we
 * don't recognize) keeps polling until the attempts run out — never guess a
 * terminal state Meta didn't report.
 */
export async function waitForContainer(
  getStatus: (containerId: string) => Promise<ContainerStatus>,
  containerId: string,
  opts: WaitForContainerOpts = {},
): Promise<void> {
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = opts.maxAttempts ?? MAX_POLL_ATTEMPTS;
  const sleep = opts.sleep ?? defaultSleep;

  let last = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { statusCode, detail } = await getStatus(containerId);
    last = statusCode;
    if (statusCode === "FINISHED" || statusCode === "PUBLISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(
        `Container ${containerId} ${statusCode}: ${detail || "(no detail from Meta)"}`,
      );
    }
    // No sleep after the final check — throw immediately below.
    if (attempt < maxAttempts) await sleep(intervalMs);
  }

  const minutes = Math.round((maxAttempts * intervalMs) / 60_000);
  throw new Error(
    `Container ${containerId} still ${last || "(no status_code)"} after ${maxAttempts} checks (~${minutes} min)`,
  );
}

/**
 * Binds a client to waitForContainer so the CLI can hand the publisher a
 * plain (containerId) => Promise<void> — the exact ExecuteDeps shape.
 */
export function makeContainerWaiter(
  client: Pick<InstagramClient, "getContainerStatus">,
  opts: WaitForContainerOpts = {},
): (containerId: string) => Promise<void> {
  return (containerId) => waitForContainer(client.getContainerStatus, containerId, opts);
}
