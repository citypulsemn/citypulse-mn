import { describe, it, expect } from "vitest";
import {
  GRAPH,
  buildCreateContainerRequest,
  buildStatusRequest,
  buildPublishRequest,
  buildQuotaRequest,
  makeInstagramClient,
  waitForContainer,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
  type ContainerStatus,
  type GraphFetchResult,
  type GraphRequest,
  type InstagramDeps,
} from "../instagram";

const TOKEN = "IGQVJsecret-token-value-999";
const IG_USER = "17841400000000000";

/** Fake Graph transport: scripted responses, records every request + headers. */
function fakeGraph(respond: (req: GraphRequest) => GraphFetchResult) {
  const calls: { req: GraphRequest; headers: Record<string, string> }[] = [];
  const deps: InstagramDeps = {
    fetchJson: async (req, headers) => {
      calls.push({ req, headers });
      return respond(req);
    },
  };
  return { deps, calls };
}

const ok = (body: unknown): GraphFetchResult => ({ ok: true, status: 200, body });
const fail = (status: number, body: unknown = null): GraphFetchResult => ({
  ok: false,
  status,
  body,
});

describe("request builders — golden shapes", () => {
  it("create container: POST {GRAPH}/{igUserId}/media with media_type REELS, video_url, caption", () => {
    const req = buildCreateContainerRequest(IG_USER, {
      videoUrl: "https://cdn.example/reels-publish/regular.mp4",
      caption: "Monday in the Cities.\n\n#minneapolis #stpaul",
    });
    expect(req.url).toBe(`https://graph.instagram.com/v23.0/${IG_USER}/media`);
    expect(req.method).toBe("POST");
    const body = new URLSearchParams(req.body);
    expect(body.get("media_type")).toBe("REELS");
    expect(body.get("video_url")).toBe("https://cdn.example/reels-publish/regular.mp4");
    expect(body.get("caption")).toBe("Monday in the Cities.\n\n#minneapolis #stpaul");
    expect([...body.keys()].sort()).toEqual(["caption", "media_type", "video_url"]);
  });

  it("caption survives form encoding: newlines, hashes, ampersands, emoji", () => {
    const caption = "Fair time 🎡 & more\n#tcfair =100%";
    const req = buildCreateContainerRequest(IG_USER, {
      videoUrl: "https://v.example/x.mp4",
      caption,
    });
    expect(new URLSearchParams(req.body).get("caption")).toBe(caption);
  });

  it("empty caption still ships the caption field, empty — never dropped silently", () => {
    const req = buildCreateContainerRequest(IG_USER, {
      videoUrl: "https://v.example/x.mp4",
      caption: "",
    });
    expect(new URLSearchParams(req.body).get("caption")).toBe("");
  });

  it("status: GET {GRAPH}/{containerId}?fields=status_code,status with no body", () => {
    const req = buildStatusRequest("17900000001");
    expect(req).toEqual({
      url: "https://graph.instagram.com/v23.0/17900000001?fields=status_code,status",
      method: "GET",
    });
  });

  it("publish: POST {GRAPH}/{igUserId}/media_publish with creation_id", () => {
    const req = buildPublishRequest(IG_USER, "17900000001");
    expect(req).toEqual({
      url: `https://graph.instagram.com/v23.0/${IG_USER}/media_publish`,
      method: "POST",
      body: "creation_id=17900000001",
    });
  });

  it("quota: GET {GRAPH}/{igUserId}/content_publishing_limit?fields=quota_usage,config", () => {
    const req = buildQuotaRequest(IG_USER);
    expect(req).toEqual({
      url: `https://graph.instagram.com/v23.0/${IG_USER}/content_publishing_limit?fields=quota_usage,config`,
      method: "GET",
    });
  });

  it("GRAPH base is the Instagram-Login host, versioned", () => {
    expect(GRAPH).toBe("https://graph.instagram.com/v23.0");
  });

  it("no builder output ever carries a token or access_token field", () => {
    const reqs = [
      buildCreateContainerRequest(IG_USER, { videoUrl: "https://v/x.mp4", caption: "c" }),
      buildStatusRequest("c1"),
      buildPublishRequest(IG_USER, "c1"),
      buildQuotaRequest(IG_USER),
    ];
    for (const req of reqs) {
      expect(req.url).not.toContain("access_token");
      expect(req.body ?? "").not.toContain("access_token");
    }
  });
});

describe("makeInstagramClient — execution", () => {
  it("sends the token as a Bearer header only — never in the URL or body", async () => {
    const { deps, calls } = fakeGraph(() => ok({ id: "cont-1" }));
    const client = makeInstagramClient(TOKEN, deps);
    await client.createReelContainer(IG_USER, {
      videoUrl: "https://v.example/x.mp4",
      caption: "c",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(calls[0].req.url).not.toContain(TOKEN);
    expect(calls[0].req.body ?? "").not.toContain(TOKEN);
  });

  it("createReelContainer returns the container id from a REELS create", async () => {
    const { deps, calls } = fakeGraph(() => ok({ id: "17900000001" }));
    const client = makeInstagramClient(TOKEN, deps);
    const id = await client.createReelContainer(IG_USER, {
      videoUrl: "https://v.example/regular.mp4",
      caption: "cap",
    });
    expect(id).toBe("17900000001");
    expect(calls[0].req.url).toBe(`https://graph.instagram.com/v23.0/${IG_USER}/media`);
    expect(new URLSearchParams(calls[0].req.body).get("media_type")).toBe("REELS");
  });

  it("createReelContainer throws honestly when the response has no id", async () => {
    const { deps } = fakeGraph(() => ok({}));
    const client = makeInstagramClient(TOKEN, deps);
    await expect(
      client.createReelContainer(IG_USER, { videoUrl: "https://v/x.mp4", caption: "c" }),
    ).rejects.toThrow("Instagram /media returned no container id");
  });

  it("getContainerStatus maps status_code and status onto statusCode/detail", async () => {
    const { deps, calls } = fakeGraph(() =>
      ok({ status_code: "IN_PROGRESS", status: "Processing video", id: "c1" }),
    );
    const client = makeInstagramClient(TOKEN, deps);
    const status = await client.getContainerStatus("c1");
    expect(status).toEqual({ statusCode: "IN_PROGRESS", detail: "Processing video" });
    expect(calls[0].req).toEqual({
      url: "https://graph.instagram.com/v23.0/c1?fields=status_code,status",
      method: "GET",
    });
  });

  it("getContainerStatus returns empty strings for missing fields, not fabricated ones", async () => {
    const { deps } = fakeGraph(() => ok({ id: "c1" }));
    const client = makeInstagramClient(TOKEN, deps);
    expect(await client.getContainerStatus("c1")).toEqual({ statusCode: "", detail: "" });
  });

  it("publish posts creation_id and returns the media id", async () => {
    const { deps, calls } = fakeGraph(() => ok({ id: "media-42" }));
    const client = makeInstagramClient(TOKEN, deps);
    const mediaId = await client.publish(IG_USER, "cont-7");
    expect(mediaId).toBe("media-42");
    expect(calls[0].req).toEqual({
      url: `https://graph.instagram.com/v23.0/${IG_USER}/media_publish`,
      method: "POST",
      body: "creation_id=cont-7",
    });
  });

  it("publish throws honestly when the response has no id", async () => {
    const { deps } = fakeGraph(() => ok(null));
    const client = makeInstagramClient(TOKEN, deps);
    await expect(client.publish(IG_USER, "c1")).rejects.toThrow(
      "Instagram /media_publish returned no media id",
    );
  });

  it("getQuotaUsage reads Meta's { data: [{ quota_usage }] } wrapper", async () => {
    const { deps, calls } = fakeGraph(() =>
      ok({ data: [{ quota_usage: 4, config: { quota_total: 100 } }] }),
    );
    const client = makeInstagramClient(TOKEN, deps);
    expect(await client.getQuotaUsage(IG_USER)).toBe(4);
    expect(calls[0].req.url).toBe(
      `https://graph.instagram.com/v23.0/${IG_USER}/content_publishing_limit?fields=quota_usage,config`,
    );
  });

  it("getQuotaUsage tolerates a bare quota_usage shape, and 0 is a valid count", async () => {
    const { deps } = fakeGraph(() => ok({ quota_usage: 0 }));
    const client = makeInstagramClient(TOKEN, deps);
    expect(await client.getQuotaUsage(IG_USER)).toBe(0);
  });

  it("getQuotaUsage throws rather than invent a count from an empty response", async () => {
    const { deps } = fakeGraph(() => ok({ data: [] }));
    const client = makeInstagramClient(TOKEN, deps);
    await expect(client.getQuotaUsage(IG_USER)).rejects.toThrow(/quota_usage/);
  });

  it("non-OK responses throw Meta's error.message verbatim", async () => {
    const { deps } = fakeGraph(() =>
      fail(400, {
        error: {
          message: "The video file you selected is invalid.",
          type: "OAuthException",
          code: 352,
        },
      }),
    );
    const client = makeInstagramClient(TOKEN, deps);
    await expect(
      client.createReelContainer(IG_USER, { videoUrl: "https://v/x.mp4", caption: "c" }),
    ).rejects.toThrow("The video file you selected is invalid.");
  });

  it("non-OK without a Meta error body falls back to the HTTP status", async () => {
    const { deps } = fakeGraph(() => fail(500));
    const client = makeInstagramClient(TOKEN, deps);
    await expect(client.getQuotaUsage(IG_USER)).rejects.toThrow("Instagram API error 500");
  });

  it("the token never reaches a thrown message — even when Meta echoes it back", async () => {
    const { deps } = fakeGraph(() =>
      fail(401, { error: { message: `Invalid OAuth access token ${TOKEN} cannot be used` } }),
    );
    const client = makeInstagramClient(TOKEN, deps);
    const err = await client.publish(IG_USER, "c1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain(TOKEN);
    expect((err as Error).message).toContain("Invalid OAuth access token");
  });
});

/** Scripted getStatus: returns the sequence in order, records containerIds. */
function scriptedStatus(sequence: ContainerStatus[]) {
  const remaining = [...sequence];
  const calls: string[] = [];
  const getStatus = async (containerId: string): Promise<ContainerStatus> => {
    calls.push(containerId);
    const next = remaining.shift();
    if (!next) throw new Error("test status script exhausted");
    return next;
  };
  return { getStatus, calls };
}

function fakeSleep() {
  const waits: number[] = [];
  const sleep = async (ms: number) => {
    waits.push(ms);
  };
  return { sleep, waits };
}

const inProgress: ContainerStatus = { statusCode: "IN_PROGRESS", detail: "" };
const finished: ContainerStatus = { statusCode: "FINISHED", detail: "" };

describe("waitForContainer", () => {
  it("immediate FINISHED resolves without sleeping", async () => {
    const { getStatus, calls } = scriptedStatus([finished]);
    const { sleep, waits } = fakeSleep();
    await waitForContainer(getStatus, "c1", { sleep });
    expect(calls).toEqual(["c1"]);
    expect(waits).toEqual([]);
  });

  it("PUBLISHED is success, not an error", async () => {
    const { getStatus } = scriptedStatus([{ statusCode: "PUBLISHED", detail: "" }]);
    const { sleep, waits } = fakeSleep();
    await waitForContainer(getStatus, "c1", { sleep });
    expect(waits).toEqual([]);
  });

  it("IN_PROGRESS x3 then FINISHED: sleeps 3x with intervalMs between checks", async () => {
    const { getStatus, calls } = scriptedStatus([inProgress, inProgress, inProgress, finished]);
    const { sleep, waits } = fakeSleep();
    await waitForContainer(getStatus, "c1", { intervalMs: 20_000, sleep });
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([20_000, 20_000, 20_000]);
  });

  it("ERROR throws with the container id and Meta's detail verbatim", async () => {
    const { getStatus } = scriptedStatus([
      { statusCode: "ERROR", detail: "Publishing failed: unsupported video format" },
    ]);
    const { sleep } = fakeSleep();
    await expect(waitForContainer(getStatus, "c9", { sleep })).rejects.toThrow(
      "Container c9 ERROR: Publishing failed: unsupported video format",
    );
  });

  it("ERROR with no detail says so, honestly, instead of an empty tail", async () => {
    const { getStatus } = scriptedStatus([{ statusCode: "ERROR", detail: "" }]);
    const { sleep } = fakeSleep();
    await expect(waitForContainer(getStatus, "c1", { sleep })).rejects.toThrow(
      "Container c1 ERROR: (no detail from Meta)",
    );
  });

  it("EXPIRED throws like ERROR", async () => {
    const { getStatus } = scriptedStatus([{ statusCode: "EXPIRED", detail: "Container expired" }]);
    const { sleep } = fakeSleep();
    await expect(waitForContainer(getStatus, "c1", { sleep })).rejects.toThrow(
      "Container c1 EXPIRED: Container expired",
    );
  });

  it("exhausted attempts throw 'still {status} after {n} checks (~{minutes} min)'", async () => {
    const { getStatus, calls } = scriptedStatus([inProgress, inProgress, inProgress]);
    const { sleep, waits } = fakeSleep();
    await expect(
      waitForContainer(getStatus, "c1", { intervalMs: 60_000, maxAttempts: 3, sleep }),
    ).rejects.toThrow("Container c1 still IN_PROGRESS after 3 checks (~3 min)");
    expect(calls).toHaveLength(3);
    // No pointless sleep after the final check.
    expect(waits).toEqual([60_000, 60_000]);
  });

  it("defaults poll 5 times at 60s (~5 min, Meta's once-per-minute guidance) before giving up", async () => {
    const { getStatus, calls } = scriptedStatus(
      Array.from({ length: MAX_POLL_ATTEMPTS }, () => inProgress),
    );
    const { sleep, waits } = fakeSleep();
    await expect(waitForContainer(getStatus, "c1", { sleep })).rejects.toThrow(
      `Container c1 still IN_PROGRESS after ${MAX_POLL_ATTEMPTS} checks (~5 min)`,
    );
    expect(calls).toHaveLength(5);
    expect(waits).toHaveLength(4);
    expect(waits.every((w) => w === POLL_INTERVAL_MS)).toBe(true);
  });

  it("a status Meta didn't document keeps polling — never guessed terminal", async () => {
    const { getStatus } = scriptedStatus([{ statusCode: "SOMETHING_NEW", detail: "" }, finished]);
    const { sleep, waits } = fakeSleep();
    await waitForContainer(getStatus, "c1", { sleep });
    expect(waits).toHaveLength(1);
  });
});
