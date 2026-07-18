import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from "@/lib/brand/og-card";
import { venuePageBySlug } from "@/lib/venue-pages";

// No DB: the venue name comes from the static registry, not events.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Venue events — City Pulse MN";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = venuePageBySlug(slug);
  const name = venue?.name ?? "City Pulse MN";
  // Long venue names get a smaller title so they don't clip.
  const titleSize = name.length > 26 ? 56 : name.length > 18 ? 64 : 72;
  return new ImageResponse(
    OgCard({
      eyebrow: "Upcoming at",
      title: name,
      subtitle: venue ? `${venue.city} · concerts, shows & events` : "The pulse of the Twin Cities",
      titleSize,
    }),
    { ...size, fonts: ogFonts },
  );
}
