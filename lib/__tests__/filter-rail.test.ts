import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE LEFT FILTER RAIL (Aug 2026).
 *
 * At 1800px+ the controls move into a 240px column and the event list starts at
 * the TOP of the page instead of below 133px of chrome. Filters stay on screen
 * while you scroll a 24,000px list.
 *
 * The rail appears at 1800 and NOT SOONER because it is only free if the list
 * keeps its four columns. That arithmetic is tight and is asserted below —
 * getting it wrong is silent: the grid just renders one column fewer.
 */
const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const explorer = readFileSync(join(ROOT, "components/EventsExplorer.tsx"), "utf8").replace(/\r\n/g, "\n");

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

const rail = mediaBlock(1800, ".explorer-layout");

describe("the filter rail", () => {
  it("has its hook on the explorer's main element", () => {
    expect(explorer).toMatch(/className="wrap explorer-layout"/);
  });

  it("is a two-column grid with the rail on the left", () => {
    expect(rail).not.toBe("");
    expect(rail).toMatch(/grid-template-columns: 240px minmax\(0, 1fr\)/);
    expect(rail).toMatch(/\.explorer-layout > \.controls-shell \{[\s\S]*?grid-column: 1/);
  });

  it("sends every other child to column 2, so a new view mode needs no rule", () => {
    expect(rail).toMatch(/\.explorer-layout > \* \{ grid-column: 2/);
  });

  it("zeroes inline margins on the grid children", () => {
    // `.list-view` carries `margin: 8px auto 0`, and AUTO MARGINS MAKE A GRID
    // ITEM SHRINK-TO-FIT rather than stretch. It collapsed to 887px inside a
    // 1424px column and the card grid fell from four columns to two.
    expect(rail).toMatch(/\.explorer-layout > \* \{[^}]*margin-inline: 0/);
  });

  it("stretches the rail's controls instead of centring them", () => {
    // `align-items: center` is inherited from the two-row block; under it every
    // control sizes to its own content and floats mid-rail.
    expect(rail).toMatch(/\.explorer-layout > \.controls-shell \{[\s\S]*?align-items: stretch/);
  });

  it("sticks beneath the measured topbar, and can scroll itself if it ever grows", () => {
    expect(rail).toMatch(/position: sticky/);
    expect(rail).toMatch(/top: calc\(var\(--topbar-h/);
    expect(rail).toMatch(/max-height: calc\(100vh - var\(--topbar-h/);
    expect(rail).toMatch(/overflow-y: auto/);
    // --topbar-h is measured, not hardcoded.
    expect(explorer).toMatch(/setProperty\(\s*"--topbar-h"/);
  });

  it("frees the month label, which alone is wider than the rail", () => {
    // .monthnav .label reserves clamp(150px, 16vw, 190px); at this viewport that
    // is 190, plus two 44px buttons and two 10px gaps = a 298px minimum.
    expect(rail).toMatch(/\.explorer-layout \.monthnav \.label \{[^}]*min-width: 0/);
  });
});

describe("the rail appears only where it is free", () => {
  it("needs the 1760px wrap tier to exist", () => {
    expect(mediaBlock(1800, ".wrap")).toMatch(/\.wrap \{ max-width: 1760px; \}/);
  });

  it("leaves room for four card columns, including .day-list's own padding", () => {
    // 4x330 + 3x26 = 1398 of grid; .day-list adds 16px each side; then the rail
    // and gutter; then .wrap's 20px each side. Off-by-32 here silently renders
    // three columns — which is exactly what a 264px rail did.
    const wrapCap = 1760;
    const railW = Number(rail.match(/grid-template-columns: (\d+)px/)?.[1]);
    const gutter = Number(rail.match(/column-gap: (\d+)px/)?.[1]);
    expect(railW).toBe(240);
    expect(gutter).toBe(32);

    const content = wrapCap - 40;              // .wrap padding
    const listColumn = content - railW - gutter;
    const grid = listColumn - 32;              // .day-list padding
    const columns = Math.floor((grid + 26) / (330 + 26));
    expect(columns).toBe(4);
  });

  it("does not exist below 1800, where it would cost a column", () => {
    // At the 1600 tier the same rail drops the list to three columns — a worse
    // page than the two-row control block it would replace.
    expect(mediaBlock(1500, ".explorer-layout")).toBe("");
    expect(mediaBlock(1240, ".explorer-layout")).toBe("");
  });
});
