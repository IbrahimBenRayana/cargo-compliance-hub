import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // Phase 1 IA shift: /features/<slug> deep-pages move to /platform/<slug>.
      // Keep /features as the overview hub.
      {
        source: "/features/isf-filing",
        destination: "/platform/filings",
        permanent: true,
      },
      {
        source: "/features/compliance",
        destination: "/platform/compliance",
        permanent: true,
      },
      {
        source: "/features/team",
        destination: "/platform/automation#team",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
