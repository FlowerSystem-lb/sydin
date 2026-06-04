"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      ])
        .then(([{ data, error: inventoryError }, usage, settings]) => {
          if (!isActive) return;

          if (inventoryError) {
            setError(
              "We could not load your inventory summary. Refresh the page and try again."
            );
            setLoading(false);
            return;
          }

          setItems(data || []);
          setSubscriptionUsage(usage);
          setBusinessSettings(settings);
          setLoading(false);
        })
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

    const lowStockItems = items.filter(
      (item) =>
        Number(item.quantity || 0) <= businessSettings.low_stock_threshold
    ).length;

    return {
      totalItems: items.length,
      totalStock,
      lowStockItems,
      recentlyAddedItems: Math.min(items.length, 3),
    };
  }, [businessSettings.low_stock_threshold, items]);

  const recentItems = useMemo(
    () => items.slice(0, 3),
    [items]
  );

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
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
      marker: "TI",
      accent: "from-indigo-400 to-violet-500",
    },
    {
      label: "Total Stock",
      value: stats.totalStock,
      detail: "Units available",
      marker: "TS",
      accent: "from-cyan-300 to-indigo-500",
    },
    {
      label: "Low Stock Items",
      value: stats.lowStockItems,
      detail: `At or below ${businessSettings.low_stock_threshold} units`,
      marker: "LS",
      accent: "from-rose-400 to-fuchsia-500",
    },
    {
      label: "Recently Added Items",
      value: stats.recentlyAddedItems,
      detail: "Latest records",
      marker: "RA",
      accent: "from-violet-400 to-sky-400",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] text-white">
      <Sidebar
        addItemHref="/dashboard/add-item"
        planName={currentPlanName}
        itemUsage={itemUsageText}
        businessName={businessSettings.business_name}
        businessLogoUrl={businessSettings.business_logo_url}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.8)]" />
                  Live inventory overview
                </div>

                <p className="text-lg font-medium text-slate-400">
                  Welcome back to {businessSettings.business_name}
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Dashboard
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Monitor stock health, recently added products, and inventory movement signals from one polished workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl bg-white px-5 py-4 text-center text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                >
                  View Inventory
                </Link>

                <Link
                  href="/dashboard/add-item"
                  className="rounded-2xl border border-indigo-400/30 bg-indigo-500/15 px-5 py-4 text-center text-base font-bold text-white transition hover:border-indigo-300/60 hover:bg-indigo-500/25"
                >
                  Add Item
                </Link>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
              {error}
            </div>
          )}

          <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Subscription
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {loading ? (
                    <span className="inline-block h-9 w-64 max-w-full animate-pulse rounded-2xl bg-white/[0.08]" />
                  ) : (
                    `Current plan: ${currentPlanName}`
                  )}
                </h2>

                <p className="mt-3 text-base text-slate-400">
                  {loading ? (
                    <span className="inline-block h-5 w-40 animate-pulse rounded-full bg-white/[0.08]" />
                  ) : (
                    `Usage: ${itemUsageText}`
                  )}
                </p>
              </div>

              <div className="min-w-0 rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-4 lg:min-w-[320px]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-indigo-100">
                    Item usage
                  </span>

                  <span className="text-sm font-black text-white">
                    {loading ? "..." : `${usagePercent}%`}
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/35">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-violet-400 to-fuchsia-400 transition-all"
                    style={{
                      width: loading ? "0%" : `${usagePercent}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Add item limits are enforced from your current plan.
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="group rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-indigo-300/30 hover:bg-white/[0.075] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">
                      {card.label}
                    </p>

                    <p className="mt-4 text-5xl font-bold tracking-tight text-white">
                      {loading ? (
                        <span className="block h-12 w-24 animate-pulse rounded-2xl bg-white/[0.08]" />
                      ) : (
                        card.value.toLocaleString()
                      )}
                    </p>
                  </div>

                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-xs font-black text-white shadow-[0_18px_55px_rgba(99,102,241,0.28)]`}>
                    {card.marker}
                  </div>
                </div>

                <p className="mt-5 text-sm text-slate-500">
                  {card.detail}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Latest activity
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Recent Items
                </h2>
              </div>

              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-center text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
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
                      className="min-h-[116px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                    >
                      <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                    </div>
                  ))}
                </div>
              ) : recentItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-black/25 px-5 py-14 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-lg font-black text-indigo-200">
                    0
                  </div>

                  <h3 className="text-2xl font-bold">
                    No inventory yet
                  </h3>

                  <p className="mx-auto mt-3 max-w-md text-slate-400">
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
                      className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.055] sm:flex-row sm:items-center"
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
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-slate-300/30 bg-white/35 text-center text-slate-500">
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
                        <h3 className="text-2xl font-bold tracking-tight text-white break-words">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-slate-400 break-words">
                          {item.category}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <span className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-lg font-bold text-white">
                          Qty {item.quantity}
                        </span>

                        {item.quantity <= businessSettings.low_stock_threshold && (
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
