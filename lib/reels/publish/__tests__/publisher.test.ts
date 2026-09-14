import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { VARIANTS, type Variant, type WeekWindow } from "../../types";
import type {
  DayManifest,
  HoldState,
  ManifestOutcome,
  PublishLedger,
  PublishPlanItem,
  PublishResult,
} from "../types";
import { DEFAULT_SLOTS } from "../types";
import {
  LEDGER_FILE,
  MANIFEST_FILE,
  detectHolds,
  executePlan,
  holdFileFor,
  loadLedger,
  loadManifest,
  planPublish,
  saveLedger,
  slotReached,
  summarizeForOps,
  type ExecuteDeps,
  type PublisherFsDeps,
} from "../publisher";

const DAY_DIR = join("C:", "reels", "2026-08-24_monday");

const WINDOW: WeekWindow = {
  postDay: "monday",
  start: "2026-08-24",
  end: "2026-08-28",
  isoWeek: 35,
  shotTypeKey: 3,
  audioLane: 2,
};

/** All three slots (08:30 / 11:45 / 18:30) have passed by 19:00. */
const EVENING = new Date(2026, 7, 24, 19, 0);

function built(variant: Variant, over: Partial<ManifestOutcome> = {}): ManifestOutcome {
  return {
    variant,
    status: "built",
    videoFile: join(DAY_DIR, `${variant}.mp4`),
    captionFile: join(DAY_DIR, `${variant}.caption.txt`),
    durationSec: 33.07,
    warnings: [],
    waivedClips: 0,
    ...over,
  };
}

function makeManifest(over: Partial<DayManifest> = {}): DayManifest {
  return {
    day: "monday",
    window: WINDOW,
    generatedAt: "2026-08-24T11:31:00.000Z",
    smoke: false,
    outcomes: VARIANTS.map((v) => built(v)),
    ...over,
  };
}

function noHolds(): HoldState {
  return { global: false, variants: new Set() };
}

/** In-memory fs — reads throw on missing paths, like node:fs. */
function fakeFs(initial: Record<string, string> = {}, existing: string[] = []) {
  const files = new Map<string, string>(Object.entries(initial));
  const extra = new Set(existing);
  const deps: PublisherFsDeps = {
    readFile: (path) => {
      const data = files.get(path);
      if (data === undefined) throw new Error(`ENOENT: ${path}`);
      return data;
    },
    writeFile: (path, data) => {
      files.set(path, data);
    },
    exists: (path) => files.has(path) || extra.has(path),
  };
  return { deps, files };
}

const manifestPath = join(DAY_DIR, MANIFEST_FILE);
const ledgerPath = join(DAY_DIR, LEDGER_FILE);

describe("loadManifest", () => {
  it("round-trips a valid manifest", () => {
    const manifest = makeManifest();
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(manifest) });
    expect(loadManifest(DAY_DIR, deps)).toEqual(manifest);
  });

  it("missing file yields null", () => {
    const { deps } = fakeFs();
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("corrupt JSON yields null", () => {
    const { deps } = fakeFs({ [manifestPath]: "{ not json !!" });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("non-object JSON yields null", () => {
    const { deps } = fakeFs({ [manifestPath]: '"a string"' });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("missing outcomes array yields null", () => {
    const bad = { ...makeManifest(), outcomes: undefined };
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(bad) });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("an unknown variant in an outcome yields null", () => {
    const bad = makeManifest();
    (bad.outcomes[1] as { variant: string }).variant = "spooky";
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(bad) });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("a manifest that cannot attest smoke yields null (fail-safe)", () => {
    const bad = { ...makeManifest(), smoke: undefined };
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(bad) });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("a built outcome without waivedClips yields null — the gate's input must be attested", () => {
    const bad = makeManifest();
    delete (bad.outcomes[0] as Partial<ManifestOutcome>).waivedClips;
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(bad) });
    expect(loadManifest(DAY_DIR, deps)).toBeNull();
  });

  it("a skipped outcome without waivedClips defaults to 0 — nothing shipped, nothing waived", () => {
    const manifest = makeManifest({
      outcomes: [{ variant: "family", status: "skipped", reason: "no family events", warnings: [] } as unknown as ManifestOutcome],
    });
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(manifest) });
    const loaded = loadManifest(DAY_DIR, deps);
    expect(loaded?.outcomes[0]?.waivedClips).toBe(0);
    expect(loaded?.outcomes[0]?.reason).toBe("no family events");
  });

  it("drops non-string warnings but keeps the strings", () => {
    const manifest = makeManifest();
    (manifest.outcomes[0] as { warnings: unknown[] }).warnings = ["real warning", 42, null];
    const { deps } = fakeFs({ [manifestPath]: JSON.stringify(manifest) });
    expect(loadManifest(DAY_DIR, deps)?.outcomes[0]?.warnings).toEqual(["real warning"]);
  });
});

describe("loadLedger / saveLedger", () => {
  it("save then load round-trips", () => {
    const { deps } = fakeFs();
    const ledger: PublishLedger = {
      regular: { containerId: "c1", mediaId: "18001", publishedAt: "2026-08-24T13:30:05.000Z" },
    };
    saveLedger(DAY_DIR, ledger, deps);
    expect(loadLedger(DAY_DIR, deps)).toEqual(ledger);
  });

  it("missing file yields an empty ledger", () => {
    const { deps } = fakeFs();
    expect(loadLedger(DAY_DIR, deps)).toEqual({});
  });

  it("corrupt JSON yields an empty ledger — never crash", () => {
    const { deps } = fakeFs({ [ledgerPath]: "not json at all" });
    expect(loadLedger(DAY_DIR, deps)).toEqual({});
  });

  it("drops a malformed entry but keeps the valid ones", () => {
    const { deps } = fakeFs({
      [ledgerPath]: JSON.stringify({
        regular: { containerId: "c1", mediaId: "18001", publishedAt: "2026-08-24T13:30:05.000Z" },
        family: { containerId: 99, mediaId: "18002" },
        weird: "what",
      }),
    });
    expect(loadLedger(DAY_DIR, deps)).toEqual({
      regular: { containerId: "c1", mediaId: "18001", publishedAt: "2026-08-24T13:30:05.000Z" },
    });
  });
});

describe("detectHolds", () => {
  it("no HOLD files — nothing held", () => {
    const { deps } = fakeFs();
    expect(detectHolds(DAY_DIR, deps)).toEqual({ global: false, variants: new Set() });
  });

  it("HOLD in the day folder is the global veto", () => {
    const { deps } = fakeFs({}, [join(DAY_DIR, "HOLD")]);
    expect(detectHolds(DAY_DIR, deps).global).toBe(true);
  });

  it("HOLD.family holds only family", () => {
    const { deps } = fakeFs({}, [join(DAY_DIR, holdFileFor("family"))]);
    const holds = detectHolds(DAY_DIR, deps);
    expect(holds.global).toBe(false);
    expect(holds.variants).toEqual(new Set(["family"]));
  });
});

describe("slotReached — minute-precision local time", () => {
  it("one minute before the slot: not reached", () => {
    expect(slotReached("11:45", new Date(2026, 7, 24, 11, 44))).toBe(false);
  });

  it("boundary: the exact minute counts as reached", () => {
    expect(slotReached("11:45", new Date(2026, 7, 24, 11, 45))).toBe(true);
  });

  it("one minute after: reached", () => {
    expect(slotReached("11:45", new Date(2026, 7, 24, 11, 46))).toBe(true);
  });

  it("seconds within the minute before the slot never tip it over", () => {
    expect(slotReached("08:30", new Date(2026, 7, 24, 8, 29, 59))).toBe(false);
  });

  it("a malformed slot throws instead of silently never publishing", () => {
    expect(() => slotReached("8am", EVENING)).toThrow(/Invalid slot/);
    expect(() => slotReached("25:00", EVENING)).toThrow(/Invalid slot/);
    expect(() => slotReached("08:65", EVENING)).toThrow(/Invalid slot/);
  });
});

describe("planPublish — rule order, first match wins", () => {
  it("clean manifest, all slots passed: three publishes with their slots", () => {
    const plan = planPublish(makeManifest(), {}, noHolds(), DEFAULT_SLOTS, EVENING);
    expect(plan).toEqual([
      { variant: "regular", action: "publish", reason: "due (slot 08:30)" },
      { variant: "family", action: "publish", reason: "due (slot 11:45)" },
      { variant: "weird", action: "publish", reason: "due (slot 18:30)" },
    ]);
  });

  it("smoke beats everything — even ledger entries, holds, and waived clips", () => {
    const manifest = makeManifest({ smoke: true });
    manifest.outcomes[2] = built("weird", { waivedClips: 3 });
    const ledger: PublishLedger = {
      regular: { containerId: "c1", mediaId: "18001", publishedAt: "x" },
    };
    const holds: HoldState = { global: true, variants: new Set() };
    const plan = planPublish(manifest, ledger, holds, DEFAULT_SLOTS, EVENING);
    for (const item of plan) {
      expect(item).toMatchObject({ action: "skip", reason: "smoke run — never published" });
    }
  });

  it("generator-skipped passes the generator's reason through", () => {
    const manifest = makeManifest({
      outcomes: [
        built("regular"),
        { variant: "family", status: "skipped", reason: "no family events this window", warnings: [], waivedClips: 0 },
        built("weird"),
      ],
    });
    const plan = planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, EVENING);
    expect(plan[1]).toEqual({
      variant: "family",
      action: "skip",
      reason: "no family events this window",
    });
  });

  it("generator-skipped with no recorded reason says so honestly", () => {
    const manifest = makeManifest({
      outcomes: [{ variant: "weird", status: "skipped", warnings: [], waivedClips: 0 }],
    });
    const plan = planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, EVENING);
    expect(plan[0]?.reason).toBe("skipped by the generator (no reason recorded)");
  });

  it("skipped beats the ledger — the generator's reason wins", () => {
    const manifest = makeManifest({
      outcomes: [{ variant: "regular", status: "skipped", reason: "pipeline says no", warnings: [], waivedClips: 0 }],
    });
    const ledger: PublishLedger = {
      regular: { containerId: "c1", mediaId: "18001", publishedAt: "x" },
    };
    const plan = planPublish(manifest, ledger, noHolds(), DEFAULT_SLOTS, EVENING);
    expect(plan[0]?.reason).toBe("pipeline says no");
  });

  it("ledger beats hold — already-published skips even under a global HOLD", () => {
    const ledger: PublishLedger = {
      regular: { containerId: "c1", mediaId: "18001", publishedAt: "x" },
    };
    const holds: HoldState = { global: true, variants: new Set() };
    const plan = planPublish(makeManifest(), ledger, holds, DEFAULT_SLOTS, EVENING);
    expect(plan[0]).toEqual({
      variant: "regular",
      action: "skip",
      reason: "already published (media 18001)",
    });
    expect(plan[1]).toEqual({ variant: "family", action: "hold", reason: "HOLD file present" });
    expect(plan[2]).toEqual({ variant: "weird", action: "hold", reason: "HOLD file present" });
  });

  it("a variant HOLD file holds only that variant", () => {
    const holds: HoldState = { global: false, variants: new Set<Variant>(["weird"]) };
    const plan = planPublish(makeManifest(), {}, holds, DEFAULT_SLOTS, EVENING);
    expect(plan.map((p) => p.action)).toEqual(["publish", "publish", "hold"]);
  });

  it("waived clips hold with the count and the way out", () => {
    const manifest = makeManifest();
    manifest.outcomes[1] = built("family", { waivedClips: 2 });
    const plan = planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, EVENING);
    expect(plan[1]).toEqual({
      variant: "family",
      action: "hold",
      reason: "2 authenticity-waived clip(s) — review, then --force-held or remove the flag",
    });
  });

  it("HOLD file beats the waived-clip reason", () => {
    const manifest = makeManifest();
    manifest.outcomes[0] = built("regular", { waivedClips: 1 });
    const holds: HoldState = { global: false, variants: new Set<Variant>(["regular"]) };
    const plan = planPublish(manifest, {}, holds, DEFAULT_SLOTS, EVENING);
    expect(plan[0]?.reason).toBe("HOLD file present");
  });

  it("forceHeld flips waived-clip holds to publish but never HOLD-file holds", () => {
    const manifest = makeManifest();
    manifest.outcomes[0] = built("regular", { waivedClips: 1 });
    manifest.outcomes[1] = built("family", { waivedClips: 2 });
    const holds: HoldState = { global: false, variants: new Set<Variant>(["family"]) };
    const plan = planPublish(manifest, {}, holds, DEFAULT_SLOTS, EVENING, { forceHeld: true });
    expect(plan[0]).toEqual({ variant: "regular", action: "publish", reason: "due (slot 08:30)" });
    expect(plan[1]).toEqual({ variant: "family", action: "hold", reason: "HOLD file present" });
  });

  it("forceHeld cannot publish an incomplete manifest — no file, no publish", () => {
    const manifest = makeManifest();
    manifest.outcomes[0] = built("regular", { waivedClips: 1, captionFile: undefined });
    const plan = planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, EVENING, { forceHeld: true });
    expect(plan[0]).toEqual({ variant: "regular", action: "hold", reason: "manifest incomplete" });
  });

  it("a built outcome missing its videoFile holds as incomplete, even before its slot", () => {
    const manifest = makeManifest();
    manifest.outcomes[2] = built("weird", { videoFile: undefined });
    const morning = new Date(2026, 7, 24, 7, 0);
    const plan = planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, morning);
    expect(plan[2]).toEqual({ variant: "weird", action: "hold", reason: "manifest incomplete" });
  });

  it("mid-morning: regular due, later slots wait with their times", () => {
    const nineAm = new Date(2026, 7, 24, 9, 0);
    const plan = planPublish(makeManifest(), {}, noHolds(), DEFAULT_SLOTS, nineAm);
    expect(plan).toEqual([
      { variant: "regular", action: "publish", reason: "due (slot 08:30)" },
      { variant: "family", action: "wait", reason: "slot 11:45 not reached" },
      { variant: "weird", action: "wait", reason: "slot 18:30 not reached" },
    ]);
  });

  it("honest emptiness: a manifest with no outcomes plans nothing", () => {
    const manifest = makeManifest({ outcomes: [] });
    expect(planPublish(manifest, {}, noHolds(), DEFAULT_SLOTS, EVENING)).toEqual([]);
  });
});

/**
 * Fake execution harness — records every side effect in one ordered log so
 * tests can assert sequencing, and fails on demand at any step.
 */
function fakeExec(opts: {
  ledgerFiles?: Record<string, string>;
  failUploadFor?: Variant[];
  failCreateFor?: Variant[];
  failPublishFor?: Variant[];
} = {}) {
  const { deps: files, files: written } = fakeFs(opts.ledgerFiles ?? {});
  const calls: string[] = [];
  const captionsSeen: string[] = [];
  let ledgerSaves = 0;
  const rawWrite = files.writeFile;
  files.writeFile = (path, data) => {
    if (path === ledgerPath) ledgerSaves += 1;
    calls.push("save-ledger");
    rawWrite(path, data);
  };
  let containerN = 0;
  const variantOf = (text: string): Variant =>
    VARIANTS.find((v) => text.includes(v)) ?? "regular";
  const deps: ExecuteDeps = {
    files,
    readCaption: async (captionFile) => `Caption for ${variantOf(captionFile)} — go outside`,
    buildObjectName: (variant, manifest) => `${manifest.window.start}_${manifest.day}_${variant}.mp4`,
    host: {
      upload: async (localFile, objectName) => {
        calls.push(`upload:${objectName}`);
        if (opts.failUploadFor?.includes(variantOf(localFile))) {
          throw new Error("Supabase upload failed (500)");
        }
        return `https://host/public/${objectName}`;
      },
      remove: async (objectName) => {
        calls.push(`remove:${objectName}`);
      },
    },
    ig: {
      createReelContainer: async (videoUrl, caption) => {
        calls.push(`create:${videoUrl}`);
        captionsSeen.push(caption);
        if (opts.failCreateFor?.includes(variantOf(videoUrl))) {
          throw new Error("Meta says no");
        }
        containerN += 1;
        return `c${containerN}`;
      },
      publish: async (containerId) => {
        calls.push(`publish:${containerId}`);
        const variant = VARIANTS[containerN - 1] ?? "regular";
        if (opts.failPublishFor?.includes(variant)) {
          throw new Error("media_publish rejected");
        }
        return `m-${containerId}`;
      },
    },
    waitForContainer: async (containerId) => {
      calls.push(`wait:${containerId}`);
    },
    now: () => new Date("2026-08-24T18:31:00.000Z"),
  };
  return { deps, calls, captionsSeen, written, ledgerSaves: () => ledgerSaves };
}

function publishPlan(): PublishPlanItem[] {
  return VARIANTS.map((variant) => ({
    variant,
    action: "publish" as const,
    reason: `due (slot ${DEFAULT_SLOTS[variant]})`,
  }));
}

describe("executePlan", () => {
  it("happy path: publishes 3 sequentially, saves the ledger after each, cleans up each upload", async () => {
    const { deps, calls, written, ledgerSaves } = fakeExec();
    const results = await executePlan(publishPlan(), makeManifest(), DAY_DIR, deps);

    expect(results.map((r) => r.outcome)).toEqual(["published", "published", "published"]);
    expect(results.map((r) => r.mediaId)).toEqual(["m-c1", "m-c2", "m-c3"]);
    expect(ledgerSaves()).toBe(3);
    // Strict sequencing: each reel runs its whole chain before the next starts,
    // and the hosted file is removed after the publish (and its ledger save).
    expect(calls).toEqual([
      "upload:2026-08-24_monday_regular.mp4",
      "create:https://host/public/2026-08-24_monday_regular.mp4",
      "wait:c1",
      "publish:c1",
      "save-ledger",
      "remove:2026-08-24_monday_regular.mp4",
      "upload:2026-08-24_monday_family.mp4",
      "create:https://host/public/2026-08-24_monday_family.mp4",
      "wait:c2",
      "publish:c2",
      "save-ledger",
      "remove:2026-08-24_monday_family.mp4",
      "upload:2026-08-24_monday_weird.mp4",
      "create:https://host/public/2026-08-24_monday_weird.mp4",
      "wait:c3",
      "publish:c3",
      "save-ledger",
      "remove:2026-08-24_monday_weird.mp4",
    ]);

    const ledger = JSON.parse(written.get(ledgerPath) ?? "{}") as PublishLedger;
    expect(Object.keys(ledger).sort()).toEqual(["family", "regular", "weird"]);
    expect(ledger.regular).toEqual({
      containerId: "c1",
      mediaId: "m-c1",
      publishedAt: "2026-08-24T18:31:00.000Z",
    });
  });

  it("caption file content reaches createReelContainer verbatim", async () => {
    const { deps, captionsSeen } = fakeExec();
    await executePlan(publishPlan(), makeManifest(), DAY_DIR, deps);
    expect(captionsSeen).toEqual([
      "Caption for regular — go outside",
      "Caption for family — go outside",
      "Caption for weird — go outside",
    ]);
  });

  it("mid-plan failure: 2nd container errors, 3rd still publishes, ledger holds 1st+3rd", async () => {
    const { deps, calls, written } = fakeExec({ failCreateFor: ["family"] });
    const results = await executePlan(publishPlan(), makeManifest(), DAY_DIR, deps);

    expect(results.map((r) => r.outcome)).toEqual(["published", "failed", "published"]);
    expect(results[1]?.detail).toBe("Meta says no");
    const ledger = JSON.parse(written.get(ledgerPath) ?? "{}") as PublishLedger;
    expect(Object.keys(ledger).sort()).toEqual(["regular", "weird"]);
    // The failed upload was still cleaned up — remove runs on the failure path too.
    expect(calls).toContain("remove:2026-08-24_monday_family.mp4");
    // ...but Meta was never asked to publish a container that errored.
    expect(calls.filter((c) => c.startsWith("publish:"))).toEqual(["publish:c1", "publish:c2"]);
  });

  it("failure at the publish step: hosted file still removed, nothing enters the ledger", async () => {
    const { deps, calls, written } = fakeExec({ failPublishFor: ["regular"] });
    const results = await executePlan(
      [{ variant: "regular", action: "publish", reason: "due (slot 08:30)" }],
      makeManifest(),
      DAY_DIR,
      deps,
    );
    expect(results[0]).toMatchObject({ outcome: "failed", detail: "media_publish rejected" });
    expect(calls).toContain("remove:2026-08-24_monday_regular.mp4");
    expect(written.has(ledgerPath)).toBe(false);
  });

  it("upload failure: no container attempted, nothing hosted so nothing removed, siblings continue", async () => {
    const { deps, calls } = fakeExec({ failUploadFor: ["regular"] });
    const results = await executePlan(publishPlan(), makeManifest(), DAY_DIR, deps);
    expect(results.map((r) => r.outcome)).toEqual(["failed", "published", "published"]);
    expect(results[0]?.detail).toBe("Supabase upload failed (500)");
    expect(calls).not.toContain("create:https://host/public/2026-08-24_monday_regular.mp4");
    expect(calls).not.toContain("remove:2026-08-24_monday_regular.mp4");
  });

  it("wait/hold/skip items map to their result outcomes verbatim, with no API calls", async () => {
    const { deps, calls } = fakeExec();
    const plan: PublishPlanItem[] = [
      { variant: "regular", action: "skip", reason: "already published (media 18001)" },
      { variant: "family", action: "hold", reason: "HOLD file present" },
      { variant: "weird", action: "wait", reason: "slot 18:30 not reached" },
    ];
    const results = await executePlan(plan, makeManifest(), DAY_DIR, deps);
    expect(results).toEqual([
      { variant: "regular", outcome: "skipped", detail: "already published (media 18001)" },
      { variant: "family", outcome: "held", detail: "HOLD file present" },
      { variant: "weird", outcome: "waiting", detail: "slot 18:30 not reached" },
    ]);
    expect(calls).toEqual([]);
  });

  it("preserves earlier ledger entries when publishing a later reel", async () => {
    const existing: PublishLedger = {
      regular: { containerId: "c-old", mediaId: "18001", publishedAt: "2026-08-24T13:31:00.000Z" },
    };
    const { deps, written } = fakeExec({
      ledgerFiles: { [ledgerPath]: JSON.stringify(existing) },
    });
    await executePlan(
      [{ variant: "weird", action: "publish", reason: "due (slot 18:30)" }],
      makeManifest(),
      DAY_DIR,
      deps,
    );
    const ledger = JSON.parse(written.get(ledgerPath) ?? "{}") as PublishLedger;
    expect(ledger.regular).toEqual(existing.regular);
    expect(ledger.weird?.containerId).toBe("c1");
  });

  it("honest emptiness: an empty plan does nothing and reports nothing", async () => {
    const { deps, calls } = fakeExec();
    const results = await executePlan([], makeManifest(), DAY_DIR, deps);
    expect(results).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("summarizeForOps — clean runs are silent", () => {
  const published = (variant: Variant): PublishResult => ({
    variant,
    outcome: "published",
    detail: `published (media m-${variant})`,
    mediaId: `m-${variant}`,
  });

  it("all published: silent", () => {
    expect(summarizeForOps(VARIANTS.map(published), "Monday Aug 24")).toBeNull();
  });

  it("waiting and skipped are normal mid-day states, not incidents: silent", () => {
    const results: PublishResult[] = [
      published("regular"),
      { variant: "family", outcome: "waiting", detail: "slot 11:45 not reached" },
      { variant: "weird", outcome: "skipped", detail: "already published (media 18003)" },
    ];
    expect(summarizeForOps(results, "Monday Aug 24")).toBeNull();
  });

  it("no results at all: silent", () => {
    expect(summarizeForOps([], "Monday Aug 24")).toBeNull();
  });

  it("a hold earns an email naming the count and carrying every result line", () => {
    const results: PublishResult[] = [
      published("regular"),
      {
        variant: "family",
        outcome: "held",
        detail: "2 authenticity-waived clip(s) — review, then --force-held or remove the flag",
      },
      published("weird"),
    ];
    const summary = summarizeForOps(results, "Monday Aug 24");
    expect(summary?.subject).toBe("Reels publish (Monday Aug 24): 1 held");
    expect(summary?.lines).toEqual([
      "regular: published — published (media m-regular)",
      "family: held — 2 authenticity-waived clip(s) — review, then --force-held or remove the flag",
      "weird: published — published (media m-weird)",
    ]);
  });

  it("holds and failures both count, failures first in the subject", () => {
    const results: PublishResult[] = [
      { variant: "regular", outcome: "failed", detail: "Meta says no" },
      { variant: "family", outcome: "held", detail: "HOLD file present" },
      { variant: "weird", outcome: "held", detail: "HOLD file present" },
    ];
    const summary = summarizeForOps(results, "Friday Aug 28");
    expect(summary?.subject).toBe("Reels publish (Friday Aug 28): 1 failed, 2 held");
    expect(summary?.lines[0]).toBe("regular: failed — Meta says no");
  });
});
