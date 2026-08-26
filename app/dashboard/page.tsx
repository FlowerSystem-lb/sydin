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
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";

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

function ItemThumb({ item }: { item: Item }) {
  if (item.image) {
    return (
      <span className="ov-thumb">
        {/* Fixed 34px box, so ask for a 34px file rather than the original. */}
        <Image src={item.image} alt="" width={34} height={34} loading="lazy" />
      </span>
    );
  }

  return (
    <span className="ov-thumb">
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
          // 250 (the function's cap), not 8: the "no activity" completeness
          // stat below needs to know about every movement, not just the
          // handful shown in the recent-activity list, or it would overcount
          // items as having no history whenever more than 8 movements exist.
          // recentMovements still slices to 6 for display.
          getRecentStockMovements(user.id, 250).catch(() => []),
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

    // Data-completeness counts (backlog item 3 / 2026-08-04 decision): the
    // predictive Dashboard is deferred until there's real operating history,
    // but "what's missing that's blocking that history" is true today and
    // computable now. Each count feeds a card below that links to the exact
    // same Inventory quick filter, so the number and the fix are one click
    // apart — same pattern as the Inventory Value caption's ?quick=no-price.
    const movedItemIds = new Set(
      movements
        .map((movement) => movement.item_id)
        .filter((id): id is number => id !== null && id !== undefined)
    );
    const noImageCount = items.filter((item) => !item.image?.trim()).length;
    const noPriceCount = items.length - pricedItemCount;
    const noActivityCount = items.filter(
      (item) => !movedItemIds.has(item.id)
    ).length;
    const unassignedDepotCount = items.filter(
      (item) => !item.depot_id
    ).length;

    // Where the stock actually sits. Moved here from Inventory's side rail:
    // Inventory is the screen you open to find and change a product, and it
    // should spend its width on products. A breakdown belongs on the screen you
    // open for a summary. Quantity, not item count -- "34,623 units in
    // Unassigned" is the fact worth knowing; "6 products" is not.
    const sumBy = (key: "depot" | "category") => {
      const totals = new Map<string, number>();
      for (const entry of enrichedItems) {
        const label = (entry[key] || "").trim() || "Unassigned";
        totals.set(label, (totals.get(label) || 0) + entry.quantity);
      }
      return [...totals.entries()]
        .map(([label, quantity]) => ({ label, quantity }))
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 5);
    };

    return {
      enrichedItems,
      stockByLocation: sumBy("depot"),
      stockByCategory: sumBy("category"),
      recentItems: enrichedItems.slice(0, 6),
      totalItems: items.length,
      totalQuantity,
      totalValue,
      hasValue: valueItems.length > 0,
      pricedItemCount,
      noImageCount,
      noPriceCount,
      noActivityCount,
      unassignedDepotCount,
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
    movements,
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
    },
    {
      label: "Depots / Locations",
      rawValue: dashboardData.totalDepots,
      format: (n: number) => formatNumber(Math.round(n)),
      detail: "Inventory locations",
      icon: "depots" as UiIconName,
      href: "/dashboard/depots",
    },
    {
      label: "Total Quantity",
      rawValue: dashboardData.totalQuantity,
      format: (n: number) => formatNumber(Math.round(n)),
      detail: "Units across items",
      icon: "layers" as UiIconName,
      href: "/dashboard/inventory",
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
      // When the figure is partial, send the click to the items causing that —
      // the caption states the gap, this is how you act on it.
      href:
        dashboardData.pricedItemCount < dashboardData.totalItems
          ? "/dashboard/inventory?quick=no-price"
          : "/dashboard/inventory",
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

  const recentMovements = movements.slice(0, 6);

  const hasNoItems = !loading && dashboardData.totalItems === 0;
  const setupGaps = [
    {
      key: "no-price",
      count: dashboardData.noPriceCount,
      label: "missing a price",
    },
    {
      key: "no-image",
      count: dashboardData.noImageCount,
      label: "missing a photo",
    },
    {
      key: "unassigned",
      count: dashboardData.unassignedDepotCount,
      label: "not in a depot",
    },
    {
      key: "no-activity",
      count: dashboardData.noActivityCount,
      label: "with no activity",
    },
  ].filter((gap) => gap.count > 0);

  return (
    <main
      className="dashboard-overview ov-page"
      aria-labelledby="dashboard-title"
    >
      {/* Padding lives on this wrapper, not on <main>: a global mobile rule
          sets `main { padding: 0 !important }` under 767px so each page owns
          its own gutters there. Fighting that with another !important would
          have been the third one on this property. */}
      <div className="ov-inner">
      <header className="ov-head">
        <div className="ov-head-text">
          <p className="ov-eyebrow">{businessSettings.business_name}</p>
          {/* Matches the sidebar and top bar, which both call this page
              "Overview". Two names for one page is worse than either name. */}
          <h1 id="dashboard-title" className="ov-title">
            Overview
          </h1>
        </div>
      </header>

      {/* Was .sydin-overview-alert: a one-off amber box at 10px radius, the
          only error style in the app that did not match the others. Overview
          is the first screen after sign-in, so an error here should look like
          an error anywhere else. */}
      {error && <DashboardNotice tone="warning">{error}</DashboardNotice>}

      {/* Key figures. Hairline separators, no boxes: these four numbers used to
          be four cards, spending four borders and four shadows to say what
          whitespace says on its own. */}
      {/* A div, not a <section>: `main > div > section` is what turns any
          section on a dashboard page into a white card, and this row is
          deliberately not a card. Avoiding the selector beats overriding it. */}
      <div className="ov-figures" role="group" aria-label="Inventory summary">
        {summaryCards.map((card) => (
          <Link key={card.label} href={card.href} className="ov-figure">
            <span className="ov-figure-label">{card.label}</span>
            <span className="ov-figure-value">
              {loading || card.rawValue === null ? (
                "--"
              ) : (
                <CountUpNumber value={card.rawValue} format={card.format} />
              )}
            </span>
            <span className="ov-figure-note">{card.detail}</span>
          </Link>
        ))}
      </div>

      {hasNoItems ? (
        /* One empty state for the whole screen. The old Overview stacked three
           separate "No items yet / Add Item" blocks on a new workspace. */
        <DashboardEmptyState
          icon="box"
          title="Your workspace is empty"
          description="Add your first item to start tracking stock, depots and activity. Everything on this screen fills in as you go."
          action={
            <ActionButton href="/dashboard/add-item" icon="plus">
              Add your first item
            </ActionButton>
          }
        />
      ) : (
        <div className="ov-columns">
          {/* Needs attention = the old "Items that need restocking" and "Stock
              health" panels, which rendered the same in/low/out split twice,
              about 600px apart. */}
          <section className="ov-section" aria-labelledby="ov-attention-title">
            <div className="ov-section-head">
              <h2 id="ov-attention-title" className="ov-section-title">
                Needs attention
              </h2>
              <Link href={LOW_STOCK_INVENTORY_HREF} className="ov-link">
                All low stock
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>

            {!loading && dashboardData.totalItems > 0 && (
              <div className="ov-health">
                <div className="ov-health-bar" aria-hidden="true">
                  <span
                    className="ov-health-in"
                    style={{ flexGrow: stockBreakdown.in }}
                  />
                  <span
                    className="ov-health-low"
                    style={{ flexGrow: stockBreakdown.low }}
                  />
                  <span
                    className="ov-health-out"
                    style={{ flexGrow: stockBreakdown.out }}
                  />
                </div>
                <p className="ov-health-legend">
                  <span className="ov-dot ov-dot-success" />
                  {formatNumber(stockBreakdown.in)} in stock
                  <span className="ov-dot ov-dot-neutral" />
                  {formatNumber(stockBreakdown.low)} low
                  <span className="ov-dot ov-dot-warning" />
                  {formatNumber(stockBreakdown.out)} out
                </p>
              </div>
            )}

            {loading ? (
              <LoadingSkeletonGroup count={3} />
            ) : dashboardData.lowStockItems.length === 0 ? (
              <p className="ov-quiet">
                Every item is above its low-stock level. Nothing to restock.
              </p>
            ) : (
              <ul className="ov-list">
                {dashboardData.lowStockItems.map((entry) => (
                  <li key={entry.item.id}>
                    <Link
                      href={getDashboardItemHref(entry.item.id)}
                      className="ov-row"
                    >
                      <ItemThumb item={entry.item} />
                      <span className="ov-row-text">
                        <strong>{entry.item.name}</strong>
                        <small>
                          {[
                            entry.depot,
                            `${getStockLabel(entry.state)} · min ${formatNumber(
                              entry.threshold
                            )}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <span className={`ov-row-value ov-value-${entry.state}`}>
                        {getInventoryQuantityLabel(
                          entry.item.quantity,
                          entry.item.unit_type,
                          entry.item.custom_unit_label
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent activity = the old "Recent Items" and "Recent Activity"
              panels merged. Both answered "what changed lately". */}
          <section className="ov-section" aria-labelledby="ov-activity-title">
            <div className="ov-section-head">
              <h2 id="ov-activity-title" className="ov-section-title">
                Recent activity
              </h2>
              <Link href="/dashboard/activity" className="ov-link">
                All activity
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <LoadingSkeletonGroup count={3} />
            ) : recentMovements.length > 0 ? (
              <ul className="ov-list">
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

                  return (
                    <li key={movement.id}>
                      <Link
                        href={
                          item
                            ? getDashboardItemHref(item.id)
                            : "/dashboard/activity"
                        }
                        className="ov-row"
                      >
                        <span
                          className={`ov-dot ov-dot-${movementStatus.tone}`}
                          aria-hidden="true"
                        />
                        <span className="ov-row-text">
                          <strong>{movementLabel}</strong>
                          <small>
                            {STOCK_MOVEMENT_LABELS[movement.movement_type]}
                          </small>
                        </span>
                        <span className="ov-row-value ov-row-time">
                          {formatDateDistance(movement.created_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              /* No movements yet but items exist: show the newest items, so the
                 section still answers "what changed lately". */
              <ul className="ov-list">
                {dashboardData.recentItems.map((entry) => (
                  <li key={entry.item.id}>
                    <Link
                      href={getDashboardItemHref(entry.item.id)}
                      className="ov-row"
                    >
                      <ItemThumb item={entry.item} />
                      <span className="ov-row-text">
                        <strong>{entry.item.name}</strong>
                        <small>
                          {[
                            entry.item.item_code || entry.item.sku,
                            entry.category,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Added to inventory"}
                        </small>
                      </span>
                      <span className="ov-row-value">
                        {getInventoryQuantityLabel(
                          entry.item.quantity,
                          entry.item.unit_type,
                          entry.item.custom_unit_label
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ov-section" aria-labelledby="ov-spending-title">
            <div className="ov-section-head">
              <h2 id="ov-spending-title" className="ov-section-title">
                Spending this month
              </h2>
              <Link href="/dashboard/purchase-orders" className="ov-link">
                All purchases
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <LoadingSkeletonGroup count={2} />
            ) : spending.monthCount === 0 ? (
              <p className="ov-quiet">
                No purchases recorded this month. Record restocks and expenses
                to track spending here.
              </p>
            ) : (
              <>
                <p className="ov-spend-total">
                  {formatCurrency(spending.monthTotal, currencyCode)}
                </p>
                <p className="ov-figure-note">
                  {formatNumber(spending.monthCount)} purchase
                  {spending.monthCount === 1 ? "" : "s"} this month
                </p>
                <ul className="ov-list">
                  <li>
                    <Link href="/dashboard/purchase-orders" className="ov-row">
                      <span className="ov-row-text">
                        <strong>Stock purchases</strong>
                        <small>Items bought for inventory</small>
                      </span>
                      <span className="ov-row-value">
                        {formatCurrency(spending.inventoryTotal, currencyCode)}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard/purchase-orders" className="ov-row">
                      <span className="ov-row-text">
                        <strong>General purchases</strong>
                        <small>Equipment, supplies, services</small>
                      </span>
                      <span className="ov-row-value">
                        {formatCurrency(spending.expenseTotal, currencyCode)}
                      </span>
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </section>

          {/* Where the stock sits. Moved off Inventory's side rail, which was
              spending 22% of that screen's width on a summary. Two breakdowns
              in one section rather than two sections, so Overview gains one
              region, not two -- the whole point of the rebuild was fewer. */}
          <section className="ov-section" aria-labelledby="ov-stock-title">
            <div className="ov-section-head">
              <h2 id="ov-stock-title" className="ov-section-title">
                Where your stock sits
              </h2>
              <Link href="/dashboard/depots" className="ov-link">
                All depots
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <LoadingSkeletonGroup count={3} />
            ) : dashboardData.totalQuantity === 0 ? (
              <p className="ov-quiet">
                No stock recorded yet. Quantities appear here once items have
                stock against them.
              </p>
            ) : (
              <div className="ov-split">
                {[
                  {
                    key: "location",
                    label: "By location",
                    rows: dashboardData.stockByLocation,
                  },
                  {
                    key: "category",
                    label: "By category",
                    rows: dashboardData.stockByCategory,
                  },
                ].map((group) => (
                  <div key={group.key} className="ov-split-col">
                    <p className="ov-figure-label">{group.label}</p>
                    <ul className="ov-list">
                      {group.rows.map((row) => (
                        <li key={row.label}>
                          <span className="ov-row ov-row-static">
                            <span className="ov-row-text">
                              <strong>{row.label}</strong>
                            </span>
                            <span className="ov-row-value">
                              {formatNumber(row.quantity)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Finish setup. Unique data, but it did not need four amber boxes:
              gaps that are already closed are simply not listed. */}
          <section className="ov-section" aria-labelledby="ov-setup-title">
            <div className="ov-section-head">
              <h2 id="ov-setup-title" className="ov-section-title">
                Finish setup
              </h2>
              <Link href="/dashboard/inventory" className="ov-link">
                Open inventory
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <LoadingSkeletonGroup count={2} />
            ) : setupGaps.length === 0 ? (
              <p className="ov-quiet">
                Every item has a price, a photo and a depot. Your data is ready
                for trends and forecasting.
              </p>
            ) : (
              <ul className="ov-list">
                {setupGaps.map((gap) => (
                  <li key={gap.key}>
                    <Link
                      href={`/dashboard/inventory?quick=${gap.key}`}
                      className="ov-row"
                    >
                      <span className="ov-row-text">
                        <strong>
                          {formatNumber(gap.count)}{" "}
                          {gap.count === 1 ? "item" : "items"} {gap.label}
                        </strong>
                      </span>
                      <UiIcon
                        name="chevron-right"
                        className="h-4 w-4 ov-row-chevron"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      </div>
    </main>
  );
}
