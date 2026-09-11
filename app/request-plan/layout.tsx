import type { Metadata } from "next";

/* The page is a client component and cannot export metadata itself; this
   layout exists only to give the tab its own name. */
export const metadata: Metadata = {
  title: "Request a plan · SydIN",
  description: "Ask the SydIN team to set up a plan for your business.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
