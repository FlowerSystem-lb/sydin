import type { Metadata } from "next";

/* The page is a client component and cannot export metadata itself; this
   layout exists only to give the tab its own name. */
export const metadata: Metadata = {
  title: "Create account · SydIN",
  description: "Create your SydIN workspace in minutes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
