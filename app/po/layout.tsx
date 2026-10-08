import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase order",
  robots: { index: false, follow: false },
};

export default function PublicPurchaseOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
