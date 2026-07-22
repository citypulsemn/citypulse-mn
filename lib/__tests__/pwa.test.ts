import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import manifest from "../../app/manifest";

const ROOT = join(__dirname, "..", "..");
const pub = (f: string) => join(ROOT, "public", f);

describe("web app manifest", () => {
  const m = manifest();

  it("carries the installability essentials", () => {
    expect(m.name).toContain("City Pulse");
    expect(m.short_name).toBe("City Pulse");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("matches the site chrome so the splash screen doesn't flash a foreign colour", () => {
    expect(m.theme_color).toBe("#0e1830"); // === viewport.themeColor in app/layout
    expect(m.background_color).toBe("#0e1830");
  });

  it("declares 192 + 512 'any' icons AND a maskable one (Android crops to a circle)", () => {
    const icons = m.icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("every declared icon actually exists on disk and is a real PNG", () => {
    for (const icon of manifest().icons ?? []) {
      const file = pub(String(icon.src).replace(/^\//, ""));
      expect(existsSync(file), `${icon.src} exists`).toBe(true);
      expect(statSync(file).size, `${icon.src} non-empty`).toBeGreaterThan(500);
      // PNG magic number — catches a truncated or mis-generated asset.
      expect(readFileSync(file).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
  });

  it("ships the iOS home-screen icon and the SVG favicon too", () => {
    expect(existsSync(pub("apple-touch-icon.png"))).toBe(true);
    expect(existsSync(pub("icon.svg"))).toBe(true);
  });

  it("shortcuts point at real surfaces", () => {
    const urls = (m.shortcuts ?? []).map((s) => s.url);
    expect(urls).toEqual(["/this-weekend", "/ongoing"]);
    for (const u of urls) {
      expect(existsSync(join(ROOT, "app", u.slice(1), "page.tsx")), `${u} page exists`).toBe(true);
    }
  });
});

/**
 * THE SAFETY TRIPWIRES. A service worker that caches HTML would serve stale
 * event data — a moved start time, a cancelled show — which is the one thing
 * this project refuses to do. These assertions are deliberately dumb: they pin
 * the strategy in the source so it cannot regress quietly.
 */
describe("service worker — never serves a stale event", () => {
  const sw = readFileSync(pub("sw.js"), "utf8");

  it("cache-first applies ONLY to content-hashed build output", () => {
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
  });

  it("navigations are network-first with an offline fallback — and are never cached", () => {
    expect(sw).toContain('req.mode === "navigate"');
    expect(sw).toContain("caches.match(OFFLINE_URL)");
    // the navigate branch must not write to the cache
    const navBranch = sw.slice(sw.indexOf('req.mode === "navigate"'));
    expect(navBranch).not.toContain("cache.put");
  });

  it("only GET is intercepted, so the analytics beacon (POST) always flies", () => {
    expect(sw).toContain('req.method !== "GET"');
  });

  it("third-party requests are left alone", () => {
    expect(sw).toContain("url.origin !== self.location.origin");
  });

  it("the cache is versioned and old versions are purged on activate", () => {
    expect(sw).toMatch(/const VERSION = "v\d+"/);
    expect(sw).toContain("caches.delete");
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
  });

  it("precaches the offline page, which exists and is noindex", () => {
    expect(sw).toContain('const OFFLINE_URL = "/offline"');
    const page = readFileSync(join(ROOT, "app", "offline", "page.tsx"), "utf8");
    expect(page).toContain("index: false");
  });
});

describe("service worker registration", () => {
  const src = readFileSync(join(ROOT, "components", "ServiceWorkerRegistration.tsx"), "utf8");

  it("registers in production only (a worker in dev fights HMR)", () => {
    expect(src).toContain('process.env.NODE_ENV !== "production"');
  });

  it("never breaks the page: failures are swallowed", () => {
    expect(src).toContain(".catch(() => {})");
  });

  it("is mounted in the root layout", () => {
    const layout = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("<ServiceWorkerRegistration />");
  });

  it("sw.js is served no-cache so a fix (or the kill-switch) reaches browsers", () => {
    const cfg = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(cfg).toContain('source: "/sw.js"');
    expect(cfg).toContain("no-cache");
  });
});
