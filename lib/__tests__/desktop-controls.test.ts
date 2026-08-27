import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * DESKTOP CONTROL ROWS (Aug 2026).
 *
 * The control stack was 322px tall at every width — a fixed column of four rows
 * — so the first event card sat at 523px. One card above the fold on a 1152x648
 * window, three on a 1366x768 laptop.
 *
 * It was never a shortage of space. Two of those rows were nearly empty: the
 * Filters disclosure used 81px of a 1200px row, the location picker 202px. They
 * were stacked vertically while 400-1100px sat idle beside them.
 *
 * Guarded because the failure is silent: someone merging these media queries
 * back into one, or dropping the shell wrapper, restores a four-row stack that
 * still looks fine in a screenshot of the top of the page.
 */
const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const explorer = readFileSync(join(ROOT, "components/EventsExplorer.tsx"), "utf8").replace(/\r\n/g, "\n");

/**
 * The `@media (min-width: N)` block that actually contains `.controls-shell`.
 *
 * globals.css has THREE `min-width: 1000px` blocks; matching the first one just
 * tests unrelated rules and passes or fails for the wrong reason.
 */
function mediaBlock(minWidth: number): string {
  const needle = `@media (min-width: ${minWidth}px)`;
  for (let start = css.indexOf(needle); start !== -1; start = css.indexOf(needle, start + 1)) {
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        const block = css.slice(start, i + 1);
        if (block.includes(".controls-shell")) return block;
        break;
      }
    }
  }
  return "";
}

describe("desktop control rows", () => {
  const wide = mediaBlock(1240);
  const mid = mediaBlock(1000);

  it("the shell wrapper exists in the markup", () => {
    // Without it the drawer's children cannot share rows with the search box.
    expect(explorer).toMatch(/className="controls-shell"/);
  });

  it("lifts the drawer's children into the grid on desktop", () => {
    expect(mid).toMatch(/\.controls-drawer\s*\{\s*display:\s*contents/);
  });

  it("puts search and the date controls on ONE row at >= 1240px", () => {
    expect(wide).toMatch(/\.controls-shell \.searchrow \{[^}]*grid-row: 1/);
    expect(wide).toMatch(/\.controls-shell \.controls \{[^}]*grid-row: 1/);
  });

  it("puts categories, Filters and location on the SECOND row at >= 1240px", () => {
    for (const sel of ["chips", "filterpanel", "locctl"]) {
      expect(wide, `${sel} should be on row 2`).toMatch(
        new RegExp(`\\.controls-shell \\.${sel} \\{[^}]*grid-row: 2`),
      );
    }
  });

  it("falls back to three unwrapped rows below 1240px", () => {
    // Forcing two rows narrower makes BOTH wrap to two lines — 246px, worse
    // than three unwrapped rows at 187px. A row that wraps costs more height
    // than the row it saved.
    expect(mid).toMatch(/\.controls-shell \.controls \{[^}]*grid-row: 2/);
    expect(mid).toMatch(/\.controls-shell \.chips \{[^}]*grid-row: 3/);
  });

  it("NEVER hides a control on desktop", () => {
    // The phone collapses controls behind a button because it has no room.
    // Desktop has the room, and putting the category chips — the main way
    // anyone browses this site — behind a click would be a regression.
    for (const block of [mid, wide]) {
      expect(block).not.toMatch(/\.(chips|controls|filterpanel|locctl)[^{]*\{[^}]*display:\s*none/);
    }
    expect(css).toMatch(/\.controls-toggle \{ display: none; \}/); // toggle is mobile-only
  });

  it("keeps the divider that the chips row used to carry", () => {
    // .chips loses its border in the grid (it no longer spans the full width),
    // so the shell must take it over or the control block loses its bottom rule.
    expect(mid).toMatch(/\.controls-shell \{[^}]*border-bottom: 1px solid/);
    expect(mid).toMatch(/\.controls-shell \.chips \{[^}]*border-bottom: 0/);
  });

  it("leaves the phone's drawer alone", () => {
    // The 560px block is the compact-bar work; this change must not touch it.
    expect(css).toMatch(/@media \(max-width: 560px\)/);
    expect(explorer).toMatch(/aria-controls="controls-drawer"/);
    expect(explorer).toMatch(/id="controls-drawer"/);
  });
});
