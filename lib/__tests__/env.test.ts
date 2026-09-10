import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { envValue, envOr, envRequired } from "../env";

const ROOT = join(__dirname, "..", "..");
const touched: string[] = [];
const set = (k: string, v: string | undefined) => {
  touched.push(k);
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
};
afterEach(() => {
  for (const k of touched) delete process.env[k];
  touched.length = 0;
});

describe("envValue — blank counts as absent", () => {
  it("falls through an EMPTY STRING to the next name", () => {
    // This is the whole point. GitHub Actions sets an unset secret to "", and
    // `??` treats "" as a real value — which is why the 9 Sep verdict email
    // never sent even though OPS_DIGEST_TO was configured.
    set("CP_A", "");
    set("CP_B", "ops@example.com");
    expect(envValue("CP_A", "CP_B")).toBe("ops@example.com");
    expect(process.env.CP_A ?? process.env.CP_B).toBe(""); // the old behaviour
  });

  it("falls through whitespace too", () => {
    set("CP_A", "   ");
    set("CP_B", "ops@example.com");
    expect(envValue("CP_A", "CP_B")).toBe("ops@example.com");
  });

  it("falls through an unset variable", () => {
    set("CP_A", undefined);
    set("CP_B", "ops@example.com");
    expect(envValue("CP_A", "CP_B")).toBe("ops@example.com");
  });

  it("prefers the first non-blank name", () => {
    set("CP_A", "first@example.com");
    set("CP_B", "second@example.com");
    expect(envValue("CP_A", "CP_B")).toBe("first@example.com");
  });

  it("trims, so a stray newline from a pasted secret doesn't travel", () => {
    set("CP_A", " ops@example.com\n");
    expect(envValue("CP_A")).toBe("ops@example.com");
  });

  it("returns undefined when everything is blank", () => {
    set("CP_A", "");
    set("CP_B", "  ");
    expect(envValue("CP_A", "CP_B")).toBeUndefined();
    expect(envValue()).toBeUndefined();
  });
});

describe("envOr / envRequired", () => {
  it("envOr uses the default only when every name is blank", () => {
    set("CP_A", "");
    expect(envOr("fallback", "CP_A")).toBe("fallback");
    set("CP_A", "real");
    expect(envOr("fallback", "CP_A")).toBe("real");
  });

  it("envRequired throws and names what it tried", () => {
    set("CP_A", "");
    expect(() => envRequired("CP_A", "CP_B")).toThrow(/CP_A, CP_B/);
    // The message must explain the empty-string trap, or the next person
    // debugging this loses the same afternoon.
    expect(() => envRequired("CP_A")).toThrow(/empty string/);
  });
});

describe("no `?? process.env` fallbacks survive", () => {
  it("nothing chains env vars with ?? any more", () => {
    // `A ?? B` silently resolves to "" under CI. Every one of these was a
    // delivery channel that could fail while its job reported success.
    const files = [
      "lib/report-verdict-email.ts",
      "lib/notify-send.ts",
      "lib/report-token.ts",
      "lib/geocode.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, `${f} still chains env vars with ??`).not.toMatch(
        /process\.env\.[A-Z_0-9]+\s*\?\?\s*process\.env\./,
      );
    }
  });
});
