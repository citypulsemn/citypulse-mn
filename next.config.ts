import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Event images come from external sources (venue sites, agent-supplied URLs).
  // Allow any https host; tighten to specific domains for production if desired.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Ensure the OG-image font is bundled into the serverless function (it's read
  // from disk at render time in the Node runtime).
  outputFileTracingIncludes: {
    "/event/[id]/opengraph-image": ["./app/event/[id]/Oswald-SemiBold.ttf"],
  },
};

export default nextConfig;
