import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ReelsHistory, Variant } from "./types";
import { isAudioFresh } from "./history";

/**
 * Music selection from the owner's local mood banks
 * (Documents/CityPulseMN/Audio/<variant>/). The toolkit's audio-lane rotation
 * concept maps here to file rotation: never repeat a track within 28 days,
 * and the ISO week seeds a deterministic pick among what's eligible.
 *
 * An empty or missing folder is a first-class outcome, not an error: the reel
 * exports without music and the owner adds a trending sound at post time
 * (which the toolkit itself says gets more reach).
 */

const AUDIO_EXTS = new Set([".mp3", ".m4a", ".aac"]);

export interface AudioPick {
  /** Absolute path of the chosen track, or null for a music-less export. */
  file: string | null;
  /** Human-readable note for the manifest. */
  note: string;
}

export function pickAudioFile(
  variant: Variant,
  audioRoot: string,
  history: ReelsHistory,
  todayIso: string,
  isoWeek: number,
  deps: { readdir(dir: string): string[]; exists(p: string): boolean } = {
    readdir: (dir) => readdirSync(dir),
    exists: existsSync,
  },
): AudioPick {
  const dir = path.join(audioRoot, variant);
  if (!deps.exists(dir)) {
    return { file: null, note: `no ${variant} audio folder at ${dir} — exported without music` };
  }
  const tracks = deps
    .readdir(dir)
    .filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
    .sort();
  if (tracks.length === 0) {
    return { file: null, note: `${variant} audio folder is empty — exported without music` };
  }

  // Prefer tracks outside the 28-day window; if every track was used
  // recently, take the least-recently-used one rather than going silent.
  const eligible = tracks.filter((t) => !isAudioFresh(history, t, todayIso));
  if (eligible.length > 0) {
    const chosen = eligible[isoWeek % eligible.length];
    return { file: path.join(dir, chosen), note: `audio: ${chosen}` };
  }
  const lru = [...tracks].sort(
    (a, b) => (history.audio[a] ?? "").localeCompare(history.audio[b] ?? "") || a.localeCompare(b),
  )[0];
  return {
    file: path.join(dir, lru),
    note: `audio: ${lru} (all ${tracks.length} tracks used within 28 days — took the least recent)`,
  };
}
