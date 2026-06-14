"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  PageHeader,
  buttonClassName,
} from "@/components/ui";
import InventoryValueOverview, {
  type InventoryCategoryValue,
  type InventoryValueAnalytics,
} from "@/app/dashboard/components/InventoryValueOverview";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import { supabase } from "@/app/lib/supabase";
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
} from "@/app/lib/inventoryItemModel";
import {
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/app/lib/onboarding";

interface Item {
  id: number;
  name: string;
  category: string;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );
  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const canViewValueAnalytics = planCapabilities.dashboardAnalytics;

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
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
          .select("*")
          .eq("user_id", user.id)
          .order("id", {
            ascending: false,
          }),
        getSubscriptionUsage(user.id),
        getOrCreateBusinessSettings(user.id),
        getCategoriesForUser(user.id).catch(() => []),
        getOnboardingProgress(user.id).catch(() => null),
      ])
        .then(
          ([
            { data, error: inventoryError },
            usage,
            settings,
            loadedCategories,
            loadedOnboarding,
          ]) => {
          if (!isActive) return;

          if (inventoryError) {
            setError(
              "We could not load your inventory summary. Refresh the page and try again."
            );
            setLoading(false);
            return;
          }

          setItems(data || []);
          setCategories(loadedCategories);
          setSubscriptionUsage(usage);
          setBusinessSettings(settings);
          setOnboarding(loadedOnboarding);
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
    }).catch(() => {
      if (!isActive) return;

      setError("We could not confirm your session. Please sign in again.");
      setLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalStock = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const lowStockItems = items.filter((item) => {
      const itemThreshold = planCapabilities.customLowStockThreshold
        ? getEffectiveItemLowStockThreshold(
            item.min_stock_level,
            effectiveLowStockThreshold
          )
        : effectiveLowStockThreshold;

      return Number(item.quantity || 0) <= itemThreshold;
    }).length;

    return {
      totalItems: items.length,
      totalStock,
      lowStockItems,
      recentlyAddedItems: Math.min(items.length, 3),
    };
  }, [
    effectiveLowStockThreshold,
    items,
    planCapabilities.customLowStockThreshold,
  ]);

  const valueAnalytics = useMemo<InventoryValueAnalytics>(() => {
    const categoryValues = new Map<string, InventoryCategoryValue>();
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let itemsWithPriceData = 0;
    let hasCostPriceData = false;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const hasCostPrice =
        item.cost_price !== null &&
        item.cost_price !== undefined &&
        item.cost_price !== "";
      const hasSellingPrice =
        item.selling_price !== null &&
        item.selling_price !== undefined &&
        item.selling_price !== "";
      const costValue = calculateInventoryValue(quantity, item.cost_price);
      const retailValue = calculateInventoryValue(
        quantity,
        item.selling_price
      );
      const itemThreshold = planCapabilities.customLowStockThreshold
        ? getEffectiveItemLowStockThreshold(
            item.min_stock_level,
            effectiveLowStockThreshold
          )
        : effectiveLowStockThreshold;

      if (hasCostPrice || hasSellingPrice) {
        itemsWithPriceData += 1;
      }
      if (hasCostPrice) {
        hasCostPriceData = true;
      }
      if (costValue !== null) {
        totalCostValue += costValue;
      }
      if (retailValue !== null) {
        totalRetailValue += retailValue;
      }
      if (quantity <= itemThreshold) {
        lowStockItems += 1;
      }
      if (quantity <= 0) {
        outOfStockItems += 1;
      }

      if (hasCostPrice) {
        const category = resolveCategoryDisplay(
          item,
          categories.find(
            (managedCategory) =>
              managedCategory.id === item.category_id
          ) || null
        );
        const currentCategory = categoryValues.get(category) || {
          category,
          costValue: 0,
          retailValue: 0,
        };

        currentCategory.costValue += costValue || 0;
        currentCategory.retailValue += retailValue || 0;
        categoryValues.set(category, currentCategory);
      }
    });

    const sortedCategories = [...categoryValues.values()].sort(
      (left, right) => right.costValue - left.costValue
    );
    const chartCategories = sortedCategories.slice(0, 6);

    if (sortedCategories.length > 6) {
      chartCategories.push(
        sortedCategories.slice(6).reduce<InventoryCategoryValue>(
          (other, category) => ({
            category: "Other",
            costValue: other.costValue + category.costValue,
            retailValue: other.retailValue + category.retailValue,
          }),
          {
            category: "Other",
            costValue: 0,
            retailValue: 0,
          }
        )
      );
    }

    return {
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      totalRetailValue: Math.round(totalRetailValue * 100) / 100,
      estimatedMarginValue:
        Math.round((totalRetailValue - totalCostValue) * 100) / 100,
      itemsWithPriceData,
      lowStockItems,
      outOfStockItems,
      hasCostPriceData,
      categories: chartCategories,
    };
  }, [
    effectiveLowStockThreshold,
    categories,
    items,
    planCapabilities.customLowStockThreshold,
  ]);

  const recentItems = useMemo(
    () => items.slice(0, 3),
    [items]
  );

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const upgradePlan =
    subscriptionUsage.subscription.plan === "free"
      ? "Standard"
      : subscriptionUsage.subscription.plan === "standard"
        ? "Pro"
        : "";
  const itemUsageText = `${subscriptionUsage.usedItems} / ${subscriptionUsage.subscription.item_limit} items`;
  const usagePercent = Math.min(
    100,
    Math.round(
      (subscriptionUsage.usedItems /
        Math.max(subscriptionUsage.subscription.item_limit, 1)) *
        100
    )
  );

  const summaryCards = [
    {
      label: "Total Items",
      value: stats.totalItems,
      detail: "Products tracked",
      href: "/dashboard/inventory",
      icon: "box" as UiIconName,
      accent: "from-indigo-400 to-violet-500",
    },
    {
      label: "Total Stock",
      value: stats.totalStock,
      detail: "Units available",
      href: "/dashboard/inventory",
      icon: "layers" as UiIconName,
      accent: "from-cyan-300 to-indigo-500",
    },
    {
      label: "Low Stock Items",
      value: stats.lowStockItems,
      detail: `At or below ${effectiveLowStockThreshold} units`,
      href: "/dashboard/reports",
      icon: "alert" as UiIconName,
      accent: "from-rose-400 to-fuchsia-500",
    },
    {
      label: "Recently Added Items",
      value: stats.recentlyAddedItems,
      detail: "Latest records",
      href: "/dashboard/inventory",
      icon: "clock" as UiIconName,
      accent: "from-violet-400 to-sky-400",
    },
  ];

  return (
    <div className="contents">
      <main>
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
          <PageHeader
            eyebrow={`Welcome back to ${businessSettings.business_name}`}
            title="Dashboard"
            description="Monitor stock health, recently added products, and inventory movement signals from one workspace."
            meta={
              <span className="ui-badge ui-badge-info mb-2">
                Inventory overview
              </span>
            }
            actions={
              <>
                <Link
                  href="/dashboard/reports"
                  className={buttonClassName({ variant: "secondary" })}
                >
                  View Reports
                </Link>

                <Link
                  href="/dashboard/inventory"
                  className={buttonClassName({ variant: "primary" })}
                >
                  View Inventory
                </Link>

                <Link
                  href="/dashboard/add-item"
                  className={buttonClassName({ variant: "ghost" })}
                >
                  Add Item
                </Link>
              </>
            }
          />

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-theme-danger">
              {error}
            </div>
          )}

          <section className="glass-card p-5 sm:p-6">
            {loading ? (
              <div className="h-32 animate-pulse rounded-2xl bg-theme-surface" />
            ) : onboarding ? (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                    Getting started
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-theme-primary">
                    {onboarding.completedCount} of {onboarding.totalCount}{" "}
                    recommended steps complete
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-muted">
                    {onboarding.nextStep
                      ? `Next suggestion: ${onboarding.nextStep.title}. These setup steps are optional and can be completed in any order.`
                      : "Your recommended setup is complete. Visit the Help Center whenever you need a guide or support contact."}
                  </p>
                  {onboarding.hasPartialError && (
                    <p className="mt-2 text-xs font-semibold text-theme-warning">
                      Some setup statuses could not be checked right now.
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:min-w-[420px] lg:items-center">
                  <div className="flex-1 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] p-4">
                    <div className="flex items-center justify-between gap-4 text-sm font-bold">
                      <span className="text-theme-muted">Setup progress</span>
                      <span className="text-theme-accent">
                        {onboarding.percentage}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-theme-surface">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
                        style={{ width: `${onboarding.percentage}%` }}
                      />
                    </div>
                  </div>

                  <Link
                    href={
                      onboarding.nextStep?.href || "/dashboard/help"
                    }
                    className="glass-button min-h-12 px-5 py-3 text-sm font-bold"
                  >
                    {onboarding.nextStep
                      ? onboarding.nextStep.action
                      : "Open Help Center"}
                  </Link>
                  <Link
                    href="/dashboard/help"
                    className="min-h-12 rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-center text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    View Guide
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-theme-primary">
                    Need help getting started?
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    Setup progress is unavailable, but all guides and support
                    contacts remain accessible.
                  </p>
                </div>
                <Link
                  href="/dashboard/help"
                  className="glass-button px-5 py-3 text-sm font-bold"
                >
                  Open Help Center
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Subscription
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">
                  {loading ? (
                    <span className="inline-block h-9 w-64 max-w-full animate-pulse rounded-2xl bg-theme-surface" />
                  ) : (
                    `Current plan: ${currentPlanName}`
                  )}
                </h2>

                <p className="mt-3 text-base text-theme-muted">
                  {loading ? (
                    <span className="inline-block h-5 w-40 animate-pulse rounded-full bg-theme-surface" />
                  ) : (
                    `Usage: ${itemUsageText}`
                  )}
                </p>
              </div>

              <div className="min-w-0 rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-4 lg:min-w-[320px]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-theme-accent">
                    Item usage
                  </span>

                  <span className="text-sm font-black text-theme-primary">
                    {loading ? "..." : `${usagePercent}%`}
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--sydin-input-bg)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-violet-400 to-fuchsia-400 transition-all"
                    style={{
                      width: loading ? "0%" : `${usagePercent}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs font-semibold text-theme-subtle">
                  Add item limits are enforced from your current plan.
                </p>

                {upgradePlan && (
                  <Link
                    href={`/request-plan?plan=${upgradePlan}&source=dashboard-plan`}
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-indigo-200/25 bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-accent transition hover:border-indigo-200/40 hover:bg-theme-hover"
                  >
                    Request {upgradePlan}
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="ui-card ui-card-interactive group p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-theme-muted">
                      {card.label}
                    </p>

                    <p className="mt-3 text-3xl font-bold tracking-tight text-theme-primary">
                      {loading ? (
                        <span className="block h-12 w-24 animate-pulse rounded-2xl bg-theme-surface" />
                      ) : (
                        card.value.toLocaleString()
                      )}
                    </p>
                  </div>

                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${card.accent} text-white shadow-[var(--shadow-subtle)]`}>
                    <UiIcon name={card.icon} className="h-6 w-6" />
                  </div>
                </div>

                <p className="mt-5 text-sm text-theme-subtle">
                  {card.detail}
                </p>
              </Link>
            ))}
          </section>

          <InventoryValueOverview
            analytics={valueAnalytics}
            currencyCode={businessSettings.currency_code || "USD"}
            currentPlanName={currentPlanName}
            isLocked={!canViewValueAnalytics}
            loading={loading}
          />

          <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Latest activity
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">
                  Recent Items
                </h2>
              </div>

              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-center text-sm font-bold text-theme-primary transition hover:border-theme-strong hover:bg-theme-hover"
              >
                View Inventory
              </Link>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="min-h-[116px] overflow-hidden rounded-3xl border border-theme bg-theme-surface"
                    >
                      <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                    </div>
                  ))}
                </div>
              ) : recentItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-theme-inset px-5 py-14 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-theme-accent">
                    <UiIcon name="box" className="h-8 w-8" />
                  </div>

                  <h3 className="text-2xl font-bold">
                    No inventory yet
                  </h3>

                  <p className="mx-auto mt-3 max-w-md text-theme-muted">
                    Add your first product and your dashboard will start showing live inventory signals.
                  </p>

                  <Link
                    href="/dashboard/add-item"
                    className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-slate-200"
                  >
                    Add Item
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {recentItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-3xl border border-theme bg-theme-inset p-4 transition hover:border-indigo-300/25 hover:bg-theme-hover sm:flex-row sm:items-center"
                    >
                      <div className="flex h-[132px] shrink-0 items-center justify-center rounded-3xl bg-[#f4f0e8] p-4 sm:h-24 sm:w-24">
                        {item.image ? (
                          <div className="relative h-full w-full">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              loading="lazy"
                              sizes="96px"
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-slate-300/30 bg-white/35 text-center text-theme-subtle">
                            <span className="text-xs font-black uppercase tracking-[0.16em]">
                              Image
                            </span>

                            <span className="mt-1 text-xs font-semibold">
                              Not added
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-2xl font-bold tracking-tight text-theme-primary break-words">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-theme-muted break-words">
                          {resolveCategoryDisplay(
                            item,
                            categories.find(
                              (category) =>
                                category.id === item.category_id
                            ) || null
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <span className="rounded-2xl border border-theme bg-theme-surface px-4 py-3 text-lg font-bold text-theme-primary">
                          Qty {item.quantity}
                        </span>

                        {item.quantity <=
                          (planCapabilities.customLowStockThreshold
                            ? getEffectiveItemLowStockThreshold(
                                item.min_stock_level,
                                effectiveLowStockThreshold
                              )
                            : effectiveLowStockThreshold) && (
                          <span className="rounded-full border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
