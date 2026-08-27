import { describe, it, expect } from "vitest";
import {
  searchVideos,
  pickFile,
  chooseClipsForReel,
  downloadClip,
  type PexelsVideo,
  type PexelsVideoFile,
  type PexelsDeps,
  type ChooseClipsDeps,
} from "../pexels";
import { emptyHistory, markClipUsed, markTermUsed } from "../history";
import type { BrollLine, ReelsHistory } from "../types";

const TODAY = "2026-08-26";

function vid(id: number, over: Partial<PexelsVideo> = {}): PexelsVideo {
  return {
    id,
    duration: 12,
    image: `https://img.example/${id}.jpg`,
    user: { name: `Creator ${id}`, url: `https://pexels.com/@c${id}` },
    video_files: [{ link: `https://dl.example/${id}.mp4`, width: 1080, height: 1920 }],
    ...over,
  };
}

function line(label: string, terms: string[]): BrollLine {
  return { label, terms, shotType: 0 };
}

/** Fake Pexels search keyed by query term; records every request. */
function fakeSearch(byTerm: Record<string, PexelsVideo[]>, status = 200) {
  const calls: { term: string; url: string; headers: Record<string, string> }[] = [];
  const deps: PexelsDeps = {
    fetchJson: async (url, headers) => {
      const term = new URL(url).searchParams.get("query") ?? "";
      calls.push({ term, url, headers });
      if (status !== 200) return { ok: false, status, body: null };
      return { ok: true, status: 200, body: { videos: byTerm[term] ?? [] } };
    },
  };
  return { deps, calls };
}

/** Authenticity screen that rejects the listed poster URLs; records call batches. */
function fakeScreen(badImages: string[] = []) {
  const batches: string[][] = [];
  const screenImages = async (urls: string[]) => {
    batches.push(urls);
    return urls.map((u) => !badImages.includes(u));
  };
  return { screenImages, batches };
}

function chooseDeps(
  byTerm: Record<string, PexelsVideo[]>,
  badImages: string[] = [],
) {
  const search = fakeSearch(byTerm);
  const screen = fakeScreen(badImages);
  const deps: ChooseClipsDeps = { ...search.deps, screenImages: screen.screenImages };
  return { deps, searchCalls: search.calls, screenBatches: screen.batches };
}

function opts(history: ReelsHistory = emptyHistory()) {
  return { apiKey: "test-key", todayIso: TODAY, history };
}

describe("searchVideos", () => {
  it("requests the portrait search URL with the key in the Authorization header", async () => {
    const { deps, calls } = fakeSearch({ "st paul farmers market": [vid(1)] });
    const videos = await searchVideos("st paul farmers market", { apiKey: "abc123" }, deps);

    expect(videos.map((v) => v.id)).toEqual([1]);
    expect(calls).toHaveLength(1);
    expect(calls[0].headers).toEqual({ Authorization: "abc123" });
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("https://api.pexels.com/videos/search");
    expect(url.searchParams.get("query")).toBe("st paul farmers market");
    expect(url.searchParams.get("per_page")).toBe("8");
    expect(url.searchParams.get("orientation")).toBe("portrait");
  });

  it("throws the exact invalid-key message on 401", async () => {
    const { deps } = fakeSearch({}, 401);
    await expect(searchVideos("x", { apiKey: "bad" }, deps)).rejects.toThrow(
      "Invalid Pexels API key",
    );
  });

  it("throws a rate-limit message on 429", async () => {
    const { deps } = fakeSearch({}, 429);
    await expect(searchVideos("x", { apiKey: "k" }, deps)).rejects.toThrow(/rate limit/i);
  });

  it("throws with the status on other errors", async () => {
    const { deps } = fakeSearch({}, 503);
    await expect(searchVideos("x", { apiKey: "k" }, deps)).rejects.toThrow(/503/);
  });

  it("a response with no videos array yields an empty list, not an error", async () => {
    const deps: PexelsDeps = {
      fetchJson: async () => ({ ok: true, status: 200, body: {} }),
    };
    expect(await searchVideos("x", { apiKey: "k" }, deps)).toEqual([]);
  });
});

describe("pickFile — faithful port of the manual finder", () => {
  const f = (link: string, width: number | null, height: number | null): PexelsVideoFile => ({
    link,
    width,
    height,
  });

  it("prefers portrait even when a landscape file is closer to 1920", () => {
    const v = vid(1, {
      video_files: [f("landscape", 3413, 1920), f("portrait", 540, 960)],
    });
    expect(pickFile(v)?.link).toBe("portrait");
  });

  it("among portrait files, closest height to 1920 wins", () => {
    const v = vid(1, {
      video_files: [f("uhd", 1440, 2560), f("hd", 1080, 1920), f("sd", 540, 960)],
    });
    expect(pickFile(v)?.link).toBe("hd");
  });

  it("falls back to all files when nothing is portrait", () => {
    const v = vid(1, {
      video_files: [f("far", 1920, 1080), f("near", 3840, 2160)],
    });
    expect(pickFile(v)?.link).toBe("near");
  });

  it("returns null for an empty video_files array", () => {
    expect(pickFile(vid(1, { video_files: [] }))).toBeNull();
  });

  it("treats null dimensions as 0, like the original's (height||0) guard", () => {
    const v = vid(1, {
      video_files: [f("nullish", null, 1080), f("landscape", 1920, 1080)],
    });
    // height 1080 > width null(→0) makes "nullish" the only portrait file.
    expect(pickFile(v)?.link).toBe("nullish");
  });
});

describe("chooseClipsForReel", () => {
  it("cascades to the next term when a search comes back empty", async () => {
    const { deps, searchCalls } = chooseDeps({
      "aerial drone minnesota state fair": [],
      "state fair crowd": [vid(7)],
    });
    const result = await chooseClipsForReel(
      [line("HOOK", ["aerial drone minnesota state fair", "state fair crowd"])],
      opts(),
      deps,
    );

    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]).toMatchObject({
      pexelsId: 7,
      termUsed: "state fair crowd",
      authenticity: "passed",
      url: "https://dl.example/7.mp4",
      creditName: "Creator 7",
    });
    expect(result.warnings).toEqual([]);
    expect(searchCalls.map((c) => c.term)).toEqual([
      "aerial drone minnesota state fair",
      "state fair crowd",
    ]);
  });

  it("moves to the next term when every candidate fails screening, one screen call per term", async () => {
    const { deps, screenBatches } = chooseDeps(
      {
        "first ave": [vid(1)],
        "music venue": [vid(2)],
      },
      ["https://img.example/1.jpg"],
    );
    const result = await chooseClipsForReel(
      [line("Event 1", ["first ave", "music venue"])],
      opts(),
      deps,
    );

    expect(result.clips[0]).toMatchObject({ pexelsId: 2, authenticity: "passed" });
    expect(screenBatches).toEqual([
      ["https://img.example/1.jpg"],
      ["https://img.example/2.jpg"],
    ]);
  });

  it("skips a screening-failed candidate in favor of a later passer within the same term", async () => {
    const { deps } = chooseDeps(
      { "lake harriet": [vid(1), vid(2)] },
      ["https://img.example/1.jpg"],
    );
    const result = await chooseClipsForReel([line("Event 2", ["lake harriet"])], opts(), deps);
    expect(result.clips[0]).toMatchObject({ pexelsId: 2, authenticity: "passed" });
    expect(result.warnings).toEqual([]);
  });

  it("waives the best-ranked screening failure when every term's candidates fail, with a warning", async () => {
    const { deps } = chooseDeps(
      {
        "term one": [vid(1), vid(2)],
        "term two": [vid(3)],
      },
      ["https://img.example/1.jpg", "https://img.example/2.jpg", "https://img.example/3.jpg"],
    );
    const result = await chooseClipsForReel(
      [line("CTA", ["term one", "term two"])],
      opts(),
      deps,
    );

    expect(result.clips[0]).toMatchObject({
      pexelsId: 1,
      termUsed: "term one",
      authenticity: "waived",
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("CTA");
    expect(result.warnings[0]).toContain("waived");
  });

  it("never reuses a video id across the 7 lines of one reel", async () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => vid(id));
    const labels = ["HOOK", "E1", "E2", "E3", "E4", "E5", "CTA"];
    const { deps } = chooseDeps({ "minneapolis skyline": pool });
    const result = await chooseClipsForReel(
      labels.map((label) => line(label, ["minneapolis skyline"])),
      opts(),
      deps,
    );

    const ids = result.clips.map((c) => c.pexelsId);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(ids).size).toBe(7);
  });

  it("tries terms used within 21 days last", async () => {
    const history = markTermUsed(emptyHistory(), "stone arch bridge", "2026-08-21");
    const { deps, searchCalls } = chooseDeps({
      "stone arch bridge": [vid(1)],
      "mississippi river": [vid(2)],
    });
    const result = await chooseClipsForReel(
      [line("E1", ["stone arch bridge", "mississippi river"])],
      opts(history),
      deps,
    );

    expect(result.clips[0].termUsed).toBe("mississippi river");
    expect(searchCalls.map((c) => c.term)).toEqual(["mississippi river"]);
  });

  it("still falls back to a recently-used term when fresher terms find nothing", async () => {
    const history = markTermUsed(emptyHistory(), "stone arch bridge", "2026-08-21");
    const { deps } = chooseDeps({
      "stone arch bridge": [vid(1)],
      "mississippi river": [],
    });
    const result = await chooseClipsForReel(
      [line("E1", ["stone arch bridge", "mississippi river"])],
      opts(history),
      deps,
    );
    expect(result.clips[0]).toMatchObject({ pexelsId: 1, termUsed: "stone arch bridge" });
  });

  it("excludes clips used within 42 days, and allows one used exactly 42 days ago", async () => {
    const history = emptyHistory();
    markClipUsed(history, "1", "2026-08-16"); // 10 days ago — excluded
    markClipUsed(history, "2", "2026-07-15"); // exactly 42 — usable
    const { deps } = chooseDeps({ "loring park": [vid(1), vid(2)] });
    const result = await chooseClipsForReel([line("E1", ["loring park"])], opts(history), deps);
    expect(result.clips[0].pexelsId).toBe(2);
  });

  it("excludes clips shorter than 6 seconds and keeps exactly 6", async () => {
    const { deps } = chooseDeps({
      "food truck": [vid(1, { duration: 5 }), vid(2, { duration: 6 })],
    });
    const result = await chooseClipsForReel([line("E1", ["food truck"])], opts(), deps);
    expect(result.clips[0]).toMatchObject({ pexelsId: 2, durationSec: 6 });
  });

  it("excludes videos where no file can be picked", async () => {
    const { deps } = chooseDeps({
      "nordeast bar": [vid(1, { video_files: [] }), vid(2)],
    });
    const result = await chooseClipsForReel([line("E1", ["nordeast bar"])], opts(), deps);
    expect(result.clips[0].pexelsId).toBe(2);
  });

  it("throws naming the line when no term yields any usable candidate", async () => {
    const { deps } = chooseDeps({
      "empty one": [],
      "too short": [vid(1, { duration: 3 })],
    });
    await expect(
      chooseClipsForReel([line("Event 4", ["empty one", "too short"])], opts(), deps),
    ).rejects.toThrow(/Event 4/);
  });

  it("honest emptiness: no lines in, no clips out, no requests made", async () => {
    const { deps, searchCalls, screenBatches } = chooseDeps({});
    const result = await chooseClipsForReel([], opts(), deps);
    expect(result).toEqual({ clips: [], warnings: [] });
    expect(searchCalls).toEqual([]);
    expect(screenBatches).toEqual([]);
  });
});

describe("downloadClip", () => {
  it("delegates to the injected downloader and returns the destination", async () => {
    const calls: [string, string][] = [];
    const dest = await downloadClip("https://dl.example/9.mp4", "/tmp/clip9.mp4", {
      download: async (url, destFile) => {
        calls.push([url, destFile]);
      },
    });
    expect(dest).toBe("/tmp/clip9.mp4");
    expect(calls).toEqual([["https://dl.example/9.mp4", "/tmp/clip9.mp4"]]);
  });

  it("propagates downloader failures", async () => {
    await expect(
      downloadClip("https://dl.example/9.mp4", "/tmp/clip9.mp4", {
        download: async () => {
          throw new Error("disk full");
        },
      }),
    ).rejects.toThrow("disk full");
  });
});
