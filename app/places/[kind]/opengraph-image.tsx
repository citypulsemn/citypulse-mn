import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from "@/lib/brand/og-card";
import { KIND_META, placesByKind, type PlaceKind } from "@/lib/places";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "City Pulse MN — Places";

// Props-only card from the shared shell + the in-code registry — no DB, so this
// image route stays off the database (the build/runtime rules apply here too).
export default async function Image({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = KIND_META[kind as PlaceKind];
  const valid = meta && placesByKind(kind as PlaceKind).length > 0;

  return new ImageResponse(
    OgCard({
      eyebrow: "Twin Cities · Places",
      title: valid ? meta.plural : "Places",
      subtitle: "Every one, mapped · Minneapolis–St. Paul",
    }),
    { ...OG_SIZE, fonts: ogFonts },
  );
}
