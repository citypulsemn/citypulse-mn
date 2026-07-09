import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/events";
import { categoryColor, CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS } from "@/lib/dates";
import { oswaldSemiBold } from "./oswald-font";

// Node runtime: the image reads the event from Postgres (postgres.js needs TCP).
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "City Pulse MN event";

const NAVY = "#0e1830";
const GOLD = "#c9a961";
const CREAM = "#f1ece0";
const CREAM_DIM = "#d7d1c3";

const SKYLINE =
  "M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  const oswald = oswaldSemiBold;

  const fonts = [{ name: "Oswald", data: oswald, weight: 600 as const, style: "normal" as const }];

  // Fallback card for missing/draft events — never a broken image.
  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: NAVY,
            color: GOLD,
            fontFamily: "Oswald",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          City Pulse MN
        </div>
      ),
      { ...size, fonts },
    );
  }

  const cat = CATEGORIES[event.category];
  const color = categoryColor(event.category);
  const d = new Date(event.start);
  const dateStr = `${DOW[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  const cancelled = event.status === "cancelled";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          background: NAVY,
          fontFamily: "Oswald",
        }}
      >
        <div style={{ position: "absolute", inset: 28, border: `3px solid ${GOLD}`, borderRadius: 20 }} />
        <div
          style={{
            position: "absolute",
            inset: 40,
            border: "1px solid rgba(201,169,97,0.4)",
            borderRadius: 14,
          }}
        />
        <svg
          width="200"
          height="170"
          viewBox="0 0 80 70"
          fill="none"
          stroke={GOLD}
          strokeWidth="2.4"
          strokeLinejoin="round"
          style={{ position: "absolute", right: 70, bottom: 60, opacity: 0.16 }}
        >
          <path d={SKYLINE} />
        </svg>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            padding: "0 96px",
          }}
        >
          <div style={{ display: "flex", color: cancelled ? "#f0a488" : color, fontSize: 30, letterSpacing: 8, textTransform: "uppercase" }}>
            {cancelled ? `${cat.label} · Cancelled` : cat.label}
          </div>
          <div style={{ display: "flex", color: CREAM, fontSize: 66, lineHeight: 1.04, marginTop: 18, maxHeight: 290, overflow: "hidden" }}>
            {event.title}
          </div>
          <div style={{ display: "flex", color: CREAM_DIM, fontSize: 34, marginTop: 22 }}>
            {dateStr} · {event.venue}
          </div>
          <div style={{ display: "flex", color: GOLD, fontSize: 26, letterSpacing: 6, marginTop: 40, textTransform: "uppercase" }}>
            City Pulse MN
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
