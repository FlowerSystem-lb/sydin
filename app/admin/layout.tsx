import type { Metadata } from "next";
import AdminGate from "@/components/admin/AdminGate";

export const metadata: Metadata = {
  title: "SydIN admin",
  robots: { index: false, follow: false },
};

/* Everything under /admin sits behind the authenticator-code gate. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
