import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "./mobile.css";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "SydIN - Visual Inventory Management Software",
  description:
    "SydIN helps small businesses track inventory with photos, QR item pages, stock history, and a clean private workspace.",
  // Home-screen install on iPhone and Android: the manifest (app/manifest.ts)
  // carries the icons and full-screen display; iOS reads these two as well.
  applicationName: "SydIN",
  appleWebApp: {
    capable: true,
    title: "SydIN",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

// viewport-fit: cover lets the phone shell draw under the home-indicator
// area and pad it with env(safe-area-inset-bottom), which mobile.css
// already does; without it the bar sat above a grey strip on a notched
// phone. Zoom stays enabled (accessibility).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// Marketing-only display serif (Steep reference: editorial headlines,
// regular weight even at large sizes — restraint instead of bold sans).
// Exposed as a CSS variable, not applied to <body>, so the dashboard's own
// sans-serif type is untouched; only .marketing-hero-title /
// .marketing-section-title opt in via app/globals.css.
/* The UI face. Until 5 Oct 2026 the app asked for Inter but never loaded it,
   so Windows drew everything in Segoe UI. Geist is loaded here, self-hosted
   by Next, so every machine sees the same type (redesign v2). */
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif-display",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable}`}
      data-theme="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="sydin-shell flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
