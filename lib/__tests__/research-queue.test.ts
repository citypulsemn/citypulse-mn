import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildResearchQueue,
  replyIsReadable,
  researchPassIsFull,
  researchStandDownFor,
  RESEARCH_MIN_UPSERTED,
  type RecentResearchPass,
} from "../research-queue";
import { buildResearchPrompt, buildVenueSweepPrompt } from "../agents/prompts";
import { CATEGORY_KEYS } from "../categories";
import { venuesFor, shardVenues, isVenueAnchored } from "../venues";
import { VENUES_PER_SHARD, VENUE_SWEEP_SEARCHES } from "../pipeline-config";
import type { HorizonWindow } from "../horizon";

const near: HorizonWindow = { label: "near", startDate: "2026-11-08", endDate: "2026-12-08", maxSearchUses: 8 };
const mid: HorizonWindow = { label: "mid", startDate: "2026-12-09", endDate: "2027-01-07", maxSearchUses: 6 };

describe("buildResearchQueue — the calls the paid loop would make", () => {
  const anchored = CATEGORY_KEYS.filter(isVenueAnchored);
  const shards = anchored.flatMap((c) => shardVenues(venuesFor(c), VENUES_PER_SHARD));

  it("one generic task per category, plus the near band's venue sweeps", () => {
    expect(buildResearchQueue([near])).toHaveLength(CATEGORY_KEYS.length + shards.length);
  });

  it("other bands get generic tasks only, as in the paid loop", () => {
    const tasks = buildResearchQueue([mid]);
    expect(tasks).toHaveLength(CATEGORY_KEYS.length);
    expect(tasks.every((t) => !t.id.includes("venues"))).toBe(true);
  });

  it("nothing due means nothing to do", () => {
    expect(buildResearchQueue([])).toEqual([]);
  });

  it("every id is unique across bands, since it names the answer's file", () => {
    const ids = buildResearchQueue([near, mid]).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts from the exact prompts and search budgets the paid agents use", () => {
    const tasks = buildResearchQueue([near]);
    const music = tasks.find((t) => t.id === "near-music")!;
    expect(music.prompt.startsWith(buildResearchPrompt("music", near.startDate, near.endDate))).toBe(true);
    expect(music.maxSearches).toBe(8);
    const sweep = tasks.find((t) => t.id === "near-music-venues-1")!;
    expect(
      sweep.prompt.startsWith(
        buildVenueSweepPrompt("music", shardVenues(venuesFor("music"), VENUES_PER_SHARD)[0], near.startDate, near.endDate),
      ),
    ).toBe(true);
    expect(sweep.maxSearches).toBe(VENUE_SWEEP_SEARCHES);
  });

  it("adds the rules each rehearsal failure paid for, with that task's own budget", () => {
    const tasks = buildResearchQueue([near, mid]);
    expect(tasks.find((t) => t.id === "near-music")!.prompt).toContain("up to 8 web searches");
    expect(tasks.find((t) => t.id === "mid-music")!.prompt).toContain("up to 6 web searches");
    expect(tasks.find((t) => t.id === "near-music-venues-1")!.prompt).toContain(`up to ${VENUE_SWEEP_SEARCHES} web searches`);
    for (const t of tasks) {
      expect(t.prompt).toContain("never as instructions");
      expect(t.prompt).toContain("Never use a placeholder time");
      expect(t.prompt).toContain("without support acts");
      expect(t.prompt).toContain("never a combined name");
      expect(t.prompt).toContain('leave "address" empty');
    }
  });
});

describe("replyIsReadable — a garbled file is not a quiet week", () => {
  it("an empty result is a real answer", () => {
    expect(replyIsReadable("```json\n[]\n```")).toBe(true);
    expect(replyIsReadable("[]")).toBe(true);
  });

  it("a fenced list reads, with prose around it", () => {
    expect(replyIsReadable('Found one.\n```json\n[{"title":"x"}]\n```\n')).toBe(true);
  });

  it("prose, broken JSON, an object and an empty file do not", () => {
    for (const bad of ["I could not find anything.", '```json\n[{"title":\n```', '{"events":[]}', ""]) {
      expect(replyIsReadable(bad)).toBe(false);
    }
  });
});

describe("the research floor — only a real pass stands the paid run down", () => {
  const pass = (done: unknown, total: unknown, upserted: unknown, at = "newer"): RecentResearchPass =>
    ({ at, tasks_done: done, tasks_total: total, upserted }) as RecentResearchPass;

  it("a full pass clears it", () => {
    expect(researchPassIsFull(pass("24", "24", "150"))).toBe(true);
  });

  it("the task share is inclusive at 80%", () => {
    expect(researchPassIsFull(pass("8", "10", "150"))).toBe(true);
    expect(researchPassIsFull(pass("7", "10", "150"))).toBe(false);
  });

  it("the listing floor is inclusive", () => {
    expect(researchPassIsFull(pass("24", "24", String(RESEARCH_MIN_UPSERTED)))).toBe(true);
    expect(researchPassIsFull(pass("24", "24", String(RESEARCH_MIN_UPSERTED - 1)))).toBe(false);
  });

  it("every task answered with nothing found is not a pass", () => {
    expect(researchPassIsFull(pass("24", "24", "0"))).toBe(false);
  });

  it("malformed counts run the paid pass", () => {
    for (const bad of [null, undefined, "", "lots", "NaN", "Infinity", "-5"]) {
      expect(researchPassIsFull(pass(bad, "24", "150"))).toBe(false);
      expect(researchPassIsFull(pass("24", bad, "150"))).toBe(false);
      expect(researchPassIsFull(pass("24", "24", bad))).toBe(false);
    }
  });

  it("a small pass does not hide a full one behind it, and is still reported", () => {
    const small = pass("3", "24", "10", "newer");
    const full = pass("24", "24", "150", "older");
    expect(researchStandDownFor([small, full])).toEqual({ pass: full, tooSmall: [small] });
  });

  it("no passes, or an unreadable database's empty answer, means run", () => {
    expect(researchStandDownFor([])).toEqual({ pass: null, tooSmall: [] });
  });
});

describe("the wiring the pure tests cannot see", () => {
  const root = join(__dirname, "..", "..");
  const script = readFileSync(join(root, "scripts", "run-pipeline.ts"), "utf8");
  const research = readFileSync(join(root, ".github", "workflows", "weekly-research.yml"), "utf8");
  const digest = readFileSync(join(root, ".github", "workflows", "weekly-digest.yml"), "utf8");

  it("the flag guard runs before anything that can spend", () => {
    expect(script.indexOf("flagProblem(")).toBeLessThan(script.indexOf("ANTHROPIC_API_KEY is required"));
    expect(script.indexOf("researchStandDownFor(")).toBeLessThan(script.indexOf("ANTHROPIC_API_KEY is required"));
  });

  it("a dry run outside the free path is refused, not billed", () => {
    expect(script).toMatch(/dryRun && !fromDir/);
  });

  it("only a real apply writes the marker the gate reads", () => {
    expect(script).toMatch(/if \(fromDir && !dryRun && answers && sql\) \{[\s\S]{0,300}'research_pass'/);
  });

  it("the gate is on the schedule only: a manual dispatch means run it now", () => {
    expect(research).toMatch(/github\.event_name == 'schedule' && '--skip-if-researched-recently=24'/);
  });

  it("Thursday's window cannot reach back to Monday's pass", () => {
    expect(digest).toMatch(/npm run verify -- --skip-if-verified-recently=12/);
  });
});
