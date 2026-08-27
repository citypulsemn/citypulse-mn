import { describe, it, expect } from "vitest";
import {
  emptyHistory,
  loadHistory,
  saveHistory,
  markTermUsed,
  markClipUsed,
  markAudioUsed,
  isTermFresh,
  isClipFresh,
  pruneHistory,
  type HistoryDeps,
} from "../history";

const TODAY = "2026-08-26";

/** In-memory fs — reads throw on missing paths, like node:fs. */
function fakeFs(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const deps: HistoryDeps = {
    readFile: (path) => {
      const data = files.get(path);
      if (data === undefined) throw new Error(`ENOENT: ${path}`);
      return data;
    },
    writeFile: (path, data) => {
      files.set(path, data);
    },
  };
  return { deps, files };
}

describe("history round-trip", () => {
  it("saves marks and loads them back identically", () => {
    const { deps } = fakeFs();
    const history = emptyHistory();
    markTermUsed(history, "minneapolis skyline", "2026-08-24");
    markClipUsed(history, "123456", "2026-08-24");
    markAudioUsed(history, "lane0-track2.mp3", "2026-08-24");

    saveHistory(history, "/state/reels-history.json", deps);
    const loaded = loadHistory("/state/reels-history.json", deps);

    expect(loaded).toEqual({
      terms: { "minneapolis skyline": "2026-08-24" },
      clips: { "123456": "2026-08-24" },
      audio: { "lane0-track2.mp3": "2026-08-24" },
    });
  });

  it("writes valid JSON", () => {
    const { deps, files } = fakeFs();
    saveHistory(markTermUsed(emptyHistory(), "a", TODAY), "/h.json", deps);
    expect(() => JSON.parse(files.get("/h.json")!)).not.toThrow();
  });
});

describe("loadHistory resilience — never crash, never invent", () => {
  it("missing file yields a fresh empty history", () => {
    const { deps } = fakeFs();
    expect(loadHistory("/nope.json", deps)).toEqual(emptyHistory());
  });

  it("corrupt JSON yields a fresh empty history", () => {
    const { deps } = fakeFs({ "/h.json": "{ not json !!" });
    expect(loadHistory("/h.json", deps)).toEqual(emptyHistory());
  });

  it("non-object JSON yields a fresh empty history", () => {
    const { deps } = fakeFs({ "/h.json": '"just a string"' });
    expect(loadHistory("/h.json", deps)).toEqual(emptyHistory());
  });

  it("keeps valid sections and empties malformed ones", () => {
    const { deps } = fakeFs({
      "/h.json": JSON.stringify({
        terms: { good: "2026-08-01", bad: 42 },
        clips: "not a record",
      }),
    });
    expect(loadHistory("/h.json", deps)).toEqual({
      terms: { good: "2026-08-01" },
      clips: {},
      audio: {},
    });
  });
});

describe("freshness windows", () => {
  it("a term used 5 days ago is fresh (too recent to reuse)", () => {
    const h = markTermUsed(emptyHistory(), "t", "2026-08-21");
    expect(isTermFresh(h, "t", TODAY)).toBe(true);
  });

  it("boundary: exactly 21 days ago is NOT fresh", () => {
    const h = markTermUsed(emptyHistory(), "t", "2026-08-05");
    expect(isTermFresh(h, "t", TODAY)).toBe(false);
  });

  it("20 days ago is still fresh; 22 is not", () => {
    const h = emptyHistory();
    markTermUsed(h, "at20", "2026-08-06");
    markTermUsed(h, "at22", "2026-08-04");
    expect(isTermFresh(h, "at20", TODAY)).toBe(true);
    expect(isTermFresh(h, "at22", TODAY)).toBe(false);
  });

  it("clip window is 42 days: 41 fresh, exactly 42 not", () => {
    const h = emptyHistory();
    markClipUsed(h, "at41", "2026-07-16");
    markClipUsed(h, "at42", "2026-07-15");
    expect(isClipFresh(h, "at41", TODAY)).toBe(true);
    expect(isClipFresh(h, "at42", TODAY)).toBe(false);
  });

  it("unknown keys are not fresh", () => {
    expect(isTermFresh(emptyHistory(), "never used", TODAY)).toBe(false);
    expect(isClipFresh(emptyHistory(), "999", TODAY)).toBe(false);
  });

  it("an unparseable stored date is not fresh", () => {
    const h = markTermUsed(emptyHistory(), "t", "not-a-date");
    expect(isTermFresh(h, "t", TODAY)).toBe(false);
  });

  it("honors an explicit windowDays override", () => {
    const h = markTermUsed(emptyHistory(), "t", "2026-08-20");
    expect(isTermFresh(h, "t", TODAY, 7)).toBe(true);
    expect(isTermFresh(h, "t", TODAY, 6)).toBe(false);
  });
});

describe("pruneHistory", () => {
  it("drops entries older than 90 days, keeps 90 exactly, across all sections", () => {
    const h = emptyHistory();
    markTermUsed(h, "old", "2026-05-27"); // 91 days before TODAY
    markTermUsed(h, "edge", "2026-05-28"); // exactly 90
    markClipUsed(h, "old", "2026-05-27");
    markClipUsed(h, "recent", "2026-08-20");
    markAudioUsed(h, "old.mp3", "2026-05-27");

    expect(pruneHistory(h, TODAY)).toEqual({
      terms: { edge: "2026-05-28" },
      clips: { recent: "2026-08-20" },
      audio: {},
    });
  });

  it("drops entries whose dates cannot be parsed", () => {
    const h = markTermUsed(emptyHistory(), "junk", "??");
    expect(pruneHistory(h, TODAY).terms).toEqual({});
  });

  it("returns a new object and leaves the input untouched", () => {
    const h = markTermUsed(emptyHistory(), "old", "2020-01-01");
    const pruned = pruneHistory(h, TODAY);
    expect(pruned).not.toBe(h);
    expect(h.terms.old).toBe("2020-01-01");
  });

  it("empty history prunes to empty history", () => {
    expect(pruneHistory(emptyHistory(), TODAY)).toEqual(emptyHistory());
  });
});
