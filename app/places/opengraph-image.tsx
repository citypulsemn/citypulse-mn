import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from "@/lib/brand/og-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "City Pulse MN — Places";

export default function Image() {
  return new ImageResponse(
    OgCard({
      eyebrow: "Twin Cities",
      title: "Places",
      subtitle: "Beaches, splash pads & more — mapped",
    }),
    { ...OG_SIZE, fonts: ogFonts },
  );
}
