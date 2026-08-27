import type { Timeline, TimelineSlot } from "./types";

/**
 * Fixed reel timeline, measured from the published reels: 1080×1920 @ 30fps,
 * each clip on screen for 152 frames, consecutive clips crossfading over 12
 * frames (0.4s). Slots therefore overlap by the fade: slot i starts at
 * i × (152 − 12) frames. Seven clips = 992 frames = 33.0667s — the published
 * template's length.
 */

const FPS = 30;
const SLOT_FRAMES = 152;
const FADE_FRAMES = 12;

export function buildTimeline(clipCount = 7): Timeline {
  const fadeSec = FADE_FRAMES / FPS;
  if (clipCount <= 0) {
    return { fps: FPS, fadeSec, slots: [], totalSec: 0 };
  }
  const stepFrames = SLOT_FRAMES - FADE_FRAMES;
  const slots: TimelineSlot[] = Array.from({ length: clipCount }, (_, index) => ({
    index,
    startSec: (index * stepFrames) / FPS,
    durationSec: SLOT_FRAMES / FPS,
  }));
  // A single clip has no crossfade partner, which the (n−1) term handles.
  const totalFrames = clipCount * SLOT_FRAMES - (clipCount - 1) * FADE_FRAMES;
  return { fps: FPS, fadeSec, slots, totalSec: totalFrames / FPS };
}
