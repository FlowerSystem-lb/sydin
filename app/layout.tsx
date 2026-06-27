import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SydIN - Visual Inventory Management Software",
  description:
    "SydIN helps small businesses track inventory with photos, QR item pages, stock history, and a clean private workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
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
