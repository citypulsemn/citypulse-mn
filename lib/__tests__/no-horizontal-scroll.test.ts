import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * HORIZONTAL PAGE SCROLL ON MOBILE (Aug 2026).
 *
 * Reported from a phone: the whole site could be panned sideways into empty
 * navy. Two independent causes, both in the footer, both the same shape — an
 * element wider than its container with `overflow-x: visible`, so the excess
 * became page scroll:
 *
 *   .site-footer-links   11 links + 10 "·" separators, `flex-wrap` unset, so
 *                        `nowrap`. Needed ~740px on one line. Overflowed at
 *                        ANY width below ~800px, not just on phones.
 *   .sf-pitch /          A flex item stretches to its container but never below
 *   .subscribe-form      its own MIN-CONTENT: 335px inside a 288px column at a
 *                        320px viewport. `min-width: 0` is the release valve.
 *
 * Contrast with `.section-nav`, `.collstrip-row`, `.presets` and `.chips`, which
 * are also wider than the screen but carry `overflow-x: auto` — they own their
 * overflow and scroll inside themselves. That is the distinction this guards.
 */
const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8").replace(/\r\n/g, "\n");

/** The `@media (max-width: N)` block containing `needle`. */
function maxWidthBlock(maxWidth: number, needle: string): string {
  const marker = `@media (max-width: ${maxWidth}px)`;
  for (let start = css.indexOf(marker); start !== -1; start = css.indexOf(marker, start + 1)) {
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        const block = css.slice(start, i + 1);
        if (block.includes(needle)) return block;
        break;
      }
    }
  }
  return "";
}

describe("the footer cannot push the page sideways", () => {
  it("the link row wraps", () => {
    // Not scoped to a media query: it overflowed at 700px too.
    expect(css).toMatch(/\.site-footer-links \{[^}]*flex-wrap: wrap/);
  });

  it("footer flex children can shrink below their min-content", () => {
    const mobile = maxWidthBlock(560, ".site-footer-inner > *");
    expect(mobile, "expected a mobile rule releasing the min-content floor").not.toBe("");
    expect(mobile).toMatch(/\.site-footer-inner > \* \{[^}]*min-width: 0/);
  });

  it("the measures that exceed a small phone get a percentage ceiling", () => {
    // .sf-sub is 42ch (~358px) and .subscribe-form caps at 420px; both are
    // wider than a 320px viewport's 288px content column.
    const mobile = maxWidthBlock(560, ".sf-sub");
    expect(mobile).toMatch(/\.sf-sub, \.subscribe-form \{[^}]*max-width: 100%/);
  });

  it("the email input keeps a floor so the button wraps instead of it collapsing", () => {
    // The input is `flex: 1; min-width: 0`, so without a floor it shrinks to
    // nothing rather than wrapping — it came out 97px next to a 170px button.
    const mobile = maxWidthBlock(560, ".subscribe-row");
    expect(mobile).toMatch(/\.subscribe-row \{[^}]*flex-wrap: wrap/);
    expect(mobile).toMatch(/\.subscribe-row input\[type="email"\] \{[^}]*min-width: 150px/);
  });
});

describe("rows that are meant to be wider than the screen own their overflow", () => {
  /**
   * Each of these is deliberately wider than a phone. They must scroll INSIDE
   * themselves; if one ever loses its `overflow-x`, it becomes page scroll and
   * the whole site pans sideways again.
   */
  const scrollers = [".section-nav", ".collstrip-row", ".presets", ".chips"];

  it.each(scrollers)("%s scrolls itself", (sel) => {
    const escaped = sel.replace(".", "\\.");
    const re = new RegExp(`${escaped}[^{]*\\{[^}]*overflow-x:\\s*(auto|scroll|hidden)`);
    expect(css).toMatch(re);
  });
});
