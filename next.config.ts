import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 6.3 — the weekend surface graduated from a collection to the evergreen
      // root URL; 301 consolidates any accumulated SEO equity onto it.
      { source: "/collections/this-weekend", destination: "/this-weekend", permanent: true },
    ];
  },
  // Event images come from external sources (venue sites, agent-supplied URLs).
  // Allow any https host; tighten to specific domains for production if desired.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
