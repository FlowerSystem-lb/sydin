import type { Metadata } from "next";

/* The page is a client component and cannot export metadata itself; this
   layout exists only to give the tab its own name. */
export const metadata: Metadata = {
  title: "Plan requests · SydIN",
  description: "Plan requests submitted by SydIN customers.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
