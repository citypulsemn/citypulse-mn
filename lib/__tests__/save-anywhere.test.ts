import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UX3 — save from anywhere. The behavior is client-interactive (no React render
 * env here), so these tripwires pin the load-bearing wiring: cards carry a
 * suppressible save overlay, saves broadcast a live event, the header count is
 * honest-empty, and the first-save nudge obeys the no-dark-patterns stance.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("SaveButton — compact variant + live broadcast", () => {
  const src = read("components/SaveButton.tsx");
  it("has an icon-only compact variant for card overlays", () => {
    expect(src).toContain('variant?: "default" | "compact"');
    expect(src).toContain("savebtn-compact");
  });
  it("broadcasts a save event AFTER the write confirms (listeners re-read truth)", () => {
    expect(src).toContain('export const SAVE_EVENT = "citypulse:save"');
    expect(src).toContain("const confirmed = await toggleSaveAction");
    expect(src).toContain("new CustomEvent(SAVE_EVENT");
  });
});

describe("EventDayCard — save while browsing", () => {
  const src = read("components/EventDayCard.tsx");
  it("renders a compact SaveButton as a SIBLING of the anchor (not nested)", () => {
    expect(src).toContain('<SaveButton eventId={event.id} variant="compact" />');
    expect(src).toContain('className="daycard-wrap"');
    // the anchor JSX itself must not contain the button (invalid + hijacks tap)
    const anchor = src.slice(src.indexOf('<a className="daycard"'), src.indexOf("</a>"));
    expect(anchor).not.toContain("SaveButton");
  });
  it("save overlay is suppressible where a dedicated remove exists (/saved)", () => {
    expect(src).toContain("showSave = true");
    expect(read("components/SavedList.tsx")).toContain("showSave={false}");
  });
});

describe("SavedLink — the live, honest-empty count", () => {
  const src = read("components/SavedLink.tsx");
  it("re-reads on every save broadcast so the count stays live", () => {
    expect(src).toContain("SAVE_EVENT, load");
  });
  it("renders NOTHING at zero (no dangling badge)", () => {
    expect(src).toContain("if (!count) return null");
  });
  it("is mounted in the homepage topbar", () => {
    expect(read("components/EventsExplorer.tsx")).toContain("<SavedLink />");
  });
});

describe("FirstSaveNudge — one-time, dismissible, no dark pattern", () => {
  const src = read("components/FirstSaveNudge.tsx");
  it("appears only on a real save, is dismissible, and never returns once dismissed", () => {
    expect(src).toContain("if (detail?.saved) setShow(true)"); // save, not unsave
    expect(src).toContain('DISMISSED_KEY = "cp_savenudge_dismissed"');
    expect(src).toContain("localStorage.getItem(DISMISSED_KEY)");
    expect(src).toContain("localStorage.setItem(DISMISSED_KEY");
    // a status strip, never a modal/dialog (no dark pattern)
    expect(src).toContain('role="status"');
    expect(src).not.toContain('role="dialog"');
  });
  it("is mounted globally so a save from any page is caught", () => {
    expect(read("app/layout.tsx")).toContain("<FirstSaveNudge />");
  });
});

describe("restore hint on the empty /saved state", () => {
  it("tells a cleared-cookie visitor how to bring their list back", () => {
    expect(read("components/SavedList.tsx")).toContain("keep-list link before");
  });
});
