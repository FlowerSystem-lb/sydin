"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

function getItemIdentifier(item: Item) {
  return item.item_code || item.sku || "No identifier";
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
  if (state === "out") return "Out of Stock";
  if (state === "low") return "Low Stock";
  return "In Stock";
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
    <div className="overview-card-header">
      <div className="overview-card-title">
        <UiIcon name={icon} className="h-4 w-4" />
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="overview-view-link">
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

    return {
      totalItems: items.length,
      totalStock,
      lowStockCount,
      value: hasRetailValue ? totalRetailValue : totalCostValue,
      valueLabel: hasRetailValue
        ? "Estimated retail value"
        : hasCostValue
          ? "Estimated cost value"
          : "No price data yet",
      hasValue: hasRetailValue || hasCostValue,
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

  const kpiCards = [
    {
      label: "Total Items",
      value: formatNumber(dashboardData.totalItems),
      detail: "Across inventory",
      icon: "box" as UiIconName,
      tone: "blue",
      href: "/dashboard/inventory",
    },
    {
      label: "Total Stock",
      value: formatNumber(dashboardData.totalStock),
      detail: "Units available",
      icon: "layers" as UiIconName,
      tone: "blue",
      href: "/dashboard/inventory",
    },
    {
      label: "Low Stock Items",
      value: formatNumber(dashboardData.lowStockCount),
      detail: "At or below reorder level",
      icon: "alert" as UiIconName,
      tone: "red",
      href: LOW_STOCK_INVENTORY_HREF,
    },
    {
      label: "Inventory Value",
      value: dashboardData.hasValue
        ? formatCurrency(dashboardData.value, currencyCode)
        : "--",
      detail: dashboardData.valueLabel,
      icon: "usage" as UiIconName,
      tone: "green",
      href: "/dashboard/reports",
    },
  ];

  const recentMovements = movements.slice(0, 4);

  return (
    <main className="dashboard-overview">
      <div className="dashboard-overview-inner">
        <section className="overview-hero" aria-labelledby="dashboard-title">
          <div className="min-w-0">
            <p className="overview-kicker">Inventory overview</p>
            <h1 id="dashboard-title">Overview</h1>
            <p>{businessSettings.business_name}</p>
          </div>
          <div className="overview-actions" aria-label="Dashboard actions">
            <Link href="/dashboard/add-item" className="overview-action">
              <UiIcon name="plus" className="h-4 w-4" />
              Add Item
            </Link>
            <Link href="/dashboard/inventory" className="overview-action">
              <UiIcon name="box" className="h-4 w-4" />
              View Inventory
            </Link>
            <Link
              href="/dashboard/purchase-orders"
              className="overview-action overview-action-primary"
            >
              <UiIcon name="file" className="h-4 w-4" />
              Create PO
            </Link>
            <Link href="/dashboard/stock-counts" className="overview-action">
              <UiIcon name="check" className="h-4 w-4" />
              Stock Count
            </Link>
            <Link href="/dashboard/qr-center" className="overview-action">
              <UiIcon name="qr" className="h-4 w-4" />
              QR Scan
            </Link>
          </div>
        </section>

        {error && (
          <p role="alert" className="overview-alert overview-alert-danger">
            {error}
          </p>
        )}

        <section className="overview-kpi-grid" aria-label="Inventory metrics">
          {kpiCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="overview-kpi-card"
              aria-label={`Open ${card.label}`}
            >
              <div>
                <p>{card.label}</p>
                <strong>{loading ? "..." : card.value}</strong>
                <span>{card.detail}</span>
              </div>
              <span className={`overview-kpi-icon overview-kpi-icon-${card.tone}`}>
                <UiIcon name={card.icon} className="h-6 w-6" />
              </span>
            </Link>
          ))}
        </section>

        <section className="overview-plan-strip" aria-label="Plan and setup">
          <div className="overview-plan-cell overview-plan-name">
            <span className="overview-plan-mark">
              <UiIcon name="usage" className="h-5 w-5" />
            </span>
            <div>
              <strong>{currentPlanName} Plan</strong>
              <p>Usage: {loading ? "..." : itemUsageText}</p>
            </div>
          </div>
          <div className="overview-plan-cell overview-plan-progress">
            <div className="overview-plan-progress-copy">
              <span>Setup Progress</span>
              <strong>{loading ? "..." : `${setupPercent}%`}</strong>
            </div>
            <div className="overview-progress-track">
              <span style={{ width: `${setupPercent}%` }} />
            </div>
          </div>
          <div className="overview-plan-cell overview-plan-next">
            <div>
              <strong>
                {nextStep ? `Next Step: ${nextStep.action}` : "Setup guide"}
              </strong>
              <p>
                {nextStep
                  ? nextStep.description
                  : "Review guides and support when needed."}
              </p>
            </div>
            <Link href={nextStep?.href || "/dashboard/help"}>
              Continue setup
              <UiIcon name="chevron-right" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <div className="overview-main-grid">
          <section className="overview-card overview-inventory-card">
            <DashboardCardHeader
              icon="box"
              title="Inventory Snapshot"
              href="/dashboard/inventory"
              hrefLabel="View all"
            />

            {loading ? (
              <div className="overview-skeleton-list" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((item) => (
                  <span key={item} />
                ))}
              </div>
            ) : dashboardData.snapshotItems.length === 0 ? (
              <div className="overview-empty-state">
                <UiIcon name="box" className="h-8 w-8" />
                <strong>No inventory yet</strong>
                <p>Add your first item to start tracking stock health.</p>
                <Link href="/dashboard/add-item">Add Item</Link>
              </div>
            ) : (
              <>
                <div className="overview-inventory-table">
                  <div className="overview-inventory-head">
                    <span>Item</span>
                    <span>Category</span>
                    <span>Stock</span>
                    <span>Location</span>
                    <span>Status</span>
                    <span aria-hidden="true" />
                  </div>
                  {dashboardData.snapshotItems.map((entry) => (
                    <Link
                      key={entry.item.id}
                      href={getDashboardItemHref(entry.item.id)}
                      className="overview-inventory-row"
                      aria-label={`Open ${entry.item.name} details`}
                    >
                      <span className="overview-item-cell">
                        <span className="overview-thumb">
                          {entry.item.image ? (
                            <Image
                              src={entry.item.image}
                              alt={entry.item.name}
                              fill
                              sizes="44px"
                              className="object-contain"
                            />
                          ) : (
                            <UiIcon name="box" className="h-5 w-5" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <strong>{entry.item.name}</strong>
                          <small>SKU: {getItemIdentifier(entry.item)}</small>
                        </span>
                      </span>
                      <span>{entry.category}</span>
                      <span>
                        {getInventoryQuantityLabel(
                          entry.item.quantity,
                          entry.item.unit_type,
                          entry.item.custom_unit_label
                        )}
                      </span>
                      <span>{entry.depot}</span>
                      <span>
                        <span className={`overview-status overview-status-${entry.state}`}>
                          {getStockLabel(entry.state)}
                        </span>
                      </span>
                      <span className="overview-row-more" aria-hidden="true">
                        <UiIcon name="more" className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="overview-inventory-mobile-list">
                  {dashboardData.snapshotItems.slice(0, 4).map((entry) => (
                    <Link
                      key={entry.item.id}
                      href={getDashboardItemHref(entry.item.id)}
                      className="overview-mobile-item"
                      aria-label={`Open ${entry.item.name} details`}
                    >
                      <span className="overview-thumb overview-thumb-lg">
                        {entry.item.image ? (
                          <Image
                            src={entry.item.image}
                            alt={entry.item.name}
                            fill
                            sizes="64px"
                            className="object-contain"
                          />
                        ) : (
                          <UiIcon name="box" className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <strong>{entry.item.name}</strong>
                        <small>SKU: {getItemIdentifier(entry.item)}</small>
                      </span>
                      <span className="overview-mobile-item-meta">
                        <small>Stock</small>
                        <strong>{formatNumber(entry.quantity)}</strong>
                      </span>
                      <span className={`overview-status overview-status-${entry.state}`}>
                        {getStockLabel(entry.state)}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="overview-side-stack">
            <section className="overview-card">
              <DashboardCardHeader
                icon="alert"
                title="Low Stock Alerts"
                href={LOW_STOCK_INVENTORY_HREF}
              />
              {dashboardData.lowStockItems.length === 0 && !loading ? (
                <div className="overview-compact-empty">All stocked.</div>
              ) : (
                <div className="overview-compact-list">
                  {(loading ? [] : dashboardData.lowStockItems).map((entry) => (
                    <Link
                      key={entry.item.id}
                      href={getDashboardItemHref(entry.item.id)}
                      className="overview-low-stock-row"
                      aria-label={`Open ${entry.item.name} details`}
                    >
                      <span className="overview-thumb overview-thumb-sm">
                        {entry.item.image ? (
                          <Image
                            src={entry.item.image}
                            alt={entry.item.name}
                            fill
                            sizes="34px"
                            className="object-contain"
                          />
                        ) : (
                          <UiIcon name="box" className="h-4 w-4" />
                        )}
                      </span>
                      <strong>{entry.item.name}</strong>
                      <span>Stock {formatNumber(entry.quantity)}</span>
                      <span>Reorder at {formatNumber(entry.threshold)}</span>
                    </Link>
                  ))}
                  {loading && <span className="overview-mini-skeleton" />}
                </div>
              )}
            </section>

            <section className="overview-card">
              <DashboardCardHeader
                icon="clock"
                title="Recent Activity"
                href="/dashboard/stock-movements"
              />
              {recentMovements.length === 0 && !loading ? (
                <div className="overview-compact-empty">
                  No recent activity.{" "}
                  <Link href="/dashboard/stock-movements">Open movements</Link>
                </div>
              ) : (
                <div className="overview-activity-list">
                  {(loading ? [] : recentMovements).map((movement) => {
                    const item = movement.item_id
                      ? itemById.get(movement.item_id)
                      : null;
                    const movementLabel =
                      item?.name ||
                      formatStockMovementNotes(movement.notes) ||
                      STOCK_MOVEMENT_LABELS[movement.movement_type];
                    const delta = movement.quantity_delta;

                    return (
                      <Link
                        key={movement.id}
                        href="/dashboard/stock-movements"
                        className="overview-activity-row"
                        aria-label={`Open stock movement history for ${movementLabel}`}
                      >
                        <span className="overview-activity-icon">
                          <UiIcon name="movement" className="h-3.5 w-3.5" />
                        </span>
                        <strong>{movementLabel}</strong>
                        <span
                          className={
                            delta < 0
                              ? "overview-delta-negative"
                              : delta > 0
                                ? "overview-delta-positive"
                                : ""
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {formatNumber(delta)} units
                        </span>
                        <small>{formatDateDistance(movement.created_at)}</small>
                      </Link>
                    );
                  })}
                  {loading && <span className="overview-mini-skeleton" />}
                </div>
              )}
            </section>

            <section className="overview-card">
              <DashboardCardHeader icon="usage" title="Quick Actions" />
              <div className="overview-quick-actions">
                <Link href="/dashboard/add-item">
                  <UiIcon name="plus" className="h-4 w-4" />
                  Add Item
                </Link>
                <Link href="/dashboard/purchase-orders">
                  <UiIcon name="file" className="h-4 w-4" />
                  Create PO
                </Link>
                <Link href="/dashboard/stock-counts">
                  <UiIcon name="check" className="h-4 w-4" />
                  Stock Count
                </Link>
                <Link href="/dashboard/qr-center">
                  <UiIcon name="qr" className="h-4 w-4" />
                  QR Scan
                </Link>
              </div>
            </section>

            <section className="overview-card">
              <DashboardCardHeader
                icon="movement"
                title="Reorder Suggestions"
                href={LOW_STOCK_INVENTORY_HREF}
              />
              {dashboardData.reorderSuggestions.length === 0 && !loading ? (
                <div className="overview-compact-empty">
                  No reorder suggestions right now.
                </div>
              ) : (
                <div className="overview-reorder-list">
                  {(loading ? [] : dashboardData.reorderSuggestions).map(
                    (entry) => (
                      <div key={entry.item.id} className="overview-reorder-row">
                        <Link
                          href={getDashboardItemHref(entry.item.id)}
                          className="overview-reorder-item-link"
                          aria-label={`Open ${entry.item.name} details`}
                        >
                          <span className="overview-thumb overview-thumb-sm">
                            {entry.item.image ? (
                              <Image
                                src={entry.item.image}
                                alt={entry.item.name}
                                fill
                                sizes="34px"
                                className="object-contain"
                              />
                            ) : (
                              <UiIcon name="box" className="h-4 w-4" />
                            )}
                          </span>
                          <strong>{entry.item.name}</strong>
                        </Link>
                        <span>Suggested: {formatNumber(entry.suggested)}</span>
                        <Link
                          href={getPurchaseOrderItemHref(entry.item.id)}
                          aria-label={`Create purchase order draft with ${entry.item.name}`}
                        >
                          Create PO
                        </Link>
                      </div>
                    )
                  )}
                  {loading && <span className="overview-mini-skeleton" />}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
