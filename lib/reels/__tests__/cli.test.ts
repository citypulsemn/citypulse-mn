import { describe, it, expect } from "vitest";
import { strayWords, swallowedFlags, swallowedFlagsMessage } from "../cli";

const FLAGS = ["dry-run", "variant", "force-held", "day-dir"];

describe("swallowedFlags — npm run x --flag without the bare --", () => {
  it("a scheduled run (no flags typed) has nothing to report", () => {
    expect(swallowedFlags(FLAGS, { PATH: "x", npm_config_cache: "c", npm_lifecycle_event: "reels:publish" })).toEqual([]);
    expect(swallowedFlagsMessage("reels:publish", FLAGS, {}, [])).toBeNull();
  });

  it("finds each flag npm kept, hyphens and all", () => {
    // What npm 11 really sets for `npm run reels:publish --dry-run --variant=regular --force-held`.
    const env = { npm_config_dry_run: "true", npm_config_variant: "regular", npm_config_force_held: "true" };
    expect(swallowedFlags(FLAGS, env)).toEqual(["dry-run", "variant", "force-held"]);
  });

  it("ignores npm settings that are not this script's flags", () => {
    expect(swallowedFlags(["date"], { npm_config_dry_run: "true", npm_config_dated: "x" })).toEqual([]);
  });

  it("an empty value still counts: the flag was typed", () => {
    expect(swallowedFlags(["day-dir"], { npm_config_day_dir: "" })).toEqual(["day-dir"]);
  });

  it("says what happened and how to type it", () => {
    expect(swallowedFlagsMessage("cards:publish", ["dry-run", "date"], { npm_config_dry_run: "true" }, [])).toBe(
      'npm kept --dry-run for itself, so "npm run cards:publish" started as if no flags were typed. ' +
        'Nothing was done. Put "--" before the flags: npm run cards:publish -- --dry-run …',
    );
  });
});

describe("strayWords — the other trace npm leaves", () => {
  it("`npm run reels --day=friday` reaches the script as the bare word friday", () => {
    // Measured with npm 11.16.0: no npm_config_day, just a positional.
    expect(strayWords(["friday"])).toEqual(["friday"]);
    expect(swallowedFlagsMessage("reels", ["smoke", "day"], {}, ["friday"])).toBe(
      'npm turned a flag into the bare word "friday", so "npm run reels" started as if no flags were typed. ' +
        'Nothing was done. Put "--" before the flags: npm run reels -- …',
    );
  });

  it("flags typed correctly are not stray", () => {
    expect(strayWords(["--day=friday", "--smoke"])).toEqual([]);
    expect(swallowedFlagsMessage("reels", ["smoke", "day"], {}, ["--day=friday", "--smoke"])).toBeNull();
  });

  it("both traces at once are both named", () => {
    expect(swallowedFlagsMessage("reels", ["smoke", "day"], { npm_config_smoke: "true" }, ["friday"])).toContain(
      'npm kept --smoke for itself and npm turned a flag into the bare word "friday"',
    );
  });
});
