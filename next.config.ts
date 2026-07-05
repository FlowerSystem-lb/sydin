import type { NextConfig } from "next";

const securityHeaders = [
  // Stop the app from being embedded in iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Never let browsers guess content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin when navigating off-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera stays available for the QR scanner; lock down the rest.
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Enforce HTTPS for a year once seen over HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
] as const;

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
