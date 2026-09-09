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

  it("NEVER fetches /api/saved itself — it reads the shared store", () => {
    // 9 Sep 2026 incident: one fetch per button meant a 30-card listing page
    // fired 30 concurrent force-dynamic lambdas, each taking a Postgres
    // connection, and 17% of /api/saved returned 500s (EMAXCONN). A fetch
    // reappearing in this component is that outage coming back.
    expect(src).not.toContain('fetch("/api/saved")');
    expect(src).toContain("useSaved()");
    expect(src).toContain("applySave(eventId, confirmed)");
  });
});

describe("useSaved — one fetch per page, not one per button", () => {
  const src = read("components/useSaved.ts");
  it("loads once and shares the result", () => {
    expect(src).toContain('fetch("/api/saved")');
    expect(src).toContain("if (loading || typeof window === \"undefined\") return;");
    expect(src).toContain("if (snapshot === null) load();");
  });
  it("applies a toggle in place rather than re-fetching", () => {
    expect(src).toContain("export function applySave");
    // The mutator must not trigger another round trip.
    const mutator = src.slice(src.indexOf("export function applySave"));
    expect(mutator.slice(0, mutator.indexOf("}"))).not.toContain("fetch(");
  });
  it("renders nothing visitor-specific on the server", () => {
    expect(src).toContain("const getServerSnapshot = () => null");
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
  it("stays live off the shared store, without a fetch of its own", () => {
    // Was: its own fetch("/api/saved") plus a re-fetch on every SAVE_EVENT.
    // That was a second copy of the same request on every page and one more
    // per toggle. applySave() keeps the store current, so reading it is live.
    expect(src).toContain("useSaved()?.size");
    expect(src).not.toContain('fetch("/api/saved")');
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
