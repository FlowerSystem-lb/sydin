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

  const summaryCards = [
    {
      label: "Total Items",
      value: formatNumber(dashboardData.totalItems),
      detail: `${formatNumber(dashboardData.lowStockCount)} need attention`,
      icon: "box" as UiIconName,
      href: "/dashboard/inventory",
    },
    {
      label: "Depots / Locations",
      value: formatNumber(dashboardData.totalDepots),
      detail: "Inventory locations",
      icon: "depots" as UiIconName,
      href: "/dashboard/depots",
    },
    {
      label: "Total Quantity",
      value: formatNumber(dashboardData.totalQuantity),
      detail: "Units across items",
      icon: "layers" as UiIconName,
      href: "/dashboard/inventory",
    },
    {
      label: "Inventory Value",
      value: dashboardData.hasValue
        ? formatCurrency(dashboardData.totalValue, currencyCode)
        : "--",
      detail: dashboardData.hasValue ? currencyCode : "Add prices to track value",
      icon: "usage" as UiIconName,
      href: "/dashboard/inventory",
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
            <h1 id="dashboard-title">Dashboard</h1>
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
              <span className="sydin-overview-summary-icon">
                <UiIcon name={card.icon} className="h-4 w-4" />
              </span>
              <span>
                <small>{card.label}</small>
                <strong>{loading ? "--" : card.value}</strong>
                <em>{card.detail}</em>
              </span>
            </Link>
          ))}
        </section>

        <div className="sydin-overview-grid">
          <section className="sydin-overview-panel sydin-overview-restock">
            <DashboardPanelHeader
              icon="alert"
              title="Items that need restocking"
              href={LOW_STOCK_INVENTORY_HREF}
              hrefLabel="Low stock"
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
              href="/dashboard/stock-movements"
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
                <Link href="/dashboard/stock-movements">Open movements</Link>
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
                    : "/dashboard/stock-movements";

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
