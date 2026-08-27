import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { BrollLine, PickedClip, ReelsHistory } from "./types";
import {
  CLIP_WINDOW_DAYS,
  TERM_WINDOW_DAYS,
  isClipFresh,
  isTermFresh,
  markClipUsed,
  markTermUsed,
} from "./history";

/**
 * Pexels b-roll selection — a faithful port of the manual B-Roll Finder
 * (Documents/CityPulseMN/city_pulse_broll_finder.html), plus the rotation and
 * authenticity rules the pipeline adds on top.
 */

/** Each timeline slot shows ~5.1s of source, so anything shorter than this is unusable. */
export const MIN_CLIP_SEC = 6;
export const SEARCH_PER_PAGE = 8;

export interface PexelsVideoFile {
  link: string;
  width: number | null;
  height: number | null;
}

export interface PexelsVideo {
  id: number;
  /** Seconds. */
  duration: number;
  /** Poster image URL — what the authenticity screen looks at. */
  image: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

export interface PexelsSearchResponse {
  videos?: PexelsVideo[];
}

export interface FetchJsonResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface PexelsDeps {
  fetchJson(url: string, headers: Record<string, string>): Promise<FetchJsonResult>;
}

export const defaultPexelsDeps: PexelsDeps = {
  fetchJson: async (url, headers) => {
    const res = await fetch(url, { headers });
    return {
      ok: res.ok,
      status: res.status,
      body: res.ok ? await res.json() : null,
    };
  },
};

export interface SearchOpts {
  apiKey: string;
  perPage?: number;
  /** Pexels orientation filter; the pipeline always wants portrait. */
  orientation?: "portrait" | "landscape" | "square" | "";
}

export async function searchVideos(
  term: string,
  opts: SearchOpts,
  deps: PexelsDeps = defaultPexelsDeps,
): Promise<PexelsVideo[]> {
  const perPage = opts.perPage ?? SEARCH_PER_PAGE;
  const orientation = opts.orientation ?? "portrait";
  let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&per_page=${perPage}`;
  if (orientation) url += `&orientation=${orientation}`;
  const res = await deps.fetchJson(url, { Authorization: opts.apiKey });
  if (res.status === 401) throw new Error("Invalid Pexels API key");
  if (res.status === 429) {
    throw new Error("Pexels rate limit reached (200/hour on the free tier) — wait and retry");
  }
  if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
  const data = res.body as PexelsSearchResponse | null;
  return data?.videos ?? [];
}

/**
 * The finder's exact file pick: prefer portrait files (height > width; fall
 * back to all files if none), then closest height to 1920 wins. Null
 * dimensions compare as 0, matching the original's `(height||0)` guard.
 */
export function pickFile(video: PexelsVideo): PexelsVideoFile | null {
  const files = video.video_files ?? [];
  const portrait = files.filter((f) => (f.height ?? 0) > (f.width ?? 0));
  const pool = portrait.length ? portrait : files;
  const sorted = [...pool].sort(
    (a, b) => Math.abs((a.height ?? 0) - 1920) - Math.abs((b.height ?? 0) - 1920),
  );
  return sorted[0] ?? null;
}

/** A clip chosen for one line — everything PickedClip needs except the downloaded path. */
export interface ChosenClip {
  pexelsId: number;
  /** Direct download URL of the picked file. */
  url: string;
  width: number;
  height: number;
  durationSec: number;
  termUsed: string;
  authenticity: "passed" | "waived";
  creditName: string;
  creditUrl: string;
}

export interface ChooseClipsOpts {
  apiKey: string;
  /** yyyy-mm-dd — freshness windows are measured against this day. */
  todayIso: string;
  history: ReelsHistory;
  perPage?: number;
}

export interface ChooseClipsDeps extends PexelsDeps {
  /**
   * Vision authenticity screen over poster images; one call per term's
   * candidate set. true = looks like real local footage, false = reject.
   */
  screenImages(imageUrls: string[]): Promise<boolean[]>;
}

export interface ChooseClipsResult {
  /** One per line, in line order. */
  clips: ChosenClip[];
  warnings: string[];
}

interface Candidate {
  video: PexelsVideo;
  file: PexelsVideoFile;
  term: string;
}

function toChosen(c: Candidate, authenticity: "passed" | "waived"): ChosenClip {
  return {
    pexelsId: c.video.id,
    url: c.file.link,
    width: c.file.width ?? 0,
    height: c.file.height ?? 0,
    durationSec: c.video.duration,
    termUsed: c.term,
    authenticity,
    creditName: c.video.user?.name ?? "Pexels",
    creditUrl: c.video.user?.url ?? "https://pexels.com",
  };
}

/**
 * For each of the 7 b-roll lines, walk its terms most-specific-first and pick
 * the first candidate that survives every gate. Terms used within 21 days are
 * tried last, not never — a repetitive local clip beats a fresh generic one.
 * If every candidate fails the authenticity screen, the best-ranked failure
 * ships with authenticity "waived" and a warning. Zero candidates at all is a
 * hard error naming the line — never invent.
 */
export async function chooseClipsForReel(
  lines: BrollLine[],
  opts: ChooseClipsOpts,
  deps: ChooseClipsDeps,
): Promise<ChooseClipsResult> {
  const clips: ChosenClip[] = [];
  const warnings: string[] = [];
  const usedThisBatch = new Set<number>();

  for (const line of lines) {
    const freshTerms = line.terms.filter(
      (t) => !isTermFresh(opts.history, t, opts.todayIso, TERM_WINDOW_DAYS),
    );
    const staleTerms = line.terms.filter(
      (t) => isTermFresh(opts.history, t, opts.todayIso, TERM_WINDOW_DAYS),
    );
    const orderedTerms = [...freshTerms, ...staleTerms];

    let chosen: ChosenClip | null = null;
    const screeningFailed: Candidate[] = [];

    for (const term of orderedTerms) {
      const videos = await searchVideos(
        term,
        { apiKey: opts.apiKey, perPage: opts.perPage ?? SEARCH_PER_PAGE },
        deps,
      );
      const candidates: Candidate[] = [];
      for (const video of videos) {
        if (usedThisBatch.has(video.id)) continue;
        if (isClipFresh(opts.history, String(video.id), opts.todayIso, CLIP_WINDOW_DAYS)) continue;
        if (video.duration < MIN_CLIP_SEC) continue;
        const file = pickFile(video);
        if (!file) continue;
        candidates.push({ video, file, term });
      }
      if (!candidates.length) continue;

      const verdicts = await deps.screenImages(candidates.map((c) => c.video.image));
      const passIndex = candidates.findIndex((_, i) => verdicts[i] === true);
      if (passIndex >= 0) {
        chosen = toChosen(candidates[passIndex], "passed");
        break;
      }
      screeningFailed.push(...candidates);
    }

    if (!chosen && screeningFailed.length) {
      const best = screeningFailed[0];
      chosen = toChosen(best, "waived");
      warnings.push(
        `"${line.label}": every candidate failed the authenticity screen — ` +
          `using best-ranked clip ${best.video.id} (term "${best.term}") with authenticity waived. Review before posting.`,
      );
    }

    if (!chosen) {
      throw new Error(
        `No usable b-roll for line "${line.label}" — terms tried: ${
          orderedTerms.join(", ") || "(none)"
        }. Every search came back empty or fully excluded.`,
      );
    }

    usedThisBatch.add(chosen.pexelsId);
    clips.push(chosen);
  }

  return { clips, warnings };
}

export interface DownloadDeps {
  download(url: string, destFile: string): Promise<void>;
}

async function fetchToFile(url: string, destFile: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) for ${url}`);
  }
  const body = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream);
  await pipeline(body, createWriteStream(destFile));
}

export const defaultDownloadDeps: DownloadDeps = { download: fetchToFile };

/** Streams a picked file to disk; returns the destination path. */
export async function downloadClip(
  url: string,
  destFile: string,
  deps: DownloadDeps = defaultDownloadDeps,
): Promise<string> {
  await deps.download(url, destFile);
  return destFile;
}

/**
 * Download every chosen clip into destDir (created if needed) and record the
 * term + clip usage in history — usage is marked here, after a download
 * actually succeeds, so an aborted run never burns a rotation slot.
 * Files are named clip<line>_<pexelsId>.mp4 in line order.
 */
export async function downloadChosenClips(
  clips: ChosenClip[],
  destDir: string,
  history: ReelsHistory,
  todayIso: string,
  deps: DownloadDeps = defaultDownloadDeps,
): Promise<PickedClip[]> {
  await mkdir(destDir, { recursive: true });
  const picked: PickedClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const file = path.join(destDir, `clip${i + 1}_${c.pexelsId}.mp4`);
    await downloadClip(c.url, file, deps);
    markTermUsed(history, c.termUsed, todayIso);
    markClipUsed(history, String(c.pexelsId), todayIso);
    picked.push({
      pexelsId: c.pexelsId,
      file,
      width: c.width,
      height: c.height,
      durationSec: c.durationSec,
      termUsed: c.termUsed,
      authenticity: c.authenticity,
      creditName: c.creditName,
      creditUrl: c.creditUrl,
    });
  }
  return picked;
}
