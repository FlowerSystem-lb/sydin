"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  DASHBOARD_NAVIGATION,
  DASHBOARD_SECTION_LABELS,
  DASHBOARD_SECTION_ORDER,
  isDashboardRouteActive,
} from "@/components/dashboard/navigation";

interface MobileTab {
  id: string;
  label: string;
  icon: UiIconName;
  href: string;
  center?: boolean;
}

/**
 * The phone bar and its More sheet are BUILT FROM navigation.ts, not from their
 * own list.
 *
 * They used to be hardcoded here, and the two drifted badly: the sidebar
 * carried fourteen destinations while this file offered nine, so Customers,
 * Suppliers, Sales, Purchase Orders, Workflows, Depots, Categories, Import &
 * Export and Help had no route on a phone at all. Anything added to the app
 * simply never arrived here, silently, because nothing connected the two.
 *
 * Deriving both from the same list is what stops that happening again: a new
 * page appears on the phone the moment it appears in the sidebar.
 */
const PRIMARY_TABS = DASHBOARD_NAVIGATION.filter(
  (item) => item.mobilePlacement === "primary"
).map((item) => ({
  id: item.href,
  label: item.shortLabel || item.label,
  icon: item.icon,
  href: item.href,
}));

/* Scan sits in the MIDDLE, which is what makes it the raised button rather than
   a fifth tab, so it is spliced into the centre rather than appended. */
const MOBILE_TABS: MobileTab[] = [
  ...PRIMARY_TABS.slice(0, Math.ceil(PRIMARY_TABS.length / 2)),
  {
    id: "scan",
    label: "Scan",
    icon: "scan",
    href: "/dashboard/scanner",
    center: true,
  },
  ...PRIMARY_TABS.slice(Math.ceil(PRIMARY_TABS.length / 2)),
  { id: "more", label: "More", icon: "more", href: "#" },
];

/* Everything else, grouped exactly as the sidebar groups it, so the phone and
   the desktop tell the same story about where things live. */
const MORE_MENU_SECTIONS = DASHBOARD_SECTION_ORDER.map((section) => ({
  section,
  label: DASHBOARD_SECTION_LABELS[section],
  items: DASHBOARD_NAVIGATION.filter(
    (item) => item.mobilePlacement === "more" && item.section === section
  ),
})).filter((group) => group.items.length > 0);

function getActiveTab(pathname: string): string {
  const scanner = "/dashboard/scanner";
  if (isDashboardRouteActive(pathname, scanner)) return "scan";

  const match = PRIMARY_TABS.find((tab) =>
    isDashboardRouteActive(pathname, tab.href)
  );

  return match ? match.id : "more";
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
          {MORE_MENU_SECTIONS.map((group) => (
            <div key={group.section} className="mobile-more-menu-group">
              <p className="mobile-more-menu-heading">{group.label}</p>
              {group.items.map((item) => (
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
                {tab.href === "/dashboard" && alertCount > 0 && (
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
