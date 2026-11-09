import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLACES, placeBySlug, type Place } from "../places";
import {
  AERIAL_LAYER,
  PLAYGROUND_FACTS,
  aerialCropUrl,
  aerialPath,
  beforeYouGo,
  factSources,
  walkMinutes,
  type PlaygroundFacts,
} from "../playground-facts";

const ROOT = join(__dirname, "..", "..");

// A playground at a round test point and splash pads at known distances north
// of it (1 degree of latitude = 111.2 km, so 0.001 deg = 111 m).
const PLAY: Place = {
  slug: "test-playground", name: "Test Playground", kind: "playground",
  lat: 45.0, lng: -93.3, address: "1 Test St", city: "Testville", neighborhood: null,
  season: { type: "year-round" }, cost: "free", tags: [], intro: "x",
  sourceUrl: "https://example.gov/park", verifiedAt: "2026-11-09", venueSlug: null,
};
const pad = (slug: string, dLat: number): Place => ({
  ...PLAY, slug, name: `Pad ${slug}`, kind: "splash-pad", lat: 45.0 + dLat,
  season: { type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" },
});
const SRC = { quotes: ["q"], url: "https://example.gov/park" };
const BASE: PlaygroundFacts = { readOn: "2026-11-09" };
const texts = (f: PlaygroundFacts | null, pads: Place[] = []) => beforeYouGo(PLAY, f, pads).map((l) => l.text);

describe("beforeYouGo — what a parent sees", () => {
  it("no entry, no lines (honest emptiness: the page renders nothing)", () => {
    expect(beforeYouGo(PLAY, null, [pad("near", 0.001)])).toEqual([]);
  });

  it("says each restroom kind plainly when no sentence is written for it", () => {
    expect(texts({ ...BASE, restrooms: { ...SRC, kind: "building" } })).toEqual(["Restroom building"]);
    expect(texts({ ...BASE, restrooms: { ...SRC, kind: "seasonal" } })).toEqual(["Restrooms open part of the year"]);
    expect(texts({ ...BASE, restrooms: { ...SRC, kind: "portable" } })).toEqual(["Portable toilets only"]);
  });

  it("a written restroom line wins over the kind's default", () => {
    const line = "Restrooms in the visitor center, which is open daily 9 AM–5 PM";
    expect(texts({ ...BASE, restrooms: { ...SRC, kind: "building", line } })).toEqual([line]);
  });

  it("says silence out loud — a missing restroom line reads as 'none'", () => {
    expect(texts({ ...BASE, restrooms: { ...SRC, kind: "not-listed" } })).toEqual([
      "The park's own page doesn't list restrooms",
    ]);
  });

  it("orders the lines the way a parent asks them", () => {
    const f: PlaygroundFacts = {
      ...BASE,
      hours: { ...SRC, value: "5 a.m.–10 p.m." },
      fenced: SRC,
      toddlerArea: SRC,
      ages: { ...SRC, value: "ages 2–12" },
      restrooms: { ...SRC, kind: "building" },
      waterPlay: { ...SRC, line: "A wading pool, in summer" },
    };
    expect(texts(f)).toEqual([
      "Restroom building",
      "Built for ages 2–12",
      "Separate toddler area",
      "Fenced play area",
      "Hours: 5 a.m.–10 p.m.",
      "A wading pool, in summer",
    ]);
  });

  it("a lot within 100 m is 'right by the playground'; farther gets a walk that errs long", () => {
    const near = beforeYouGo(PLAY, { ...BASE, lot: { lat: 45.0008, lng: -93.3, label: "the north lot" } }, []);
    expect(near[0].text).toBe("Park in the north lot, right by the playground.");
    expect(near[0].link?.href).toBe("https://www.google.com/maps/search/?api=1&query=45.0008,-93.3");

    const far = beforeYouGo(PLAY, { ...BASE, lot: { lat: 45.003, lng: -93.3, label: "the north lot" } }, []);
    // 334 m straight, x1.3 for winding paths, at 80 m/min = 5.4 -> 6
    expect(far[0].text).toBe("Park in the north lot, about a 6-minute walk.");
  });

  it("walkMinutes rounds up and never says zero", () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(61)).toBe(1); // 79.3 m walked
    expect(walkMinutes(62)).toBe(2); // 80.6 m walked
  });

  it("a splash pad within 400 m is 'at this park', linked, with its season", () => {
    const l = beforeYouGo(PLAY, BASE, [pad("same", 0.0035), pad("far", 0.02)]);
    expect(l).toEqual([
      {
        key: "splash",
        text: "Splash pad at this park (Memorial Day–Labor Day):",
        link: { href: "/places/splash-pad/same", text: "Pad same →" },
      },
    ]);
  });

  it("past 400 m it is the nearest, with miles; at 3 mi or more it is left out", () => {
    expect(texts(BASE, [pad("mid", 0.02)])).toEqual(["Nearest splash pad, 1.4 mi (Memorial Day–Labor Day):"]);
    expect(texts(BASE, [pad("just-past", 0.004)])).toEqual(["Nearest splash pad, 0.3 mi (Memorial Day–Labor Day):"]); // 445 m
    expect(texts(BASE, [pad("inside", 0.04341)])).toHaveLength(1); // 2.9993 mi
    expect(texts(BASE, [pad("edge", 0.04342)])).toEqual([]); // 3.0000 mi
    expect(texts(BASE, [pad("way", 0.2)])).toEqual([]);
  });

  it("names each source SITE once, linking its first page", () => {
    const one = { quotes: ["q"], url: "https://www.trp.org/hyland-visitor-center" };
    const two = { quotes: ["q"], url: "https://www.trp.org/hyland-lake-park-reserve" };
    expect(factSources({ ...BASE, restrooms: { ...one, kind: "building" }, hours: { ...two, value: "dawn" } }))
      .toEqual(["https://www.trp.org/hyland-visitor-center"]);
  });

  it("lists each source page once, in first-use order", () => {
    const a = { quotes: ["q"], url: "https://a.gov/x" };
    const b = { quotes: ["q"], url: "https://b.gov/y" };
    const c = { quotes: ["q"], url: "https://c.gov/z" };
    expect(factSources({ ...BASE, restrooms: { ...a, kind: "building" }, ages: { ...b, value: "2-5" }, hours: { ...a, value: "dawn" }, waterPlay: { ...c, line: "pool" } }))
      .toEqual(["https://a.gov/x", "https://b.gov/y", "https://c.gov/z"]);
    expect(factSources(BASE)).toEqual([]);
  });
});

describe("the aerial photo request", () => {
  it("asks for met25 and nothing else, at native 1-ft resolution", () => {
    expect(AERIAL_LAYER).toBe("met25");
    const { url, width, height } = aerialCropUrl(45.0, -93.3);
    expect(url).toContain("LAYERS=met25&");
    expect(url).toContain("SRS=EPSG:4326");
    expect([width, height]).toEqual([525, 394]); // 160 x 120 m at 0.3048 m/px
    // 60 m north/south of centre, 80 m east/west at 45 degrees north
    expect(url).toContain("BBOX=-93.301016,44.999461,-93.298984,45.000539&");
  });

  it("no source file anywhere asks for a Nearmap-flown or unlicensed layer", () => {
    // Hennepin 2021+ and Dakota 6-inch were flown by Nearmap (Dakota: no
    // commercial distribution; Hennepin: terms unpublished). rams20 has no terms.
    for (const f of ["lib/playground-facts.ts", "scripts/playground-aerial.ts", "components/BeforeYouGo.tsx"]) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, f).not.toMatch(/LAYERS=(hen|dak|rams|wash|carv|scott)/);
    }
  });
});

describe("PLAYGROUND_FACTS — the drift guard", () => {
  const entries = Object.entries(PLAYGROUND_FACTS);
  const aggregators = [
    "familyfuntwincities.com", "minnesotaparent.com", "mommypoppins.com", "tripadvisor.",
    "yelp.com", "facebook.com", "wikipedia.org", "playgroundbuddy", "racketmn.com",
  ];

  it("every key is an outdoor playground in the registry", () => {
    for (const [slug] of entries) {
      const p = placeBySlug(slug);
      expect(p?.kind, `${slug} is not a playground`).toBe("playground");
      expect(p?.tags.includes("indoor"), `${slug} is indoor; the photo would show a roof`).toBe(false);
    }
  });

  it("every fact carries a word-for-word quote from a primary https page, never an aggregator", () => {
    for (const [slug, f] of entries) {
      for (const fact of [f.restrooms, f.ages, f.toddlerArea, f.fenced, f.hours, f.waterPlay]) {
        if (!fact) continue;
        expect(fact.quotes.length, `${slug} has no quote`).toBeGreaterThan(0);
        for (const q of fact.quotes) expect(q.trim().length, `${slug} has a blank quote`).toBeGreaterThan(3);
        expect(fact.url.startsWith("https://"), `${slug} source is not https`).toBe(true);
        const host = new URL(fact.url).hostname.toLowerCase();
        for (const bad of aggregators) expect(host.includes(bad), `${slug} cites ${bad}`).toBe(false);
      }
    }
  });

  it("every entry says when a person read it — a real date, not before this table", () => {
    for (const [slug, f] of entries) {
      expect(f.readOn, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${f.readOn}T12:00:00Z`)), slug).toBe(false);
      expect(f.readOn >= "2026-11-08", slug).toBe(true);
    }
  });

  it("every photo exists, and was taken at the pin the page shows", () => {
    for (const [slug, f] of entries) {
      if (!f.aerial) continue;
      const p = placeBySlug(slug)!;
      expect(existsSync(join(ROOT, "public", aerialPath(slug))), `${slug}: run npm run playground-aerial`).toBe(true);
      expect([f.aerial.lat, f.aerial.lng], `${slug}: pin moved; re-fetch the photo with --force`).toEqual([p.lat, p.lng]);
    }
  });

  it("the restroom line and the Restrooms badge never disagree", () => {
    for (const [slug, f] of entries) {
      if (!f.restrooms) continue;
      const badge = placeBySlug(slug)!.details?.restrooms === true;
      expect(badge, `${slug}: line says ${f.restrooms.kind}, badge says ${badge}`).toBe(f.restrooms.kind !== "not-listed");
    }
  });

  it("a sourced toddler area or fence is also a filterable detail", () => {
    // One way only: a detail may rest on an earlier verified read (Teddy Bear's
    // fence, Aug 2026) whose page has since moved.
    for (const [slug, f] of entries) {
      const d = placeBySlug(slug)!.details ?? {};
      if (f.toddlerArea) expect(d.toddlerArea, `${slug} toddlerArea`).toBe(true);
      if (f.fenced) expect(d.fenced, `${slug} fenced`).toBe(true);
    }
  });

  it("ships only at eight or more playgrounds (the Places rule)", () => {
    expect(entries.length).toBeGreaterThanOrEqual(8);
  });

  it("a lot is close enough to be this playground's (under 1 km)", () => {
    for (const [slug, f] of entries) {
      if (!f.lot) continue;
      const p = placeBySlug(slug)!;
      const dLat = (f.lot.lat - p.lat) * 111_320;
      const dLng = (f.lot.lng - p.lng) * 111_320 * Math.cos((p.lat * Math.PI) / 180);
      expect(Math.hypot(dLat, dLng), slug).toBeLessThan(1000);
    }
  });
});

describe("the detail page stays static", () => {
  // Comments stripped: prose that says "never next/image" is not an import of it.
  const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const page = codeOnly(readFileSync(join(ROOT, "app/places/[kind]/[slug]/page.tsx"), "utf8"));
  const block = codeOnly(readFileSync(join(ROOT, "components/BeforeYouGo.tsx"), "utf8"));

  it("the block is a server component with a plain <img>, never the image optimizer", () => {
    expect(block).not.toMatch(/["']use client["']/);
    expect(block).not.toMatch(/next\/image/);
    expect(page).not.toMatch(/next\/image/);
  });

  it("only playground pages get the block", () => {
    expect(page).toMatch(/k === "playground" \? playgroundFacts\(place\.slug\) : null/);
  });

  it("every registry playground is either covered or knowingly left out", () => {
    // Indoor playgrounds have no useful aerial; every OUTDOOR one should be here
    // once this item ships. A new outdoor playground fails this until it is read.
    const outdoor = PLACES.filter((p) => p.kind === "playground" && !p.tags.includes("indoor")).map((p) => p.slug);
    const missing = outdoor.filter((s) => !(s in PLAYGROUND_FACTS));
    expect(missing).toEqual([]);
  });
});
