"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
  MetricCard,
} from "@/components/dashboard/Workspace";
import ItemDetailsSlideOver, {
  type SlideOverInventoryItem,
} from "@/components/inventory/ItemDetailsSlideOver";
import SetAlertLevelDialog from "@/components/inventory/SetAlertLevelDialog";
import StockMovementDialog from "@/components/inventory/StockMovementDialog";
import type { StockMovement } from "@/app/lib/stockMovements";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { formatDepotLabel, getDepotsForUser, type Depot } from "@/app/lib/depots";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
} from "@/app/lib/inventoryItemModel";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getEffectivePlan,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  getUpgradePlanForCurrentPlan,
  type UserSubscription,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface AlertInventoryItem {
  id: number;
  name: string;
  quantity: number;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  min_stock_level?: number | null;
  depot_id?: number | null;
  unit_type?: string | null;
  custom_unit_label?: string | null;
}

type AlertState = "out" | "low";
type AlertFilter = "all" | AlertState;

export default function StockAlertsPage() {
  const [items, setItems] = useState<AlertInventoryItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [subscription, setSubscription] = useState<UserSubscription>(
    FALLBACK_SUBSCRIPTION
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [alertLevelItemId, setAlertLevelItemId] = useState<number | null>(null);
  const [movementItemId, setMovementItemId] = useState<number | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again to view stock alerts.");
      }

      const [{ data: itemRows, error: itemError }, usage, settings, loadedDepots] =
        await Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, quantity, image, sku, item_code, min_stock_level, depot_id, unit_type, custom_unit_label"
            )
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          getSubscriptionUsage(user.id),
          getOrCreateBusinessSettings(user.id),
          getDepotsForUser(user.id).catch(() => []),
        ]);

      if (itemError) throw itemError;

      return {
        items: (itemRows || []) as AlertInventoryItem[],
        subscription: usage.subscription,
        settings,
        depots: loadedDepots,
      };
    };

    loadData()
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setSubscription(result.subscription);
        setBusinessSettings(result.settings);
        setDepots(result.depots);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load stock alerts."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const planCapabilities = getSubscriptionCapabilities(subscription);
  const canUseItemThreshold = planCapabilities.customLowStockThreshold;
  const defaultThreshold = getEffectiveLowStockThreshold(
    subscription,
    businessSettings.low_stock_threshold
  );
  const currentPlanLabel = formatPlanName(getEffectivePlan(subscription));
  const upgradePlan = getUpgradePlanForCurrentPlan(
    getEffectivePlan(subscription)
  );

  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );

  const alertEntries = useMemo(() => {
    return items
      .map((item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const threshold = canUseItemThreshold
          ? getEffectiveItemLowStockThreshold(
              item.min_stock_level,
              defaultThreshold
            )
          : defaultThreshold;
        const state: AlertState | "in" =
          quantity <= 0 ? "out" : quantity <= threshold ? "low" : "in";

        return { item, quantity, threshold, state };
      })
      .filter(
        (entry): entry is typeof entry & { state: AlertState } =>
          entry.state !== "in"
      )
      .sort((left, right) => {
        if (left.state !== right.state) return left.state === "out" ? -1 : 1;
        return left.quantity - right.quantity;
      });
  }, [canUseItemThreshold, defaultThreshold, items]);

  const outCount = alertEntries.filter((entry) => entry.state === "out").length;
  const lowCount = alertEntries.length - outCount;
  const visibleEntries =
    filter === "all"
      ? alertEntries
      : alertEntries.filter((entry) => entry.state === filter);

  const alertLevelItem = alertLevelItemId
    ? items.find((item) => item.id === alertLevelItemId) || null
    : null;

  const handleAlertLevelSaved = (itemId: number, minStockLevel: number | null) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, min_stock_level: minStockLevel } : item
      )
    );
    setNotice("Alert level updated.");
  };

  const handleMovementRecorded = (movement: StockMovement, itemId: number) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, quantity: movement.quantity_after }
          : item
      )
    );
    setNotice("Stock movement recorded.");
  };

  const handleSlideOverItemUpdated = (
    updatedItem: SlideOverInventoryItem,
    movement?: StockMovement
  ) => {
    void movement;
    setItems((current) =>
      current.map((item) =>
        item.id === updatedItem.id
          ? {
              ...item,
              name: updatedItem.name,
              quantity: updatedItem.quantity,
              image: updatedItem.image,
              sku: updatedItem.sku || null,
              item_code: updatedItem.item_code || null,
              min_stock_level: updatedItem.min_stock_level ?? null,
              depot_id: updatedItem.depot_id ?? null,
            }
          : item
      )
    );
  };

  return (
    <main className="insights-workspace insights-alerts">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Insights"
          title="Stock Alerts"
          description="Everything at or below its low-stock alert level, in one place."
          actions={
            <>
              <ActionButton
                variant="secondary"
                icon="box"
                href="/dashboard/inventory?quick=low-stock"
              >
                View in inventory
              </ActionButton>
              <ActionButton icon="file" href="/dashboard/purchase-orders/new">
                Create purchase order
              </ActionButton>
            </>
          }
        />

        {(notice || error) && (
          <DashboardNotice tone={error ? "danger" : "success"}>
            {error || notice}
          </DashboardNotice>
        )}

        <section className="grid gap-2.5 sm:grid-cols-3">
          <MetricCard
            label="Out of stock"
            value={loading ? "—" : String(outCount)}
            detail="Nothing left on the shelf"
            icon="alert"
          />
          <MetricCard
            label="Low stock"
            value={loading ? "—" : String(lowCount)}
            detail="At or below alert level"
            icon="box"
          />
          <MetricCard
            label="Default alert level"
            value={String(defaultThreshold)}
            detail={
              canUseItemThreshold
                ? "Per-item levels available"
                : "Fixed on your current plan"
            }
            icon="settings"
            href="/dashboard/settings"
          />
        </section>

        <DashboardToolbar>
          <FilterBar label="Filter alerts">
            <FilterChip
              active={filter === "all"}
              count={alertEntries.length}
              onClick={() => setFilter("all")}
            >
              All alerts
            </FilterChip>
            <FilterChip
              active={filter === "out"}
              count={outCount}
              onClick={() => setFilter("out")}
            >
              Out of stock
            </FilterChip>
            <FilterChip
              active={filter === "low"}
              count={lowCount}
              onClick={() => setFilter("low")}
            >
              Low stock
            </FilterChip>
          </FilterBar>
        </DashboardToolbar>

        <section className="dashboard-card overflow-hidden p-0">
          {loading ? (
            <LoadingSkeletonGroup
              count={4}
              className="p-4"
              itemClassName="min-h-20"
            />
          ) : visibleEntries.length > 0 ? (
            <div className="divide-y divide-[var(--border-default)]">
              {visibleEntries.map(({ item, quantity, threshold, state }) => {
                const depot = item.depot_id
                  ? depotById.get(item.depot_id)
                  : null;
                const codeLabel = item.sku || item.item_code;

                return (
                  <article
                    key={item.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(150px,0.7fr)_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-theme-inset ring-1 ring-black/5">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-theme-subtle">
                            <UiIcon name="box" className="h-5 w-5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setDetailsItemId(item.id)}
                          className="block max-w-full truncate text-left font-bold text-theme-primary hover:text-theme-accent"
                        >
                          {item.name}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-theme-subtle">
                          {codeLabel ? `${codeLabel} · ` : ""}
                          {formatDepotLabel(depot)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p
                        className={`text-sm font-black ${
                          state === "out"
                            ? "text-theme-danger"
                            : "text-amber-600"
                        }`}
                      >
                        {state === "out"
                          ? "Out of stock"
                          : getInventoryQuantityLabel(
                              quantity,
                              item.unit_type,
                              item.custom_unit_label
                            ) + " left"}
                      </p>
                      <p className="mt-0.5 text-xs text-theme-subtle">
                        Alert at {threshold}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        variant="secondary"
                        icon="movement"
                        onClick={() => setMovementItemId(item.id)}
                      >
                        Restock
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        icon="alert"
                        onClick={() => setAlertLevelItemId(item.id)}
                      >
                        Set alert level
                      </ActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <DashboardEmptyState
              className="m-4"
              icon="check"
              title={
                filter === "all"
                  ? "All stock levels are healthy"
                  : "No alerts in this group"
              }
              description={
                filter === "all"
                  ? "Nothing is at or below its low-stock alert level right now."
                  : "Switch filters to see the rest of your alerts."
              }
              action={
                <ActionButton
                  variant="secondary"
                  icon="box"
                  href="/dashboard/inventory"
                >
                  View inventory
                </ActionButton>
              }
            />
          )}
        </section>
      </DashboardPageShell>

      {detailsItemId && (
        <ItemDetailsSlideOver
          itemId={detailsItemId}
          initialTab="alerts"
          returnTo="/dashboard/alerts"
          onClose={() => setDetailsItemId(null)}
          onItemUpdated={handleSlideOverItemUpdated}
        />
      )}

      <SetAlertLevelDialog
        open={alertLevelItemId !== null}
        item={alertLevelItem}
        defaultThreshold={defaultThreshold}
        canUseItemThreshold={canUseItemThreshold}
        currentPlanLabel={currentPlanLabel}
        upgradePlan={upgradePlan}
        onClose={() => setAlertLevelItemId(null)}
        onSaved={handleAlertLevelSaved}
      />

      <StockMovementDialog
        open={movementItemId !== null}
        items={items}
        initialItemId={movementItemId}
        onClose={() => setMovementItemId(null)}
        onRecorded={handleMovementRecorded}
      />
    </main>
  );
}
