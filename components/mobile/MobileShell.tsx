"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef } from "react";
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
  { id: "more", label: "More", icon: "more", href: "#" },
];

const MORE_MENU_ITEMS = [
  { label: "Settings", icon: "settings" as UiIconName, href: "/dashboard/settings" },
  { label: "Reports", icon: "reports" as UiIconName, href: "/dashboard/reports" },
  { label: "Stock Counts", icon: "check" as UiIconName, href: "/dashboard/stock-counts" },
  { label: "Alerts", icon: "alert" as UiIconName, href: "/dashboard/alerts" },
  { label: "QR Center", icon: "qr" as UiIconName, href: "/dashboard/qr-center" },
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
  alertCount = 0,
}: {
  children: React.ReactNode;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = getActiveTab(pathname);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (href: string) => {
    // Scroll content to top
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    router.push(href);
    setMoreMenuOpen(false);
  };

  return (
    <div className="mobile-shell">
      {/* Main content */}
      <div className="mobile-shell-content" ref={contentRef}>
        {children}
      </div>

      {/* More menu backdrop */}
      {moreMenuOpen && (
        <div
          className="mobile-more-menu-backdrop"
          onClick={() => setMoreMenuOpen(false)}
        />
      )}

      {/* More menu sheet */}
      {moreMenuOpen && (
        <div className="mobile-more-menu">
          {MORE_MENU_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNavigation(item.href)}
              className="mobile-more-menu-item"
            >
              <UiIcon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

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

          if (tab.id === "more") {
            return (
              <button
                key={tab.id}
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`mobile-nav-tab ${isActive ? "mobile-nav-tab-active" : ""}`}
                aria-label={tab.label}
                aria-expanded={moreMenuOpen}
              >
                <UiIcon
                  name={tab.icon}
                  className="h-5 w-5"
                />
                <span className="mobile-nav-tab-label">{tab.label}</span>
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
              <div className="mobile-nav-tab-relative">
                <UiIcon
                  name={tab.icon}
                  className="h-5 w-5"
                />
                {tab.id === "home" && alertCount > 0 && (
                  <div className="mobile-nav-badge">
                    {alertCount > 9 ? "9+" : alertCount}
                  </div>
                )}
              </div>
              <span className="mobile-nav-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
