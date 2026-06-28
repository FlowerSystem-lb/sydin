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
  formatPlanName,
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
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/app/lib/onboarding";
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

function getDashboardItemHref(itemId: number) {
  return `/dashboard/inventory/${itemId}?returnTo=${encodeURIComponent(
    DASHBOARD_RETURN_TO
  )}`;
}

function getPurchaseOrderItemHref(itemId: number) {
  return `/dashboard/purchase-orders?items=${itemId}`;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number, currencyCode: string) {
  const currency = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toTitleCase(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getUserDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata || {};
  const metadataName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : typeof metadata.first_name === "string"
          ? metadata.first_name
          : "";

  if (metadataName.trim()) return metadataName.trim();

  const emailName = user.email?.split("@")[0] || "";
  return emailName ? toTitleCase(emailName) : "";
}

function getMovementStatus(movementType: StockMovement["movement_type"]) {
  if (movementType === "damaged_lost") {
    return {
      label: "Attention",
      className: "fin-status-danger",
    };
  }

  if (movementType === "adjustment") {
    return {
      label: "Review",
      className: "fin-status-warning",
    };
  }

  return {
    label: "Completed",
    className: "fin-status-success",
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

function DashboardCardHeader({
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
    <div className="fin-card-header">
      <div className="fin-card-title">
        <UiIcon name={icon} className="h-4 w-4" />
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="fin-view-link">
          {hrefLabel}
          <UiIcon name="chevron-right" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [profileName, setProfileName] = useState("");
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

        setProfileName(getUserDisplayName(user));

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
          getOnboardingProgress(user.id).catch(() => null),
          getRecentStockMovements(user.id, 8).catch(() => []),
        ])
          .then(
            ([
              { data, error: inventoryError },
              usage,
              settings,
              loadedCategories,
              loadedDepots,
              loadedOnboarding,
              loadedMovements,
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
              setOnboarding(loadedOnboarding);
              setMovements(loadedMovements);
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

      return {
        item,
        quantity,
        threshold,
        state,
        retailValue,
        costValue,
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
    const totalStock = enrichedItems.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );
    const lowStockCount = enrichedItems.filter(
      (entry) => entry.state !== "in"
    ).length;
    const totalRetailValue = enrichedItems.reduce(
      (sum, entry) => sum + (entry.retailValue || 0),
      0
    );
    const totalCostValue = enrichedItems.reduce(
      (sum, entry) => sum + (entry.costValue || 0),
      0
    );
    const hasRetailValue = enrichedItems.some(
      (entry) => entry.retailValue !== null
    );
    const hasCostValue = enrichedItems.some(
      (entry) => entry.costValue !== null
    );

    const lowStockItems = enrichedItems
      .filter((entry) => entry.state !== "in")
      .sort((left, right) => {
        if (left.state !== right.state) return left.state === "out" ? -1 : 1;
        return left.quantity - right.quantity;
      });
    const reorderSuggestions = lowStockItems
      .map((entry) => ({
        ...entry,
        suggested: Math.max(0, entry.threshold - entry.quantity),
      }))
      .filter((entry) => entry.suggested > 0);

    const locationSummary = new Map<
      string,
      {
        label: string;
        itemCount: number;
        quantity: number;
        value: number;
        attention: number;
      }
    >();

    const categorySummary = new Map<
      string,
      {
        label: string;
        stock: number;
        attention: number;
      }
    >();

    enrichedItems.forEach((entry) => {
      const locationLabel = entry.depot || "Unassigned";
      const location = locationSummary.get(locationLabel) || {
        label: locationLabel,
        itemCount: 0,
        quantity: 0,
        value: 0,
        attention: 0,
      };

      location.itemCount += 1;
      location.quantity += entry.quantity;
      location.value += entry.retailValue ?? entry.costValue ?? 0;
      location.attention += entry.state === "in" ? 0 : 1;
      locationSummary.set(locationLabel, location);

      const categoryLabel = entry.category || "Uncategorized";
      const categoryEntry = categorySummary.get(categoryLabel) || {
        label: categoryLabel,
        stock: 0,
        attention: 0,
      };

      categoryEntry.stock += Math.max(0, entry.quantity);
      categoryEntry.attention += entry.state === "in" ? 0 : Math.max(1, entry.quantity);
      categorySummary.set(categoryLabel, categoryEntry);
    });

    const stockMixRaw = Array.from(categorySummary.values())
      .sort(
        (left, right) =>
          right.stock + right.attention - (left.stock + left.attention)
      )
      .slice(0, 8);
    const maxStockMix = Math.max(
      1,
      ...stockMixRaw.map((entry) => entry.stock + entry.attention)
    );
    const stockMixItems = stockMixRaw.map((entry) => ({
      ...entry,
      stockHeight: Math.max(12, Math.round((entry.stock / maxStockMix) * 100)),
      attentionHeight: Math.max(
        entry.attention > 0 ? 10 : 0,
        Math.round((entry.attention / maxStockMix) * 100)
      ),
    }));

    return {
      totalItems: items.length,
      totalStock,
      lowStockCount,
      inStockCount: enrichedItems.filter((entry) => entry.state === "in").length,
      outStockCount: enrichedItems.filter((entry) => entry.state === "out").length,
      value: hasRetailValue ? totalRetailValue : totalCostValue,
      valueLabel: hasRetailValue
        ? "Estimated retail value"
        : hasCostValue
          ? "Estimated cost value"
          : "No price data yet",
      hasValue: hasRetailValue || hasCostValue,
      costValue: totalCostValue,
      hasCostValue,
      locationCards: Array.from(locationSummary.values())
        .sort((left, right) => right.value - left.value || right.quantity - left.quantity)
        .slice(0, 3),
      stockMixItems,
      snapshotItems: enrichedItems.slice(0, 6),
      lowStockItems: lowStockItems.slice(0, 3),
      reorderSuggestions: reorderSuggestions.slice(0, 3),
    };
  }, [
    canUseItemThreshold,
    categories,
    depotById,
    effectiveLowStockThreshold,
    items,
  ]);

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const itemLimit = subscriptionUsage.subscription.item_limit;
  const itemUsageText = `${formatNumber(subscriptionUsage.usedItems)} / ${formatNumber(
    itemLimit
  )} items`;
  const setupPercent = onboarding?.percentage ?? 0;
  const nextStep = onboarding?.nextStep;

  const healthyItemCount = Math.max(
    0,
    dashboardData.totalItems - dashboardData.lowStockCount
  );
  const stockHealthPercent =
    dashboardData.totalItems > 0
      ? Math.round((healthyItemCount / dashboardData.totalItems) * 100)
      : 100;
  const itemUsagePercent =
    itemLimit > 0
      ? Math.min(
          100,
          Math.round((subscriptionUsage.usedItems / itemLimit) * 100)
        )
      : 0;
  const displayName =
    profileName || businessSettings.business_name.split(" ")[0] || "there";
  const inventoryValue = dashboardData.hasValue
    ? formatCurrency(dashboardData.value, currencyCode)
    : "--";
  const firstReorderHref = dashboardData.reorderSuggestions[0]
    ? getPurchaseOrderItemHref(dashboardData.reorderSuggestions[0].item.id)
    : "/dashboard/purchase-orders";
  const totalLocations = Math.max(depots.length, dashboardData.locationCards.length);
  const recentMovements = movements.slice(0, 5);

  const metricCards = [
    {
      label: "Total Items",
      value: formatNumber(dashboardData.totalItems),
      detail: `${formatNumber(dashboardData.inStockCount)} healthy items`,
      icon: "box" as UiIconName,
      tone: "primary",
      href: "/dashboard/inventory",
    },
    {
      label: "Low Stock",
      value: formatNumber(dashboardData.lowStockCount),
      detail: `${formatNumber(dashboardData.outStockCount)} out of stock`,
      icon: "alert" as UiIconName,
      tone: "soft",
      href: LOW_STOCK_INVENTORY_HREF,
    },
    {
      label: "Total Stock",
      value: formatNumber(dashboardData.totalStock),
      detail: "Units available",
      icon: "layers" as UiIconName,
      tone: "soft",
      href: "/dashboard/inventory",
    },
    {
      label: "Stock Health",
      value: `${stockHealthPercent}%`,
      detail: "Across inventory",
      icon: "usage" as UiIconName,
      tone: "soft",
      href: "/dashboard/reports",
    },
  ];

  const quickCards = [
    {
      title: "Add Item",
      detail: "Create a new inventory record",
      href: "/dashboard/add-item",
      icon: "plus" as UiIconName,
      tone: "dark",
    },
    {
      title: "Stock Count",
      detail: `${setupPercent}% setup complete`,
      href: nextStep?.href || "/dashboard/stock-counts",
      icon: "check" as UiIconName,
      tone: "orange",
    },
  ];

  return (
    <main className="dashboard-overview fin-dashboard">
      <section className="fin-greeting" aria-labelledby="dashboard-title">
        <span className="fin-greeting-icon" aria-hidden="true">
          <UiIcon name="appearance" className="h-5 w-5" />
        </span>
        <div>
          <h1 id="dashboard-title">Good morning, {displayName}</h1>
          <p>Stay on top of your stock, monitor progress, and track status.</p>
        </div>
      </section>

      {error && (
        <p role="alert" className="fin-alert fin-alert-danger">
          {error}
        </p>
      )}

      <div className="fin-dashboard-grid">
        <section className="fin-card fin-balance-card" aria-label="Inventory value">
          <div className="fin-balance-head">
            <div>
              <span>Total Inventory Value</span>
              <strong>{loading ? "..." : inventoryValue}</strong>
              <p>
                <span>{stockHealthPercent}%</span> healthy stock across{" "}
                {formatNumber(healthyItemCount)} items
              </p>
            </div>
            <span className="fin-currency-pill">{currencyCode}</span>
          </div>

          <div className="fin-balance-actions" aria-label="Inventory actions">
            <Link href="/dashboard/add-item">
              <UiIcon name="plus" className="h-4 w-4" />
              Add Item
            </Link>
            <Link href={firstReorderHref}>
              <UiIcon name="file" className="h-4 w-4" />
              Request
            </Link>
          </div>

          <div className="fin-wallet-heading">
            <span>Locations</span>
            <span>Total {formatNumber(totalLocations)} depots</span>
          </div>

          {loading ? (
            <div className="fin-mini-skeleton" aria-hidden="true" />
          ) : dashboardData.locationCards.length === 0 ? (
            <div className="fin-empty-mini">
              Add your first item to see location value here.
            </div>
          ) : (
            <div className="fin-location-grid">
              {dashboardData.locationCards.map((location) => (
                <Link
                  key={location.label}
                  href="/dashboard/inventory"
                  className="fin-location-card"
                  aria-label={`Open inventory for ${location.label}`}
                >
                  <span className="fin-location-flag">
                    {location.label.slice(0, 2).toUpperCase()}
                  </span>
                  <strong>
                    {dashboardData.hasValue
                      ? formatCurrency(location.value, currencyCode)
                      : `${formatNumber(location.quantity)} units`}
                  </strong>
                  <small>{location.itemCount} item types</small>
                  <span
                    className={
                      location.attention > 0
                        ? "fin-location-status fin-location-status-risk"
                        : "fin-location-status"
                    }
                  >
                    {location.attention > 0 ? "Review" : "Active"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="fin-metrics-grid" aria-label="Inventory metrics">
          {metricCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`fin-metric-card fin-metric-${card.tone}`}
              aria-label={`Open ${card.label}`}
            >
              <span className="fin-metric-icon" aria-hidden="true">
                <UiIcon name={card.icon} className="h-4 w-4" />
              </span>
              <span>{card.label}</span>
              <strong>{loading ? "..." : card.value}</strong>
              <small>{card.detail}</small>
            </Link>
          ))}
        </section>

        <section className="fin-card fin-chart-card">
          <DashboardCardHeader
            icon="reports"
            title="Stock Mix"
            href="/dashboard/reports"
            hrefLabel="Reports"
          />
          <p className="fin-card-subtitle">
            View availability and attention across your top categories.
          </p>
          <div className="fin-chart-legend" aria-hidden="true">
            <span>
              <i className="fin-legend-stock" /> Available
            </span>
            <span>
              <i className="fin-legend-risk" /> At risk
            </span>
          </div>
          {loading ? (
            <div className="fin-chart-skeleton" aria-hidden="true" />
          ) : dashboardData.stockMixItems.length === 0 ? (
            <div className="fin-empty-mini">
              Categories will appear here once items are added.
            </div>
          ) : (
            <div className="fin-chart-bars" aria-label="Stock mix chart">
              {dashboardData.stockMixItems.map((entry) => (
                <div key={entry.label} className="fin-chart-bar">
                  <div className="fin-chart-track">
                    <span
                      className="fin-chart-stock"
                      style={{ height: `${entry.stockHeight}%` }}
                    />
                    <span
                      className="fin-chart-risk"
                      style={{ height: `${entry.attentionHeight}%` }}
                    />
                  </div>
                  <small title={entry.label}>{entry.label.slice(0, 3)}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fin-card fin-limit-card">
          <div className="fin-plain-card-head">
            <h2>Monthly Item Limit</h2>
            <span>{currentPlanName}</span>
          </div>
          <div className="fin-limit-track">
            <span style={{ width: `${itemUsagePercent}%` }} />
          </div>
          <div className="fin-limit-meta">
            <span>{loading ? "..." : itemUsageText}</span>
            <span>{formatNumber(itemLimit)} max</span>
          </div>
        </section>

        <section className="fin-card fin-action-panel">
          <div className="fin-plain-card-head">
            <h2>My Actions</h2>
            <Link href="/dashboard/help">Help</Link>
          </div>
          <div className="fin-action-card-grid">
            {quickCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`fin-action-card fin-action-${card.tone}`}
              >
                <span aria-hidden="true">
                  <UiIcon name={card.icon} className="h-4 w-4" />
                </span>
                <strong>{card.title}</strong>
                <small>{card.detail}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="fin-card fin-activities-card">
          <div className="fin-activities-toolbar">
            <DashboardCardHeader
              icon="clock"
              title="Recent Activities"
              href="/dashboard/stock-movements"
              hrefLabel="View all"
            />
            <div className="fin-table-tools">
              <label className="fin-table-search">
                <UiIcon name="search" className="h-4 w-4" />
                <input aria-label="Search activities" placeholder="Search" />
              </label>
              <Link href="/dashboard/stock-movements" className="fin-filter-button">
                Filter
                <UiIcon name="settings" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="fin-table-skeleton" aria-hidden="true">
              {[1, 2, 3, 4].map((item) => (
                <span key={item} />
              ))}
            </div>
          ) : recentMovements.length === 0 ? (
            <div className="fin-empty-state">
              <UiIcon name="movement" className="h-8 w-8" />
              <strong>No recent activity</strong>
              <p>Stock movements will appear here as your team works.</p>
              <Link href="/dashboard/stock-movements">Open movements</Link>
            </div>
          ) : (
            <div className="fin-table-wrap">
              <table className="fin-activity-table">
                <thead>
                  <tr>
                    <th aria-label="Selection" />
                    <th>Order ID</th>
                    <th>Activity</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
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
                    const delta = movement.quantity_delta;
                    const activityHref = item
                      ? getDashboardItemHref(item.id)
                      : "/dashboard/stock-movements";

                    return (
                      <tr key={movement.id}>
                        <td>
                          <span className="fin-table-check" aria-hidden="true" />
                        </td>
                        <td>INV_{String(movement.id).padStart(6, "0")}</td>
                        <td>
                          <Link href={activityHref} className="fin-activity-name">
                            <span aria-hidden="true">
                              <UiIcon name="movement" className="h-3.5 w-3.5" />
                            </span>
                            <span>
                              <strong>{movementLabel}</strong>
                              {item && (
                                <small>
                                  {getInventoryQuantityLabel(
                                    item.quantity,
                                    item.unit_type,
                                    item.custom_unit_label
                                  )}{" "}
                                  in stock
                                </small>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td
                          className={
                            delta < 0
                              ? "fin-quantity-negative"
                              : delta > 0
                                ? "fin-quantity-positive"
                                : ""
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {formatNumber(delta)}
                        </td>
                        <td>
                          <span
                            className={`fin-table-status ${movementStatus.className}`}
                          >
                            {movementStatus.label}
                          </span>
                        </td>
                        <td>
                          <span className="fin-date-cell">
                            {formatDateTime(movement.created_at)}
                            <small>{formatDateDistance(movement.created_at)}</small>
                          </span>
                        </td>
                        <td>
                          <Link
                            href="/dashboard/stock-movements"
                            className="fin-row-more"
                            aria-label={`Open stock movement history for ${movementLabel}`}
                          >
                            <UiIcon name="more" className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
