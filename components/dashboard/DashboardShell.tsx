"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SydINMark from "@/components/brand/SydINMark";
import SydINWordmark from "@/components/brand/SydINWordmark";
import UiIcon from "@/components/UiIcon";
import {
  Badge,
  Button,
  IconButton,
  MenuSurface,
  SheetShell,
  buttonClassName,
} from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionUsage,
  getUpgradeRequestHref,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import {
  SCANNER_REQUEST_EVENT,
  SCANNER_REQUEST_STORAGE_KEY,
} from "@/app/lib/scannerNavigation";
import { supabase } from "@/app/lib/supabase";
import {
  DASHBOARD_NAVIGATION,
  DASHBOARD_SECTION_LABELS,
  DASHBOARD_SECTION_ORDER,
  getDashboardNavigationItem,
  isDashboardRouteActive,
  type DashboardNavigationItem,
} from "@/components/dashboard/navigation";
import { cx } from "@/components/ui/utils";

const SIDEBAR_STORAGE_KEY = "sydin:sidebar-collapsed";

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

interface DashboardShellProps {
  children: React.ReactNode;
  userId: string;
  email?: string | null;
}

function AccountAvatar({
  logoUrl,
  businessName,
  size = "md",
}: {
  logoUrl: string;
  businessName: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  return (
    <span
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-selected)] text-[var(--text-accent)]",
        sizeClass
      )}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={businessName}
          fill
          sizes={size === "sm" ? "36px" : "40px"}
          className="bg-white object-contain p-1"
        />
      ) : (
        <SydINMark size="sm" />
      )}
    </span>
  );
}

function NavigationLink({
  item,
  pathname,
  compact,
  onNavigate,
}: {
  item: DashboardNavigationItem;
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const active = isDashboardRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      className={cx(
        "dashboard-nav-link",
        active && "dashboard-nav-link-active",
        compact && "dashboard-nav-link-compact"
      )}
    >
      <UiIcon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className="dashboard-nav-label">{item.label}</span>
      <span className="dashboard-nav-tooltip" role="tooltip">
        {item.label}
      </span>
    </Link>
  );
}

function NavigationGroups({
  pathname,
  compact = false,
  onNavigate,
}: {
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Dashboard navigation" className="dashboard-nav-groups">
      {DASHBOARD_SECTION_ORDER.map((section) => {
        const items = DASHBOARD_NAVIGATION.filter(
          (item) => item.section === section
        );

        return (
          <div key={section} className="dashboard-nav-group">
            <p className="dashboard-nav-group-label">
              {DASHBOARD_SECTION_LABELS[section]}
            </p>
            <div className="dashboard-nav-group-items">
              {items.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  compact={compact}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export default function DashboardShell({
  children,
  userId,
  email,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [businessSettings, setBusinessSettings] = useState(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setCollapsed(
          window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
        );
      } catch {
        setCollapsed(false);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      getOrCreateBusinessSettings(userId),
      getSubscriptionUsage(userId),
    ])
      .then(([settings, loadedUsage]) => {
        if (!active) return;
        setBusinessSettings(settings);
        setUsage(loadedUsage);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const currentItem = getDashboardNavigationItem(pathname);
  const planName = formatPlanName(usage.subscription.plan);
  const itemLimit = usage.subscription.item_limit;
  const usagePercent =
    itemLimit > 0
      ? Math.min(100, Math.round((usage.usedItems / itemLimit) * 100))
      : 0;
  const upgradeHref = getUpgradeRequestHref(
    usage.subscription.plan,
    "account-menu"
  );
  const quickAddVisible =
    pathname !== "/dashboard" &&
    pathname !== "/dashboard/inventory" &&
    pathname !== "/dashboard/add-item";

  const groupedMoreItems = useMemo(
    () =>
      DASHBOARD_SECTION_ORDER.map((section) => ({
        section,
        items: DASHBOARD_NAVIGATION.filter(
          (item) =>
            item.mobilePlacement === "more" && item.section === section
        ),
      })).filter((group) => group.items.length > 0),
    []
  );

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // The preference still applies for this session.
      }
      return next;
    });
  };

  const requestScanner = useCallback(() => {
    if (pathname === "/dashboard/inventory") {
      window.dispatchEvent(new Event(SCANNER_REQUEST_EVENT));
      return;
    }

    try {
      window.sessionStorage.setItem(SCANNER_REQUEST_STORAGE_KEY, "true");
    } catch {
      // Navigation still reaches the scanner workspace.
    }
    router.push("/dashboard/inventory");
  }, [pathname, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const accountSummary = (
    <>
      <div className="flex items-center gap-3">
        <AccountAvatar
          logoUrl={businessSettings.business_logo_url}
          businessName={businessSettings.business_name}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">
            {businessSettings.business_name}
          </p>
          <p className="truncate text-xs text-[var(--text-subtle)]">
            {email || "Authenticated account"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge tone="accent">{planName} plan</Badge>
        <span className="text-xs font-bold text-[var(--text-secondary)]">
          {usage.usedItems} / {itemLimit} items
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-page-muted)]"
        role="progressbar"
        aria-label="Inventory item usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usagePercent}
      >
        <span
          className="block h-full rounded-full bg-[var(--brand-cyan)]"
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </>
  );

  return (
    <div
      className={cx(
        "dashboard-shell liquid-bg min-h-screen text-theme-primary",
        collapsed && "dashboard-shell-collapsed"
      )}
    >
      <aside
        className={cx(
          "dashboard-sidebar glass-navigation",
          collapsed && "dashboard-sidebar-collapsed"
        )}
      >
        <div className="dashboard-sidebar-header">
          <Link
            href="/dashboard"
            className="dashboard-brand-link"
            aria-label="SydIN dashboard"
          >
            <SydINMark size="md" />
            <SydINWordmark
              size="sm"
              className="dashboard-sidebar-wordmark"
            />
          </Link>
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={
              <UiIcon
                name={collapsed ? "chevron-right" : "chevron-left"}
                className="h-4 w-4"
              />
            }
            size="sm"
            onClick={toggleCollapsed}
            className="dashboard-sidebar-toggle"
          />
        </div>

        <div className="dashboard-sidebar-scroll">
          <NavigationGroups pathname={pathname} compact={collapsed} />
        </div>

        <div
          ref={accountMenuRef}
          className="dashboard-account-area"
        >
          {accountMenuOpen && (
            <MenuSurface className="dashboard-account-menu">
              <div className="p-3">{accountSummary}</div>
              <div className="dashboard-account-menu-links">
                <Link
                  href={upgradeHref}
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <UiIcon name="usage" className="h-4 w-4" />
                  Plan & usage
                </Link>
                <Link
                  href="/dashboard/settings#appearance-heading"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <UiIcon name="appearance" className="h-4 w-4" />
                  Appearance
                </Link>
                <Link
                  href="/dashboard/settings"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <UiIcon name="settings" className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  href="/dashboard/help"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <UiIcon name="help" className="h-4 w-4" />
                  Help Center
                </Link>
              </div>
              <div className="dashboard-account-menu-signout">
                <button type="button" role="menuitem" onClick={handleSignOut}>
                  <UiIcon name="logout" className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </MenuSurface>
          )}

          <button
            ref={accountTriggerRef}
            type="button"
            className="dashboard-account-trigger"
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((current) => !current)}
          >
            <AccountAvatar
              logoUrl={businessSettings.business_logo_url}
              businessName={businessSettings.business_name}
              size="sm"
            />
            <span className="dashboard-account-copy">
              <span>{businessSettings.business_name}</span>
              <span>{planName} plan</span>
            </span>
            <UiIcon
              name="chevron-up"
              className="dashboard-account-chevron h-4 w-4"
            />
          </button>
        </div>
      </aside>

      <header className="dashboard-tablet-header glass-navigation">
        <IconButton
          label="Open navigation"
          icon={<UiIcon name="menu" className="h-5 w-5" />}
          onClick={() => setTabletDrawerOpen(true)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">
            {currentItem.label}
          </p>
          <p className="truncate text-xs text-[var(--text-subtle)]">
            {businessSettings.business_name}
          </p>
        </div>
        {quickAddVisible && (
          <Link
            href="/dashboard/add-item"
            className={buttonClassName({ size: "sm" })}
          >
            <UiIcon name="plus" className="h-4 w-4" />
            Add Item
          </Link>
        )}
      </header>

      <header className="dashboard-mobile-header glass-navigation">
        <Link href="/dashboard" aria-label="SydIN home">
          <SydINMark size="md" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text-primary)]">
          {currentItem.shortLabel || currentItem.label}
        </p>
        {quickAddVisible ? (
          <Link
            href="/dashboard/add-item"
            aria-label="Add item"
            className="ui-icon-button ui-icon-button-md"
          >
            <UiIcon name="plus" className="h-5 w-5" />
          </Link>
        ) : (
          <span className="h-11 w-11" aria-hidden="true" />
        )}
      </header>

      <div className="dashboard-desktop-toolbar">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">
            {currentItem.label}
          </p>
          <p className="truncate text-xs text-[var(--text-subtle)]">
            {businessSettings.business_name}
          </p>
        </div>
        {quickAddVisible && (
          <Link
            href="/dashboard/add-item"
            className={buttonClassName({ size: "sm" })}
          >
            <UiIcon name="plus" className="h-4 w-4" />
            Add Item
          </Link>
        )}
      </div>

      <div className="dashboard-shell-content">{children}</div>

      <nav
        className="dashboard-mobile-nav glass-navigation"
        aria-label="Primary mobile navigation"
      >
        {DASHBOARD_NAVIGATION.filter(
          (item) =>
            item.mobilePlacement === "primary" &&
            item.href !== "/dashboard/pick-lists"
        ).map((item) => {
          const active = isDashboardRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "dashboard-mobile-nav-item",
                active && "dashboard-mobile-nav-item-active"
              )}
            >
              <UiIcon name={item.icon} className="h-5 w-5" />
              <span>{item.shortLabel || item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={requestScanner}
          className="dashboard-mobile-nav-item dashboard-mobile-scan"
          aria-label="Scan inventory code"
        >
          <span className="dashboard-mobile-scan-icon">
            <UiIcon name="scan" className="h-6 w-6" />
          </span>
          <span>Scan</span>
        </button>
        {DASHBOARD_NAVIGATION.filter(
          (item) => item.href === "/dashboard/pick-lists"
        ).map((item) => {
          const active = isDashboardRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "dashboard-mobile-nav-item",
                active && "dashboard-mobile-nav-item-active"
              )}
            >
              <UiIcon name={item.icon} className="h-5 w-5" />
              <span>Pick Lists</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cx(
            "dashboard-mobile-nav-item",
            DASHBOARD_NAVIGATION.some(
              (item) =>
                item.mobilePlacement === "more" &&
                isDashboardRouteActive(pathname, item.href)
            ) && "dashboard-mobile-nav-item-active"
          )}
          aria-label="Open more navigation"
          aria-expanded={moreOpen}
        >
          <UiIcon name="more" className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      <SheetShell
        open={tabletDrawerOpen}
        onClose={() => setTabletDrawerOpen(false)}
        side="left"
        title="Navigation"
        eyebrow="SydIN"
        className="dashboard-tablet-drawer"
      >
        <NavigationGroups
          pathname={pathname}
          onNavigate={() => setTabletDrawerOpen(false)}
        />
        <div className="mt-6 border-t border-[var(--border-divider)] pt-5">
          <button
            type="button"
            className="dashboard-account-trigger w-full"
            onClick={() => {
              setTabletDrawerOpen(false);
              setMoreOpen(true);
            }}
          >
            <AccountAvatar
              logoUrl={businessSettings.business_logo_url}
              businessName={businessSettings.business_name}
              size="sm"
            />
            <span className="dashboard-account-copy">
              <span>{businessSettings.business_name}</span>
              <span>{planName} plan</span>
            </span>
            <UiIcon name="chevron-right" className="h-4 w-4" />
          </button>
        </div>
      </SheetShell>

      <SheetShell
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        side="bottom"
        title="More"
        description="Workspace tools and account settings"
        className="dashboard-more-sheet"
      >
        <div className="dashboard-more-account">{accountSummary}</div>

        <div className="mt-5 space-y-5">
          {groupedMoreItems.map((group) => (
            <section
              key={group.section}
              aria-label={DASHBOARD_SECTION_LABELS[group.section]}
            >
              <p className="dashboard-nav-group-label">
                {DASHBOARD_SECTION_LABELS[group.section]}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <NavigationLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 grid gap-2 border-t border-[var(--border-divider)] pt-5">
          <Link
            href={upgradeHref}
            onClick={() => setMoreOpen(false)}
            className={buttonClassName({ variant: "secondary" })}
          >
            <UiIcon name="usage" className="h-4 w-4" />
            Plan & usage
          </Link>
          <Button
            variant="danger"
            leadingIcon={<UiIcon name="logout" className="h-4 w-4" />}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </SheetShell>
    </div>
  );
}
