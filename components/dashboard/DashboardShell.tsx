"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SydINMark from "@/components/brand/SydINMark";
import GlobalSearchDialog from "@/components/dashboard/GlobalSearchDialog";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
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
  getActivityEventIcon,
  getActivityEventLabel,
  getActivityEventTone,
} from "@/app/lib/activityFeed";
import { formatStockMovementNotes } from "@/app/lib/stockMovements";
import {
  getNotificationsPreview,
  type NotificationsPreview,
} from "@/app/lib/notificationsPreview";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/app/lib/notifications";
import { SCANNER_REQUEST_EVENT } from "@/app/lib/scannerNavigation";
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
const SIDEBAR_ROUTE_EVENT = "sydin:sidebar-route-collapse";

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Header "+ Add" menu. The header owns creation actions; the sidebar owns
// navigation — so the old top tabs (which duplicated the five sidebar links)
// were removed rather than kept alongside it.
const ADD_MENU_ITEMS: {
  label: string;
  description: string;
  href: string;
  icon: UiIconName;
}[] = [
  {
    label: "New item",
    description: "Add a product to your inventory",
    href: "/dashboard/add-item",
    icon: "box",
  },
  {
    label: "Purchase order",
    description: "Record a purchase or expense",
    href: "/dashboard/purchase-orders/new",
    icon: "file",
  },
  {
    label: "Receive stock",
    description: "Log stock arriving without a PO",
    href: "/dashboard/receiving",
    icon: "download",
  },
];

function getDashboardPageContext(pathname: string, action?: string | null) {
  if (pathname === "/dashboard/add-item") {
    return {
      label: "Inventory / Add Item",
      shortLabel: "Add Item",
    };
  }

  if (pathname === "/dashboard/search") {
    return {
      label: "Search",
      shortLabel: "Search",
    };
  }

  // Sub-routes would otherwise fall back to their parent's label ("Purchase
  // Orders" while you are on the new-PO form). That was cosmetic when each page
  // also printed its own <h1>; now that the heading is hidden wherever the
  // chrome shows the name, this bar is the only page title on screen.
  if (pathname === "/dashboard/purchase-orders/new") {
    return {
      label: "Purchase Orders / New",
      shortLabel: "New PO",
    };
  }

  if (pathname === "/dashboard/inventory/import") {
    return {
      label: "Inventory / Import",
      shortLabel: "Import",
    };
  }

  if (pathname === "/dashboard/scanner/phone") {
    return {
      label: "Scanner / Phone",
      shortLabel: "Phone",
    };
  }

  if (/^\/dashboard\/inventory\/[^/]+$/.test(pathname)) {
    if (action === "edit") {
      return {
        label: "Inventory / Edit Item",
        shortLabel: "Edit Item",
      };
    }

    return {
      label: "Inventory / Item Details",
      shortLabel: "Item Details",
    };
  }

  // Without this, /dashboard/pick-lists/[id] falls through to the generic
  // matcher below and reads just "Pick Lists" -- indistinguishable from the
  // list page itself. Same fix as Inventory above.
  if (/^\/dashboard\/pick-lists\/[^/]+$/.test(pathname)) {
    return {
      label: "Pick Lists / Details",
      shortLabel: "Pick List",
    };
  }

  const navigationItem = getDashboardNavigationItem(pathname);
  return {
    label: navigationItem.label,
    shortLabel: navigationItem.shortLabel || navigationItem.label,
  };
}

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
      <span className="dashboard-nav-icon" aria-hidden="true">
        <UiIcon name={item.icon} className="h-5 w-5" />
      </span>
      <span className="dashboard-nav-label">{item.label}</span>
      <span className="dashboard-nav-active-mark" aria-hidden="true" />
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

        if (items.length === 0) return null;

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
  const searchParams = useSearchParams();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);

  const lastSearchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopSearchTriggerRef = useRef<HTMLButtonElement>(null);
  const tabletSearchTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSearchTriggerRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState<boolean | null>(null);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // Notification Center, light v1 (backlog §6): computed live from existing
  // data (Stock Alerts' own low-stock logic + the Activity feed), no new
  // table, no read/unread persistence. See app/lib/notificationsPreview.ts.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsPreview, setNotificationsPreview] =
    useState<NotificationsPreview | null>(null);
  // backlog §6, upgraded to persisted (2026-08-12): a real log of
  // low/out-of-stock CROSSING events, generated by recordStockMovement() —
  // see app/lib/notifications.ts. Additive to the section above, not a
  // replacement: "Needs attention" recomputes live every load and is proven,
  // so it keeps driving the bell's badge count unchanged. This section is a
  // markable-read history layered on top, not a second source of the same
  // number — an empty result here (fresh migration, or nothing has crossed
  // yet) simply hides the section rather than nagging about setup.
  const [persistedNotifications, setPersistedNotifications] = useState<
    Notification[]
  >([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  // Header-bar clicks open the search as a dropdown anchored under the bar;
  // Ctrl/Cmd+K (and the tablet/mobile icon buttons, where no bar is visible)
  // keep the centered modal palette.
  const [searchAnchored, setSearchAnchored] = useState(false);
  const [searchShortcutKey, setSearchShortcutKey] = useState("Ctrl");
  const [businessSettings, setBusinessSettings] = useState(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);

  useEffect(() => {
    if (!/mac/i.test(navigator.platform || navigator.userAgent)) return;

    const frame = window.requestAnimationFrame(() => {
      setSearchShortcutKey("⌘");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    const handleRouteCollapse = (event: Event) => {
      const customEvent = event as CustomEvent<{
        collapsed: boolean | null;
      }>;
      setRouteCollapsed(customEvent.detail?.collapsed ?? null);
    };

    window.addEventListener(SIDEBAR_ROUTE_EVENT, handleRouteCollapse);
    return () =>
      window.removeEventListener(SIDEBAR_ROUTE_EVENT, handleRouteCollapse);
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

        // Chained on the settings/usage this just resolved, rather than a
        // separate effect keyed off state, so this never runs twice (once
        // against the DEFAULT_* placeholders, once against the real values).
        getNotificationsPreview(userId, loadedUsage.subscription, settings)
          .then((preview) => {
            if (active) setNotificationsPreview(preview);
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);

    // Independent of the chain above — getNotifications() fails to an empty
    // array on its own (see isMissingTableError in app/lib/notifications.ts),
    // so it doesn't need business settings/usage to have resolved first.
    getNotifications(userId, 8)
      .then((rows) => {
        if (active) setPersistedNotifications(rows);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [userId]);

  const unreadPersistedCount = persistedNotifications.filter(
    (row) => !row.read_at
  ).length;

  const handleNotificationClick = (notification: Notification) => {
    setNotificationsOpen(false);
    if (!notification.read_at) {
      setPersistedNotifications((current) =>
        current.map((row) =>
          row.id === notification.id
            ? { ...row, read_at: new Date().toISOString() }
            : row
        )
      );
      void markNotificationRead(notification.id);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setPersistedNotifications((current) =>
      current.map((row) => ({
        ...row,
        read_at: row.read_at || new Date().toISOString(),
      }))
    );
    void markAllNotificationsRead(userId);
  };

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

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        notificationsMenuRef.current &&
        !notificationsMenuRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        notificationsTriggerRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  // The anchored dropdown has no scrim, so dismiss it on an outside click.
  // The wrapper contains the trigger too, so clicking the bar just toggles.
  useEffect(() => {
    if (!globalSearchOpen || !searchAnchored) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target as Node)
      ) {
        setGlobalSearchOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [globalSearchOpen, searchAnchored]);

  useEffect(() => {
    if (!addMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setAddMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddMenuOpen(false);
        addTriggerRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const editableTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (editableTarget) return;

      event.preventDefault();
      lastSearchTriggerRef.current = null;
      setSearchAnchored(false);
      setGlobalSearchOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentPage = getDashboardPageContext(
    pathname,
    searchParams.get("action")
  );
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
    if (routeCollapsed !== null) {
      setRouteCollapsed((current) => !current);
      return;
    }

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
  const effectiveCollapsed = routeCollapsed ?? collapsed;

  const requestScanner = useCallback(() => {
    // The Inventory page keeps its own quick-scan modal, so stay in place when
    // the user is already there; everywhere else opens the Scanner Workspace.
    if (pathname === "/dashboard/inventory") {
      window.dispatchEvent(new Event(SCANNER_REQUEST_EVENT));
      return;
    }

    router.push("/dashboard/scanner?mode=lookup");
  }, [pathname, router]);

  const openGlobalSearch = (
    trigger: HTMLButtonElement | null,
    { anchored = false }: { anchored?: boolean } = {}
  ) => {
    lastSearchTriggerRef.current = trigger;
    setSearchAnchored(anchored);
    setGlobalSearchOpen(true);
  };

  const closeGlobalSearch = () => {
    setGlobalSearchOpen(false);
    window.requestAnimationFrame(() => {
      lastSearchTriggerRef.current?.focus();
    });
  };

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
        "dashboard-shell dashboard-workspace-shell liquid-bg min-h-screen text-theme-primary",
        effectiveCollapsed && "dashboard-shell-collapsed"
      )}
    >
      <aside
        className={cx(
          "dashboard-sidebar glass-navigation",
          effectiveCollapsed && "dashboard-sidebar-collapsed"
        )}
      >
        <div className="dashboard-sidebar-header">
          <Link
            href="/dashboard"
            className="dashboard-brand-link"
            aria-label="SydIN dashboard"
          >
            <Image
              src="/brand/sydin-mark.svg"
              alt=""
              width={40}
              height={40}
              priority
              className="dashboard-brand-mark object-contain"
            />
            <Image
              src="/brand/sydin-logo.svg"
              alt=""
              width={132}
              height={40}
              priority
              className="dashboard-brand-logo object-contain"
            />
          </Link>
          <IconButton
            label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={
              <UiIcon
                name={effectiveCollapsed ? "chevron-right" : "chevron-left"}
                className="h-4 w-4"
              />
            }
            size="sm"
            onClick={toggleCollapsed}
            className="dashboard-sidebar-toggle"
          />
        </div>

        <div className="dashboard-sidebar-workspace" aria-label="Current workspace">
          <AccountAvatar
            logoUrl={businessSettings.business_logo_url}
            businessName={businessSettings.business_name}
            size="sm"
          />
          <div className="dashboard-sidebar-workspace-copy">
            <span>Workspace</span>
            <strong>{businessSettings.business_name}</strong>
            <small>
              {planName} plan - {usagePercent}% used
            </small>
          </div>
        </div>

        <div className="dashboard-sidebar-scroll">
          <NavigationGroups pathname={pathname} compact />
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
            {currentPage.label}
          </p>
          <p className="truncate text-xs text-[var(--text-subtle)]">
            {businessSettings.business_name}
          </p>
        </div>
        <button
          ref={tabletSearchTriggerRef}
          type="button"
          onClick={(event) => openGlobalSearch(event.currentTarget)}
          className="ui-icon-button ui-icon-button-md"
          aria-label="Open global search"
          title="Search"
        >
          <UiIcon name="search" className="h-5 w-5" />
        </button>
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
          <Image
            src="/brand/sydin-mark.svg"
            alt=""
            width={34}
            height={34}
            priority
            className="dashboard-mobile-brand-mark object-contain"
          />
        </Link>
        <p className="sr-only">
          {currentPage.shortLabel}
        </p>
        <button
          ref={mobileSearchTriggerRef}
          type="button"
          onClick={(event) => openGlobalSearch(event.currentTarget)}
          className="ui-icon-button ui-icon-button-md ml-auto"
          aria-label="Open global search"
          title="Search"
        >
          <UiIcon name="search" className="h-5 w-5" />
        </button>
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

      <div className="dashboard-main-canvas">
        <div className="dashboard-desktop-toolbar">
          <div className="dashboard-top-context">
            <p className="dashboard-top-context-title">{currentPage.label}</p>
          </div>

          <div
            ref={searchWrapRef}
            className={cx(
              "dashboard-top-search",
              globalSearchOpen && searchAnchored && "dashboard-top-search-open"
            )}
          >
            <button
              ref={desktopSearchTriggerRef}
              type="button"
              onClick={(event) =>
                globalSearchOpen && searchAnchored
                  ? setGlobalSearchOpen(false)
                  : openGlobalSearch(event.currentTarget, { anchored: true })
              }
              className="dashboard-top-searchbar"
              aria-label="Search SydIN"
              aria-haspopup="dialog"
              aria-expanded={globalSearchOpen && searchAnchored}
              title="Search (Ctrl/Cmd+K)"
            >
              <UiIcon name="search" className="h-4 w-4 shrink-0" />
              <span className="dashboard-top-searchbar-label">
                Search items, orders, suppliers...
              </span>
              <span className="dashboard-top-searchbar-kbd" aria-hidden="true">
                <kbd>{searchShortcutKey}</kbd>
                <kbd>K</kbd>
              </span>
            </button>

            {globalSearchOpen && searchAnchored && (
              <GlobalSearchDialog
                open
                anchored
                userId={userId}
                pathname={pathname}
                onClose={closeGlobalSearch}
              />
            )}
          </div>

          <div className="dashboard-top-tools">
            <div ref={addMenuRef} className="dashboard-top-add">
              <button
                ref={addTriggerRef}
                type="button"
                className="dashboard-top-primary-button"
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                onClick={() => setAddMenuOpen((current) => !current)}
              >
                <UiIcon name="plus" className="h-4 w-4" />
                Add
                <UiIcon
                  name="chevron-down"
                  className={cx(
                    "dashboard-top-add-chevron h-4 w-4",
                    addMenuOpen && "dashboard-top-add-chevron-open"
                  )}
                />
              </button>

              {addMenuOpen && (
                <MenuSurface className="dashboard-top-add-menu">
                  {ADD_MENU_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setAddMenuOpen(false)}
                    >
                      <UiIcon name={item.icon} className="h-4 w-4" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  ))}
                </MenuSurface>
              )}
            </div>
            <button
              type="button"
              onClick={requestScanner}
              className="dashboard-top-icon-button"
              aria-label="Scan inventory code"
              title="Scan"
            >
              <UiIcon name="scan" className="h-5 w-5" />
            </button>
            <div ref={notificationsMenuRef} className="dashboard-top-notifications">
              <button
                ref={notificationsTriggerRef}
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="dashboard-top-icon-button"
                aria-label="Notifications"
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
                title="Notifications"
              >
                <UiIcon name="bell" className="h-5 w-5" />
                {(notificationsPreview?.lowStockTotal || 0) > 0 && (
                  <span className="dashboard-top-notification-badge">
                    {notificationsPreview!.lowStockTotal > 9
                      ? "9+"
                      : notificationsPreview!.lowStockTotal}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <MenuSurface className="dashboard-notifications-menu">
                  <div className="dashboard-notifications-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>Needs attention + recent activity</span>
                    </div>
                    {unreadPersistedCount > 0 && (
                      <button
                        type="button"
                        className="dashboard-notifications-mark-all"
                        onClick={handleMarkAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {persistedNotifications.length > 0 && (
                    <div className="dashboard-notifications-section">
                      <p className="dashboard-notifications-section-title">
                        Alerts
                      </p>
                      {persistedNotifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={notification.link_href || "/dashboard/alerts"}
                          role="menuitem"
                          className="dashboard-notifications-row"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <span
                            className={cx(
                              "dashboard-notifications-dot",
                              notification.type === "out_of_stock"
                                ? "dashboard-notifications-dot-danger"
                                : "dashboard-notifications-dot-warning",
                              notification.read_at &&
                                "dashboard-notifications-dot-read"
                            )}
                          />
                          <span className="dashboard-notifications-row-text">
                            <strong>{notification.title}</strong>
                            <small>
                              {notification.body ||
                                formatNotificationDate(notification.created_at)}
                            </small>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {!notificationsPreview ? (
                    <div className="dashboard-notifications-empty">
                      Loading...
                    </div>
                  ) : notificationsPreview.lowStock.length === 0 &&
                    notificationsPreview.activity.length === 0 &&
                    persistedNotifications.length === 0 ? (
                    <div className="dashboard-notifications-empty">
                      You&apos;re all caught up.
                    </div>
                  ) : (
                    <>
                      {notificationsPreview.lowStock.length > 0 && (
                        <div className="dashboard-notifications-section">
                          <p className="dashboard-notifications-section-title">
                            Needs attention
                          </p>
                          {notificationsPreview.lowStock.map((entry) => (
                            <Link
                              key={entry.id}
                              href={`/dashboard/inventory/${entry.id}`}
                              role="menuitem"
                              className="dashboard-notifications-row"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              <span
                                className={cx(
                                  "dashboard-notifications-dot",
                                  entry.state === "out"
                                    ? "dashboard-notifications-dot-danger"
                                    : "dashboard-notifications-dot-warning"
                                )}
                              />
                              <span className="dashboard-notifications-row-text">
                                <strong>{entry.name}</strong>
                                <small>
                                  {entry.state === "out"
                                    ? "Out of stock"
                                    : `Low stock — ${entry.quantity} left`}
                                </small>
                              </span>
                            </Link>
                          ))}
                          {notificationsPreview.lowStockTotal >
                            notificationsPreview.lowStock.length && (
                            <Link
                              href="/dashboard/alerts"
                              role="menuitem"
                              className="dashboard-notifications-viewall"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              View all {notificationsPreview.lowStockTotal} alerts
                            </Link>
                          )}
                        </div>
                      )}

                      {notificationsPreview.activity.length > 0 && (
                        <div className="dashboard-notifications-section">
                          <p className="dashboard-notifications-section-title">
                            Recent activity
                          </p>
                          {notificationsPreview.activity.map((event) => (
                            <div
                              key={event.id}
                              className="dashboard-notifications-row"
                            >
                              <span
                                className={cx(
                                  "dashboard-notifications-icon",
                                  `dashboard-notifications-icon-${getActivityEventTone(
                                    event.type
                                  )}`
                                )}
                              >
                                <UiIcon
                                  name={getActivityEventIcon(event.type) as UiIconName}
                                  className="h-3.5 w-3.5"
                                />
                              </span>
                              <span className="dashboard-notifications-row-text">
                                <strong>
                                  {getActivityEventLabel(event.type)}
                                  {event.itemName ? ` · ${event.itemName}` : ""}
                                </strong>
                                <small>
                                  {event.notes
                                    ? formatStockMovementNotes(event.notes)
                                    : formatNotificationDate(event.createdAt)}
                                </small>
                              </span>
                            </div>
                          ))}
                          <Link
                            href="/dashboard/activity"
                            role="menuitem"
                            className="dashboard-notifications-viewall"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            View all activity
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </MenuSurface>
              )}
            </div>
            <div ref={accountMenuRef} className="dashboard-top-account">
              <button
                ref={accountTriggerRef}
                type="button"
                className="dashboard-top-account-pill"
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
                <span>
                  <strong>{businessSettings.business_name}</strong>
                  <small>{email || `${planName} plan`}</small>
                </span>
                <UiIcon
                  name="chevron-down"
                  className={cx(
                    "dashboard-top-account-chevron h-4 w-4",
                    accountMenuOpen && "dashboard-top-account-chevron-open"
                  )}
                />
              </button>

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
                      Plan &amp; usage
                    </Link>
                    <Link
                      href="/dashboard/settings#appearance-heading"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <UiIcon name="appearance" className="h-4 w-4" />
                      Workspace style
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <UiIcon name="settings" className="h-4 w-4" />
                      Settings
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
            </div>
          </div>
        </div>

        <div className="dashboard-shell-content">{children}</div>
      </div>

      <nav
        className="dashboard-mobile-nav glass-navigation"
        aria-label="Primary mobile navigation"
      >
        {DASHBOARD_NAVIGATION.filter(
          (item) => item.mobilePlacement === "primary"
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

      <GlobalSearchDialog
        open={globalSearchOpen && !searchAnchored}
        userId={userId}
        pathname={pathname}
        onClose={closeGlobalSearch}
      />
    </div>
  );
}
