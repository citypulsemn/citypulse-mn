import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Places P5 — "Been there". The behavior is client-interactive (no React
 * render env here), so these tripwires pin the load-bearing wiring: one
 * shared fetch per page, a broadcast only after the write confirms, zero
 * renders nothing, the nudge obeys the no-dark-patterns stance, and the
 * surfaces actually mount the pieces.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("useVisited — one fetch per page, live on every toggle", () => {
  const src = read("components/useVisited.ts");
  it("is a shared external store (not per-component fetches)", () => {
    expect(src).toContain("useSyncExternalStore");
    expect(src).toContain('fetch("/api/visited")');
    expect((src.match(/fetch\(/g) ?? []).length).toBe(1);
  });
  it("is null on the server so static pages render identically for everyone", () => {
    expect(src).toContain("const getServerSnapshot = () => null");
  });
  it("applies the confirmed state from the broadcast", () => {
    expect(src).toContain('export const VISIT_EVENT = "citypulse:visit"');
    expect(src).toContain("window.addEventListener(VISIT_EVENT, onVisit)");
  });
});

describe("VisitButton — optimistic, broadcasts AFTER the write confirms", () => {
  const src = read("components/VisitButton.tsx");
  it("broadcasts the confirmed state, not the optimistic one", () => {
    expect(src).toContain("const confirmed = await toggleVisitAction(slug)");
    expect(src).toContain("new CustomEvent(VISIT_EVENT");
    expect(src.indexOf("await toggleVisitAction")).toBeLessThan(src.indexOf("new CustomEvent(VISIT_EVENT"));
  });
  it("is a pressed button (accessible), with a compact variant for rows", () => {
    expect(src).toContain("aria-pressed={visited}");
    expect(src).toContain('variant?: "default" | "compact"');
  });
  it("takes its copy from lib/editorial (Taren's word wins)", () => {
    expect(src).toContain("PLACE_VISIT_COPY");
  });
});

describe("PlaceProgress — nothing at zero", () => {
  const src = read("components/PlaceProgress.tsx");
  it("renders null until hydrated and null at zero", () => {
    expect(src).toContain("if (!visited) return null");
    expect(src).toContain("if (!line) return null");
    expect(src).toContain('role="status"');
  });
});

describe("FirstVisitNudge — one-time, dismissible, no dark pattern", () => {
  const src = read("components/FirstVisitNudge.tsx");
  it("appears only on a check (never an uncheck), has its own dismissal, is a strip", () => {
    expect(src).toContain("if (detail?.visited) setShow(true)");
    expect(src).toContain('DISMISSED_KEY = "cp_visitnudge_dismissed"');
    expect(src).toContain("localStorage.getItem(DISMISSED_KEY)");
    expect(src).toContain("localStorage.setItem(DISMISSED_KEY");
    expect(src).toContain('role="status"');
    expect(src).not.toContain('role="dialog"');
  });
  it("is mounted globally, next to the save nudge", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("<FirstSaveNudge />");
    expect(layout).toContain("<FirstVisitNudge />");
  });
});

describe("the surfaces mount the pieces", () => {
  it("kind page: progress line under the header; list rows get the check", () => {
    expect(read("app/places/[kind]/page.tsx")).toContain("<PlaceProgress kind={k} />");
    expect(read("components/PlacesBrowser.tsx")).toContain("useVisited()");
    expect(read("components/PlacesList.tsx")).toContain('<VisitButton slug={p.slug} kind={p.kind} variant="compact" />');
  });
  it("detail page: the check sits in the header line", () => {
    expect(read("app/places/[kind]/[slug]/page.tsx")).toContain("<VisitButton slug={place.slug} kind={k} />");
  });
  it("/saved: the places section, and the keep-list form offered for check-offs too", () => {
    const saved = read("app/saved/page.tsx");
    expect(saved).toContain("<VisitedPlaces groups={visitedGroups} />");
    expect(saved).toContain("events.length > 0 || visitedSlugs.length > 0");
  });
  it("the header ♥ count stays events-only (one badge is enough)", () => {
    expect(read("components/SavedLink.tsx")).not.toContain("VISIT_EVENT");
    expect(read("components/SavedLink.tsx")).not.toContain("/api/visited");
  });
  it("/api/visited is never cached and reads nothing without a cookie", () => {
    const route = read("app/api/visited/route.ts");
    expect(route).toContain('"cache-control": "no-store"');
    expect(route).toContain("token ? await getVisitedSlugsSafe(token) : []");
  });
  it("the visits read is wrapped on /saved and the route (rule 1: never-break)", () => {
    // Observed 3 Sep 2026: with the table not yet applied, /saved 500'd on the
    // visits query. The saved list must render without the check-offs.
    expect(read("app/saved/page.tsx")).toContain("getVisitedSlugsSafe(token)");
    expect(read("app/saved/page.tsx")).not.toMatch(/\bgetVisitedSlugs\(/);
    expect(read("lib/place-visits.ts")).toContain("export async function getVisitedSlugsSafe");
  });
});
