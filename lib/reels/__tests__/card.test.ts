import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { VARIANTS, type CardContent, type Variant } from "../types";
import { renderCardPng, renderCardToFile } from "../card";

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
