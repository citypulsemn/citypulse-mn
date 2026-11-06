import { describe, it, expect } from "vitest";
import { flagProblem } from "../cli-flags";

const check = (argv: string[], env: Record<string, string> = {}) =>
  flagProblem(["node", "script", ...argv], env, "pipeline", ["from", "emit-queue"], ["dry-run"]);

describe("flagProblem — a lost flag must not become a paid run", () => {
  it("passes a clean run, and a run with no flags at all", () => {
    expect(check([])).toBeNull();
    expect(check(["--from=q", "--dry-run"])).toBeNull();
    expect(check(["--emit-queue=q.json"], { npm_config_emit_queue: "q.json" })).toBeNull();
  });

  it("catches npm swallowing a value flag, and names the fix", () => {
    expect(check([], { npm_config_from: "q" })).toMatch(/npm swallowed --from.*npm run pipeline -- --from=\.\.\./);
  });

  it("maps a hyphen to npm's underscore", () => {
    expect(check([], { npm_config_emit_queue: "q" })).toMatch(/npm swallowed --emit-queue/);
  });

  it("catches npm swallowing --dry-run, the likeliest typo of the lot", () => {
    expect(check([], { npm_config_dry_run: "true" })).toMatch(/npm swallowed --dry-run.*-- --dry-run$/);
  });

  it("catches a value written with a space", () => {
    expect(check(["--from", "q"])).toMatch(/without a value/);
  });

  it("refuses a misspelled flag, which would otherwise spend or really write", () => {
    expect(check(["--form=q"])).toMatch(/--form=q is not a flag/);
    expect(check(["--from=q", "--dryrun"])).toMatch(/--dryrun is not a flag/);
    expect(check(["--emit_queue=q"])).toMatch(/not a flag/);
  });

  it("ignores anything that is not a flag", () => {
    expect(check(["stray"])).toBeNull();
  });

  it("catches an empty value", () => {
    expect(check(["--from="])).toMatch(/given no value/);
    expect(check(["--from=  "])).toMatch(/given no value/);
  });
});
