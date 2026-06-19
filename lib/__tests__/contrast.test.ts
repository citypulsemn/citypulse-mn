import { describe, it, expect } from "vitest";
import { contrastRatio } from "../contrast";
import { CATEGORY_KEYS, categoryColor } from "../categories";

// Must match app/globals.css.
const POPUP_BG = "#0e1830"; // --navy-900 (popup background)
const META = "#d7d1c3"; // --pop-meta
const TITLE = "#f1ece0"; // --cream
const BTN_BG = "#c9a961"; // --gold
const BTN_TEXT = "#0e1830"; // --navy-900

const AA = 4.5; // WCAG AA for normal text

describe("map popup contrast (WCAG AA ≥ 4.5:1)", () => {
  it("title text is legible on the popup background", () => {
    expect(contrastRatio(TITLE, POPUP_BG)).toBeGreaterThanOrEqual(AA);
  });

  it("meta text (venue/time/price) is legible on the popup background", () => {
    expect(contrastRatio(META, POPUP_BG)).toBeGreaterThanOrEqual(AA);
  });

  it("every category label color is legible on the popup background", () => {
    for (const key of CATEGORY_KEYS) {
      const ratio = contrastRatio(categoryColor(key), POPUP_BG);
      expect(ratio, `${key} label`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("the action button text is legible on its gold background", () => {
    expect(contrastRatio(BTN_TEXT, BTN_BG)).toBeGreaterThanOrEqual(AA);
  });
});
