import os from "node:os";
import path from "node:path";
import type { PostDay } from "./types";

/**
 * The one home for the reels output-folder convention — the generator writes
 * here and the publisher reads here, so the shape must never drift apart.
 */

export function reelsOutRoot(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.REELS_OUT_DIR ??
    path.join(os.homedir(), "Documents", "CityPulseMN", "Reels", "auto")
  );
}

/** "{windowStart}_{day}", e.g. "2026-08-29_friday". */
export function dayDirName(windowStart: string, day: PostDay): string {
  return `${windowStart}_${day}`;
}

export function dayDirFor(
  windowStart: string,
  day: PostDay,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(reelsOutRoot(env), dayDirName(windowStart, day));
}
