import { ImageResponse } from "next/og";
import { getCollection } from "@/lib/collections";
import { oswaldSemiBold } from "@/lib/brand/oswald-font";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "City Pulse MN collection";

const NAVY = "#0e1830";
const GOLD = "#c9a961";
const CREAM = "#f1ece0";
const CREAM_DIM = "#c7c1b3";
const SKYLINE =
  "M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getCollection(slug);
  const fonts = [{ name: "Oswald", data: oswaldSemiBold, weight: 600 as const, style: "normal" as const }];
  const title = collection?.title ?? "City Pulse MN";
  const tagline = collection?.tagline ?? "The pulse of the Twin Cities";

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%", background: NAVY, fontFamily: "Oswald", padding: "84px 76px", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 28, left: 28, right: 28, bottom: 28, border: `3px solid ${GOLD}`, borderRadius: 20 }} />
        <div style={{ position: "absolute", top: 40, left: 40, right: 40, bottom: 40, border: "1px solid rgba(201,169,97,0.4)", borderRadius: 14 }} />

        <div style={{ display: "flex", color: GOLD, fontSize: 28, letterSpacing: 8, textTransform: "uppercase", marginBottom: 18 }}>
          Collection
        </div>
        <div style={{ display: "flex", color: CREAM, fontSize: 72, lineHeight: 1.04, maxHeight: 320, overflow: "hidden" }}>
          {title}
        </div>
        <div style={{ display: "flex", color: CREAM_DIM, fontSize: 32, marginTop: 22, maxWidth: 900 }}>
          {tagline}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 40 }}>
          <div style={{ display: "flex", color: GOLD, fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>
            City Pulse MN
          </div>
        </div>

        <svg width="150" height="130" viewBox="0 0 80 70" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinejoin="round" style={{ position: "absolute", right: 70, bottom: 60, opacity: 0.18 }}>
          <path d={SKYLINE} />
        </svg>
      </div>
    ),
    { ...size, fonts },
  );
}
