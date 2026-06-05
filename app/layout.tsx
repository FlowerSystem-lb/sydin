import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SydIn - Visual Inventory Management Software",
  description:
    "SydIn helps small businesses track inventory with photos, QR item pages, stock history, and a clean private workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
