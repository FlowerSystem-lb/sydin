"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { formatDepotLabel, getDepotsForUser, type Depot } from "@/app/lib/depots";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  FALLBACK_SUBSCRIPTION,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import {
  calculateInventoryValue,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  formatStockMovementNotes,
  getRecentStockMovements,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
} from "@/app/lib/stockMovements";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  getPurchaseOrderSplit,
  getPurchaseOrdersForUser,
  type PurchaseOrder,
} from "@/app/lib/purchaseOrders";
import { supabase } from "@/app/lib/supabase";

interface Item {
  id: number;
  name: string;
  category: string | null;
  category_id?: number | null;
  quantity: number;
  image: string | null;
  sku?: string | null;
  item_code?: string | null;
  depot_id?: number | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
}

type StockState = "in" | "low" | "out";

const DASHBOARD_RETURN_TO = "/dashboard";
const LOW_STOCK_INVENTORY_HREF = "/dashboard/inventory?stock=low";

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function getDashboardItemHref(itemId: number) {
  return `/dashboard/inventory/${itemId}?returnTo=${encodeURIComponent(
    DASHBOARD_RETURN_TO
  )}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number, currencyCode: string) {
  const currency = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(value) >= 10000 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDateDistance(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const differenceMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (differenceMs < hour) {
    return `${Math.max(1, Math.round(differenceMs / minute))}m ago`;
  }

  if (differenceMs < day) {
    return `${Math.round(differenceMs / hour)}h ago`;
  }

  if (differenceMs < 7 * day) {
    return `${Math.round(differenceMs / day)}d ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getMovementStatus(movementType: StockMovement["movement_type"]) {
  if (movementType === "damaged_lost") {
    return {
      label: "Attention",
      tone: "warning",
    };
  }

  if (movementType === "adjustment") {
    return {
      label: "Review",
      tone: "neutral",
    };
  }

  return {
    label: "Recorded",
    tone: "success",
  };
}

function getItemThreshold(
  item: Item,
  canUseItemThreshold: boolean,
  fallbackThreshold: number
) {
  return canUseItemThreshold
    ? getEffectiveItemLowStockThreshold(
        item.min_stock_level,
        fallbackThreshold
      )
    : fallbackThreshold;
}

function getStockState(quantity: number, threshold: number): StockState {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "in";
}

function getStockLabel(state: StockState) {
  if (state === "out") return "Out of stock";
  if (state === "low") return "Low stock";
  return "In stock";
}

function DashboardPanelHeader({
  icon,
  title,
  href,
  hrefLabel = "View all",
}: {
  icon: UiIconName;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="sydin-overview-panel-header">
      <div className="sydin-overview-panel-title">
        <UiIcon name={icon} className="h-4 w-4" />
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="sydin-overview-text-link">
          {hrefLabel}
          <UiIcon name="chevron-right" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ItemThumb({ item }: { item: Item }) {
  if (item.image) {
    return (
      <span className="sydin-overview-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  return (
    <span className="sydin-overview-thumb">
      <UiIcon name="box" className="h-4 w-4" />
    </span>
  );
}

/** Animates a number from 0 to `value` on mount (skipped for reduced motion). */
function CountUpNumber({
  value,
  format,
}: {
  value: number;
  format: (current: number) => string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let frame = 0;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      if (reduceMotion) {
        setDisplay(value);
        return;
      }
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(display)}</>;
}

/** Semicircle gauge of real stock health: % of items above their low-stock threshold. */
function StockHealthGauge({
  inCount,
  lowCount,
  outCount,
}: {
  inCount: number;
  lowCount: number;
  outCount: number;
}) {
  const total = inCount + lowCount + outCount;
  const percent = total === 0 ? 0 : Math.round((inCount / total) * 100);
  const [arc, setArc] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setArc(percent));
    return () => window.cancelAnimationFrame(frame);
  }, [percent]);

  const toneClass =
    percent >= 70
      ? "sydin-health-good"
      : percent >= 40
        ? "sydin-health-warn"
        : "sydin-health-bad";

  return (
    <div className={`sydin-health-gauge ${toneClass}`}>
      <svg viewBox="0 0 200 112" role="img" aria-label={`${percent}% of items in stock`}>
        <path
          d="M 18 104 A 82 82 0 0 1 182 104"
          fill="none"
          className="sydin-health-track"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 18 104 A 82 82 0 0 1 182 104"
          fill="none"
          className="sydin-health-arc"
          strokeWidth="15"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${arc} 100`}
        />
      </svg>
      <div className="sydin-health-center">
        <strong>
          <CountUpNumber value={percent} format={(n) => `${Math.round(n)}%`} />
        </strong>
        <small>items in stock</small>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );
  const canUseItemThreshold = planCapabilities.customLowStockThreshold;
  const currencyCode = normalizeCurrencyCode(
    businessSettings.currency_code,
    "USD"
  );

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError) {
          setError("We could not confirm your session. Please sign in again.");
          setLoading(false);
          return;
        }

        if (!user) {
          setLoading(false);
          return;
        }

        Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, category, category_id, quantity, image, sku, item_code, depot_id, unit_type, custom_unit_label, cost_price, selling_price, min_stock_level"
            )
            .eq("user_id", user.id)
            .order("id", { ascending: false }),
          getSubscriptionUsage(user.id),
          getOrCreateBusinessSettings(user.id),
          getCategoriesForUser(user.id).catch(() => []),
          getDepotsForUser(user.id).catch(() => []),
          getRecentStockMovements(user.id, 8).catch(() => []),
          // Empty when the phase-8 SQL has not been run yet — the panel
          // falls back to its empty state instead of breaking the dashboard.
          getPurchaseOrdersForUser(user.id).catch(() => []),
        ])
          .then(
            ([
              { data, error: inventoryError },
              usage,
              settings,
              loadedCategories,
              loadedDepots,
              loadedMovements,
              loadedPurchaseOrders,
            ]) => {
              if (!isActive) return;

              if (inventoryError) {
                setError(
                  "We could not load your inventory summary. Refresh the page and try again."
                );
                setLoading(false);
                return;
              }

              setItems((data || []) as Item[]);
              setSubscriptionUsage(usage);
              setBusinessSettings(settings);
              setCategories(loadedCategories);
              setDepots(loadedDepots);
              setMovements(loadedMovements);
              setPurchaseOrders(loadedPurchaseOrders);
              setLoading(false);
            }
          )
          .catch(() => {
            if (!isActive) return;

            setError(
              "We could not load your dashboard. Refresh the page and try again."
            );
            setLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;

        setError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );

  const dashboardData = useMemo(() => {
    const enrichedItems = items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const threshold = getItemThreshold(
        item,
        canUseItemThreshold,
        effectiveLowStockThreshold
      );
      const state = getStockState(quantity, threshold);
      const retailValue = calculateInventoryValue(quantity, item.selling_price);
      const costValue = calculateInventoryValue(quantity, item.cost_price);
      const value = retailValue ?? costValue;

      return {
        item,
        quantity,
        threshold,
        state,
        value,
        category: resolveCategoryDisplay(
          item,
          categories.find((category) => category.id === item.category_id) ||
            null
        ),
        depot: formatDepotLabel(
          item.depot_id ? depotById.get(item.depot_id) : null
        ),
      };
    });

    const totalQuantity = enrichedItems.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );
    const valueItems = enrichedItems.filter((entry) => entry.value !== null);
    const totalValue = valueItems.reduce(
      (sum, entry) => sum + (entry.value || 0),
      0
    );
    // Only items carrying a price contribute to totalValue, so the figure is a
    // partial sum whenever any item is unpriced. Surfaced on the card (see
    // summaryCards) rather than left implied — measured 2026-08-12 on the real
    // workspace: "Inventory Value $480.00" was computed from 2 of 10 items
    // holding 8 of 35,185 units, presented as the workspace total. Flagged as
    // misleading in the 2026-08-04 decision-log entry that deferred the wider
    // Dashboard rework; captioning it is the part that did not need to wait.
    const pricedItemCount = valueItems.length;
    const lowStockItems = enrichedItems
      .filter((entry) => entry.state !== "in")
      .sort((left, right) => {
        if (left.state !== right.state) return left.state === "out" ? -1 : 1;
        return left.quantity - right.quantity;
      });
    const activeDepotIds = new Set(
      enrichedItems
        .map((entry) => entry.item.depot_id)
        .filter((depotId): depotId is number => typeof depotId === "number")
    );

    return {
      enrichedItems,
      recentItems: enrichedItems.slice(0, 6),
      totalItems: items.length,
      totalQuantity,
      totalValue,
      hasValue: valueItems.length > 0,
      pricedItemCount,
      totalDepots: Math.max(depots.length, activeDepotIds.size),
      lowStockItems: lowStockItems.slice(0, 5),
      lowStockCount: lowStockItems.length,
      outStockCount: lowStockItems.filter((entry) => entry.state === "out")
        .length,
    };
  }, [
    canUseItemThreshold,
    categories,
    depotById,
    depots.length,
    effectiveLowStockThreshold,
    items,
  ]);

  const stockBreakdown = {
    out: dashboardData.outStockCount,
    low: dashboardData.lowStockCount - dashboardData.outStockCount,
    in: dashboardData.totalItems - dashboardData.lowStockCount,
  };

  const summaryCards = [
    {
      label: "Total Items",
      rawValue: dashboardData.totalItems,
      format: (n: number) => formatNumber(Math.round(n)),
      detail: `${formatNumber(dashboardData.lowStockCount)} need attention`,
      icon: "box" as UiIconName,
      href: "/dashboard/inventory",
      accent: "sydin-kpi-teal",
      showBreakdown: true,
    },
    {
      label: "Depots / Locations",
      rawValue: dashboardData.totalDepots,
      format: (n: number) => formatNumber(Math.round(n)),
      detail: "Inventory locations",
      icon: "depots" as UiIconName,
      href: "/dashboard/depots",
      accent: "sydin-kpi-indigo",
      showBreakdown: false,
    },
    {
      label: "Total Quantity",
      rawValue: dashboardData.totalQuantity,
      format: (n: number) => formatNumber(Math.round(n)),
      detail: "Units across items",
      icon: "layers" as UiIconName,
      href: "/dashboard/inventory",
      accent: "sydin-kpi-violet",
      showBreakdown: false,
    },
    {
      label: "Inventory Value",
      rawValue: dashboardData.hasValue ? dashboardData.totalValue : null,
      format: (n: number) => formatCurrency(n, currencyCode),
      // Say what the number actually covers. Unpriced items contribute nothing,
      // so with even one item unpriced this is a partial sum — showing only the
      // currency code next to it read as a confident workspace total.
      detail: !dashboardData.hasValue
        ? "Add prices to track value"
        : dashboardData.pricedItemCount < dashboardData.totalItems
          ? `${currencyCode} · priced items only (${formatNumber(
              dashboardData.pricedItemCount
            )} of ${formatNumber(dashboardData.totalItems)})`
          : currencyCode,
      icon: "usage" as UiIconName,
      href: "/dashboard/inventory",
      accent: "sydin-kpi-emerald",
      showBreakdown: false,
    },
  ];

  const spending = useMemo(() => {
    const now = new Date();
    const monthOrders = purchaseOrders.filter((order) => {
      if (order.status === "cancelled") return false;
      const source = order.purchase_date || order.created_at;
      if (!source) return false;
      const date = new Date(source.includes("T") ? source : `${source}T00:00:00`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    });

    let inventoryTotal = 0;
    let expenseTotal = 0;
    for (const order of monthOrders) {
      const split = getPurchaseOrderSplit(order);
      inventoryTotal += split.inventoryTotal;
      expenseTotal += split.expenseTotal;
    }

    return {
      monthTotal: inventoryTotal + expenseTotal,
      inventoryTotal,
      expenseTotal,
      monthCount: monthOrders.length,
      recentOrders: purchaseOrders.slice(0, 3),
    };
  }, [purchaseOrders]);

  const topActions = [
    {
      label: "Add Item",
      href: "/dashboard/add-item",
      icon: "plus" as UiIconName,
      primary: true,
    },
    {
      label: "Set Depots",
      href: "/dashboard/depots",
      icon: "depots" as UiIconName,
    },
    {
      label: "QR Scan",
      href: "/dashboard/qr-center",
      icon: "qr" as UiIconName,
    },
    {
      label: "Stock Count",
      href: "/dashboard/stock-counts",
      icon: "check" as UiIconName,
    },
  ];
  const recentMovements = movements.slice(0, 6);

  return (
    <main className="dashboard-overview sydin-overview">
      <div className="sydin-overview-inner">
        <section className="sydin-overview-header" aria-labelledby="dashboard-title">
          <div>
            <p className="sydin-overview-kicker">SydIN workspace</p>
            {/* Matches the sidebar and top bar, which both call this page
                "Overview". Two names for one page is worse than either name. */}
            <h1 id="dashboard-title">Overview</h1>
            <p>
              Inventory snapshot across items, depots, and recent stock
              activity.
            </p>
          </div>
          <div className="sydin-overview-header-actions">
            {topActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.primary
                    ? "sydin-overview-action sydin-overview-action-primary"
                    : "sydin-overview-action"
                }
              >
                <UiIcon name={action.icon} className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="sydin-overview-alert">
            {error}
          </p>
        )}

        <section className="sydin-overview-summary" aria-label="Inventory summary">
          {summaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="sydin-overview-summary-card"
            >
              <span className={`sydin-overview-summary-icon ${card.accent}`}>
                <UiIcon name={card.icon} className="h-4 w-4" />
              </span>
              <span>
                <small>{card.label}</small>
                <strong>
                  {loading || card.rawValue === null ? (
                    "--"
                  ) : (
                    <CountUpNumber value={card.rawValue} format={card.format} />
                  )}
                </strong>
                <em>{card.detail}</em>
                {card.showBreakdown &&
                  !loading &&
                  dashboardData.totalItems > 0 && (
                    <span
                      className="sydin-overview-distribution"
                      aria-hidden="true"
                    >
                      <span
                        className="sydin-distribution-in"
                        style={{ flexGrow: stockBreakdown.in }}
                      />
                      <span
                        className="sydin-distribution-low"
                        style={{ flexGrow: stockBreakdown.low }}
                      />
                      <span
                        className="sydin-distribution-out"
                        style={{ flexGrow: stockBreakdown.out }}
                      />
                    </span>
                  )}
              </span>
            </Link>
          ))}
        </section>

        <div className="sydin-overview-grid">
          <section className="sydin-overview-panel sydin-overview-restock">
            <DashboardPanelHeader
              icon="alert"
              title="Items that need restocking"
              href="/dashboard/alerts"
              hrefLabel="View alerts"
            />

            {loading ? (
              <div className="sydin-overview-skeleton-list" aria-hidden="true">
                {[1, 2, 3].map((item) => (
                  <span key={item} />
                ))}
              </div>
            ) : dashboardData.lowStockItems.length === 0 ? (
              <div className="sydin-overview-empty">
                <span>
                  <UiIcon name="check" className="h-5 w-5" />
                </span>
                <strong>No restocking needed</strong>
                <p>Your current items are above their low-stock thresholds.</p>
              </div>
            ) : (
              <div className="sydin-overview-restock-list">
                {dashboardData.lowStockItems.map((entry) => (
                  <Link
                    key={entry.item.id}
                    href={getDashboardItemHref(entry.item.id)}
                    className="sydin-overview-restock-row"
                  >
                    <ItemThumb item={entry.item} />
                    <span className="min-w-0">
                      <strong>{entry.item.name}</strong>
                      <small>
                        {entry.depot} - reorder at {formatNumber(entry.threshold)}
                      </small>
                    </span>
                    <span
                      className={`sydin-overview-status sydin-overview-status-${entry.state}`}
                    >
                      {getStockLabel(entry.state)}
                    </span>
                    <em>
                      {getInventoryQuantityLabel(
                        entry.item.quantity,
                        entry.item.unit_type,
                        entry.item.custom_unit_label
                      )}
                    </em>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="sydin-overview-panel sydin-overview-actions-panel">
            <DashboardPanelHeader icon="plus" title="Top actions" />
            <div className="sydin-overview-action-grid">
              {topActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <UiIcon name={action.icon} className="h-4 w-4" />
                  <span>{action.label}</span>
                </Link>
              ))}
              <Link href="/dashboard/purchase-orders">
                <UiIcon name="file" className="h-4 w-4" />
                <span>Create PO</span>
              </Link>
              <Link href="/dashboard/receiving">
                <UiIcon name="movement" className="h-4 w-4" />
                <span>Receive</span>
              </Link>
            </div>
          </section>

          <section className="sydin-overview-panel sydin-overview-recent">
            <DashboardPanelHeader
              icon="box"
              title="Recent Items"
              href="/dashboard/inventory"
              hrefLabel="All items"
            />

            {loading ? (
              <div className="sydin-overview-items-grid">
                {[1, 2, 3].map((item) => (
                  <span key={item} className="sydin-overview-item-skeleton" />
                ))}
              </div>
            ) : dashboardData.recentItems.length === 0 ? (
              <div className="sydin-overview-empty">
                <span>
                  <UiIcon name="box" className="h-5 w-5" />
                </span>
                <strong>No items yet</strong>
                <p>Add your first item to start building inventory history.</p>
                <Link href="/dashboard/add-item">Add Item</Link>
              </div>
            ) : (
              <div className="sydin-overview-items-grid">
                {dashboardData.recentItems.map((entry) => (
                  <Link
                    key={entry.item.id}
                    href={getDashboardItemHref(entry.item.id)}
                    className="sydin-overview-item-card"
                  >
                    <ItemThumb item={entry.item} />
                    <span className="min-w-0">
                      <strong>{entry.item.name}</strong>
                      <small>
                        {entry.item.item_code || entry.item.sku || "No SKU"}
                      </small>
                    </span>
                    <em>
                      {getInventoryQuantityLabel(
                        entry.item.quantity,
                        entry.item.unit_type,
                        entry.item.custom_unit_label
                      )}
                    </em>
                    <span
                      className={`sydin-overview-status sydin-overview-status-${entry.state}`}
                    >
                      {getStockLabel(entry.state)}
                    </span>
                    <small className="sydin-overview-item-meta">
                      {[entry.category, entry.depot].filter(Boolean).join(" - ")}
                    </small>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="sydin-overview-panel sydin-overview-health">
            <DashboardPanelHeader
              icon="check"
              title="Stock health"
              href="/dashboard/alerts"
              hrefLabel="View alerts"
            />

            {loading ? (
              <div className="sydin-overview-skeleton-list" aria-hidden="true">
                {[1, 2, 3].map((item) => (
                  <span key={item} />
                ))}
              </div>
            ) : dashboardData.totalItems === 0 ? (
              <div className="sydin-overview-empty">
                <span>
                  <UiIcon name="box" className="h-5 w-5" />
                </span>
                <strong>No items yet</strong>
                <p>Add items to see your stock health at a glance.</p>
                <Link href="/dashboard/add-item">Add Item</Link>
              </div>
            ) : (
              <div className="sydin-health-body">
                <StockHealthGauge
                  inCount={stockBreakdown.in}
                  lowCount={stockBreakdown.low}
                  outCount={stockBreakdown.out}
                />
                <div className="sydin-health-legend">
                  {/* Was linking to unfiltered inventory, so clicking
                      "In stock 7" showed every item including the low and
                      out-of-stock ones it excludes from its own count. */}
                  <Link
                    href="/dashboard/inventory?quick=in-stock"
                    className="sydin-health-row"
                  >
                    <span className="sydin-health-dot sydin-distribution-in" />
                    <span>In stock</span>
                    <em>{formatNumber(stockBreakdown.in)}</em>
                  </Link>
                  <Link
                    href={LOW_STOCK_INVENTORY_HREF}
                    className="sydin-health-row"
                  >
                    <span className="sydin-health-dot sydin-distribution-low" />
                    <span>Low stock</span>
                    <em>{formatNumber(stockBreakdown.low)}</em>
                  </Link>
                  <Link
                    href="/dashboard/inventory?quick=out-of-stock"
                    className="sydin-health-row"
                  >
                    <span className="sydin-health-dot sydin-distribution-out" />
                    <span>Out of stock</span>
                    <em>{formatNumber(stockBreakdown.out)}</em>
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="sydin-overview-panel sydin-overview-spending">
            <DashboardPanelHeader
              icon="reports"
              title="Spending this month"
              href="/dashboard/purchase-orders"
              hrefLabel="All purchases"
            />

            {loading ? (
              <div className="sydin-overview-skeleton-list" aria-hidden="true">
                {[1, 2, 3].map((item) => (
                  <span key={item} />
                ))}
              </div>
            ) : spending.monthCount === 0 ? (
              <div className="sydin-overview-empty">
                <span>
                  <UiIcon name="file" className="h-5 w-5" />
                </span>
                <strong>No purchases this month</strong>
                <p>
                  Record stock restocks and general purchases to track spending
                  here.
                </p>
                <Link href="/dashboard/purchase-orders/new">
                  New purchase order
                </Link>
              </div>
            ) : (
              <div className="sydin-overview-spending-body">
                <div className="sydin-overview-spending-total">
                  <small>Total spent</small>
                  <strong>
                    {formatCurrency(spending.monthTotal, currencyCode)}
                  </strong>
                  <em>
                    {formatNumber(spending.monthCount)} purchase
                    {spending.monthCount === 1 ? "" : "s"} this month
                  </em>
                </div>
                <div className="sydin-overview-spending-split">
                  <Link
                    href="/dashboard/purchase-orders"
                    className="sydin-overview-spending-row"
                  >
                    <span className="sydin-overview-spending-icon">
                      <UiIcon name="box" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <strong>Stock purchases</strong>
                      <small>Items bought for inventory</small>
                    </span>
                    <em>
                      {formatCurrency(spending.inventoryTotal, currencyCode)}
                    </em>
                  </Link>
                  <Link
                    href="/dashboard/purchase-orders"
                    className="sydin-overview-spending-row"
                  >
                    <span className="sydin-overview-spending-icon">
                      <UiIcon name="file" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <strong>General purchases</strong>
                      <small>Equipment, supplies, services</small>
                    </span>
                    <em>
                      {formatCurrency(spending.expenseTotal, currencyCode)}
                    </em>
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="sydin-overview-panel sydin-overview-activity">
            <DashboardPanelHeader
              icon="clock"
              title="Recent Activity"
              href="/dashboard/activity"
              hrefLabel="Activity"
            />

            {loading ? (
              <div className="sydin-overview-skeleton-list" aria-hidden="true">
                {[1, 2, 3, 4].map((item) => (
                  <span key={item} />
                ))}
              </div>
            ) : recentMovements.length === 0 ? (
              <div className="sydin-overview-empty">
                <span>
                  <UiIcon name="movement" className="h-5 w-5" />
                </span>
                <strong>No recent activity</strong>
                <p>Stock movements will appear here as the team works.</p>
                <Link href="/dashboard/activity">Open activity</Link>
              </div>
            ) : (
              <div className="sydin-overview-activity-list">
                {recentMovements.map((movement) => {
                  const item = movement.item_id
                    ? itemById.get(movement.item_id)
                    : null;
                  const movementLabel =
                    item?.name ||
                    formatStockMovementNotes(movement.notes) ||
                    STOCK_MOVEMENT_LABELS[movement.movement_type];
                  const movementStatus = getMovementStatus(
                    movement.movement_type
                  );
                  const activityHref = item
                    ? getDashboardItemHref(item.id)
                    : "/dashboard/activity";

                  return (
                    <Link
                      key={movement.id}
                      href={activityHref}
                      className="sydin-overview-activity-row"
                    >
                      <span className="sydin-overview-activity-icon">
                        <UiIcon name="movement" className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <strong>{movementLabel}</strong>
                        <small>
                          {STOCK_MOVEMENT_LABELS[movement.movement_type]} -{" "}
                          {formatDateTime(movement.created_at)}
                        </small>
                      </span>
                      <em
                        className={
                          movement.quantity_delta < 0
                            ? "sydin-overview-delta-negative"
                            : movement.quantity_delta > 0
                              ? "sydin-overview-delta-positive"
                              : ""
                        }
                      >
                        {movement.quantity_delta > 0 ? "+" : ""}
                        {formatNumber(movement.quantity_delta)}
                      </em>
                      <span
                        className={`sydin-overview-activity-status sydin-overview-activity-${movementStatus.tone}`}
                      >
                        {movementStatus.label}
                      </span>
                      <small>{formatDateDistance(movement.created_at)}</small>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
