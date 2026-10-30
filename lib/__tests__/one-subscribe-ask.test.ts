import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ONE SUBSCRIBE ASK PER PAGE (Oct 2026).
 *
 * The house rule (docs/ROADMAP-MONETIZATION.md, "No dark patterns") is one
 * subscribe band per page. SiteFooter carried its own form too, so every page
 * with a SubscribeBand was asking twice. A page that renders a band must tell
 * the footer — `subscribe={false}`, or a condition when the band is conditional.
 */
const APP = join(__dirname, "..", "..", "app");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pages(p);
    return name === "page.tsx" ? [p] : [];
  });
}

describe("a page with a SubscribeBand does not also get the footer form", () => {
  const withBand = pages(APP).filter((p) => readFileSync(p, "utf8").includes("<SubscribeBand"));

  it("finds the band pages (guard against the scan silently matching nothing)", () => {
    expect(withBand.length).toBeGreaterThanOrEqual(7);
  });

  it.each(withBand.map((p) => [p.slice(APP.length + 1)]))("%s", (rel) => {
    const src = readFileSync(join(APP, rel), "utf8");
    expect(src).toMatch(/<SiteFooter[^>]*\bsubscribe=\{/);
  });
});
