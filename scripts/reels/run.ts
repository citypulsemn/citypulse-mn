/**
 * Reels pipeline — generates a posting day's 3 finished Instagram reels
 * (regular / family / weird) end to end: DB events → selection → web top-up →
 * copywriting → arch card render → Pexels b-roll (vision-screened) → ffmpeg
 * assembly → mp4 + caption + manifest.
 *
 *   npm run reels                       generate today's posting day (Mon–Thu → monday, Fri–Sun → friday)
 *   npm run reels -- --day=friday       generate a specific posting day
 *   npm run reels -- --date=2026-08-31  pretend today is another date (testing)
 *   npm run reels -- --variant=weird    only some variants (comma-separated)
 *   npm run reels -- --smoke            no-API dry run: regular card only, DB +
 *                                       card + ffmpeg are real, copy is canned,
 *                                       b-roll comes from --fixtures / defaults
 *
 * Requires DATABASE_URL; real runs also need ANTHROPIC_API_KEY and
 * PEXELS_API_KEY. Output: <out>/<windowStart>_<day>/<variant>.mp4 (+
 * caption.txt per variant, manifest.md per day). Rotation memory lives in
 * <out>/history.json and is only saved on real runs.
 */
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { hasDatabase } from "../../lib/db";
import { pickAudioFile } from "../../lib/reels/audio";
import { makeScreenImages, seasonScreenNote } from "../../lib/reels/authenticity";
import { assembleReel } from "../../lib/reels/assemble";
import { renderCardToFile } from "../../lib/reels/card";
import { writeReelContent } from "../../lib/reels/copywriter";
import { CTA_LINE, detailsLine, headerFor } from "../../lib/reels/format";
import {
  loadHistory,
  markAudioUsed,
  pruneHistory,
  saveHistory,
} from "../../lib/reels/history";
import { buildWeekWindow, defaultPostDay } from "../../lib/reels/keys";
import { loadWindowEvents } from "../../lib/reels/load-events";
import {
  chooseClipsForReel,
  defaultPexelsDeps,
  downloadChosenClips,
} from "../../lib/reels/pexels";
import { topUpVariant } from "../../lib/reels/research-topup";
import {
  mergeTopUp,
  partitionEvents,
  selectFive,
} from "../../lib/reels/select-events";
import { buildTimeline } from "../../lib/reels/timeline";
import type {
  BrollLine,
  PickedClip,
  PostDay,
  ReelContent,
  Variant,
  VariantSelection,
  WeekWindow,
} from "../../lib/reels/types";
import { SHOT_TYPES, VARIANTS } from "../../lib/reels/types";
import { validateReelContent } from "../../lib/reels/validate";

const argOf = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const docsDir = path.join(os.homedir(), "Documents", "CityPulseMN");
const OUT_ROOT = argOf("out") ?? process.env.REELS_OUT_DIR ?? path.join(docsDir, "Reels", "auto");
const AUDIO_ROOT = process.env.REELS_AUDIO_DIR ?? path.join(docsDir, "Audio");
const FIXTURE_DIR =
  argOf("fixtures") ??
  process.env.REELS_FIXTURE_CLIPS ??
  path.join(docsDir, "Reels", "r75_monday_weird");

interface ReelOutcome {
  variant: Variant;
  status: "built" | "skipped";
  reason?: string;
  videoFile?: string;
  durationSec?: number;
  events: string[];
  excluded: { title: string; reason: string }[];
  warnings: string[];
  clips: { label: string; pexelsId: number | null; term: string; authenticity: string }[];
  audioNote?: string;
}

/** Canned, validator-clean content so --smoke runs without any API key. */
function smokeContent(day: PostDay, window: WeekWindow, selection: VariantSelection): ReelContent {
  const flavors = ["aerial", "handheld", "slow motion", "timelapse"];
  const subjects = [
    "Minneapolis skyline",
    "Minneapolis lakefront",
    "Stone Arch Bridge",
    "Minneapolis street",
    "Minneapolis farmers market",
    "Minneapolis downtown",
    "Mississippi river Minneapolis",
  ];
  const broll: BrollLine[] = subjects.map((subject, i) => {
    const shotType = ((window.shotTypeKey + i) % 4) as BrollLine["shotType"];
    return {
      label: i === 0 ? "HOOK" : i === subjects.length - 1 ? "CTA" : `event ${i}`,
      terms: [
        `${subject} ${flavors[shotType]}`,
        `${subject} summer`,
        "Minnesota city summer",
      ],
      shotType,
    };
  });
  return {
    day,
    variant: selection.variant,
    card: {
      variant: selection.variant,
      header: headerFor(day, selection.variant, window),
      events: selection.events.map((e) => ({
        name: e.title.split(/\s+/).slice(0, 5).join(" "),
        details: detailsLine(e, window),
      })),
      cta: CTA_LINE,
    },
    caption:
      "Smoke test caption. Five real events straight from the database, rendered end to end without a single model call. If you can read this on a finished reel, the template works.",
    broll,
  };
}

async function fixtureClips(dir: string): Promise<PickedClip[]> {
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".mp4")).sort();
  if (files.length < 7) {
    throw new Error(`fixture dir ${dir} has ${files.length} mp4s — need 7 (use --fixtures=)`);
  }
  return files.slice(0, 7).map((f, i) => ({
    pexelsId: 0,
    file: path.join(dir, f),
    width: 1080,
    height: 1920,
    durationSec: 0,
    termUsed: `fixture:${f}`,
    authenticity: "passed" as const,
    creditName: "fixture",
    creditUrl: "",
  }));
}

async function main() {
  const smoke = process.argv.includes("--smoke");
  const dateArg = argOf("date");
  const now = dateArg ? new Date(`${dateArg}T09:00:00`) : new Date();
  const day = (argOf("day") as PostDay | null) ?? defaultPostDay(now);
  if (day !== "monday" && day !== "friday") throw new Error(`--day must be monday or friday`);
  const window = buildWeekWindow(now, day);
  const todayIso = now.toISOString().slice(0, 10);
  const variantFilter = argOf("variant")?.split(",") ?? (smoke ? ["regular"] : [...VARIANTS]);
  const variants = VARIANTS.filter((v) => variantFilter.includes(v));

  if (!hasDatabase) throw new Error("DATABASE_URL is required");
  if (!smoke && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required (or use --smoke)");
  if (!smoke && !process.env.PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is required (or use --smoke)");

  const dayDir = path.join(OUT_ROOT, `${window.start}_${day}`);
  await mkdir(dayDir, { recursive: true });
  const historyPath = path.join(OUT_ROOT, "history.json");
  const history = loadHistory(historyPath);

  console.log(
    `[reels] ${day} window ${window.start}..${window.end} · ISO week ${window.isoWeek} · ` +
      `shot key ${window.shotTypeKey} (${SHOT_TYPES[window.shotTypeKey]}) · audio lane ${window.audioLane}` +
      `${smoke ? " · SMOKE" : ""}`,
  );

  const candidates = await loadWindowEvents(window);
  const { pools, excluded: poolExcluded } = partitionEvents(candidates, window);
  console.log(
    `[reels] DB: ${candidates.length} events → regular ${pools.regular.length} · ` +
      `family ${pools.family.length} · weird ${pools.weird.length} · excluded ${poolExcluded.length}`,
  );

  const outcomes: ReelOutcome[] = [];

  for (const variant of variants) {
    const outcome: ReelOutcome = {
      variant,
      status: "skipped",
      events: [],
      excluded: [],
      warnings: [],
      clips: [],
    };
    outcomes.push(outcome);
    try {
      let selection = selectFive(pools[variant], variant);
      if (selection.shortfall > 0 && !smoke) {
        console.log(`[reels] ${variant}: DB pool short by ${selection.shortfall} — web top-up…`);
        const topUp = await topUpVariant(
          variant,
          window,
          selection.shortfall,
          selection.events.map((e) => e.title),
        );
        outcome.warnings.push(...topUp.warnings);
        selection = mergeTopUp(selection, topUp.events);
      }
      outcome.excluded = selection.excluded;
      if (selection.shortfall > 0) {
        outcome.reason = `only ${selection.events.length}/5 events after ${smoke ? "DB (smoke skips top-up)" : "top-up"} — reel not built (never pad, never invent)`;
        console.warn(`[reels] ${variant}: ${outcome.reason}`);
        continue;
      }

      const content = smoke
        ? smokeContent(day, window, selection)
        : await writeReelContent(day, variant, window, selection);
      outcome.events = content.card.events.map((e) => `${e.name} — ${e.details}`);
      outcome.warnings.push(...validateReelContent(content, window).warnings);

      const variantDir = path.join(dayDir, variant);
      await mkdir(variantDir, { recursive: true });
      const cardFile = path.join(variantDir, "card.png");
      await renderCardToFile(content.card, cardFile);

      let picked: PickedClip[];
      if (smoke) {
        picked = await fixtureClips(FIXTURE_DIR);
      } else {
        const chosen = await chooseClipsForReel(
          content.broll,
          { apiKey: process.env.PEXELS_API_KEY!, todayIso, history },
          {
            ...defaultPexelsDeps,
            screenImages: makeScreenImages(
              outcome.warnings,
              seasonScreenNote(Number(window.start.slice(5, 7))),
            ),
          },
        );
        outcome.warnings.push(...chosen.warnings);
        picked = await downloadChosenClips(chosen.clips, path.join(variantDir, "clips"), history, todayIso);
      }
      outcome.clips = picked.map((c, i) => ({
        label: content.broll[i]?.label ?? `line ${i + 1}`,
        pexelsId: c.pexelsId || null,
        term: c.termUsed,
        authenticity: c.authenticity,
      }));

      const audio = pickAudioFile(variant, AUDIO_ROOT, history, todayIso, window.isoWeek);
      outcome.audioNote = audio.note;

      const outFile = path.join(dayDir, `${variant}.mp4`);
      const timeline = buildTimeline(picked.length);
      const { durationSec } = await assembleReel({
        clips: picked.map((c) => ({ file: c.file })),
        timeline,
        cardFile,
        audioFile: audio.file,
        outFile,
      });
      if (audio.file) markAudioUsed(history, path.basename(audio.file), todayIso);

      await writeFile(path.join(dayDir, `${variant}.caption.txt`), content.caption + "\n");
      outcome.status = "built";
      outcome.videoFile = outFile;
      outcome.durationSec = durationSec;
      console.log(`[reels] ${variant}: built ${path.basename(outFile)} (${durationSec.toFixed(2)}s)`);
    } catch (err) {
      outcome.reason = err instanceof Error ? err.message : String(err);
      console.error(`[reels] ${variant}: FAILED — ${outcome.reason}`);
    }
  }

  if (!smoke) saveHistory(pruneHistory(history, todayIso), historyPath);

  const manifest = [
    `# Reels — ${day} ${window.start}..${window.end}`,
    ``,
    `Generated ${now.toISOString()} · ISO week ${window.isoWeek} · shot key ${window.shotTypeKey} (${SHOT_TYPES[window.shotTypeKey]}) · audio lane ${window.audioLane}${smoke ? " · **SMOKE RUN**" : ""}`,
    ``,
    `DB events in window: ${candidates.length} (regular ${pools.regular.length} / family ${pools.family.length} / weird ${pools.weird.length}); pool exclusions: ${poolExcluded.length}`,
    ...poolExcluded.map((e) => `- excluded: ${e.title} — ${e.reason}`),
    ``,
    ...outcomes.flatMap((o) => [
      `## ${o.variant} — ${o.status.toUpperCase()}${o.reason ? ` (${o.reason})` : ""}`,
      ...(o.videoFile ? [`Video: ${o.videoFile} (${o.durationSec?.toFixed(2)}s)`] : []),
      ...(o.audioNote ? [o.audioNote] : []),
      ...(o.events.length ? ["", "Events:", ...o.events.map((e) => `- ${e}`)] : []),
      ...(o.clips.length
        ? [
            "",
            "Clips:",
            ...o.clips.map(
              (c) =>
                `- ${c.label}: ${c.pexelsId ? `pexels #${c.pexelsId}` : c.term} via "${c.term}"${c.authenticity === "waived" ? " ⚠ AUTHENTICITY WAIVED — review before posting" : ""}`,
            ),
          ]
        : []),
      ...(o.warnings.length ? ["", "Warnings:", ...o.warnings.map((w) => `- ⚠ ${w}`)] : []),
      ...(o.excluded.length
        ? ["", `Not on this card (${o.excluded.length}):`, ...o.excluded.map((e) => `- ${e.title} — ${e.reason}`)]
        : []),
      ``,
    ]),
  ].join("\n");
  await writeFile(path.join(dayDir, "manifest.md"), manifest + "\n");

  const built = outcomes.filter((o) => o.status === "built").length;
  console.log(`[reels] done — ${built}/${variants.length} reels built · ${dayDir}`);
  if (built < variants.length) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("[reels] fatal:", err);
    process.exit(1);
  },
);
