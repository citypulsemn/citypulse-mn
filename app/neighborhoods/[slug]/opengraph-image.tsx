import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from "@/lib/brand/og-card";
import { neighborhoodByKey } from "@/lib/neighborhoods";

// No DB: label + blurb come from the static registry.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Neighborhood events — City Pulse MN";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = neighborhoodByKey(slug);
  const label = n?.label ?? "City Pulse MN";
  const titleSize = label.length > 24 ? 54 : label.length > 16 ? 64 : 72;
  return new ImageResponse(
    OgCard({
      eyebrow: "What's on in",
      title: label,
      subtitle: n?.blurb ?? "The pulse of the Twin Cities",
      titleSize,
    }),
    { ...size, fonts: ogFonts },
  );
}
