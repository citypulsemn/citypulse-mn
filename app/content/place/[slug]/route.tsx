import { ImageResponse } from "next/og";
import { placeBySlug, KIND_META } from "@/lib/places";
import { oswaldSemiBold } from "@/lib/brand/oswald-font";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;
const NAVY = "#0e1830";
const GOLD = "#c9a961";
const CREAM = "#f1ece0";
const CREAM_DIM = "#c7c1b3";
const SKYLINE =
  "M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const place = placeBySlug(slug);
  const fonts = [{ name: "Oswald", data: oswaldSemiBold, weight: 600 as const, style: "normal" as const }];

  if (!place) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: NAVY, color: GOLD, fontFamily: "Oswald", alignItems: "center", justifyContent: "center", fontSize: 72, letterSpacing: 8, textTransform: "uppercase" }}>
          City Pulse MN
        </div>
      ),
      { width: W, height: H, fonts },
    );
  }

  const where = [place.city].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%", background: NAVY, fontFamily: "Oswald", padding: "84px 76px", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", top: 30, left: 30, right: 30, bottom: 30, border: `3px solid ${GOLD}`, borderRadius: 26 }} />
        <div style={{ position: "absolute", top: 44, left: 44, right: 44, bottom: 44, border: "1px solid rgba(201,169,97,0.4)", borderRadius: 18 }} />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", color: GOLD, fontSize: 30, letterSpacing: 7, textTransform: "uppercase" }}>City Pulse MN</div>
          <div style={{ display: "flex", color: NAVY, background: GOLD, fontSize: 24, letterSpacing: 4, textTransform: "uppercase", padding: "8px 18px", borderRadius: 999 }}>Place of the Week</div>
        </div>

        {/* main */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: GOLD, fontSize: 40, letterSpacing: 8, textTransform: "uppercase", marginBottom: 22 }}>{KIND_META[place.kind].label}</div>
          <div style={{ display: "flex", color: CREAM, fontSize: 88, lineHeight: 1.03, maxHeight: 380, overflow: "hidden" }}>{place.name}</div>
          <div style={{ display: "flex", color: CREAM_DIM, fontSize: 40, lineHeight: 1.35, marginTop: 28, maxHeight: 330, overflow: "hidden" }}>{place.intro}</div>
        </div>

        {/* details + footer */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {where && <div style={{ display: "flex", color: GOLD, fontSize: 46, marginBottom: 22 }}>{where}</div>}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", color: GOLD, fontSize: 34, letterSpacing: 3 }}>citypulsemn.com/places</div>
            <svg width="150" height="130" viewBox="0 0 80 70" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinejoin="round" style={{ opacity: 0.2 }}>
              <path d={SKYLINE} />
            </svg>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}
