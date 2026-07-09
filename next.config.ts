import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Event images come from external sources (venue sites, agent-supplied URLs).
  // Allow any https host; tighten to specific domains for production if desired.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
