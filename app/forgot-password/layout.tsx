import type { Metadata } from "next";

/* The page is a client component and cannot export metadata itself; this
   layout exists only to give the tab its own name. */
export const metadata: Metadata = {
  title: "Reset password · SydIN",
  description: "Reset your SydIN password with a code sent to your email.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
