import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PostDay, Variant } from "../types";

/**
 * Temporary public hosting on Supabase Storage — locked decision in
 * docs/REELS-PUBLISH.md. Meta's publish API can only ingest a reel from a
 * publicly accessible URL, so each mp4 goes into the public "reels-publish"
 * bucket just long enough to publish, then gets deleted. Nothing persists
 * publicly beyond the publish window.
 */

export const PUBLISH_BUCKET = "reels-publish";

/**
 * 8-char suffix so a re-generated reel never collides with (or gets served
 * from a CDN cache of) an earlier upload for the same slot. Callers inject a
 * fixed string in tests.
 */
export function randomSuffix(): string {
  return randomUUID().slice(0, 8);
}

/** "{windowStart}_{day}_{variant}_{rand}.mp4" — URL-safe by construction. */
export function buildObjectName(
  day: PostDay,
  windowStart: string,
  variant: Variant,
  rand: string,
): string {
  return `${windowStart}_${day}_${variant}_${rand}.mp4`;
}

/**
 * Adapter matching the publisher's ExecuteDeps.buildObjectName(variant,
 * manifest) shape exactly — the CLI assigns this directly, no glue.
 */
export function objectNameFor(
  variant: Variant,
  manifest: { day: PostDay; window: { start: string } },
  rand: string = randomSuffix(),
): string {
  return buildObjectName(manifest.day, manifest.window.start, variant, rand);
}

/** Trailing slashes stripped — phone-edited .env.local values sometimes carry one. */
export function storageBase(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1`;
}

export function bucketInfoUrl(supabaseUrl: string, bucket: string): string {
  return `${storageBase(supabaseUrl)}/bucket/${bucket}`;
}

export function createBucketUrl(supabaseUrl: string): string {
  return `${storageBase(supabaseUrl)}/bucket`;
}

/** Upload (POST) and delete (DELETE) share this path. */
export function objectUrl(supabaseUrl: string, bucket: string, objectName: string): string {
  return `${storageBase(supabaseUrl)}/object/${bucket}/${objectName}`;
}

export function publicObjectUrl(supabaseUrl: string, bucket: string, objectName: string): string {
  return `${storageBase(supabaseUrl)}/object/public/${bucket}/${objectName}`;
}

export interface HostResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface HostRequest {
  method: "GET" | "POST" | "DELETE";
  headers: Record<string, string>;
  body?: Uint8Array | string;
}

export interface HostDeps {
  fetch(url: string, init: HostRequest): Promise<HostResponse>;
  readFile(file: string): Promise<Uint8Array>;
}

export const defaultHostDeps: HostDeps = {
  fetch: async (url, init) =>
    fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body as BodyInit | undefined,
    }),
  readFile: (file) => readFile(file),
};

export interface SupabaseHost {
  /** Creates the public bucket on the first ever run; a no-op after that. */
  ensureBucket(): Promise<void>;
  /** Uploads the mp4; returns the public URL Meta will fetch. */
  upload(localFile: string, objectName: string): Promise<string>;
  /** Deletes the hosted object. 404 = already gone — idempotent cleanup. */
  remove(objectName: string): Promise<void>;
}

/**
 * First 200 chars of the error body — enough to carry Supabase's message into
 * the ops email without dumping a whole HTML error page. Never the key.
 */
async function snippet(res: HostResponse): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}

export function makeSupabaseHost(
  env: Record<string, string | undefined> = process.env,
  deps: HostDeps = defaultHostDeps,
): SupabaseHost {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(
      `${missing.join(" and ")} not set — reels hosting needs ` +
        `${missing.length > 1 ? "them" : "it"} in .env.local (see docs/REELS-PUBLISH.md).`,
    );
  }
  const supabaseUrl = env.SUPABASE_URL as string;
  const auth = { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY as string}` };

  return {
    async ensureBucket() {
      const info = await deps.fetch(bucketInfoUrl(supabaseUrl, PUBLISH_BUCKET), {
        method: "GET",
        headers: { ...auth },
      });
      if (info.ok) return;
      if (info.status !== 404) {
        throw new Error(`Supabase bucket check failed (${info.status}): ${await snippet(info)}`);
      }
      const created = await deps.fetch(createBucketUrl(supabaseUrl), {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: PUBLISH_BUCKET, public: true }),
      });
      if (!created.ok) {
        throw new Error(
          `Creating bucket "${PUBLISH_BUCKET}" failed (${created.status}): ${await snippet(created)}`,
        );
      }
    },

    async upload(localFile, objectName) {
      const bytes = await deps.readFile(localFile);
      const res = await deps.fetch(objectUrl(supabaseUrl, PUBLISH_BUCKET, objectName), {
        method: "POST",
        headers: { ...auth, "Content-Type": "video/mp4", "x-upsert": "true" },
        body: bytes,
      });
      if (!res.ok) {
        throw new Error(`Upload of ${objectName} failed (${res.status}): ${await snippet(res)}`);
      }
      return publicObjectUrl(supabaseUrl, PUBLISH_BUCKET, objectName);
    },

    async remove(objectName) {
      const res = await deps.fetch(objectUrl(supabaseUrl, PUBLISH_BUCKET, objectName), {
        method: "DELETE",
        headers: { ...auth },
      });
      if (res.ok || res.status === 404) return;
      throw new Error(`Removing ${objectName} failed (${res.status}): ${await snippet(res)}`);
    },
  };
}
