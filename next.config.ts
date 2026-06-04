import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname:
          "hllktjhewivxqumqktzj.supabase.co",
      },
    ],
  },
};

export default nextConfig;