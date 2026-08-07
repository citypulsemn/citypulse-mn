import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from "@/lib/seo/site";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { FirstSaveNudge } from "@/components/FirstSaveNudge";
import { BackToTop } from "@/components/BackToTop";
import "./globals.css";

// UX10 — self-hosted via next/font (no render-blocking Google Fonts request,
// and the size-adjusted fallback kills the Oswald swap CLS). Exposed as CSS
// variables so globals.css keeps referring to them by name.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const oswald = Oswald({ subsets: ["latin"], display: "swap", variable: "--font-oswald" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "City Pulse MN — Twin Cities Events",
  description:
    "The pulse of the Twin Cities. Concerts, sports, family outings, festivals, and the wonderfully unique — all across the Minneapolis–St. Paul metro.",
  // PWA: Next links the manifest (app/manifest.ts) itself; these cover the
  // icon set and iOS's home-screen behaviour.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "City Pulse",
    // Pairs with viewportFit "cover" below: the navy chrome runs under the
    // status bar instead of leaving a white strip.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1830",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <head>
        {/* Vitals (roadmap 3.5): the Mapbox static map is the LCP asset on event
            and venue pages. dns-prefetch (not preconnect) warms DNS without
            holding a TCP/TLS handshake open on the many pages that show no map.
            Fonts are now self-hosted via next/font — no Google Fonts request. */}
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
      </head>
      <body>
        {children}
        <BackToTop />
        <FirstSaveNudge />
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
