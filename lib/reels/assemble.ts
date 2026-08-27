import { spawn as nodeSpawn } from "node:child_process";
import { existsSync as nodeExistsSync } from "node:fs";
import type { Timeline } from "./types";

/**
 * Assembly — turn 7 downloaded clips + the card PNG (+ optional music) into
 * the finished reel via ffmpeg. Command construction (buildFfmpegArgs) is
 * pure and golden-tested; execution (assembleReel) is a thin spawn wrapper
 * with injectable deps, and it verifies the output with ffprobe instead of
 * trusting ffmpeg's exit code alone.
 */

export interface BuildFfmpegArgsOpts {
  clips: { file: string }[];
  timeline: Timeline;
  cardFile: string;
  /** null = silent reel; the owner may add a trending sound at post time. */
  audioFile: string | null;
  outFile: string;
}

/** xfade offsets must be stable strings — ffmpeg parses them literally. */
function fmtOffset(n: number): string {
  return n.toFixed(4);
}

/** Durations: 4dp, trailing zeros stripped ("0.4", "5.0667", "33.0667"). */
function fmtSec(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * The full ffmpeg argv (no shell quoting — passed to spawn as an array).
 * Matches the published reels: 1080x1920/30fps, clips crossfaded per the
 * timeline, footage dimmed 15% behind the card, card faded in over 0.3s.
 */
export function buildFfmpegArgs(opts: BuildFfmpegArgsOpts): string[] {
  const { clips, timeline, cardFile, audioFile, outFile } = opts;
  if (clips.length === 0) {
    throw new Error("buildFfmpegArgs: no clips to assemble");
  }
  if (clips.length !== timeline.slots.length) {
    throw new Error(
      `buildFfmpegArgs: ${clips.length} clips but ${timeline.slots.length} timeline slots`
    );
  }

  const total = fmtSec(timeline.totalSec);
  const cardIdx = clips.length;
  const audioIdx = clips.length + 1;

  const args: string[] = [];
  for (const clip of clips) args.push("-i", clip.file);
  args.push("-loop", "1", "-t", total, "-i", cardFile);
  if (audioFile !== null) args.push("-i", audioFile);

  const chains: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const d = fmtSec(timeline.slots[i].durationSec);
    chains.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
        `fps=${timeline.fps},trim=duration=${d},setpts=PTS-STARTPTS[c${i}]`
    );
  }
  // Crossfade chain: each xfade's offset is where the incoming slot starts.
  let last = "c0";
  for (let k = 1; k < clips.length; k++) {
    const offset = fmtOffset(timeline.slots[k].startSec);
    chains.push(
      `[${last}][c${k}]xfade=transition=fade:duration=${fmtSec(timeline.fadeSec)}:offset=${offset}[x${k}]`
    );
    last = `x${k}`;
  }
  chains.push(`[${last}]drawbox=color=black@0.15:t=fill[dim]`);
  chains.push(`[${cardIdx}:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[card]`);
  chains.push(`[dim][card]overlay=0:0:format=auto[vout]`);
  if (audioFile !== null) {
    chains.push(
      `[${audioIdx}:a]atrim=duration=${total},afade=t=in:st=0:d=0.5,` +
        `afade=t=out:st=${fmtSec(timeline.totalSec - 1.2)}:d=1.2,loudnorm=I=-14:TP=-1.5[aout]`
    );
  }

  args.push("-filter_complex", chains.join(";"));
  args.push("-map", "[vout]");
  if (audioFile !== null) args.push("-map", "[aout]");
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-r", String(timeline.fps),
    "-t", total,
    "-movflags", "+faststart"
  );
  if (audioFile !== null) args.push("-c:a", "aac", "-b:a", "160k");
  args.push("-y", outFile);
  return args;
}

type Env = Record<string, string | undefined>;
type ExistsFn = (path: string) => boolean;

function resolveTool(tool: "ffmpeg" | "ffprobe", env: Env, exists: ExistsFn): string {
  const override = env[tool === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
  if (override) return override;
  if (env.LOCALAPPDATA) {
    const winget = `${env.LOCALAPPDATA}/Microsoft/WinGet/Links/${tool}.exe`;
    if (exists(winget)) return winget;
  }
  return tool;
}

export function resolveFfmpeg(env: Env = process.env, exists: ExistsFn = nodeExistsSync): string {
  return resolveTool("ffmpeg", env, exists);
}

export function resolveFfprobe(env: Env = process.env, exists: ExistsFn = nodeExistsSync): string {
  return resolveTool("ffprobe", env, exists);
}

interface SpawnedProcess {
  stdout: { on(event: "data", listener: (chunk: unknown) => void): unknown } | null;
  stderr: { on(event: "data", listener: (chunk: unknown) => void): unknown } | null;
  on(event: "error", listener: (err: Error) => void): unknown;
  on(event: "close", listener: (code: number | null) => void): unknown;
}

export type SpawnFn = (command: string, args: string[]) => SpawnedProcess;

export interface AssembleDeps {
  spawn?: SpawnFn;
  existsSync?: ExistsFn;
}

export interface AssembleReelOpts extends BuildFfmpegArgsOpts {
  env?: Env;
  deps?: AssembleDeps;
}

function run(
  spawnFn: SpawnFn,
  command: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function tail(text: string, lines: number): string {
  const all = text.split(/\r?\n/);
  return all.slice(Math.max(0, all.length - lines)).join("\n");
}

/**
 * Run ffmpeg, then verify the archive, not the intention: the output must
 * exist and ffprobe's measured duration must be within 0.25s of the timeline.
 */
export async function assembleReel(
  opts: AssembleReelOpts
): Promise<{ outFile: string; durationSec: number }> {
  const spawnFn: SpawnFn = opts.deps?.spawn ?? (nodeSpawn as unknown as SpawnFn);
  const exists = opts.deps?.existsSync ?? nodeExistsSync;
  const env = opts.env ?? process.env;

  const args = buildFfmpegArgs(opts);
  const encode = await run(spawnFn, resolveFfmpeg(env, exists), args);
  if (encode.code !== 0) {
    throw new Error(
      `ffmpeg exited ${encode.code} assembling ${opts.outFile}\n${tail(encode.stderr, 30)}`
    );
  }
  if (!exists(opts.outFile)) {
    throw new Error(`ffmpeg reported success but ${opts.outFile} is missing`);
  }

  const probe = await run(spawnFn, resolveFfprobe(env, exists), [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    opts.outFile,
  ]);
  if (probe.code !== 0) {
    throw new Error(
      `ffprobe exited ${probe.code} on ${opts.outFile} (empty or corrupt output)\n${tail(probe.stderr, 30)}`
    );
  }
  const durationSec = Number.parseFloat(probe.stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(
      `ffprobe returned no duration for ${opts.outFile} (empty output?): "${probe.stdout.trim()}"`
    );
  }
  if (Math.abs(durationSec - opts.timeline.totalSec) > 0.25) {
    throw new Error(
      `assembled reel is ${durationSec.toFixed(2)}s, expected ~${opts.timeline.totalSec.toFixed(2)}s (${opts.outFile})`
    );
  }
  return { outFile: opts.outFile, durationSec };
}
