import type { MetadataRoute } from "next";

/**
 * Web app manifest — the "install to home screen" half of the PWA.
 *
 * Next serves this at /manifest.webmanifest and links it automatically. Colors
 * match the site chrome (navy-900 / gold) so the splash screen and status bar
 * don't flash a different palette on launch.
 *
 * `shortcuts` are the genuinely app-like touch: long-press the home-screen icon
 * and jump straight to the two surfaces people actually open the site for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "City Pulse MN — Twin Cities Events",
    short_name: "City Pulse",
    description:
      "Concerts, sports, family outings, festivals, and the wonderfully unique across Minneapolis–St. Paul.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e1830",
    theme_color: "#0e1830",
    categories: ["events", "entertainment", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "This Weekend", short_name: "Weekend", url: "/this-weekend" },
      { name: "Ongoing", short_name: "Ongoing", url: "/ongoing" },
    ],
  };
}
