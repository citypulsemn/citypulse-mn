import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UX7 — accessibility & touch targets. These are DOM/CSS behaviors the node
 * test env can't render, so the tripwires pin the load-bearing wiring: the
 * modals actually behave modally, the map isn't a keyboard dead-end, the core
 * controls meet the 44px touch minimum, and the failed-contrast label is fixed.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("modal a11y hook", () => {
  const src = read("components/useModalA11y.ts");
  it("moves focus in, traps Tab, restores focus, locks scroll, inerts the background", () => {
    expect(src).toContain("focusable()[0] ?? dialog).focus()"); // focus in
    expect(src).toContain('e.key !== "Tab"'); // trap
    expect(src).toContain("last.focus()");
    expect(src).toContain("first.focus()");
    expect(src).toContain("previouslyFocused?.focus?.()"); // restore
    expect(src).toContain('document.body.style.overflow = "hidden"'); // scroll lock
    expect(src).toContain('wrap?.setAttribute("inert", "")'); // inert background
    expect(src).toContain('wrap?.removeAttribute("inert")'); // ...cleaned up
  });
});

describe("both overlays are actually modal", () => {
  it("DayPanel uses the hook and has an accessible name", () => {
    const src = read("components/DayPanel.tsx");
    expect(src).toContain("useModalA11y");
    expect(src).toContain('aria-labelledby="daypanel-heading"');
    expect(src).toContain('id="daypanel-heading"');
  });
  it("EventDetail uses the hook (and already names itself by title)", () => {
    const src = read("components/EventDetail.tsx");
    expect(src).toContain("useModalA11y");
    expect(src).toContain("aria-label={event.title}");
  });
});

describe("map markers are keyboard-accessible", () => {
  const src = read("components/MapView.tsx");
  it("markers are named buttons, focusable, and open on Enter/Space", () => {
    expect(src).toContain('el.setAttribute("role", "button")');
    expect(src).toContain('el.setAttribute("tabindex", "0")');
    expect(src).toContain("aria-label");
    expect(src).toContain('e.key === "Enter" || e.key === " "');
    expect(src).toContain("marker.togglePopup()");
  });
});

describe("touch targets meet the 44px minimum", () => {
  const css = read("app/globals.css");
  it("the modal close button is 44×44 (was 30×30)", () => {
    expect(css).toMatch(/\.closebtn \{[^}]*width: 44px; height: 44px/);
  });
  it("presets, chips, view toggle, filter pills carry a 44px min-height", () => {
    for (const sel of [".preset", ".chip", ".viewtoggle button", ".filter-pill", ".filter-toggle"]) {
      const rule = css.slice(css.indexOf(`${sel} {`), css.indexOf("}", css.indexOf(`${sel} {`)));
      expect(rule, `${sel} min-height`).toContain("min-height: 44px");
    }
  });
  it("the month arrows are 44×44 and the search-clear is a real tap target", () => {
    expect(css).toContain("width: 44px; height: 44px"); // monthnav
    expect(css).toMatch(/\.search-clear \{[^}]*width: 40px; height: 40px/);
  });
  it("the map marker gets a visible focus ring", () => {
    expect(css).toContain(".cp-marker:focus-visible");
  });
});

describe("contrast fix", () => {
  it("--gold-dim meets AA (no longer #8c7544)", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--gold-dim: #b89a5e");
    expect(css).not.toContain("--gold-dim: #8c7544");
  });
});
