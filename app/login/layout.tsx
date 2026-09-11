import type { Metadata } from "next";

/* The page is a client component and cannot export metadata itself; this
   layout exists only to give the tab its own name. */
export const metadata: Metadata = {
  title: "Sign in · SydIN",
  description: "Sign in to your SydIN workspace.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
