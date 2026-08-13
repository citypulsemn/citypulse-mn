import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * F2.7 hybrid — the "every one" OSM bulk layer. Playgrounds and parks are
 * unbounded (thousands), so the registry holds the hand-picked destinations and
 * a zoom-gated gray layer, sourced from OpenStreetMap, shows every community-
 * mapped one. These tripwires pin (1) the generated data files are present and
 * valid GeoJSON inside the metro box, and (2) the map wires the layer up:
 * zoom-gated, below the gold pins, and labeled as OSM.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("OSM bulk data files", () => {
  for (const kind of ["playground", "park"]) {
    it(`public/osm/${kind}.json is a valid FeatureCollection in the metro box`, () => {
      const path = join(ROOT, "public", "osm", `${kind}.json`);
      expect(existsSync(path), `${kind}.json exists`).toBe(true);
      const fc = JSON.parse(readFileSync(path, "utf8"));
      expect(fc.type).toBe("FeatureCollection");
      expect(fc.features.length).toBeGreaterThan(500); // metro has thousands
      // spot-check the first few points land in the metro bounding box
      for (const f of fc.features.slice(0, 25)) {
        const [lng, lat] = f.geometry.coordinates;
        expect(lat).toBeGreaterThan(44.5);
        expect(lat).toBeLessThan(45.4);
        expect(lng).toBeGreaterThan(-94.0);
        expect(lng).toBeLessThan(-92.6);
      }
    });
  }
});

describe("OSM layer wiring", () => {
  const cmp = read("components/PlacesMapInteractive.tsx");

  it("only playgrounds and parks get a bulk layer", () => {
    expect(cmp).toContain("OSM_KINDS");
    expect(cmp).toMatch(/playground:\s*\{/);
    expect(cmp).toMatch(/park:\s*\{/);
  });

  it("the layer is zoom-gated and rendered below the gold pins", () => {
    expect(cmp).toContain('"osm-points"');
    expect(cmp).toContain("minzoom: 11");
    expect(cmp).toContain('"clusters"'); // beforeId: OSM under the curated layers
    expect(cmp).toContain("fetch(`/osm/${kind}.json`)"); // runtime, not bundled
  });

  it("is honestly labeled as OpenStreetMap community data", () => {
    expect(cmp).toContain("openstreetmap.org");
    expect(cmp).toContain("Community-mapped");
  });

  it("the generator script exists", () => {
    expect(existsSync(join(ROOT, "scripts", "build-osm-places.ts"))).toBe(true);
  });
});
