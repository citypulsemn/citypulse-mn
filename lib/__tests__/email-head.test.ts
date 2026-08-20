import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EMAIL_HEAD } from "../email-head";

const ROOT = join(__dirname, "..", "..");
const LIB = join(ROOT, "lib");

/**
 * Gmail's MOBILE apps run a blanket dark-mode inversion on any email that doesn't
 * declare color-scheme support — it never checks whether the email is already
 * dark. Ours are (navy/gold/cream), so Gmail inverted them to pale lavender cards
 * with muddy olive gold. Desktop Gmail doesn't do this, which is exactly why it
 * went unnoticed. Confirmed from a real phone screenshot, Aug 2026.
 */
describe("every HTML email opts out of Gmail's dark-mode inversion", () => {
  it("the shared head declares color-scheme three ways (clients read different ones)", () => {
    expect(EMAIL_HEAD).toContain('<meta name="color-scheme" content="dark light">');
    expect(EMAIL_HEAD).toContain('<meta name="supported-color-schemes" content="dark light">');
    // Gmail wants the embedded style, not just the meta.
    expect(EMAIL_HEAD).toContain("<style>:root{color-scheme:dark light;");
    expect(EMAIL_HEAD).toContain('<meta charset="utf-8">'); // still a valid head
  });

  it("NO email hand-rolls its own <head> — they all use the shared one", () => {
    // The five were all broken identically because each built its own. A new
    // email that hand-rolls a head would silently reintroduce the bug.
    const senders = readdirSync(LIB)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => readFileSync(join(LIB, f), "utf8").includes("<!doctype html>"));

    expect(senders.length).toBeGreaterThanOrEqual(5); // digest, ops, confirm, saved, notify

    for (const f of senders) {
      const src = readFileSync(join(LIB, f), "utf8");
      expect(src, `${f} uses the shared head`).toContain("<head>${EMAIL_HEAD}</head>");
      expect(src, `${f} imports it`).toContain("email-head");
      // …and no leftover bespoke head.
      expect(src, `${f} has no hand-rolled charset head`).not.toContain(
        '<head><meta charset="utf-8"><meta name="viewport"',
      );
    }
  });

  it("declares dark FIRST but still supports light (never forces a light client dark)", () => {
    expect(EMAIL_HEAD).toContain("dark light");
    expect(EMAIL_HEAD).not.toContain("content=\"dark\"><");
  });
});
