import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    // Build-time fallback: the wildcard still constrains this to Supabase.
    return "https://*.supabase.co";
  }
})();

/**
 * Content Security Policy.
 *
 * Audited 2026-08-20: the app loads no third-party scripts, no analytics, and
 * no external fonts (`next/font/google` self-hosts at build time). The only
 * remote origin it needs is its own Supabase project. That makes a tight policy
 * possible here where most apps cannot have one.
 *
 * `'unsafe-inline'` on scripts is a deliberate, documented compromise: the App
 * Router injects inline hydration scripts, and the strict alternative
 * (per-request nonces via middleware plus `strict-dynamic`) is a bigger change
 * than this phase should carry. Everything else is locked down, so the policy
 * still stops framing, base-tag hijacking, form exfiltration, plugin content
 * and calls to any host that is not Supabase. Upgrading scripts to nonces is a
 * later, separate change.
 *
 * `'unsafe-eval'` is development-only — React Refresh needs it, production
 * does not.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind and Next both emit inline style attributes; there is no nonce path
  // for those.
  "style-src 'self' 'unsafe-inline'",
  // blob: covers image previews before upload and the generated QR codes;
  // data: covers the inlined icons in generated PDFs.
  `img-src 'self' blob: data: ${supabaseHost}`,
  // The barcode scanner draws camera frames into a blob-backed video element.
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} ${supabaseHost.replace("https://", "wss://")}${
    isDev ? " ws://localhost:* http://localhost:*" : ""
  }`,
  "worker-src 'self' blob:",
  // Nothing in SydIN embeds or is embedded.
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    // Two years, subdomains included, preload-eligible. Only meaningful over
    // HTTPS, so it is a no-op locally and active on Vercel.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Stops the browser guessing that an uploaded file is something other than
    // what it was served as — the classic image-upload-becomes-script attack.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Belt and braces alongside frame-ancestors, for older browsers.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Camera stays on for the barcode scanner. Everything else is refused, so a
    // compromised dependency cannot quietly ask for a customer's location or
    // microphone.
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

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
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
