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
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;var dashboard=location.pathname.indexOf("/dashboard")===0;if(!dashboard){delete root.dataset.theme;root.style.colorScheme="dark";return;}var value=localStorage.getItem("sydin:appearance");var valid=value==="dark"||value==="light"||value==="system";var preference=valid?value:"dark";var theme=preference==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":preference==="light"?"light":"dark";root.dataset.theme=theme;root.style.colorScheme=theme;}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}})();`,
          }}
        />
      </head>
      <body className="sydin-shell flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
