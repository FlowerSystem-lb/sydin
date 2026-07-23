"use client";

import { usePathname, useRouter } from "next/navigation";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

interface MobileTab {
  id: string;
  label: string;
  icon: UiIconName;
  href: string;
  center?: boolean;
}

const MOBILE_TABS: MobileTab[] = [
  { id: "home", label: "Home", icon: "home", href: "/dashboard" },
  { id: "inventory", label: "Inventory", icon: "box", href: "/dashboard/inventory" },
  { id: "scan", label: "Scan", icon: "scan", href: "/dashboard/scanner", center: true },
  { id: "activity", label: "Activity", icon: "clock", href: "/dashboard/activity" },
  { id: "more", label: "More", icon: "more", href: "/dashboard/settings" },
];

function getActiveTab(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "home";
  if (pathname.startsWith("/dashboard/inventory")) return "inventory";
  if (pathname.startsWith("/dashboard/scanner")) return "scan";
  if (pathname.startsWith("/dashboard/activity")) return "activity";
  return "more";
}

export default function MobileShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = getActiveTab(pathname);

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <div className="mobile-shell">
      {/* Main content */}
      <div className="mobile-shell-content">
        {children}
      </div>

      {/* Bottom Navigation */}
      <nav className="mobile-shell-nav" role="navigation" aria-label="Mobile navigation">
        {MOBILE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          if (tab.center) {
            return (
              <button
                key={tab.id}
                onClick={() => handleNavigation(tab.href)}
                className="mobile-nav-tab mobile-nav-tab-center"
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="mobile-nav-tab-icon-wrapper">
                  <UiIcon
                    name={tab.icon}
                    className="h-6 w-6"
                  />
                </div>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleNavigation(tab.href)}
              className={`mobile-nav-tab ${isActive ? "mobile-nav-tab-active" : ""}`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <UiIcon
                name={tab.icon}
                className="h-5 w-5"
              />
              <span className="mobile-nav-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
