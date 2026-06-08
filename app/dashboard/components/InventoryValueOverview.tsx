"use client";

import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  formatInventoryPrice,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";

export interface InventoryCategoryValue {
  category: string;
  costValue: number;
  retailValue: number;
}

export interface InventoryValueAnalytics {
  totalCostValue: number;
  totalRetailValue: number;
  estimatedMarginValue: number;
  itemsWithPriceData: number;
  lowStockItems: number;
  outOfStockItems: number;
  hasCostPriceData: boolean;
  categories: InventoryCategoryValue[];
}

interface InventoryValueOverviewProps {
  analytics: InventoryValueAnalytics;
  currencyCode: string;
  currentPlanName: string;
  isLocked: boolean;
  loading: boolean;
}

function formatCompactCurrency(value: number, currencyCode: string) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value.toLocaleString("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    })}`;
  }
}

function formatSignedCurrency(value: number, currencyCode: string) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value.toFixed(2)}`;
  }
}

export default function InventoryValueOverview({
  analytics,
  currencyCode,
  currentPlanName,
  isLocked,
  loading,
}: InventoryValueOverviewProps) {
  const valueCards: Array<{
    label: string;
    value: string;
    detail: string;
    icon: UiIconName;
    accent: string;
  }> = [
    {
      label: "Stock cost value",
      value:
        formatInventoryPrice(analytics.totalCostValue, currencyCode) || "-",
      detail: "Quantity multiplied by cost price",
      icon: "layers",
      accent: "from-cyan-300 to-indigo-500",
    },
    {
      label: "Retail value",
      value:
        formatInventoryPrice(analytics.totalRetailValue, currencyCode) || "-",
      detail: "Quantity multiplied by selling price",
      icon: "box",
      accent: "from-indigo-400 to-violet-500",
    },
    {
      label: "Estimated gross margin",
      value: formatSignedCurrency(
        analytics.estimatedMarginValue,
        currencyCode
      ),
      detail:
        analytics.estimatedMarginValue < 0
          ? "Retail value is below recorded cost value"
          : "Retail value minus stock cost value",
      icon: "clock",
      accent:
        analytics.estimatedMarginValue < 0
          ? "from-rose-400 to-fuchsia-500"
          : "from-emerald-300 to-cyan-500",
    },
    {
      label: "Items with price data",
      value: analytics.itemsWithPriceData.toLocaleString(),
      detail: "Cost or selling price recorded",
      icon: "sheet",
      accent: "from-violet-400 to-sky-400",
    },
    {
      label: "Low-stock items",
      value: analytics.lowStockItems.toLocaleString(),
      detail: "Using the effective item threshold",
      icon: "alert",
      accent: "from-amber-300 to-orange-500",
    },
    {
      label: "Out-of-stock items",
      value: analytics.outOfStockItems.toLocaleString(),
      detail: "Items with zero quantity",
      icon: "alert",
      accent: "from-rose-400 to-red-500",
    },
  ];
  const highestCategoryValue = Math.max(
    ...analytics.categories.map((category) => category.costValue),
    0
  );

  return (
    <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.15),_transparent_38%),rgba(255,255,255,0.045)] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
            Business overview
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Inventory Value Overview
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Values are calculated from current quantities and the prices saved
            on each item. Missing prices are excluded rather than treated as
            zero.
          </p>
        </div>
        {!loading && !isLocked && (
          <span className="w-fit rounded-full border border-indigo-300/20 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-100">
            Currency: {normalizeCurrencyCode(currencyCode, "USD")}
          </span>
        )}
      </div>

      <div className="mt-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-[26px] border border-white/10 bg-white/[0.05]"
              />
            ))}
          </div>
        ) : isLocked ? (
          <LockedFeaturePanel
            feature="Unlock stock value analytics with Standard."
            benefit="See total stock cost, retail value, estimated margin, pricing coverage, and category value insights without exposing item prices publicly."
            currentPlan={currentPlanName}
            requiredPlan="Standard"
            source="dashboard-value-analytics"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {valueCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-[26px] border border-white/10 bg-black/20 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-400">
                        {card.label}
                      </p>
                      <p className="mt-3 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                        {card.value}
                      </p>
                    </div>
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-[0_14px_40px_rgba(99,102,241,0.24)]`}
                    >
                      <UiIcon name={card.icon} className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    {card.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/25 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                    Category analysis
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    Stock value by category
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Ranked by recorded stock cost value
                </p>
              </div>

              {!analytics.hasCostPriceData ? (
                <div className="mt-6 rounded-3xl border border-dashed border-indigo-300/25 bg-indigo-500/[0.06] px-5 py-12 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-indigo-100">
                    <UiIcon name="layers" className="h-7 w-7" />
                  </span>
                  <h4 className="mt-5 text-xl font-bold text-white">
                    Add cost prices to see inventory value analytics.
                  </h4>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                    Category values will appear here as soon as at least one
                    inventory item has a cost price.
                  </p>
                </div>
              ) : (
                <div className="mt-7 space-y-5">
                  {analytics.categories.map((category, index) => {
                    const width =
                      highestCategoryValue > 0
                        ? Math.max(
                            (category.costValue / highestCategoryValue) * 100,
                            category.costValue > 0 ? 2 : 0
                          )
                        : 0;

                    return (
                      <div key={category.category}>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-xs font-black text-indigo-200">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-bold text-slate-200">
                              {category.category}
                            </p>
                          </div>
                          <p className="pl-10 text-sm font-black text-white sm:pl-0">
                            {formatCompactCurrency(
                              category.costValue,
                              currencyCode
                            )}
                          </p>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/[0.06] bg-black/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-violet-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        {category.retailValue > 0 && (
                          <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-500">
                            Retail{" "}
                            {formatCompactCurrency(
                              category.retailValue,
                              currencyCode
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
