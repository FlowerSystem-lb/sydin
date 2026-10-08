import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SydIN Scanner",
  description: "Use this phone as a wireless scanner for SydIN.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e1424",
};

export default function PairLayout({ children }: { children: React.ReactNode }) {
  return children;
}
