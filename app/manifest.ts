import type { MetadataRoute } from "next";

/**
 * The web app manifest: what lets a phone add SydIN to its home screen and
 * open it full-screen, without the browser's address bar, with its own icon
 * -- "like an app", which is what Sayed asked for on 20 Sep. Nothing about
 * the site changes for anyone who does not install it.
 *
 * start_url is the dashboard: someone who installed the app is signed in
 * and wants their stock, not the landing page. The session gate still runs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SydIN — Visual Inventory",
    short_name: "SydIN",
    description:
      "Know what is in your depot. Photos, stock levels, invoices and purchase orders in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
