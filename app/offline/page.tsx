import type { Metadata } from "next";
import BrandMark from "@/components/BrandMark";
import RetryButton from "./RetryButton";

export const metadata: Metadata = {
  title: "You are offline · SydIN",
};

/**
 * What the installed app shows when it is opened with no signal. Served by
 * the service worker in public/sw.js for a failed navigation; nothing else
 * is ever cached, so this page is the whole offline story: a calm message
 * and a retry. The stock itself is never shown stale.
 */
export default function OfflinePage() {
  return (
    <main className="dashboard-gate flex min-h-screen items-center justify-center px-4 text-theme-primary">
      <div className="dashboard-gate-card max-w-sm px-7 py-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandMark compact />
        </div>
        <p className="text-lg font-bold">You are offline</p>
        <p className="mt-1 text-sm text-theme-secondary">
          SydIN needs a connection to show your stock, so nothing here can be
          out of date. Try again once you are back on Wi-Fi or mobile data.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
