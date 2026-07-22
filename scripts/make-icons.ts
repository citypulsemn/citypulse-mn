/**
 * PWA / favicon asset generator. Run manually when the brand mark changes:
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Renders the City Pulse pulse-skyline mark (the same path as components/Logo)
 * in gold on navy, and writes the PNG sizes the web app manifest needs. Uses
 * `sharp`, which ships with Next.js — this script is not part of the build.
 *
 * Icons are full-bleed squares with NO baked rounding: iOS rounds the
 * apple-touch-icon itself and Android applies its own mask, so pre-rounding
 * would double-round.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const NAVY = "#0e1830";
const GOLD = "#c9a961";
const OUT = join(__dirname, "..", "public");

/** The Logo mark, in its native 80×70 viewBox. */
const MARK =
  "M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56";

/**
 * Build an icon SVG at `size`, with the mark occupying `coverage` of the width.
 * Maskable icons use a smaller coverage so the mark stays inside the safe zone
 * (the centre 80% circle) when Android crops it to a circle/squircle.
 */
function iconSvg(size: number, coverage: number): string {
  const markW = size * coverage;
  const scale = markW / 80;
  const markH = 70 * scale;
  const x = (size - markW) / 2;
  const y = (size - markH) / 2;
  const stroke = 3.6 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${NAVY}"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">
    <path d="${MARK}" fill="none" stroke="${GOLD}" stroke-width="${(stroke / scale).toFixed(2)}"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>`;
}

async function png(name: string, size: number, coverage: number) {
  const buf = await sharp(Buffer.from(iconSvg(size, coverage))).png().toBuffer();
  writeFileSync(join(OUT, name), buf);
  console.log(`  ${name.padEnd(26)} ${size}×${size}  (mark ${Math.round(coverage * 100)}%)`);
}

async function main() {
  console.log("writing PWA icons to public/:");
  // Source SVG — also the modern favicon.
  writeFileSync(join(OUT, "icon.svg"), iconSvg(512, 0.72) + "\n");
  console.log("  icon.svg                   vector");
  await png("icon-192.png", 192, 0.72);
  await png("icon-512.png", 512, 0.72);
  // Maskable: mark pulled in so a circular crop never clips it.
  await png("icon-maskable-512.png", 512, 0.52);
  // iOS home screen (iOS rounds it itself).
  await png("apple-touch-icon.png", 180, 0.72);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
