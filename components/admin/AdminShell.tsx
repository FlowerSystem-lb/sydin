"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";

/* The admin console frame: SydIN mark, the four areas, back to the app. */
const TABS = [
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/plan-requests", label: "Plan requests" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/activity", label: "Activity" },
];

export default function AdminShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="ad-page">
      <header className="ad-top">
        <div className="ad-top-inner">
          <Link href="/admin/customers" className="ad-brand">
            <BrandMark compact />
            <span>
              SydIN <em>admin</em>
            </span>
          </Link>
          <nav className="ad-tabs" aria-label="Admin">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`ad-tab${pathname?.startsWith(tab.href) ? " ad-tab-on" : ""}`}
                aria-current={pathname?.startsWith(tab.href) ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="ad-back">
            Back to SydIN
          </Link>
        </div>
      </header>
      <main className="ad-main">
        <div className="ad-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="ad-head-actions">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
