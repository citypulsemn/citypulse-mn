import { describe, it, expect } from "vitest";
import {
  buildFfmpegArgs,
  resolveFfmpeg,
  resolveFfprobe,
  assembleReel,
  type SpawnFn,
} from "../assemble";
import type { Timeline } from "../types";

// The standard published-reel timeline: 7 slots of 152/30 s, 0.4 s crossfades.
// totalSec = 6 * (152/30 - 0.4) + 152/30 ≈ 33.0667.
const SLOT = 152 / 30;
const FADE = 0.4;
function standardTimeline(slotCount = 7): Timeline {
  const slots = Array.from({ length: slotCount }, (_, k) => ({
    index: k,
    startSec: k * (SLOT - FADE),
    durationSec: SLOT,
  }));
  return {
    fps: 30,
    fadeSec: FADE,
    slots,
    totalSec: (slotCount - 1) * (SLOT - FADE) + SLOT,
  };
}

const CLIPS = Array.from({ length: 7 }, (_, i) => ({ file: `c${i}.mp4` }));

const EXPECTED_FILTER_VIDEO = [
  "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c0]",
  "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c1]",
  "[2:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c2]",
  "[3:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c3]",
  "[4:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c4]",
  "[5:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c5]",
  "[6:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=5.0667,setpts=PTS-STARTPTS[c6]",
  "[c0][c1]xfade=transition=fade:duration=0.4:offset=4.6667[x1]",
  "[x1][c2]xfade=transition=fade:duration=0.4:offset=9.3333[x2]",
  "[x2][c3]xfade=transition=fade:duration=0.4:offset=14.0000[x3]",
  "[x3][c4]xfade=transition=fade:duration=0.4:offset=18.6667[x4]",
  "[x4][c5]xfade=transition=fade:duration=0.4:offset=23.3333[x5]",
  "[x5][c6]xfade=transition=fade:duration=0.4:offset=28.0000[x6]",
  "[x6]drawbox=color=black@0.15:t=fill[dim]",
  "[7:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[card]",
  "[dim][card]overlay=0:0:format=auto[vout]",
];

describe("buildFfmpegArgs — golden, 7 clips with audio", () => {
  const args = buildFfmpegArgs({
    clips: CLIPS,
    timeline: standardTimeline(),
    cardFile: "card.png",
    audioFile: "music.mp3",
    outFile: "reel.mp4",
  });

  it("matches the full argv exactly", () => {
    const filter = [
      ...EXPECTED_FILTER_VIDEO,
      "[8:a]atrim=duration=33.0667,afade=t=in:st=0:d=0.5,afade=t=out:st=31.8667:d=1.2,loudnorm=I=-14:TP=-1.5[aout]",
    ].join(";");
    expect(args).toEqual([
      "-i", "c0.mp4",
      "-i", "c1.mp4",
      "-i", "c2.mp4",
      "-i", "c3.mp4",
      "-i", "c4.mp4",
      "-i", "c5.mp4",
      "-i", "c6.mp4",
      "-loop", "1", "-t", "33.0667", "-i", "card.png",
      "-i", "music.mp3",
      "-filter_complex", filter,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "19",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-t", "33.0667",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "160k",
      "-y", "reel.mp4",
    ]);
  });

  it("xfade offsets are the six exact 4dp values from the timeline", () => {
    const filter = args[args.indexOf("-filter_complex") + 1];
    const offsets = [...filter.matchAll(/offset=([\d.]+)/g)].map((m) => m[1]);
    expect(offsets).toEqual(["4.6667", "9.3333", "14.0000", "18.6667", "23.3333", "28.0000"]);
  });

  it("card is input 7 (looped for the full duration), audio is input 8", () => {
    expect(args.slice(14, 20)).toEqual(["-loop", "1", "-t", "33.0667", "-i", "card.png"]);
    expect(args.slice(20, 22)).toEqual(["-i", "music.mp3"]);
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("[7:v]format=rgba");
    expect(filter).toContain("[8:a]atrim");
  });
});

describe("buildFfmpegArgs — no audio file", () => {
  const args = buildFfmpegArgs({
    clips: CLIPS,
    timeline: standardTimeline(),
    cardFile: "card.png",
    audioFile: null,
    outFile: "reel.mp4",
  });

  it("emits no audio stream at all: no [aout], no -c:a, no extra input", () => {
    expect(args).toEqual([
      "-i", "c0.mp4",
      "-i", "c1.mp4",
      "-i", "c2.mp4",
      "-i", "c3.mp4",
      "-i", "c4.mp4",
      "-i", "c5.mp4",
      "-i", "c6.mp4",
      "-loop", "1", "-t", "33.0667", "-i", "card.png",
      "-filter_complex", EXPECTED_FILTER_VIDEO.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "19",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-t", "33.0667",
      "-movflags", "+faststart",
      "-y", "reel.mp4",
    ]);
    expect(args.join(" ")).not.toContain("[aout]");
    expect(args).not.toContain("-c:a");
  });
});

describe("buildFfmpegArgs — honest emptiness and mismatches", () => {
  it("zero clips throws instead of inventing a command", () => {
    expect(() =>
      buildFfmpegArgs({
        clips: [],
        timeline: standardTimeline(0),
        cardFile: "card.png",
        audioFile: null,
        outFile: "reel.mp4",
      })
    ).toThrow(/no clips/);
  });

  it("clip count must match the timeline slot count", () => {
    expect(() =>
      buildFfmpegArgs({
        clips: CLIPS.slice(0, 5),
        timeline: standardTimeline(7),
        cardFile: "card.png",
        audioFile: null,
        outFile: "reel.mp4",
      })
    ).toThrow(/5 clips but 7 timeline slots/);
  });
});

describe("resolveFfmpeg / resolveFfprobe", () => {
  it("FFMPEG_PATH / FFPROBE_PATH override everything", () => {
    expect(resolveFfmpeg({ FFMPEG_PATH: "D:/tools/ffmpeg.exe" }, () => true)).toBe(
      "D:/tools/ffmpeg.exe"
    );
    expect(resolveFfprobe({ FFPROBE_PATH: "D:/tools/ffprobe.exe" }, () => true)).toBe(
      "D:/tools/ffprobe.exe"
    );
  });

  it("falls back to the WinGet links path when it exists", () => {
    const env = { LOCALAPPDATA: "C:/Users/t/AppData/Local" };
    const checked: string[] = [];
    const exists = (p: string) => {
      checked.push(p);
      return true;
    };
    expect(resolveFfmpeg(env, exists)).toBe(
      "C:/Users/t/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"
    );
    expect(resolveFfprobe(env, exists)).toBe(
      "C:/Users/t/AppData/Local/Microsoft/WinGet/Links/ffprobe.exe"
    );
    expect(checked).toHaveLength(2);
  });

  it("bare command name when nothing else resolves", () => {
    expect(resolveFfmpeg({}, () => false)).toBe("ffmpeg");
    expect(resolveFfprobe({ LOCALAPPDATA: "C:/x" }, () => false)).toBe("ffprobe");
  });
});

// --- assembleReel with fake spawn ---

interface ScriptedRun {
  code: number;
  stdout?: string;
  stderr?: string;
}

function fakeSpawn(script: ScriptedRun[]) {
  const calls: { command: string; args: string[] }[] = [];
  const spawn: SpawnFn = (command, args) => {
    calls.push({ command, args });
    const runSpec = script[calls.length - 1];
    if (!runSpec) throw new Error(`fakeSpawn: unexpected call #${calls.length} (${command})`);
    return {
      stdout: {
        on(event: "data", listener: (chunk: unknown) => void) {
          if (runSpec.stdout) queueMicrotask(() => listener(runSpec.stdout));
        },
      },
      stderr: {
        on(event: "data", listener: (chunk: unknown) => void) {
          if (runSpec.stderr) queueMicrotask(() => listener(runSpec.stderr));
        },
      },
      on(event: string, listener: (...a: never[]) => void) {
        if (event === "close") {
          queueMicrotask(() => (listener as (code: number) => void)(runSpec.code));
        }
      },
    };
  };
  return { spawn, calls };
}

const REEL_OPTS = {
  clips: CLIPS,
  timeline: standardTimeline(),
  cardFile: "card.png",
  audioFile: null,
  outFile: "reel.mp4",
  env: { FFMPEG_PATH: "fake-ffmpeg", FFPROBE_PATH: "fake-ffprobe" },
};

describe("assembleReel", () => {
  it("non-zero ffmpeg exit throws with the stderr tail (last 30 lines)", async () => {
    const noise = Array.from({ length: 40 }, (_, i) => `err-${String(i + 1).padStart(2, "0")}`);
    const { spawn } = fakeSpawn([{ code: 1, stderr: noise.join("\n") }]);
    const err = await assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => true } }).then(
      () => null,
      (e: Error) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toContain("ffmpeg exited 1");
    expect(err!.message).toContain("err-11");
    expect(err!.message).toContain("err-40");
    expect(err!.message).not.toContain("err-10");
  });

  it("success: runs ffmpeg then ffprobe, returns the probed duration", async () => {
    const { spawn, calls } = fakeSpawn([
      { code: 0, stderr: "frame= 992\n" },
      { code: 0, stdout: "33.066667\n" },
    ]);
    const result = await assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => true } });
    expect(result).toEqual({ outFile: "reel.mp4", durationSec: 33.066667 });
    expect(calls).toHaveLength(2);
    expect(calls[0].command).toBe("fake-ffmpeg");
    expect(calls[0].args).toEqual(buildFfmpegArgs(REEL_OPTS));
    expect(calls[1].command).toBe("fake-ffprobe");
    expect(calls[1].args).toEqual([
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      "reel.mp4",
    ]);
  });

  it("missing output file throws even when ffmpeg exits 0", async () => {
    const { spawn } = fakeSpawn([{ code: 0 }]);
    await expect(
      assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => false } })
    ).rejects.toThrow(/reel\.mp4 is missing/);
  });

  it("probed duration off by more than 0.25s throws", async () => {
    const { spawn } = fakeSpawn([{ code: 0 }, { code: 0, stdout: "30.0\n" }]);
    await expect(
      assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => true } })
    ).rejects.toThrow(/30\.00s, expected ~33\.07s/);
  });

  it("ffprobe failure (empty/corrupt output) throws with its stderr", async () => {
    const { spawn } = fakeSpawn([{ code: 0 }, { code: 1, stderr: "moov atom not found" }]);
    await expect(
      assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => true } })
    ).rejects.toThrow(/moov atom not found/);
  });

  it("unparsable ffprobe output throws instead of passing NaN through", async () => {
    const { spawn } = fakeSpawn([{ code: 0 }, { code: 0, stdout: "N/A\n" }]);
    await expect(
      assembleReel({ ...REEL_OPTS, deps: { spawn, existsSync: () => true } })
    ).rejects.toThrow(/no duration/);
  });
});
