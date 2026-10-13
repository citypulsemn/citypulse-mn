import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { cardDirFor, cardPreviewRoot, dayDirFor, reelsOutRoot } from "../paths";

const ROOT = path.join("X:", "reels-out");
const ENV: NodeJS.ProcessEnv = { NODE_ENV: "test", REELS_OUT_DIR: ROOT };
const NO_ENV: NodeJS.ProcessEnv = { NODE_ENV: "test" };

describe("reels output paths", () => {
  it("reel day folders: <root>/<windowStart>_<day>", () => {
    expect(dayDirFor("2026-08-29", "friday", ENV)).toBe(path.join(ROOT, "2026-08-29_friday"));
  });

  it("the root falls back to Documents/CityPulseMN/Reels/auto without REELS_OUT_DIR", () => {
    expect(reelsOutRoot(NO_ENV)).toBe(
      path.join(os.homedir(), "Documents", "CityPulseMN", "Reels", "auto"),
    );
  });
});

describe("still card paths", () => {
  it("cardDirFor: <root>/<postDate>_card", () => {
    expect(cardDirFor("2026-10-07", ENV)).toBe(path.join(ROOT, "2026-10-07_card"));
  });

  it("cardDirFor follows the same root fallback as the reels", () => {
    expect(cardDirFor("2026-10-07", NO_ENV)).toBe(
      path.join(reelsOutRoot(NO_ENV), "2026-10-07_card"),
    );
  });

  it("cardPreviewRoot: <root>/_card-previews", () => {
    expect(cardPreviewRoot(ENV)).toBe(path.join(ROOT, "_card-previews"));
  });

  it("a preview folder can never be mistaken for a dated card or reel folder", () => {
    expect(path.basename(cardPreviewRoot(ENV))).not.toMatch(/^\d{4}-\d{2}-\d{2}_/);
    expect(cardPreviewRoot(ENV)).not.toBe(cardDirFor("2026-10-07", ENV));
  });
});
