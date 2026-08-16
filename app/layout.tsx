import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "SydIN - Visual Inventory Management Software",
  description:
    "SydIN helps small businesses track inventory with photos, QR item pages, stock history, and a clean private workspace.",
};

// Marketing-only display serif (Steep reference: editorial headlines,
// regular weight even at large sizes — restraint instead of bold sans).
// Exposed as a CSS variable, not applied to <body>, so the dashboard's own
// sans-serif type is untouched; only .marketing-hero-title /
// .marketing-section-title opt in via app/globals.css.
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
      className={`h-full antialiased ${sourceSerif.variable}`}
      data-theme="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="sydin-shell flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
