import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from "@/lib/brand/og-card";
import { weekendDays, weekendLabel } from "@/lib/weekend";

// Edge-safe: the card is built from date math only (no DB). weekendLabel is
// the acceptable dynamic bit — it changes weekly and caches like the page.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "This weekend in the Twin Cities — City Pulse MN";

export default function Image() {
  const label = weekendLabel(weekendDays(new Date())) || "This Weekend";
  return new ImageResponse(
    OgCard({
      eyebrow: "Twin Cities",
      title: "This Weekend",
      subtitle: label,
    }),
    { ...size, fonts: ogFonts },
  );
}
