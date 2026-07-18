import type { ReactElement } from "react";
import { oswaldSemiBold } from "./oswald-font";

/**
 * OG CARD BRAND (roadmap 3.3) — the shared shell every social card wears.
 *
 * The event and collection routes each hand-rolled the navy field, the gold
 * double border, and the skyline; three more routes would triple that
 * duplication. This centralizes the chrome so a brand tweak is one edit, and
 * so a new card is just "eyebrow + title + footer line" without re-deriving
 * the frame.
 *
 * Pure/props-only by design — no DB import lives here — so image routes that
 * can build their card from params + registry stay off the database entirely
 * (the build/runtime rules apply inside image routes too).
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const NAVY = "#0e1830";
export const GOLD = "#c9a961";
export const CREAM = "#f1ece0";
export const CREAM_DIM = "#d7d1c3";

const SKYLINE =
  "M6 56 V42 H14 V52 H20 V30 H26 V20 L30 16 L34 20 V30 H40 V8 H44 V6 H48 V8 V34 H54 V26 H60 V18 H64 V14 H68 V18 V40 H74 V56";

export const ogFonts = [
  { name: "Oswald", data: oswaldSemiBold, weight: 600 as const, style: "normal" as const },
];

export interface OgCardProps {
  /** Small uppercase line above the title, e.g. "TWIN CITIES · JULY 17–19". */
  eyebrow: string;
  /** Optional color for the eyebrow (category color on event cards). */
  eyebrowColor?: string;
  title: string;
  /** Optional line under the title (venue+date, tagline, event count). */
  subtitle?: string;
  /** Font size for the title — knob for long titles. Default 72. */
  titleSize?: number;
}

/**
 * The full 1200×630 card as a next/og element tree. Callers wrap it in
 * `new ImageResponse(OgCard({...}), { ...OG_SIZE, fonts: ogFonts })`.
 */
export function OgCard({
  eyebrow,
  eyebrowColor = GOLD,
  title,
  subtitle,
  titleSize = 72,
}: OgCardProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: "100%",
        height: "100%",
        background: NAVY,
        fontFamily: "Oswald",
        padding: "84px 96px",
        justifyContent: "center",
      }}
    >
      {/* gold double frame */}
      <div style={{ position: "absolute", top: 28, left: 28, right: 28, bottom: 28, border: `3px solid ${GOLD}`, borderRadius: 20 }} />
      <div style={{ position: "absolute", top: 40, left: 40, right: 40, bottom: 40, border: "1px solid rgba(201,169,97,0.4)", borderRadius: 14 }} />

      {/* skyline motif, bottom-right */}
      <svg
        width="180"
        height="150"
        viewBox="0 0 80 70"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.4"
        strokeLinejoin="round"
        style={{ position: "absolute", right: 70, bottom: 58, opacity: 0.16 }}
      >
        <path d={SKYLINE} />
      </svg>

      <div style={{ display: "flex", color: eyebrowColor, fontSize: 30, letterSpacing: 8, textTransform: "uppercase", marginBottom: 18 }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", color: CREAM, fontSize: titleSize, lineHeight: 1.04, maxHeight: 320, overflow: "hidden" }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ display: "flex", color: CREAM_DIM, fontSize: 34, marginTop: 22, maxWidth: 940 }}>
          {subtitle}
        </div>
      ) : null}
      <div style={{ display: "flex", color: GOLD, fontSize: 26, letterSpacing: 6, marginTop: 40, textTransform: "uppercase" }}>
        City Pulse MN
      </div>
    </div>
  );
}
