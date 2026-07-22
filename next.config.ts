import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 6.3 — the weekend surface graduated from a collection to the evergreen
      // root URL; 301 consolidates any accumulated SEO equity onto it.
      { source: "/collections/this-weekend", destination: "/this-weekend", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // The service worker must never be served from a stale cache, or a
        // fix (or the unregister stub) could take days to reach browsers.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  // R2.7 — no remote image hosts. Event artwork renders as CSS backgrounds;
  // nothing routes remote URLs through next/image, so the wide-open
  // `https://**` remotePatterns was pure SSRF surface (a crafted event.image
  // could aim the server-side optimizer at any URL). Default config refuses
  // remote images. If event images ever ship through next/image, allowlist
  // the specific venue/CDN hosts here — never "**".
};

export default nextConfig;
