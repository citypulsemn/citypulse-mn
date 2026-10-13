import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { VARIANTS, type CardContent, type Variant } from "../types";
import { renderCardPng, renderCardToFile, renderFeedCardJpeg } from "../card";

function fixture(variant: Variant): CardContent {
  return {
    variant,
    header: "THIS WEEK IN MPLS - AUGUST 3RD-7TH",
    events: [
      { name: "Lake Harriet Bandshell Concert", details: "Bandshell, Linden Hills · Mon · 7:30 PM · Free" },
      { name: "Twins vs. White Sox", details: "Target Field, North Loop · Tue · 6:40 PM · $14" },
      { name: "Uptown Art Fair", details: "Hennepin Ave, Uptown · Wed · 10 AM · Free" },
      { name: "First Ave Dance Night", details: "First Avenue, Downtown · Thu · 8 PM · $25" },
      { name: "Food Truck Rally", details: "Nicollet Mall, Downtown · Fri · 11 AM · Free" },
    ],
    cta: "FULL GUIDE AT CITYPULSEMN.COM",
  };
}

/** Decode the PNG and expose 1px RGBA sampling via a second canvas draw. */
async function decode(png: Buffer) {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return {
    width: img.width,
    height: img.height,
    at(x: number, y: number): [number, number, number, number] {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    },
  };
}

describe("renderCardPng", () => {
  for (const variant of VARIANTS) {
    it(`renders the ${variant} card at 1080x1920 with the right fill, transparent outside, gold border`, async () => {
      const png = await renderCardPng(fixture(variant));
      const px = await decode(png);

      expect(px.width).toBe(1080);
      expect(px.height).toBe(1920);

      // Outside the arch: fully transparent.
      expect(px.at(5, 5)[3]).toBe(0);

      // Inside an event row, between text lines: the template's textured
      // fill, opaque, with the variant's hue (navy = blue-led, forest =
      // green-led, burgundy = red-led). Exact values vary with the texture.
      const [r, g, b, a] = px.at(540, 900);
      expect(a).toBe(255);
      if (variant === "regular") expect(b).toBeGreaterThan(r);
      if (variant === "family") {
        expect(g).toBeGreaterThanOrEqual(r);
        expect(g).toBeGreaterThanOrEqual(b);
      }
      if (variant === "weird") {
        expect(r).toBeGreaterThan(g);
        expect(r).toBeGreaterThan(b);
      }

      // The inner gold border's left segment lands near screen x=203; scan a
      // small window to stay robust to the template's anti-aliasing.
      const goldish = [];
      for (let x = 195; x <= 215; x++) {
        const [br, bg, bb] = px.at(x, 1000);
        if (br > 120 && br > bb + 25 && bg > 80) goldish.push(x);
      }
      expect(goldish.length).toBeGreaterThan(0);
    });
  }

  it("keeps a very long event name on a single line without throwing", async () => {
    const content = fixture("regular");
    content.events[0] = {
      name: "The Extraordinarily Comprehensive Minneapolis Saint Paul Metropolitan Area Summer Festival Extravaganza And Community Celebration Spectacular".repeat(2),
      details: "Everywhere, All At Once · Mon · All Day · Free",
    };
    const png = await renderCardPng(content);
    const px = await decode(png);
    expect(px.width).toBe(1080);
    // The squeezed line must stay inside the card, not spill onto transparency.
    expect(px.at(50, 651)[3]).toBe(0);
  });

  it("renders a row with empty details without crashing", async () => {
    const content = fixture("family");
    content.events[2] = { name: "Uptown Art Fair", details: "" };
    const png = await renderCardPng(content);
    const px = await decode(png);
    expect(px.height).toBe(1920);
  });

  it("renders an empty event list as a bare card — no invented rows", async () => {
    const content: CardContent = { ...fixture("weird"), events: [] };
    const png = await renderCardPng(content);
    const px = await decode(png);
    // Where row 1's name would sit: bare burgundy template, no white ink.
    const [r, g, b, a] = px.at(540, 830);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(r + g + b).toBeLessThan(400);
  });
});

describe("renderCardToFile", () => {
  let tmpDir: string | null = null;

  afterAll(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes a decodable PNG to disk", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "reels-card-"));
    const outFile = path.join(tmpDir, "nested", "card.png");
    await renderCardToFile(fixture("regular"), outFile);

    const written = await readFile(outFile);
    // PNG magic bytes.
    expect(Array.from(written.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const img = await loadImage(written);
    expect(img.width).toBe(1080);
    expect(img.height).toBe(1920);
  });
});

describe("renderFeedCardJpeg", () => {
  /** The site's cream, #f1ece0. JPEG is lossy, so colours are compared loosely. */
  const CREAM: [number, number, number] = [241, 236, 224];
  const near = (px: number[], rgb: number[], tol = 8) =>
    rgb.every((c, i) => Math.abs(px[i] - c) <= tol);

  it("is a 1080x1350 JPEG under Instagram's 8 MB limit, cream to the corners — never black", async () => {
    const jpeg = await renderFeedCardJpeg(fixture("family"));
    expect(Array.from(jpeg.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    expect(jpeg.length).toBeLessThan(8 * 1024 * 1024);

    const px = await decode(jpeg);
    expect(px.width).toBe(1080);
    expect(px.height).toBe(1350);
    for (const [x, y] of [[0, 0], [1079, 0], [0, 1349], [1079, 1349]]) {
      expect(near(px.at(x, y), CREAM), `corner ${x},${y} = ${px.at(x, y)}`).toBe(true);
    }
  });

  for (const variant of VARIANTS) {
    it(`keeps the ${variant} template's hue in the middle of a row`, async () => {
      const px = await decode(await renderFeedCardJpeg(fixture(variant)));
      // The reel frame's (540, 900) — between a row's two text lines — lands
      // here after the crop and scale.
      const [r, g, b] = px.at(540, 726);
      expect(r + g + b).toBeLessThan(400);
      if (variant === "regular") expect(b).toBeGreaterThan(r);
      if (variant === "family") {
        expect(g).toBeGreaterThanOrEqual(r);
        expect(g).toBeGreaterThanOrEqual(b);
      }
      if (variant === "weird") {
        expect(r).toBeGreaterThan(g);
        expect(r).toBeGreaterThan(b);
      }
    });
  }

  it("fills the frame: ~40px above and below the arch, centred left to right", async () => {
    const px = await decode(await renderFeedCardJpeg(fixture("family")));
    // "Card" = clearly not background; the soft shadow doesn't count.
    const isCard = (x: number, y: number) => {
      const [r, g, b] = px.at(x, y);
      return Math.abs(r - CREAM[0]) + Math.abs(g - CREAM[1]) + Math.abs(b - CREAM[2]) > 120;
    };
    let top = 0;
    while (!isCard(540, top)) top++;
    let bottom = 1349;
    while (!isCard(540, bottom)) bottom--;
    let left = 0;
    while (!isCard(left, 726)) left++;
    let right = 1079;
    while (!isCard(right, 726)) right--;

    // Scaling the whole 1920 frame instead of cropping to the arch would put
    // the top near y=127 and leave ~400px empty underneath.
    expect(top).toBeGreaterThanOrEqual(38);
    expect(top).toBeLessThanOrEqual(50);
    expect(1349 - bottom).toBeGreaterThanOrEqual(38);
    expect(1349 - bottom).toBeLessThanOrEqual(50);
    expect(Math.abs(left - (1079 - right))).toBeLessThanOrEqual(2);
  });

  it("paints the background it is given", async () => {
    const px = await decode(await renderFeedCardJpeg(fixture("regular"), { background: "#102030" }));
    expect(near(px.at(3, 3), [0x10, 0x20, 0x30])).toBe(true);
  });

  it("renders an empty event list as a bare card on cream — no invented rows", async () => {
    const px = await decode(await renderFeedCardJpeg({ ...fixture("weird"), events: [] }));
    expect(px.height).toBe(1350);
    expect(near(px.at(0, 0), CREAM)).toBe(true);
    // Where row 1's name sits on a full card: bare burgundy, no white ink.
    const [r, g, b] = px.at(540, 660);
    expect(r).toBeGreaterThan(g);
    expect(r + g + b).toBeLessThan(400);
  });
});
