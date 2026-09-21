"use client";

import { useEffect, useMemo, useState } from "react";
import { convertFromBase } from "@/app/lib/currency";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import MoneyFlowChart from "@/components/dashboard/MoneyFlowChart";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { requestAddItem } from "@/app/lib/addItemNavigation";
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
  getPurchaseOrderBalanceInBase,
  getPurchaseOrderReceivingProgress,
  getPurchaseOrderSplit,
  getPurchaseOrdersForUser,
  isPurchaseOrderOpen,
  type PurchaseOrder,
} from "@/app/lib/purchaseOrders";
import {
  formatSalesOrderAmount,
  getSalesOrderBalance,
  getSalesOrderBalanceInBase,
  getSalesOrderTotalInBase,
  getSalesOrdersForUser,
  type SalesOrder,
} from "@/app/lib/salesOrders";
import { supabase } from "@/app/lib/supabase";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { buttonClassName } from "@/components/ui";

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

function formatDateShort(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

/* A phone cell is 160px wide; the value has to fit on one line. The class
   is chosen from the formatted length because CSS cannot measure text:
   "$1,712,130" is long, "QAR 6,232,162" is very long, "LBP 153,235,858,750"
   longer still. Each tier is a smaller size in app/mobile.css. */
function figureSizeClass(rendered: string) {
  if (rendered.length >= 16) return " ov-figure-value--longest";
  if (rendered.length >= 12) return " ov-figure-value--very-long";
  if (rendered.length >= 8) return " ov-figure-value--long";
  return "";
}

/* A day-by-day bar, real numbers not decoration: 14 bars, the tallest of
   them full height, today drawn solid where the rest are muted -- so the
   one glance answers "is today better or worse than the run-up to it"
   without a legend or a tooltip. All zero draws 14 flat, empty bars rather
   than nothing, which would read as broken. */
function Sparkline({ values }: { values: number[] }) {
  // A sparkline with one bar and thirteen empty days is not a trend, it is a
  // stray mark next to the label. It earns its place once there is a shape
  // to read: at least two days with something in them.
  if (values.filter((value) => value > 0).length < 2) return null;
  const max = Math.max(...values, 0);
  const barWidth = 4;
  const gap = 2;
  const height = 24;
  const width = values.length * (barWidth + gap) - gap;
  return (
    <svg
      className="ov-figure-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Last 14 days"
    >
      {values.map((value, index) => {
        const barHeight = max > 0 ? Math.max(2, (value / max) * (height - 2)) : 2;
        return (
          <rect
            key={index}
            className={index === values.length - 1 ? "ov-figure-sparkline-today" : undefined}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

function formatCurrency(value: number, currencyCode: string) {
  value = convertFromBase(value, currencyCode);
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

function ItemThumb({ item }: { item: Item }) {
  return (
    <span className="ov-thumb">
      {/* Fixed 34px box, so ask for a 34px file rather than the original.
          ProductThumbnail also covers the photo that exists but fails to
          load, which this list used to render as a broken-image glyph. */}
      <ProductThumbnail
        src={item.image}
        alt=""
        width={34}
        height={34}
        imgClassName=""
        iconClassName="h-4 w-4"
        fallbackClassName="flex h-full w-full items-center justify-center"
      />
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
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
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
          getSalesOrdersForUser(user.id).catch(() => [] as SalesOrder[]),
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
              loadedSalesOrders,
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
              setSalesOrders(loadedSalesOrders);
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

  /* The business, not the shelves: what was sold this month, what customers
     still owe, what is owed to suppliers, and what is on its way. Each one
     is a question the owner asks every morning; each one links to the page
     that answers it in full. */
  const business = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const inThisMonth = (source: string | null | undefined) => {
      if (!source) return false;
      const date = new Date(source.includes("T") ? source : `${source}T00:00:00`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    };

    const isToday = (source: string | null | undefined) =>
      Boolean(source) && String(source).slice(0, 10) === today;
    // The reference tile carries a comparison line ("+0,94 last year"). Ours
    // is last calendar month, and only where there is one: a first month has
    // nothing to compare against and says so instead of showing +100%.
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const inLastMonth = (source: string | null | undefined) => {
      if (!source) return false;
      const date = new Date(source.includes("T") ? source : `${source}T00:00:00`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === lastMonth.getFullYear() &&
        date.getMonth() === lastMonth.getMonth()
      );
    };

    let soldThisMonth = 0;
    let soldLastMonth = 0;
    let soldCount = 0;
    let soldToday = 0;
    let soldTodayCount = 0;
    let customersOwe = 0;
    let owingInvoices = 0;
    const overdue: SalesOrder[] = [];
    for (const order of salesOrders) {
      if (order.status === "draft" || order.status === "cancelled") continue;
      if (inThisMonth(order.issue_date || order.created_at)) {
        soldThisMonth += getSalesOrderTotalInBase(order);
        soldCount += 1;
      } else if (inLastMonth(order.issue_date || order.created_at)) {
        soldLastMonth += getSalesOrderTotalInBase(order);
      }
      if (isToday(order.issue_date || order.created_at)) {
        soldToday += getSalesOrderTotalInBase(order);
        soldTodayCount += 1;
      }
      const remaining = getSalesOrderBalanceInBase(order);
      if (remaining > 0) {
        customersOwe += remaining;
        owingInvoices += 1;
        if (order.due_date && order.due_date < today) overdue.push(order);
      }
    }

    let oweSuppliers = 0;
    let unpaidOrders = 0;
    const expected: PurchaseOrder[] = [];
    let expectedUnits = 0;
    for (const order of purchaseOrders) {
      if (order.status === "cancelled" || order.status === "draft") continue;
      const remaining = getPurchaseOrderBalanceInBase(order).remaining;
      if (remaining > 0) {
        oweSuppliers += remaining;
        unpaidOrders += 1;
      }
      if (isPurchaseOrderOpen(order) && order.lines.length > 0) {
        expected.push(order);
        expectedUnits += getPurchaseOrderReceivingProgress(order).remaining;
      }
    }

    // The last 14 days of sales, oldest first -- the one figure on this page
    // with a real day-by-day story to tell. A balance ("customers owe you")
    // is a snapshot, not a flow, and would need the whole payment history
    // replayed per day to trend honestly; this does not fake that.
    const soldTrend: number[] = [];
    const soldByDay = new Map<string, number>();
    for (let offset = 13; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      soldByDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const order of salesOrders) {
      if (order.status === "draft" || order.status === "cancelled") continue;
      const day = (order.issue_date || order.created_at).slice(0, 10);
      if (soldByDay.has(day)) {
        soldByDay.set(day, (soldByDay.get(day) || 0) + getSalesOrderTotalInBase(order));
      }
    }
    soldTrend.push(...soldByDay.values());

    // What moved today, from the stock ledger: units in, units out, changes.
    let receivedTodayUnits = 0;
    let shippedTodayUnits = 0;
    let movementsToday = 0;
    for (const movement of movements) {
      if (!isToday(movement.created_at)) continue;
      movementsToday += 1;
      if (movement.quantity_delta > 0) receivedTodayUnits += movement.quantity_delta;
      else shippedTodayUnits += -movement.quantity_delta;
    }

    return {
      soldThisMonth,
      soldLastMonth,
      soldCount,
      soldToday,
      soldTodayCount,
      soldTrend,
      receivedTodayUnits,
      shippedTodayUnits,
      movementsToday,
      customersOwe,
      owingInvoices,
      overdue: overdue.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")),
      oweSuppliers,
      unpaidOrders,
      expected,
      expectedUnits,
    };
  }, [salesOrders, purchaseOrders, movements]);

  /* Brief point 11: "what happened today?" in one line, above the month
     figures. Empty days say so plainly rather than showing four zeros. */
  const todayLine = (() => {
    const parts: string[] = [];
    if (business.soldTodayCount > 0) {
      parts.push(
        `${formatCurrency(business.soldToday, currencyCode)} sold on ${formatNumber(
          business.soldTodayCount
        )} invoice${business.soldTodayCount === 1 ? "" : "s"}`
      );
    }
    if (business.receivedTodayUnits > 0) {
      parts.push(`${formatNumber(business.receivedTodayUnits)} units in`);
    }
    if (business.shippedTodayUnits > 0) {
      parts.push(`${formatNumber(business.shippedTodayUnits)} units out`);
    }
    if (parts.length === 0 && business.movementsToday > 0) {
      parts.push(
        `${formatNumber(business.movementsToday)} stock change${business.movementsToday === 1 ? "" : "s"}`
      );
    }
    return parts;
  })();

  const businessCards: Array<{
    label: string;
    rawValue: number;
    format: (n: number) => string;
    detail: string;
    href: string;
    /** Last 14 days, oldest first -- only where a day-by-day trend is a
     * real flow, not a snapshot balance dressed up as one. */
    trend?: number[];
    /** A real comparison line under the figure, or nothing. */
    compare?: { delta: number | null; label: string };
  }> = [
    {
      label: "Sold this month",
      rawValue: business.soldThisMonth,
      format: (n: number) => formatCurrency(n, currencyCode),
      detail:
        business.soldCount === 0
          ? "No invoices yet this month"
          : `${formatNumber(business.soldCount)} invoice${business.soldCount === 1 ? "" : "s"}`,
      href: "/dashboard/sales",
      // Last 14 days, oldest first -- the sparkline in the card's corner.
      trend: business.soldTrend,
      compare:
        business.soldLastMonth > 0
          ? {
              delta: (business.soldThisMonth - business.soldLastMonth) / business.soldLastMonth,
              label: "vs last month",
            }
          : business.soldThisMonth > 0
            ? { delta: null, label: "Nothing sold last month" }
            : undefined,
    },
    {
      label: "Customers owe you",
      rawValue: business.customersOwe,
      format: (n: number) => formatCurrency(n, currencyCode),
      detail:
        business.overdue.length > 0
          ? `${formatNumber(business.overdue.length)} overdue`
          : business.owingInvoices > 0
            ? `${formatNumber(business.owingInvoices)} open invoice${business.owingInvoices === 1 ? "" : "s"}`
            : "Everything is settled",
      href: "/dashboard/sales?status=issued",
    },
    {
      label: "You owe suppliers",
      rawValue: business.oweSuppliers,
      format: (n: number) => formatCurrency(n, currencyCode),
      detail:
        business.unpaidOrders > 0
          ? `${formatNumber(business.unpaidOrders)} order${business.unpaidOrders === 1 ? "" : "s"} not fully paid`
          : "No supplier balance",
      href: "/dashboard/purchase-orders",
    },
    {
      label: "Deliveries expected",
      rawValue: business.expected.length,
      format: (n: number) => formatNumber(Math.round(n)),
      detail:
        business.expected.length > 0
          ? `${formatNumber(business.expectedUnits)} units still to come`
          : "Nothing on order",
      href: "/dashboard/receiving",
    },
  ];

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
      {/* Phone Home, from the two most-viewed inventory apps on Dribbble
          (20 Sep): a greeting row -- avatar, "Welcome back", the business,
          a bell -- and then ONE hero figure in the accent colour with its
          delta and sparkline, before the small tiles. Rendered always;
          mobile.css shows this and hides .ov-head under 768px, and the
          reverse above it, so the desktop page is untouched. The bell goes
          to Alerts and carries the real low-stock count. */}
      <header className="ov-phone-head" aria-label="Welcome">
        <span className="ov-phone-avatar" aria-hidden="true">
          {businessSettings.business_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={businessSettings.business_logo_url} alt="" />
          ) : (
            (businessSettings.business_name || "S").slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="ov-phone-greeting">
          <small>Welcome back</small>
          <strong>{businessSettings.business_name || "Your workspace"}</strong>
        </span>
        {/* The laptop has Ctrl+K and a header field; the phone had no way
            into global search at all. */}
        <Link href="/dashboard/search" className="ov-phone-bell" aria-label="Search everything">
          <UiIcon name="search" className="h-5 w-5" />
        </Link>
        <Link
          href="/dashboard/alerts"
          className="ov-phone-bell"
          aria-label={`Alerts, ${formatNumber(dashboardData.lowStockCount)} items need attention`}
        >
          <UiIcon name="alert" className="h-5 w-5" />
          {dashboardData.lowStockCount > 0 && (
            <i aria-hidden="true">{dashboardData.lowStockCount}</i>
          )}
        </Link>
      </header>

      {!hasNoItems && businessCards[0] && (
        <Link href={businessCards[0].href} className="ov-phone-hero">
          <span className="ov-phone-hero-label">{businessCards[0].label}</span>
          <span className="ov-phone-hero-value">
            {loading ? "--" : businessCards[0].format(businessCards[0].rawValue)}
          </span>
          <span className="ov-phone-hero-row">
            {!loading && businessCards[0].compare && (
              <span className="ov-phone-hero-pill">
                {businessCards[0].compare.delta !== null
                  ? `${businessCards[0].compare.delta >= 0 ? "+" : "−"}${Math.round(
                      Math.abs(businessCards[0].compare.delta) * 100
                    )}% ${businessCards[0].compare.label}`
                  : businessCards[0].compare.label}
              </span>
            )}
            <span className="ov-phone-hero-note">{businessCards[0].detail}</span>
          </span>
          {!loading && businessCards[0].trend && (
            <span className="ov-phone-hero-spark">
              <Sparkline values={businessCards[0].trend} />
            </span>
          )}
        </Link>
      )}

      <header className="ov-head">
        <div className="ov-head-text">
          <p className="ov-eyebrow">{businessSettings.business_name}</p>
          {/* Matches the sidebar and top bar, which both call this page
              "Overview". Two names for one page is worse than either name. */}
          <h1 id="dashboard-title" className="ov-title">
            Overview
          </h1>
        </div>
        {/* The reference's page header is title on the left, context and a
            primary action on the right. Ours had nothing on the right, which
            is why the top of the page felt empty next to it. The date is
            real (today, informational, no filter pretending to exist behind
            it) and the action is the one a depot starts most days with. */}
        <div className="ov-head-actions">
          <span className="ov-head-date">
            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date())}
          </span>
          <Link href="/dashboard/sales/new" className={buttonClassName()}>
            New invoice
          </Link>
        </div>
      </header>

      {/* Was .sydin-overview-alert: a one-off amber box at 10px radius, the
          only error style in the app that did not match the others. Overview
          is the first screen after sign-in, so an error here should look like
          an error anywhere else. */}
      {error && <DashboardNotice tone="warning">{error}</DashboardNotice>}

      {/* Key figures, back to being cards (16 Sep) -- Sayed's reference image
          uses bordered tiles for exactly this row, and asked for the
          workspace to match it. Still a div, not a <section>: `main > div >
          section` card-ifies by DOM position, and .ov-figure sets its own
          border/background/shadow explicitly instead, so it looks the same
          regardless of which selector would otherwise have won. */}
      <div className="ov-figures" role="group" aria-label="Inventory summary">
        {summaryCards.map((card) => {
          /* The phone gives each figure about 160px. At the canvas's 40px that
             holds roughly seven characters, so "35,186" fits and "$1,712,130"
             was being cut off mid-number -- measured, 181px of text in a 160px
             cell. CSS cannot ask how long a string is, so the length is
             measured here, where the formatted value already exists, and the
             long ones get a smaller size on phones only. Length rather than
             "is it the money card", so it keeps working when the amount grows
             or the currency changes. */
          const rendered =
            card.rawValue === null ? "" : card.format(card.rawValue);

          return (
          <Link key={card.label} href={card.href} className="ov-figure">
            <span className="ov-figure-label">{card.label}</span>
            <span
              className={`ov-figure-value${
                figureSizeClass(rendered)
              }`}
            >
              {loading || card.rawValue === null ? (
                "--"
              ) : (
                <CountUpNumber value={card.rawValue} format={card.format} />
              )}
            </span>
            <span className="ov-figure-note">{card.detail}</span>
          </Link>
          );
        })}
      </div>

      {/* The money row. Same tiles as the stock row above it, in the order
          an owner reads them: what came in, what is still coming, what
          goes out, what is on the way. */}
      {!hasNoItems && !loading && (
        <p className="ov-today" aria-label="Today">
          <strong>Today</strong>
          <span>
            {todayLine.length > 0
              ? todayLine.join(" · ")
              : "Nothing sold or moved yet today."}
          </span>
        </p>
      )}

      {!hasNoItems && (
        <div className="ov-figures ov-figures-business" role="group" aria-label="Business summary">
          {businessCards.map((card) => {
            const rendered = card.format(card.rawValue);
            return (
              <Link key={card.label} href={card.href} className="ov-figure">
                <span className="ov-figure-heading">
                  <span className="ov-figure-label">{card.label}</span>
                  {!loading && card.trend && <Sparkline values={card.trend} />}
                </span>
                <span
                  className={`ov-figure-value${
                    figureSizeClass(rendered)
                  }`}
                >
                  {loading ? "--" : rendered}
                </span>
                <span className="ov-figure-note">{card.detail}</span>
                {!loading && card.compare && (
                  <span className="ov-figure-compare">
                    {card.compare.delta !== null && (
                      <b
                        className={
                          card.compare.delta < 0 ? "ov-figure-compare-down" : "ov-figure-compare-up"
                        }
                      >
                        {card.compare.delta >= 0 ? "+" : "−"}
                        {Math.round(Math.abs(card.compare.delta) * 100)}%
                      </b>
                    )}
                    {card.compare.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {hasNoItems ? (
        /* One empty state for the whole screen. The old Overview stacked three
           separate "No items yet / Add Item" blocks on a new workspace. */
        <DashboardEmptyState
          icon="box"
          title="Your workspace is empty"
          description="Add your first item to start tracking stock, depots and activity. Everything on this screen fills in as you go."
          action={
            <ActionButton
              onClick={() =>
                requestAddItem(
                  {},
                  { pathname, navigate: (href) => router.push(href) }
                )
              }
              icon="plus"
            >
              Add your first item
            </ActionButton>
          }
        />
      ) : (
        <>
        {/* The graph from the reference dashboard: money in and out by day,
            from the orders already loaded here. Full width, above the two
            columns, because it is the one thing on the page that shows the
            business moving rather than standing still. */}
        <MoneyFlowChart
          salesOrders={salesOrders}
          purchaseOrders={purchaseOrders}
          formatMoney={(value) => formatCurrency(value, currencyCode)}
          loading={loading}
        />
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
                  /* An action centre, not a coloured list (Sayed, §12): each
                     row says what's wrong in numbers -- current against
                     minimum -- and carries the fix. Restock opens a new PO
                     with this item already on it; that route existed for the
                     Inventory bulk action, it just wasn't reachable from
                     here. The item link and the action are siblings: a
                     button inside an <a> is invalid HTML. */
                  <li key={entry.item.id} className="ov-attention-row">
                    <Link
                      href={getDashboardItemHref(entry.item.id)}
                      className="ov-row ov-attention-link"
                    >
                      <ItemThumb item={entry.item} />
                      <span className="ov-row-text">
                        <strong>{entry.item.name}</strong>
                        <small>
                          {/* The current quantity is the value column on the
                              right; repeating it here pushed the minimum --
                              the one number that explains why the row exists
                              -- off the end of the line at laptop widths. */}
                          {[entry.depot, `Minimum ${formatNumber(entry.threshold)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <span className={`ov-row-value ov-value-${entry.state}`}>
                        {entry.state === "out"
                          ? "Out"
                          : getInventoryQuantityLabel(
                              entry.item.quantity,
                              entry.item.unit_type,
                              entry.item.custom_unit_label
                            )}
                      </span>
                      {/* Mobile canvas: "Status is a coloured dot, not a pill:
                          less furniture, same meaning." Safe to add here and
                          not on the Inventory row, because this line already
                          spells the state out ("Low stock · min 10") -- the
                          dot is a second, faster reading of a fact that is
                          still written down, so nothing is lost to a reader
                          who cannot separate red from amber. aria-hidden for
                          exactly that reason: the text already said it.
                          Phone-only (see .ov-row-dot in app/mobile.css): on
                          desktop the quantity itself is already coloured by
                          state, so a dot beside it would be the second copy
                          of a signal that is already there -- the furniture
                          the canvas note is against.
                          The modifier names are older than they look --
                          ov-dot-neutral is the amber one and ov-dot-warning
                          the red -- so the mapping is spelled out rather than
                          guessed from the name. */}
                      <span
                        aria-hidden="true"
                        className={`ov-row-dot ov-dot ${
                          entry.state === "out"
                            ? "ov-dot-warning"
                            : entry.state === "low"
                              ? "ov-dot-neutral"
                              : "ov-dot-success"
                        }`}
                      />
                    </Link>
                    <Link
                      href={`/dashboard/purchase-orders/new?items=${entry.item.id}&returnTo=${encodeURIComponent(
                        DASHBOARD_RETURN_TO
                      )}`}
                      className={buttonClassName({ variant: "secondary", size: "sm" })}
                      aria-label={`Restock ${entry.item.name}`}
                    >
                      Restock
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
                  /* A real activity feed (Sayed, §11): WHAT happened, TO
                     WHAT, how much, against WHICH document, WHEN. The row
                     used to show the item and the movement type and nothing
                     else -- a stock-movement feed with no quantity on it.
                     The delta is the point; it's signed, coloured by
                     direction, in the item's own unit. The reference comes
                     out of the note when one was recorded ("PO #12 — ...").
                     No "who": SydIN is single-user, it is always the owner. */
                  const delta = movement.quantity_delta;
                  const deltaLabel =
                    delta === 0
                      ? null
                      : `${delta > 0 ? "+" : "−"}${getInventoryQuantityLabel(
                          Math.abs(delta),
                          item?.unit_type,
                          item?.custom_unit_label
                        )}`;
                  const reference = item
                    ? formatStockMovementNotes(movement.notes)
                    : "";

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
                          <strong>
                            {movementLabel}
                            {item?.item_code || item?.sku ? (
                              <span className="ov-row-code">
                                {item.item_code || item.sku}
                              </span>
                            ) : null}
                          </strong>
                          <small>
                            {[
                              STOCK_MOVEMENT_LABELS[movement.movement_type],
                              reference,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="ov-row-end">
                          {deltaLabel && (
                            <span
                              className={`ov-row-delta ${
                                delta > 0 ? "ov-row-delta-in" : "ov-row-delta-out"
                              }`}
                            >
                              {deltaLabel}
                            </span>
                          )}
                          <span className="ov-row-time">
                            {formatDateDistance(movement.created_at)}
                          </span>
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

          {(business.overdue.length > 0 || business.expected.length > 0) && (
            <section className="ov-section" aria-labelledby="ov-action-title">
              <div className="ov-section-head">
                <h2 id="ov-action-title" className="ov-section-title">
                  Action required
                </h2>
              </div>
              <ul className="ov-list">
                {business.overdue.slice(0, 4).map((order) => (
                  <li key={`inv-${order.id}`}>
                    <Link href={`/dashboard/sales/${order.id}`} className="ov-row">
                      <span className="ov-row-text">
                        <strong>
                          {order.invoice_number}
                          {order.customer_name_snapshot
                            ? ` · ${order.customer_name_snapshot}`
                            : ""}
                        </strong>
                        <small>Overdue since {formatDateShort(order.due_date)}</small>
                      </span>
                      <span className="ov-row-value ov-row-value-danger">
                        {formatSalesOrderAmount(order, getSalesOrderBalance(order))}
                      </span>
                    </Link>
                  </li>
                ))}
                {business.expected.slice(0, 4).map((order) => {
                  const progress = getPurchaseOrderReceivingProgress(order);
                  return (
                    <li key={`po-${order.id}`}>
                      <Link
                        href={`/dashboard/purchase-orders?open=${order.id}&receive=1`}
                        className="ov-row"
                      >
                        <span className="ov-row-text">
                          <strong>
                            {order.po_number}
                            {order.supplier_name_snapshot
                              ? ` · ${order.supplier_name_snapshot}`
                              : ""}
                          </strong>
                          <small>
                            {order.expected_delivery_date
                              ? `Expected ${formatDateShort(order.expected_delivery_date)} · `
                              : ""}
                            {formatNumber(progress.remaining)} units to receive
                          </small>
                        </span>
                        <span className="ov-row-value">Receive</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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
                ].map((group) => {
                  /* The panel answers "where does my stock sit?" -- a question
                     about proportion -- and answered it with bare numbers, so
                     34,786 against 391 against 8 had to be compared digit by
                     digit. Each row now carries its own share as a tint behind
                     it. No extra height, and it borrows the bar language the
                     health strip two panels above already established. */
                  const groupTotal = group.rows.reduce(
                    (sum, row) => sum + Math.max(0, row.quantity),
                    0
                  );

                  return (
                  <div key={group.key} className="ov-split-col">
                    <p className="ov-figure-label">{group.label}</p>
                    <ul className="ov-list">
                      {group.rows.map((row) => (
                        <li key={row.label}>
                          <span
                            className="ov-row ov-row-static ov-row-share"
                            style={
                              {
                                "--share": groupTotal
                                  ? `${Math.round((Math.max(0, row.quantity) / groupTotal) * 100)}%`
                                  : "0%",
                              } as React.CSSProperties
                            }
                          >
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
                  );
                })}
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
        </>
      )}
      </div>
    </main>
  );
}
