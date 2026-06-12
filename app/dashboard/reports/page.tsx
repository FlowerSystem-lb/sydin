"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { getDepotsForUser, type Depot } from "@/app/lib/depots";
import {
  formatInventoryPrice,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";
import {
  getInventoryValueTotals,
  getLowStockReport,
  getMovementTimeBuckets,
  getMovementTotals,
  getOutOfStockReport,
  getPriceDataCoverage,
  getRankedValueItems,
  groupInventoryValues,
  normalizeReportNumber,
  summarizeTopValueGroups,
  type GroupedInventoryValue,
  type InventoryReportItem,
  type ReportStockMovement,
  type StockHealthReportItem,
} from "@/app/lib/inventoryReports";
import {
  STOCK_MOVEMENT_LABELS,
  type StockMovementType,
} from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

type DatePreset = 7 | 30 | 90;

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function getDateRange(days: DatePreset) {
  const endDate = new Date();
  const startDate = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    )
  );
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  return { startDate, endDate };
}

function formatNumber(value: number) {
  return normalizeReportNumber(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatSignedNumber(value: number) {
  const normalizedValue = normalizeReportNumber(value);
  return `${normalizedValue > 0 ? "+" : ""}${formatNumber(normalizedValue)}`;
}

function formatCurrency(value: number, currencyCode: string) {
  const normalizedValue = normalizeReportNumber(value);
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");

  if (normalizedValue >= 0) {
    return (
      formatInventoryPrice(normalizedValue, normalizedCurrency) ||
      `${normalizedCurrency} 0.00`
    );
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalizedValue);
  } catch {
    return `${normalizedCurrency} ${normalizedValue.toFixed(2)}`;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: UiIconName;
  accent: string;
}) {
  return (
    <article className="rounded-[26px] border border-theme bg-theme-inset p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-theme-muted">{label}</p>
          <p className="mt-3 break-words text-3xl font-black tracking-tight text-theme-primary">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-theme-primary shadow-[0_14px_40px_rgba(99,102,241,0.2)]`}
        >
          <UiIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-theme-subtle">{detail}</p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-theme-primary sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-theme-muted">
        {description}
      </p>
    </div>
  );
}

function StockHealthTable({
  title,
  items,
  depots,
  suppliers,
  limit,
}: {
  title: string;
  items: StockHealthReportItem[];
  depots: Map<number, string>;
  suppliers: Map<number, string>;
  limit?: number;
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <article className="overflow-hidden rounded-[28px] border border-theme bg-theme-inset">
      <div className="flex items-center justify-between gap-4 border-b border-theme px-5 py-4">
        <h3 className="text-lg font-black text-theme-primary">{title}</h3>
        <span className="rounded-full border border-theme bg-theme-surface px-3 py-1 text-xs font-bold text-theme-secondary">
          {items.length}
        </span>
      </div>

      {visibleItems.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-theme-success">
            <UiIcon name="layers" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-bold text-theme-primary">Nothing to review</p>
          <p className="mt-1 text-sm text-theme-subtle">
            Your current stock does not have items in this report.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-theme-surface text-xs uppercase tracking-[0.12em] text-theme-subtle">
              <tr>
                <th className="px-5 py-3 font-bold">Item</th>
                <th className="px-4 py-3 font-bold">Quantity</th>
                <th className="px-4 py-3 font-bold">Threshold</th>
                <th className="px-4 py-3 font-bold">Depot</th>
                <th className="px-4 py-3 font-bold">Supplier</th>
                <th className="px-5 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {visibleItems.map((item) => (
                <tr key={item.id} className="text-theme-secondary">
                  <td className="px-5 py-4">
                    <p className="font-bold text-theme-primary">{item.name}</p>
                    <p className="mt-1 text-xs text-theme-subtle">
                      {item.item_code?.trim() || "No item code"}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {getInventoryQuantityLabel(
                      item.normalizedQuantity,
                      item.unit_type,
                      item.custom_unit_label
                    )}
                  </td>
                  <td className="px-4 py-4">{formatNumber(item.threshold)}</td>
                  <td className="px-4 py-4">
                    {item.depot_id
                      ? depots.get(item.depot_id) || "Unassigned"
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-4">
                    {item.supplier_id
                      ? suppliers.get(item.supplier_id) || "No supplier"
                      : "No supplier"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="inline-flex min-h-9 items-center rounded-xl border border-sky-200/15 bg-sky-400/10 px-3 py-2 text-xs font-bold text-theme-accent transition hover:border-sky-200/30 hover:bg-sky-400/15"
                    >
                      View item
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {limit && items.length > limit && (
        <p className="border-t border-theme px-5 py-3 text-xs text-theme-subtle">
          Free reports show the first {limit} items. Standard unlocks complete
          lists and advanced analytics.
        </p>
      )}
    </article>
  );
}

function ValueBarChart({
  title,
  groups,
  currencyCode,
}: {
  title: string;
  groups: GroupedInventoryValue[];
  currencyCode: string;
}) {
  const visibleGroups = summarizeTopValueGroups(groups, 6);
  const highestValue = Math.max(
    ...visibleGroups.map((group) => group.costValue),
    0
  );

  return (
    <article className="rounded-[28px] border border-theme bg-theme-inset p-5 sm:p-6">
      <h3 className="text-xl font-black text-theme-primary">{title}</h3>
      <p className="mt-1 text-xs text-theme-subtle">
        Current stock cost value, top six groups plus Other
      </p>

      {visibleGroups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-theme px-4 py-10 text-center text-sm text-theme-subtle">
          Add cost prices to populate this chart.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visibleGroups.map((group) => {
            const width =
              highestValue > 0
                ? Math.max((group.costValue / highestValue) * 100, 2)
                : 0;

            return (
              <div key={group.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-200">
                    {group.label}
                  </p>
                  <p className="shrink-0 text-xs font-black text-theme-primary">
                    {formatCurrency(group.costValue, currencyCode)}
                  </p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full border border-theme bg-theme-inset">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-violet-500 shadow-[0_0_18px_rgba(99,102,241,0.42)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function MovementChart({
  buckets,
}: {
  buckets: ReturnType<typeof getMovementTimeBuckets>;
}) {
  const highestValue = Math.max(
    ...buckets.flatMap((bucket) => [bucket.stockIn, bucket.stockOut]),
    0
  );

  return (
    <article className="rounded-[28px] border border-theme bg-theme-inset p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-theme-primary">
            Stock in vs stock out
          </h3>
          <p className="mt-1 text-xs text-theme-subtle">
            Adjustments and damaged stock are kept separate.
          </p>
        </div>
        <div className="flex gap-3 text-xs font-bold">
          <span className="flex items-center gap-2 text-theme-success">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Stock in
          </span>
          <span className="flex items-center gap-2 text-theme-danger">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            Stock out
          </span>
        </div>
      </div>

      {highestValue === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-theme px-4 py-12 text-center text-sm text-theme-subtle">
          No stock in or stock out movements in this period.
        </div>
      ) : (
        <div className="mt-7 overflow-x-auto pb-2">
          <div
            className="grid min-w-max items-end gap-2"
            style={{
              gridTemplateColumns: `repeat(${buckets.length}, minmax(34px, 1fr))`,
            }}
          >
            {buckets.map((bucket) => {
              const stockInHeight =
                highestValue > 0 ? (bucket.stockIn / highestValue) * 150 : 0;
              const stockOutHeight =
                highestValue > 0 ? (bucket.stockOut / highestValue) * 150 : 0;

              return (
                <div
                  key={bucket.key}
                  className="flex w-14 flex-col items-center sm:w-16"
                >
                  <div className="flex h-40 items-end gap-1">
                    <div
                      className="w-3 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-300"
                      style={{
                        height: `${Math.max(
                          stockInHeight,
                          bucket.stockIn > 0 ? 3 : 0
                        )}px`,
                      }}
                      title={`Stock in ${formatNumber(bucket.stockIn)}`}
                    />
                    <div
                      className="w-3 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-300"
                      style={{
                        height: `${Math.max(
                          stockOutHeight,
                          bucket.stockOut > 0 ? 3 : 0
                        )}px`,
                      }}
                      title={`Stock out ${formatNumber(bucket.stockOut)}`}
                    />
                  </div>
                  <p className="mt-2 max-w-16 text-center text-[10px] font-semibold leading-4 text-theme-subtle">
                    {bucket.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export default function ReportsPage() {
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<InventoryReportItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<ReportStockMovement[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [datePreset, setDatePreset] = useState<DatePreset>(30);
  const [loading, setLoading] = useState(true);
  const [movementLoading, setMovementLoading] = useState(true);
  const [error, setError] = useState("");
  const [movementError, setMovementError] = useState("");

  const hasAdvancedReports =
    subscriptionUsage.subscription.plan !== "free";
  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const itemUsageText = `${subscriptionUsage.usedItems} / ${subscriptionUsage.subscription.item_limit} items`;
  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );
  const currencyCode = businessSettings.currency_code || "USD";

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("We could not confirm your session. Please sign in again.");
          setLoading(false);
          return;
        }

        const [inventoryResult, usage, settings] = await Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, item_code, category, category_id, quantity, unit_type, custom_unit_label, cost_price, selling_price, min_stock_level, depot_id, supplier_id"
            )
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          getSubscriptionUsage(user.id),
          getOrCreateBusinessSettings(user.id),
        ]);

        if (!isActive) return;

        if (inventoryResult.error) {
          setError(
            "We could not load your report data. Refresh the page and try again."
          );
          setLoading(false);
          return;
        }

        setUserId(user.id);
        setItems((inventoryResult.data || []) as InventoryReportItem[]);
        setSubscriptionUsage(usage);
        setBusinessSettings(settings);

        const [loadedDepots, loadedSuppliers, loadedCategories] =
          await Promise.all([
          getDepotsForUser(user.id),
          getSuppliersForUser(user.id),
          getCategoriesForUser(user.id),
        ]);

        if (!isActive) return;
        setDepots(loadedDepots);
        setSuppliers(loadedSuppliers);
        setCategories(loadedCategories);

        setLoading(false);
      })
      .catch(() => {
        if (!isActive) return;
        setError(
          "We could not load your reports workspace. Refresh the page and try again."
        );
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !hasAdvancedReports) return;

    let isActive = true;
    const { startDate, endDate } = getDateRange(datePreset);

    supabase
      .from("stock_movements")
      .select(
        "id, item_id, movement_type, quantity_delta, quantity_before, quantity_after, notes, created_at"
      )
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!isActive) return;

        if (fetchError) {
          setMovementError(
            "Movement analytics could not be loaded for this period."
          );
          setMovements([]);
        } else {
          setMovements((data || []) as ReportStockMovement[]);
        }

        setMovementLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [datePreset, hasAdvancedReports, userId]);

  const depotNames = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot.name])),
    [depots]
  );
  const supplierNames = useMemo(
    () =>
      new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers]
  );
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const lowStockItems = useMemo(
    () =>
      getLowStockReport(
        items,
        effectiveLowStockThreshold,
        planCapabilities.customLowStockThreshold
      ),
    [
      effectiveLowStockThreshold,
      items,
      planCapabilities.customLowStockThreshold,
    ]
  );
  const outOfStockItems = useMemo(
    () => getOutOfStockReport(items),
    [items]
  );

  const advancedAnalytics = useMemo(() => {
    if (!hasAdvancedReports) return null;

    const totals = getInventoryValueTotals(items);
    const coverage = getPriceDataCoverage(items);
    const topCostItems = getRankedValueItems(items, "cost");
    const topRetailItems = getRankedValueItems(items, "retail");
    const costPricedItems = items.filter(
      (item) =>
        item.cost_price !== null &&
        item.cost_price !== undefined &&
        item.cost_price !== "" &&
        Number.isFinite(Number(item.cost_price)) &&
        Number(item.cost_price) >= 0
    );
    const valueByDepot = groupInventoryValues(costPricedItems, (item) =>
      item.depot_id
        ? depotNames.get(item.depot_id) || "Unassigned"
        : "Unassigned"
    );
    const valueBySupplier = groupInventoryValues(
      costPricedItems,
      (item) =>
        item.supplier_id
          ? supplierNames.get(item.supplier_id) || "No supplier"
          : "No supplier"
    );
    const valueByCategory = groupInventoryValues(
      costPricedItems,
      (item) =>
        resolveCategoryDisplay(
          item,
          item.category_id
            ? categoryNames.get(item.category_id) || null
            : null
        )
    );

    return {
      ...totals,
      ...coverage,
      topCostItems,
      topRetailItems,
      valueByDepot,
      valueBySupplier,
      valueByCategory,
    };
  }, [
    depotNames,
    categoryNames,
    hasAdvancedReports,
    items,
    supplierNames,
  ]);

  const movementAnalytics = useMemo(() => {
    const range = getDateRange(datePreset);

    return {
      totals: getMovementTotals(movements),
      buckets: getMovementTimeBuckets({
        movements,
        ...range,
        bucketSize: datePreset === 90 ? "week" : "day",
      }),
    };
  }, [datePreset, movements]);

  const summaryCards = advancedAnalytics
    ? [
        {
          label: "Total stock cost value",
          value: formatCurrency(
            advancedAnalytics.totalCostValue,
            currencyCode
          ),
          detail: "Current quantity multiplied by recorded cost price",
          icon: "layers" as UiIconName,
          accent: "from-cyan-300 to-indigo-500",
        },
        {
          label: "Total retail value",
          value: formatCurrency(
            advancedAnalytics.totalRetailValue,
            currencyCode
          ),
          detail: "Potential retail value, not completed sales",
          icon: "box" as UiIconName,
          accent: "from-indigo-400 to-violet-500",
        },
        {
          label: "Estimated margin value",
          value: formatCurrency(
            advancedAnalytics.estimatedMarginValue,
            currencyCode
          ),
          detail: "Potential retail value minus current stock cost value",
          icon: "sheet" as UiIconName,
          accent:
            advancedAnalytics.estimatedMarginValue < 0
              ? "from-rose-400 to-fuchsia-500"
              : "from-emerald-300 to-cyan-500",
        },
        {
          label: "Items with price data",
          value: advancedAnalytics.itemsWithPriceData.toLocaleString(),
          detail: `${advancedAnalytics.costPriceItems} cost priced, ${advancedAnalytics.retailPriceItems} retail priced`,
          icon: "file" as UiIconName,
          accent: "from-violet-400 to-sky-400",
        },
      ]
    : [];

  return (
    <div className="liquid-bg min-h-screen overflow-x-hidden text-theme-primary">
      <Sidebar
        addItemHref="/dashboard/add-item"
        planName={currentPlanName}
        itemUsage={itemUsageText}
        businessName={businessSettings.business_name}
        businessLogoUrl={businessSettings.business_logo_url}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-7">
          <section className="rounded-[32px] border border-theme bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_36%),rgba(255,255,255,0.045)] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-400/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                  Private workspace
                  <span className="h-1 w-1 rounded-full bg-cyan-300" />
                  {currentPlanName}
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-theme-primary sm:text-5xl lg:text-6xl">
                  Reports
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-theme-muted">
                  Private inventory insights based on your current stock and
                  movement history.
                </p>
              </div>

              {hasAdvancedReports && (
                <div className="rounded-2xl border border-theme bg-theme-inset p-3">
                  <p className="px-1 text-xs font-bold uppercase tracking-[0.13em] text-theme-subtle">
                    Movement period
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {([7, 30, 90] as DatePreset[]).map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          if (days === datePreset) return;
                          setMovementLoading(true);
                          setMovementError("");
                          setDatePreset(days);
                        }}
                        className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          datePreset === days
                            ? "border-cyan-200/30 bg-cyan-400/15 text-theme-primary"
                            : "border-theme bg-theme-surface text-theme-muted hover:bg-theme-hover hover:text-theme-primary"
                        }`}
                      >
                        Last {days} days
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-indigo-300/15 bg-indigo-500/[0.07] px-4 py-3 text-sm leading-6 text-theme-muted">
              Current value reports are live snapshots. The date filter applies
              only to movement reports.
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-theme-danger">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-[26px] border border-theme bg-theme-surface"
                />
              ))}
            </div>
          ) : (
            <>
              <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                <SectionHeading
                  eyebrow="Stock health"
                  title="Items needing attention"
                  description="Low-stock thresholds follow your current plan. Out-of-stock items are shown separately so the two reports stay actionable."
                />
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SummaryCard
                    label="Low-stock items"
                    value={lowStockItems.length.toLocaleString()}
                    detail="Above zero and at or below the effective threshold"
                    icon="alert"
                    accent="from-amber-300 to-orange-500"
                  />
                  <SummaryCard
                    label="Out-of-stock items"
                    value={outOfStockItems.length.toLocaleString()}
                    detail="Items with zero or lower recorded quantity"
                    icon="alert"
                    accent="from-rose-400 to-red-500"
                  />
                </div>
                <div className="mt-5 grid grid-cols-1 gap-5">
                  <StockHealthTable
                    title="Low-stock report"
                    items={lowStockItems}
                    depots={depotNames}
                    suppliers={supplierNames}
                    limit={hasAdvancedReports ? undefined : 5}
                  />
                  <StockHealthTable
                    title="Out-of-stock report"
                    items={outOfStockItems}
                    depots={depotNames}
                    suppliers={supplierNames}
                    limit={hasAdvancedReports ? undefined : 5}
                  />
                </div>
              </section>

              {!hasAdvancedReports ? (
                <LockedFeaturePanel
                  feature="Unlock value and movement reports with Standard."
                  benefit="See current stock cost and potential retail value, depot and supplier analysis, movement summaries, focused charts, complete report lists, and date filters. Values stay private inside your dashboard."
                  currentPlan={currentPlanName}
                  requiredPlan="Standard"
                  source="reports-center"
                />
              ) : (
                <>
                  <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                    <SectionHeading
                      eyebrow="Current value snapshot"
                      title="Inventory value"
                      description="Missing prices are excluded. A recorded zero remains a real zero. Estimated margin is potential retail value minus current stock cost value, not completed earnings."
                    />
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {summaryCards.map((card) => (
                        <SummaryCard key={card.label} {...card} />
                      ))}
                    </div>
                  </section>

                  {advancedAnalytics && (
                    <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                      <SectionHeading
                        eyebrow="Value analysis"
                        title="Where inventory value sits"
                        description="Cost value is grouped from current item assignments. Unassigned depots, missing suppliers, and blank categories remain visible."
                      />
                      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <ValueBarChart
                          title="Stock value by depot"
                          groups={advancedAnalytics.valueByDepot}
                          currencyCode={currencyCode}
                        />
                        <ValueBarChart
                          title="Stock value by supplier"
                          groups={advancedAnalytics.valueBySupplier}
                          currencyCode={currencyCode}
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
                        {[
                          {
                            title: "Top stock cost value items",
                            items: advancedAnalytics.topCostItems,
                          },
                          {
                            title: "Top potential retail value items",
                            items: advancedAnalytics.topRetailItems,
                          },
                        ].map((report) => (
                          <article
                            key={report.title}
                            className="rounded-[28px] border border-theme bg-theme-inset p-5"
                          >
                            <h3 className="text-lg font-black text-theme-primary">
                              {report.title}
                            </h3>
                            {report.items.length === 0 ? (
                              <p className="mt-5 rounded-2xl border border-dashed border-theme px-4 py-8 text-center text-sm text-theme-subtle">
                                No matching price data yet.
                              </p>
                            ) : (
                              <div className="mt-4 space-y-2">
                                {report.items.map((entry, index) => (
                                  <Link
                                    key={entry.item.id}
                                    href={`/dashboard/inventory/${entry.item.id}`}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-theme-surface px-4 py-3 transition hover:border-cyan-200/20 hover:bg-theme-hover"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-theme-primary">
                                        {index + 1}. {entry.item.name}
                                      </p>
                                      <p className="mt-1 text-xs text-theme-subtle">
                                        {getInventoryQuantityLabel(
                                          entry.item.quantity,
                                          entry.item.unit_type,
                                          entry.item.custom_unit_label
                                        )}
                                      </p>
                                    </div>
                                    <p className="shrink-0 text-xs font-black text-theme-accent">
                                      {formatCurrency(entry.value, currencyCode)}
                                    </p>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </article>
                        ))}

                        <article className="rounded-[28px] border border-theme bg-theme-inset p-5">
                          <h3 className="text-lg font-black text-theme-primary">
                            Value by category
                          </h3>
                          {advancedAnalytics.valueByCategory.length === 0 ? (
                            <p className="mt-5 rounded-2xl border border-dashed border-theme px-4 py-8 text-center text-sm text-theme-subtle">
                              Add cost prices to populate this report.
                            </p>
                          ) : (
                            <div className="mt-4 space-y-2">
                              {advancedAnalytics.valueByCategory.map(
                                (group) => (
                                  <div
                                    key={group.label}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-theme-surface px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-theme-primary">
                                        {group.label}
                                      </p>
                                      <p className="mt-1 text-xs text-theme-subtle">
                                        {group.itemCount} item
                                        {group.itemCount === 1 ? "" : "s"}
                                      </p>
                                    </div>
                                    <p className="shrink-0 text-xs font-black text-theme-accent">
                                      {formatCurrency(
                                        group.costValue,
                                        currencyCode
                                      )}
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </article>
                      </div>
                    </section>
                  )}

                  <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                    <SectionHeading
                      eyebrow="Movement analytics"
                      title={`Last ${datePreset} days`}
                      description="Stock in, stock out, damaged or lost quantities, and signed adjustments remain separate."
                    />

                    {movementError && (
                      <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-theme-danger">
                        {movementError}
                      </div>
                    )}

                    {movementLoading ? (
                      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div
                            key={item}
                            className="h-32 animate-pulse rounded-[24px] border border-theme bg-theme-surface"
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                          <SummaryCard
                            label="Movement count"
                            value={movementAnalytics.totals.movementCount.toLocaleString()}
                            detail="All movement records in this period"
                            icon="clock"
                            accent="from-violet-400 to-sky-400"
                          />
                          <SummaryCard
                            label="Stock in"
                            value={formatNumber(movementAnalytics.totals.stockIn)}
                            detail="Recorded stock-in quantity"
                            icon="upload"
                            accent="from-emerald-300 to-cyan-500"
                          />
                          <SummaryCard
                            label="Stock out"
                            value={formatNumber(movementAnalytics.totals.stockOut)}
                            detail="Recorded stock-out quantity"
                            icon="download"
                            accent="from-sky-300 to-indigo-500"
                          />
                          <SummaryCard
                            label="Damaged / lost"
                            value={formatNumber(
                              movementAnalytics.totals.damagedLost
                            )}
                            detail="Kept separate from stock out"
                            icon="alert"
                            accent="from-rose-400 to-red-500"
                          />
                          <SummaryCard
                            label="Adjustments"
                            value={movementAnalytics.totals.adjustmentCount.toLocaleString()}
                            detail="Adjustment record count"
                            icon="sheet"
                            accent="from-amber-300 to-orange-500"
                          />
                          <SummaryCard
                            label="Net adjustment"
                            value={formatSignedNumber(
                              movementAnalytics.totals.netAdjustment
                            )}
                            detail="Signed quantity delta from adjustments"
                            icon="layers"
                            accent="from-indigo-400 to-violet-500"
                          />
                        </div>

                        <div className="mt-5">
                          <MovementChart buckets={movementAnalytics.buckets} />
                        </div>

                        <article className="mt-5 overflow-hidden rounded-[28px] border border-theme bg-theme-inset">
                          <div className="border-b border-theme px-5 py-4">
                            <h3 className="text-xl font-black text-theme-primary">
                              Recent movement activity
                            </h3>
                          </div>

                          {movements.length === 0 ? (
                            <div className="px-5 py-12 text-center text-sm text-theme-subtle">
                              No stock movements were recorded in this period.
                            </div>
                          ) : (
                            <div className="divide-y divide-white/[0.07]">
                              {movements.slice(0, 12).map((movement) => {
                                const item = itemsById.get(movement.item_id);
                                const isAdjustment =
                                  movement.movement_type === "adjustment";
                                const signedDelta = normalizeReportNumber(
                                  movement.quantity_delta
                                );

                                return (
                                  <div
                                    key={movement.id}
                                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-bold text-theme-primary">
                                          {item?.name || "Inventory item"}
                                        </p>
                                        <span className="rounded-full border border-theme bg-theme-surface px-2.5 py-1 text-[11px] font-bold text-theme-secondary">
                                          {
                                            STOCK_MOVEMENT_LABELS[
                                              movement.movement_type as StockMovementType
                                            ]
                                          }
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-theme-subtle">
                                        {formatDateTime(movement.created_at)}
                                        {movement.notes
                                          ? ` · ${movement.notes}`
                                          : ""}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                      <p
                                        className={`text-sm font-black ${
                                          signedDelta < 0
                                            ? "text-theme-danger"
                                            : "text-theme-success"
                                        }`}
                                      >
                                        {isAdjustment
                                          ? formatSignedNumber(signedDelta)
                                          : formatNumber(
                                              Math.abs(signedDelta)
                                            )}
                                      </p>
                                      {item && (
                                        <Link
                                          href={`/dashboard/inventory/${item.id}`}
                                          className="rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-theme-hover"
                                        >
                                          View
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </article>
                      </>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
