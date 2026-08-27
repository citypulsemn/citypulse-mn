import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { CardContent, Variant } from "./types";

/**
 * Renders the City Pulse MN "arch card" — the static event overlay in every
 * reel — as a transparent 1080x1920 PNG.
 *
 * The card artwork is NOT drawn: the owner's real blank templates
 * (assets/reels/template-<variant>.png, the same PNGs used in the manual
 * CapCut builds) are composited at the exact placement measured from the
 * published reels, and only the text is drawn on top. That makes the finish —
 * paper texture, dome shading, medallion vignette, gold lines, edge shadow —
 * pixel-identical to the account's live cards.
 */

const CW = 1080;
const CH = 1920;

/** Template-internal geometry (alpha/gold-line scans of the 800x1328 PNGs). */
const TPL = {
  w: 800,
  h: 1328,
  /** Card bbox top (dome apex) and bottom in the template. */
  top: 58,
  bottom: 1260,
  /** The six gold separator lines: header|row1|row2|row3|row4|row5|CTA. */
  seps: [433, 585, 725, 871, 1016, 1160],
  /** Bottom segment of the inner gold border — the CTA band ends here. */
  innerBottom: 1242,
  /** Bottom of the logo medallion — the header band starts under it. */
  medallionBottom: 362,
} as const;

/**
 * Published-reel placement (gold-border scans of r61/r64 frames): dome apex
 * at y=180, card bottom at y=1513, horizontally centered. The template is
 * drawn scaled so its card lands exactly there.
 */
const PUB_APEX = 180;
const PUB_BOTTOM = 1513;
const SCALE = (PUB_BOTTOM - PUB_APEX) / (TPL.bottom - TPL.top);
const DEST_W = TPL.w * SCALE;
const DEST_H = TPL.h * SCALE;
const DEST_X = (CW - DEST_W) / 2;
const DEST_Y = PUB_APEX - TPL.top * SCALE;

/** Template y → final canvas y. */
const ty = (y: number): number => y * SCALE + DEST_Y;

const CX = CW / 2;
const WHITE = "#FFFFFF";
/** Details lines read near-white on the published cards, not blue-gray. */
const DETAILS_COLOR = "#E6ECF4";
/** Text width budget inside the card (inner gold border, small margin). */
const TEXT_MAX_W = 650;

const TEMPLATE_FILE: Record<Variant, string> = {
  regular: "template-regular.png",
  family: "template-family.png",
  weird: "template-weird.png",
};

export interface CardAssets {
  /** Directory holding Anton-Regular.ttf and the template PNGs. */
  assetsDir?: string;
}

const registeredFonts = new Set<string>();
const imageCache = new Map<string, Promise<Image>>();

function resolveAssetsDir(assetsDir?: string): string {
  // Scripts run from the repo root; cwd-relative keeps tsx/vitest/CI aligned.
  return assetsDir ?? path.join(process.cwd(), "assets", "reels");
}

/**
 * The published cards' text is Bebas Neue (zoomed letterform comparison
 * against r64: stroke ≈25% of cap height, strongly condensed — ~20% narrower
 * per glyph than Oswald at the same cap; crossed-center W, straight-leg R,
 * flagged 1). One weight for everything — the real cards' "lighter" details
 * lines are just the same font smaller. Always request weight 400: asking for
 * 700 from a single-weight family makes canvas synthesize a fake bold, which
 * reads exactly like the "too fat" text this replaced.
 */
const FONT = '"Bebas Neue"';

function ensureFonts(dir: string): void {
  const fontPath = path.join(dir, "BebasNeue-Regular.ttf");
  if (registeredFonts.has(fontPath)) return;
  if (!existsSync(fontPath)) {
    throw new Error(
      `Reels card font not found at ${fontPath} — run from the repo root (expects assets/reels/BebasNeue-Regular.ttf)`
    );
  }
  GlobalFonts.registerFromPath(fontPath);
  registeredFonts.add(fontPath);
}

function loadCachedImage(file: string): Promise<Image> {
  let cached = imageCache.get(file);
  if (!cached) {
    if (!existsSync(file)) {
      throw new Error(`Reels card asset not found at ${file} — run from the repo root`);
    }
    cached = loadImage(file);
    imageCache.set(file, cached);
  }
  return cached;
}

/** Steps the size down by 2 until the text fits maxWidth, floored at minSize. */
function fitFont(
  ctx: SKRSContext2D,
  text: string,
  startSize: number,
  minSize: number,
  maxWidth: number
): number {
  for (let size = startSize; size > minSize; size -= 2) {
    ctx.font = `400 ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `400 ${minSize}px ${FONT}`;
  return minSize;
}

/** Fits then fills one line; a line still too long at minSize is squeezed, never wrapped. */
function drawFitted(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  startSize: number,
  minSize: number,
  maxWidth: number
): number {
  const size = fitFont(ctx, text, startSize, minSize, maxWidth);
  if (ctx.measureText(text).width > maxWidth) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
  return size;
}

export async function renderCardPng(
  content: CardContent,
  assets: CardAssets = {}
): Promise<Buffer> {
  const dir = resolveAssetsDir(assets.assetsDir);
  ensureFonts(dir);
  const template = await loadCachedImage(path.join(dir, TEMPLATE_FILE[content.variant]));

  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(template, DEST_X, DEST_Y, DEST_W, DEST_H);

  ctx.textAlign = "center";

  // Header band: the single merged header+date line between the medallion
  // and the first gold separator.
  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  drawFitted(
    ctx,
    content.header.toUpperCase(),
    CX,
    (ty(TPL.medallionBottom) + ty(TPL.seps[0])) / 2 + 2,
    38,
    24,
    TEXT_MAX_W
  );

  // Five event rows between the six separator lines. Render only what we
  // were given — never invent a row.
  ctx.textBaseline = "alphabetic";
  content.events.slice(0, 5).forEach((row, i) => {
    const top = ty(TPL.seps[i]);
    const rowH = ty(TPL.seps[i + 1]) - top;
    ctx.fillStyle = WHITE;
    const nameSize = drawFitted(
      ctx,
      row.name.toUpperCase(),
      CX,
      top + rowH * 0.46,
      40,
      22,
      TEXT_MAX_W
    );
    if (row.details) {
      // Details gap tracks the fitted name size so shrunken names don't float.
      const gap = Math.max(nameSize * 0.95, 38);
      ctx.fillStyle = DETAILS_COLOR;
      drawFitted(
        ctx,
        row.details.toUpperCase(),
        CX,
        top + rowH * 0.46 + gap,
        35,
        15,
        TEXT_MAX_W
      );
    }
  });

  // CTA band between the last separator and the inner border's bottom line.
  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  drawFitted(
    ctx,
    content.cta.toUpperCase(),
    CX,
    (ty(TPL.seps[5]) + ty(TPL.innerBottom)) / 2,
    43,
    20,
    TEXT_MAX_W
  );

  return canvas.encode("png");
}

export async function renderCardToFile(
  content: CardContent,
  outFile: string,
  assets: CardAssets = {}
): Promise<void> {
  const png = await renderCardPng(content, assets);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, png);
}
