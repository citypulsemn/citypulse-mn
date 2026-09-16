import { describe, it, expect } from "vitest";
import {
  PUBLISH_BUCKET,
  buildObjectName,
  randomSuffix,
  storageBase,
  bucketInfoUrl,
  createBucketUrl,
  objectUrl,
  publicObjectUrl,
  makeSupabaseHost,
  type HostDeps,
  type HostRequest,
} from "../host";

const URL_BASE = "https://proj.supabase.co";
const KEY = "service-key-123";
const ENV = { SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: KEY };
const NAME = "2026-08-24_monday_regular_ab12cd34.mp4";

interface RecordedCall {
  url: string;
  method: HostRequest["method"];
  headers: Record<string, string>;
  body?: Uint8Array | string;
}

/**
 * Fake Supabase Storage: handler maps each call to a status (+ body text);
 * records every request and every readFile path. No network anywhere.
 */
function fakeDeps(
  handler: (call: RecordedCall) => { status: number; text?: string },
  fileBytes: Uint8Array = new TextEncoder().encode("mp4-bytes"),
) {
  const calls: RecordedCall[] = [];
  const reads: string[] = [];
  const deps: HostDeps = {
    fetch: async (url, init) => {
      const call: RecordedCall = {
        url,
        method: init.method,
        headers: init.headers,
        body: init.body,
      };
      calls.push(call);
      const r = handler(call);
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        text: async () => r.text ?? "",
      };
    },
    readFile: async (file) => {
      reads.push(file);
      return fileBytes;
    },
  };
  return { deps, calls, reads };
}

const ok = () => ({ status: 200 });

describe("buildObjectName", () => {
  it("golden: {windowStart}_{day}_{variant}_{rand}.mp4", () => {
    expect(buildObjectName("monday", "2026-08-24", "regular", "ab12cd34")).toBe(
      "2026-08-24_monday_regular_ab12cd34.mp4",
    );
    expect(buildObjectName("friday", "2026-08-28", "weird", "00ff00ff")).toBe(
      "2026-08-28_friday_weird_00ff00ff.mp4",
    );
  });
});

describe("randomSuffix", () => {
  it("is 8 lowercase hex chars (a UUID prefix) and varies between calls", () => {
    const a = randomSuffix();
    const b = randomSuffix();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(b).toMatch(/^[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("storage URL helpers", () => {
  it("golden: every endpoint per the Storage REST layout", () => {
    expect(storageBase(URL_BASE)).toBe("https://proj.supabase.co/storage/v1");
    expect(bucketInfoUrl(URL_BASE, PUBLISH_BUCKET)).toBe(
      "https://proj.supabase.co/storage/v1/bucket/reels-publish",
    );
    expect(createBucketUrl(URL_BASE)).toBe("https://proj.supabase.co/storage/v1/bucket");
    expect(objectUrl(URL_BASE, PUBLISH_BUCKET, NAME)).toBe(
      `https://proj.supabase.co/storage/v1/object/reels-publish/${NAME}`,
    );
    expect(publicObjectUrl(URL_BASE, PUBLISH_BUCKET, NAME)).toBe(
      `https://proj.supabase.co/storage/v1/object/public/reels-publish/${NAME}`,
    );
  });

  it("tolerates a trailing slash on SUPABASE_URL (phone-edited .env hazard)", () => {
    expect(storageBase("https://proj.supabase.co/")).toBe("https://proj.supabase.co/storage/v1");
    expect(publicObjectUrl("https://proj.supabase.co/", PUBLISH_BUCKET, NAME)).toBe(
      `https://proj.supabase.co/storage/v1/object/public/reels-publish/${NAME}`,
    );
  });
});

describe("makeSupabaseHost construction", () => {
  it("throws naming SUPABASE_URL when it is missing", () => {
    const { deps } = fakeDeps(ok);
    expect(() => makeSupabaseHost({ SUPABASE_SERVICE_ROLE_KEY: KEY }, deps)).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("throws naming SUPABASE_SERVICE_ROLE_KEY when it is missing", () => {
    const { deps } = fakeDeps(ok);
    expect(() => makeSupabaseHost({ SUPABASE_URL: URL_BASE }, deps)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("names both when the env is entirely empty, and treats empty strings as missing", () => {
    const { deps } = fakeDeps(ok);
    expect(() => makeSupabaseHost({}, deps)).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() =>
      makeSupabaseHost({ SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: KEY }, deps),
    ).toThrow(/SUPABASE_URL/);
  });

  it("never leaks the service key value into the error message", () => {
    const { deps } = fakeDeps(ok);
    try {
      makeSupabaseHost({ SUPABASE_SERVICE_ROLE_KEY: "sekrit-value" }, deps);
      expect.unreachable("construction should have thrown");
    } catch (err) {
      expect(String(err)).not.toContain("sekrit-value");
    }
  });
});

describe("ensureBucket", () => {
  it("existing bucket (200): one GET with the Bearer service key, no create", async () => {
    const { deps, calls } = fakeDeps(ok);
    await makeSupabaseHost(ENV, deps).ensureBucket();

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe("https://proj.supabase.co/storage/v1/bucket/reels-publish");
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("404: creates the bucket as public via POST /bucket with JSON", async () => {
    const { deps, calls } = fakeDeps((call) =>
      call.method === "GET" ? { status: 404 } : { status: 200 },
    );
    await makeSupabaseHost(ENV, deps).ensureBucket();

    expect(calls).toHaveLength(2);
    expect(calls[1].method).toBe("POST");
    expect(calls[1].url).toBe("https://proj.supabase.co/storage/v1/bucket");
    expect(calls[1].headers["Content-Type"]).toBe("application/json");
    expect(calls[1].headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(calls[1].body as string)).toEqual({ name: "reels-publish", public: true });
  });

  it("404 then failed create throws with the status and body snippet", async () => {
    const { deps } = fakeDeps((call) =>
      call.method === "GET" ? { status: 404 } : { status: 400, text: "duplicate key" },
    );
    await expect(makeSupabaseHost(ENV, deps).ensureBucket()).rejects.toThrow(
      /reels-publish.*400.*duplicate key/,
    );
  });

  it("a non-404 failure on the info call throws and never attempts a create", async () => {
    const { deps, calls } = fakeDeps(() => ({ status: 500, text: "storage down" }));
    await expect(makeSupabaseHost(ENV, deps).ensureBucket()).rejects.toThrow(
      /500.*storage down/,
    );
    expect(calls).toHaveLength(1);
  });
});

describe("upload", () => {
  it("POSTs the file bytes with service key, video/mp4 and x-upsert; returns the public URL", async () => {
    const bytes = new TextEncoder().encode("fake-mp4-payload");
    const { deps, calls, reads } = fakeDeps(ok, bytes);

    const url = await makeSupabaseHost(ENV, deps).upload("C:/reels/auto/day/regular.mp4", NAME);

    expect(reads).toEqual(["C:/reels/auto/day/regular.mp4"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(
      `https://proj.supabase.co/storage/v1/object/reels-publish/${NAME}`,
    );
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(calls[0].headers["Content-Type"]).toBe("video/mp4");
    expect(calls[0].headers["x-upsert"]).toBe("true");
    expect(calls[0].body).toBe(bytes);
    expect(url).toBe(
      `https://proj.supabase.co/storage/v1/object/public/reels-publish/${NAME}`,
    );
  });

  it("non-OK throws with object name, status and response text", async () => {
    const { deps } = fakeDeps(() => ({ status: 403, text: "signature verification failed" }));
    await expect(makeSupabaseHost(ENV, deps).upload("C:/x.mp4", NAME)).rejects.toThrow(
      new RegExp(`${NAME}.*403.*signature verification failed`),
    );
  });

  it("caps the error body snippet at 200 chars", async () => {
    const text = "x".repeat(199) + "Y" + "Z".repeat(100);
    const { deps } = fakeDeps(() => ({ status: 500, text }));
    const err = await makeSupabaseHost(ENV, deps)
      .upload("C:/x.mp4", NAME)
      .then(() => expect.unreachable("upload should have thrown"))
      .catch((e: unknown) => String(e));
    expect(err).toContain("Y");
    expect(err).not.toContain("Z");
  });

  it("an empty error body still yields an honest status-bearing message", async () => {
    const { deps } = fakeDeps(() => ({ status: 502, text: "" }));
    const err = await makeSupabaseHost(ENV, deps)
      .upload("C:/x.mp4", NAME)
      .then(() => expect.unreachable("upload should have thrown"))
      .catch((e: unknown) => String(e));
    expect(err).toContain("502");
    expect(err).not.toContain("undefined");
  });
});

describe("remove", () => {
  it("DELETEs the object path with the Bearer service key", async () => {
    const { deps, calls } = fakeDeps(ok);
    await makeSupabaseHost(ENV, deps).remove(NAME);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe(
      `https://proj.supabase.co/storage/v1/object/reels-publish/${NAME}`,
    );
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("tolerates a 404 — the object being already gone is the desired end state", async () => {
    const { deps } = fakeDeps(() => ({ status: 404, text: "not found" }));
    await expect(makeSupabaseHost(ENV, deps).remove(NAME)).resolves.toBeUndefined();
  });

  it("any other failure throws with the status", async () => {
    const { deps } = fakeDeps(() => ({ status: 500, text: "storage down" }));
    await expect(makeSupabaseHost(ENV, deps).remove(NAME)).rejects.toThrow(
      /500.*storage down/,
    );
  });
});

describe("full hosting cycle", () => {
  it("every call carries the Bearer service key and nothing else leaks it", async () => {
    const { deps, calls } = fakeDeps((call) =>
      call.method === "GET" ? { status: 404 } : { status: 200 },
    );
    const host = makeSupabaseHost(ENV, deps);

    await host.ensureBucket(); // GET 404 + POST create
    await host.upload("C:/reels/regular.mp4", NAME);
    await host.remove(NAME);

    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${KEY}`);
    }
  });
});

describe("makeSupabaseHost URL validation", () => {
  it("refuses a connection-string SUPABASE_URL without echoing the value", () => {
    const env = {
      SUPABASE_URL: "postgresql://user:hunter2@db.example.com:6543/postgres",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
    };
    let message = "";
    try {
      makeSupabaseHost(env);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("https URL");
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("postgresql");
  });
});
