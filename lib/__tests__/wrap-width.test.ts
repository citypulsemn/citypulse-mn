import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE WRAP CAP (Aug 2026).
 *
 * `.wrap` was capped at 1240px at every size, so a 1920px monitor showed 340px
 * of empty navy down each side while the event grid ran three columns. The cap
 * is a READING constraint — prose should not run to 200 characters a line — but
 * the homepage, day pages and places lists are card grids, where it was only
 * costing a column.
 *
 * Raised to 1600 at 1500px+. Laptops are untouched: at 1440 the wrap is still
 * 1240, verified in a browser.
 *
 * The rule this encodes: WIDENING THE PAGE MUST NOT WIDEN A SENTENCE. Most
 * prose already had its own max-width (`.page-intro` 640px, `.place-intro`
 * 643px, `.marquee` 560px on the event page). One did not — the subscribe
 * band's subtitle stretched to 1167px, 115 characters a line — and that is the
 * failure mode a future width bump would repeat.
 */
const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8").replace(/\r\n/g, "\n");

/** The `@media (min-width: N)` block containing `needle`. */
function mediaBlock(minWidth: number, needle: string): string {
  const marker = `@media (min-width: ${minWidth}px)`;
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

describe("the wrap cap", () => {
  it("still defaults to 1240px, so laptops are unchanged", () => {
    expect(css).toMatch(/^\.wrap \{[^}]*max-width: 1240px/m);
  });

  it("widens only on wide screens", () => {
    const block = mediaBlock(1500, ".wrap");
    expect(block, "expected a min-width:1500px block raising .wrap").not.toBe("");
    expect(block).toMatch(/\.wrap \{ max-width: 1600px; \}/);
  });

  it("stays under the width where a card grid would over-stretch", () => {
    // The grid is repeat(auto-fill, minmax(330px, 1fr)) with a 26px gap.
    // 1600 - 40 padding = 1560 of content -> four columns, not five.
    const m = css.match(/@media \(min-width: 1500px\) \{[^}]*max-width: (\d+)px/);
    const cap = Number(m?.[1]);
    expect(cap).toBeGreaterThan(1240);
    expect(cap).toBeLessThanOrEqual(1700);
    const content = cap - 40;
    const columns = Math.floor((content + 26) / (330 + 26));
    expect(columns).toBe(4);
  });
});

describe("widening the page does not widen a sentence", () => {
  /**
   * Each of these is prose that sits inside `.wrap` and would otherwise grow
   * with it. If a new one is added without a measure, this is where it should
   * be caught — a 115-character line is how this was found the first time.
   */
  const constrained: [string, RegExp][] = [
    ["subscribe band subtitle", /\.subscribe-band-sub \{[^}]*max-width: \d+ch/],
    ["footer pitch subtitle", /\.sf-sub \{[^}]*max-width: \d+ch/],
    ["collection tagline", /\.coll-tagline \{[^}]*max-width: \d+ch/],
  ];

  it.each(constrained)("%s has its own measure", (_label, re) => {
    expect(css).toMatch(re);
  });

  it("the event detail card is capped independently of the wrap", () => {
    // .marquee holds the event description; at 560px it never felt the change.
    expect(css).toMatch(/\.marquee \{[\s\S]{0,120}max-width: 560px/);
  });
});
