"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import UiIcon from "@/components/UiIcon";
import { Button, DialogShell, Select } from "@/components/ui";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { getOrCreateBusinessSettings } from "@/app/lib/businessSettings";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { recordStockMovement } from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface CountInventoryItem {
  id: number;
  name: string;
  category: string | null;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  min_stock_level?: number | null;
  depot_id?: number | null;
}

interface CountRow {
  itemId: number;
  expectedQuantity: number;
  countedQuantity: string;
  note: string;
}

interface FinalizeResult {
  adjusted: number;
  skipped: number;
  failed: Array<{ itemId: number; name: string; message: string }>;
}

const DRAFT_STORAGE_KEY = "sydin:stock-counts-draft";
const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

type WorkflowStep = "setup" | "count" | "review" | "finalized";
type CountScope = "all" | "category" | "depot" | "low-stock" | "selected";
type CountFilter = "all" | "uncounted" | "counted" | "differences" | "low-stock";

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function normalizeWholeQuantity(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : null;
}

function getDraftPayload({
  step,
  countName,
  countNotes,
  scope,
  categoryId,
  depotId,
  showExpected,
  rows,
}: {
  step: WorkflowStep;
  countName: string;
  countNotes: string;
  scope: CountScope;
  categoryId: string;
  depotId: string;
  showExpected: boolean;
  rows: CountRow[];
}) {
  return {
    step,
    countName,
    countNotes,
    scope,
    categoryId,
    depotId,
    showExpected,
    rows,
    savedAt: new Date().toISOString(),
  };
}

export default function StockCountsPage() {
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [items, setItems] = useState<CountInventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [fallbackLowStockThreshold, setFallbackLowStockThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<WorkflowStep>("setup");
  const [countName, setCountName] = useState("");
  const [countNotes, setCountNotes] = useState("");
  const [scope, setScope] = useState<CountScope>("all");
  const [categoryId, setCategoryId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [showExpected, setShowExpected] = useState(true);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [countSearch, setCountSearch] = useState("");
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const [setupError, setSetupError] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmClearDraft, setConfirmClearDraft] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(
    null
  );
  const [draftRestored, setDraftRestored] = useState(false);

  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requestedIds = new URLSearchParams(window.location.search)
        .get("items")
        ?.split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (requestedIds && requestedIds.length > 0) {
        setSelectedItemIds(requestedIds);
        setScope("selected");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const getCategoryLabel = (item: CountInventoryItem) =>
    resolveCategoryDisplay(item, categoryById.get(Number(item.category_id)));
  const getDepotLabel = (item: CountInventoryItem) =>
    formatDepotLabel(item.depot_id ? depotById.get(item.depot_id) : null);
  const getLowStockThreshold = useCallback(
    (item: CountInventoryItem) =>
      planCapabilities.customLowStockThreshold
        ? getEffectiveItemLowStockThreshold(
            item.min_stock_level,
            fallbackLowStockThreshold
          )
        : fallbackLowStockThreshold,
    [fallbackLowStockThreshold, planCapabilities.customLowStockThreshold]
  );
  const isLowStock = useCallback(
    (item: CountInventoryItem) =>
      Number(item.quantity || 0) <= getLowStockThreshold(item),
    [getLowStockThreshold]
  );

  const selectedIdSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds]
  );

  const scopedItems = useMemo(() => {
    if (scope === "category") {
      return items.filter((item) => String(item.category_id || "") === categoryId);
    }
    if (scope === "depot") {
      return items.filter((item) => String(item.depot_id || "") === depotId);
    }
    if (scope === "low-stock") {
      return items.filter((item) => isLowStock(item));
    }
    if (scope === "selected") {
      return items.filter((item) => selectedIdSet.has(item.id));
    }
    return items;
  }, [categoryId, depotId, isLowStock, items, scope, selectedIdSet]);

  const rowDetails = useMemo(
    () =>
      rows
        .map((row) => {
          const item = itemById.get(row.itemId);
          const counted = normalizeWholeQuantity(row.countedQuantity);
          const isCounted = counted !== null;
          const difference = isCounted ? counted - row.expectedQuantity : 0;
          return {
            row,
            item,
            counted,
            isCounted,
            difference,
          };
        })
        .filter((detail) => detail.item),
    [itemById, rows]
  );

  const normalizedCountSearch = countSearch.trim().toLowerCase();
  const visibleRowDetails = rowDetails.filter(({ row, item, isCounted, difference }) => {
    if (!item) return false;
    const matchesSearch =
      !normalizedCountSearch ||
      [
        item.name,
        item.item_code,
        item.sku,
        getCategoryLabel(item),
        getDepotLabel(item),
        row.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedCountSearch);
    const matchesFilter =
      countFilter === "all" ||
      (countFilter === "uncounted" && !isCounted) ||
      (countFilter === "counted" && isCounted) ||
      (countFilter === "differences" && isCounted && difference !== 0) ||
      (countFilter === "low-stock" && isLowStock(item));
    return matchesSearch && matchesFilter;
  });

  const countedDetails = rowDetails.filter((detail) => detail.isCounted);
  const differenceDetails = rowDetails.filter(
    (detail) => detail.isCounted && detail.difference !== 0
  );
  const positiveDetails = differenceDetails.filter(
    (detail) => detail.difference > 0
  );
  const negativeDetails = differenceDetails.filter(
    (detail) => detail.difference < 0
  );
  const matchedCount = countedDetails.filter(
    (detail) => detail.difference === 0
  ).length;
  const uncountedCount = rowDetails.length - countedDetails.length;
  const netDifference = differenceDetails.reduce(
    (total, detail) => total + detail.difference,
    0
  );
  const invalidCountedRows = rows.filter(
    (row) =>
      row.countedQuantity.trim() !== "" &&
      normalizeWholeQuantity(row.countedQuantity) === null
  );
  const hasDraft =
    step !== "setup" ||
    rows.length > 0 ||
    countName.trim() !== "" ||
    countNotes.trim() !== "";

  useEffect(() => {
    let active = true;

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again to use stock counts.");

      const [
        { data: inventoryRows, error: inventoryError },
        loadedCategories,
        loadedDepots,
        usage,
        settings,
      ] = await Promise.all([
        supabase
          .from("inventory")
          .select(
            "id, name, category, category_id, quantity, image, sku, item_code, unit_type, custom_unit_label, min_stock_level, depot_id"
          )
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        getCategoriesForUser(user.id).catch(() => []),
        getDepotsForUser(user.id).catch(() => []),
        getSubscriptionUsage(user.id),
        getOrCreateBusinessSettings(user.id),
      ]);

      if (inventoryError) throw inventoryError;

      if (!active) return;
      setItems((inventoryRows || []) as CountInventoryItem[]);
      setCategories(loadedCategories);
      setDepots(loadedDepots);
      setSubscriptionUsage(usage);
      setFallbackLowStockThreshold(
        getEffectiveLowStockThreshold(
          usage.subscription,
          settings.low_stock_threshold
        )
      );
      setLoading(false);
    }

    loadData().catch((error) => {
      if (!active) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load stock count data."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let frame = 0;
    try {
      const rawDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft) as Partial<
        ReturnType<typeof getDraftPayload>
      >;
      if (!parsed.rows || parsed.rows.length === 0) return;
      const parsedRows = parsed.rows;
      const validItemIds = new Set(items.map((item) => item.id));

      frame = window.requestAnimationFrame(() => {
        setStep(
          parsed.step === "count" || parsed.step === "review"
            ? parsed.step
            : "count"
        );
        setCountName(parsed.countName || "");
        setCountNotes(parsed.countNotes || "");
        setScope(
          parsed.scope === "category" ||
            parsed.scope === "depot" ||
            parsed.scope === "low-stock" ||
            parsed.scope === "selected" ||
            parsed.scope === "all"
            ? parsed.scope
            : "all"
        );
        setCategoryId(parsed.categoryId || "");
        setDepotId(parsed.depotId || "");
        setShowExpected(parsed.showExpected !== false);
        setRows(
          parsedRows
            .filter((row) => validItemIds.has(row.itemId))
            .map((row) => ({
              itemId: row.itemId,
              expectedQuantity: Number(row.expectedQuantity || 0),
              countedQuantity: String(row.countedQuantity || ""),
              note: row.note || "",
            }))
        );
        setDraftRestored(true);
        setNotice("Restored a stock count draft saved on this device.");
      });
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items, loading]);

  useEffect(() => {
    if (step === "finalized") return;
    if (!hasDraft) return;
    try {
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify(
          getDraftPayload({
            step,
            countName,
            countNotes,
            scope,
            categoryId,
            depotId,
            showExpected,
            rows,
          })
        )
      );
    } catch {
      // Session draft recovery is best effort only.
    }
  }, [
    categoryId,
    countName,
    countNotes,
    depotId,
    hasDraft,
    rows,
    scope,
    showExpected,
    step,
  ]);

  useEffect(() => {
    if (!hasDraft || step === "finalized") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraft, step]);

  const refreshItems = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again to refresh inventory.");
    const { data, error } = await supabase
      .from("inventory")
      .select(
        "id, name, category, category_id, quantity, image, sku, item_code, unit_type, custom_unit_label, min_stock_level, depot_id"
      )
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    if (error) throw error;
    setItems((data || []) as CountInventoryItem[]);
  };

  const startCount = () => {
    setSetupError("");
    const trimmedName = countName.trim();
    if (!trimmedName) {
      setSetupError("Name this stock count before starting.");
      return;
    }
    if (scope === "category" && !categoryId) {
      setSetupError("Choose a category for this count.");
      return;
    }
    if (scope === "depot" && !depotId) {
      setSetupError("Choose a depot/location for this count.");
      return;
    }
    if (scope === "selected" && selectedItemIds.length === 0) {
      setSetupError("Selected-item count requires item IDs from Inventory.");
      return;
    }
    if (scopedItems.length === 0) {
      setSetupError("No items match this count scope.");
      return;
    }

    setRows(
      scopedItems.map((item) => ({
        itemId: item.id,
        expectedQuantity: Number(item.quantity || 0),
        countedQuantity: "",
        note: "",
      }))
    );
    setCountSearch("");
    setCountFilter("all");
    setFinalizeResult(null);
    setConfirmFinalize(false);
    setStep("count");
    setNotice("");
  };

  const updateRow = (
    itemId: number,
    update: Partial<Pick<CountRow, "countedQuantity" | "note">>
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.itemId === itemId
          ? {
              ...row,
              ...update,
            }
          : row
      )
    );
  };

  const fillExpectedForUncounted = () => {
    setRows((current) =>
      current.map((row) =>
        row.countedQuantity.trim()
          ? row
          : { ...row, countedQuantity: String(row.expectedQuantity) }
      )
    );
  };

  const clearDraft = () => {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setStep("setup");
    setRows([]);
    setCountName("");
    setCountNotes("");
    setCategoryId("");
    setDepotId("");
    setScope(selectedItemIds.length > 0 ? "selected" : "all");
    setShowExpected(true);
    setCountSearch("");
    setCountFilter("all");
    setSetupError("");
    setFinalizeError("");
    setFinalizeResult(null);
    setConfirmFinalize(false);
    setConfirmClearDraft(false);
    setNotice("Stock count draft cleared.");
  };

  const goToReview = () => {
    setFinalizeError("");
    if (invalidCountedRows.length > 0) {
      setFinalizeError("Fix invalid counted quantities before review.");
      return;
    }
    setConfirmFinalize(false);
    setStep("review");
  };

  const finalizeCount = async () => {
    if (finalizing || !confirmFinalize) return;
    if (invalidCountedRows.length > 0) {
      setFinalizeError("Fix invalid counted quantities before finalizing.");
      return;
    }

    const adjustments = differenceDetails.filter(
      (detail) => detail.item && detail.counted !== null
    );

    try {
      setFinalizing(true);
      setFinalizeError("");
      const failed: FinalizeResult["failed"] = [];
      let adjusted = 0;

      for (const detail of adjustments) {
        const item = detail.item;
        if (!item || detail.counted === null) continue;

        try {
          await recordStockMovement({
            itemId: item.id,
            movementType: "adjustment",
            quantity: detail.counted,
            notes: [
              "Stock count adjustment",
              countName.trim(),
              detail.row.note.trim(),
            ]
              .filter(Boolean)
              .join(" - "),
          });
          adjusted += 1;
        } catch (error) {
          failed.push({
            itemId: item.id,
            name: item.name,
            message:
              error instanceof Error
                ? error.message
                : "Adjustment could not be recorded.",
          });
        }
      }

      await refreshItems();
      const result = {
        adjusted,
        skipped: rowDetails.length - adjustments.length,
        failed,
      };
      setFinalizeResult(result);
      setStep("finalized");
      if (failed.length === 0) {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      setNotice(
        failed.length
          ? `Finalized with ${failed.length} failed adjustment${
              failed.length === 1 ? "" : "s"
            }.`
          : "Stock count finalized."
      );
    } catch {
      setFinalizeError("Something went wrong while finalizing this count.");
    } finally {
      setFinalizing(false);
    }
  };

  const scopeLabel =
    scope === "category"
      ? `Category: ${
          categories.find((category) => String(category.id) === categoryId)
            ?.name || "choose category"
        }`
      : scope === "depot"
        ? `Depot/location: ${
            formatDepotLabel(
              depots.find((depot) => String(depot.id) === depotId) || null
            )
          }`
        : scope === "low-stock"
          ? "Low-stock items"
          : scope === "selected"
            ? `Selected items (${selectedItemIds.length})`
            : "All inventory";

  return (
    <main className="operations-workspace operations-stock-counts">
      <DashboardPageShell
        width="wide"
        className={
          step === "count" || step === "review" ? "pb-28 sm:pb-0" : ""
        }
      >
        <DashboardPageHeader
          eyebrow="Operations"
          title="Stock Counts"
          description="Count stock, review discrepancies, and finalize auditable adjustments through SydIN stock movements."
          actions={
            <div className="operations-step-strip grid grid-cols-4 overflow-hidden rounded-2xl border border-theme bg-theme-inset text-center text-xs font-black text-theme-secondary">
              {(["setup", "count", "review", "finalized"] as WorkflowStep[]).map(
                (itemStep, index) => (
                  <div
                    key={itemStep}
                    className={`min-w-20 border-r border-theme px-3 py-2 last:border-r-0 ${
                      step === itemStep
                        ? "bg-[#2563eb]/10 text-theme-accent"
                        : ""
                    }`}
                  >
                    <span className="block text-xs uppercase tracking-[0.12em]">
                      Step {index + 1}
                    </span>
                    <span className="capitalize">{itemStep}</span>
                  </div>
                )
              )}
            </div>
          }
        />

        {(notice || loadError) && (
          <DashboardNotice tone={loadError ? "danger" : "info"}>
            {loadError || notice}
          </DashboardNotice>
        )}

        {loading ? (
          <LoadingSkeletonGroup
            count={3}
            className="dashboard-card"
            itemClassName="min-h-20"
          />
        ) : loadError ? null : step === "setup" ? (
          <section className="dashboard-card grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#2563eb]/20 bg-[#2563eb]/10 px-4 py-3 text-sm text-theme-accent">
                Draft saved on this device. Review differences before
                finalizing stock adjustments.
              </div>
              {draftRestored && (
                <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                  A stock count draft saved on this device was restored. Review
                  it before continuing or clear it to restart.
                </p>
              )}
              {setupError && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                  {setupError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Count name
                  <input
                    type="text"
                    value={countName}
                    onChange={(event) => setCountName(event.target.value)}
                    placeholder="June shelf count"
                    className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Scope
                  <Select
                    value={scope}
                    onChange={(value) => setScope(value as CountScope)}
                    options={[
                      { value: "all", label: "All inventory" },
                      { value: "category", label: "Category" },
                      { value: "depot", label: "Depot/location" },
                      { value: "low-stock", label: "Low-stock items" },
                      ...(selectedItemIds.length > 0
                        ? [
                            {
                              value: "selected",
                              label: `Selected items (${selectedItemIds.length})`,
                            },
                          ]
                        : []),
                    ]}
                  />
                </label>
                {scope === "category" && (
                  <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                    Category
                    <Select
                      value={categoryId}
                      onChange={setCategoryId}
                      searchable={categories.length > 8}
                      options={categories.map((category) => ({
                        value: String(category.id),
                        label: category.name,
                      }))}
                    />
                  </label>
                )}
                {scope === "depot" && (
                  <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                    Depot/location
                    <Select
                      value={depotId}
                      onChange={setDepotId}
                      searchable={depots.length > 8}
                      options={depots.map((depot) => ({
                        value: String(depot.id),
                        label: formatDepotLabel(depot),
                      }))}
                    />
                  </label>
                )}
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary sm:col-span-2">
                  Notes
                  <textarea
                    value={countNotes}
                    onChange={(event) => setCountNotes(event.target.value)}
                    placeholder="Optional internal notes for this count"
                    className="min-h-24 resize-y rounded-xl border border-theme bg-theme-inset px-3 py-2 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-theme bg-theme-inset px-3 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={showExpected}
                  onChange={(event) => setShowExpected(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]/50"
                />
                Show expected system quantity while counting
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={startCount} disabled={items.length === 0}>
                  Start Count
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmClearDraft(true)}
                  disabled={!hasDraft}
                >
                  Clear draft
                </Button>
              </div>
            </div>
            <aside className="grid content-start gap-3 rounded-2xl border border-theme bg-theme-inset p-4">
              <p className="text-sm font-black text-theme-primary">
                Scope preview
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-theme bg-theme-surface p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Items
                  </p>
                  <p className="mt-1 text-2xl font-black text-theme-primary">
                    {scopedItems.length}
                  </p>
                </div>
                <div className="rounded-xl border border-theme bg-theme-surface p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Low stock
                  </p>
                  <p className="mt-1 text-2xl font-black text-theme-primary">
                    {scopedItems.filter((item) => isLowStock(item)).length}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-5 text-theme-muted">
                {scopeLabel}. Finalizing records stock adjustments through Stock
                Movements.
              </p>
              {items.length === 0 && (
                <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                  Choose a scope to begin counting inventory. Add inventory
                  items first if this workspace is empty.
                </p>
              )}
              {scope !== "all" && scopedItems.length === 0 && items.length > 0 && (
                <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                  Choose a different scope to begin counting inventory.
                </p>
              )}
            </aside>
          </section>
        ) : step === "count" ? (
          <>
            <DashboardToolbar>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-theme-primary">
                    {countName || "Stock count"}
                  </h2>
                  <p className="mt-1 text-sm text-theme-muted">
                    {scopeLabel}. {countedDetails.length} of {rows.length} items
                    counted.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto] lg:min-w-[42rem]">
                  <label className="relative">
                    <span className="sr-only">Search count items</span>
                    <UiIcon
                      name="search"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
                    />
                    <input
                      type="search"
                      value={countSearch}
                      onChange={(event) => setCountSearch(event.target.value)}
                      placeholder="Search count"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                  </label>
                  <Select
                    ariaLabel="Count filter"
                    value={countFilter}
                    onChange={(value) => setCountFilter(value as CountFilter)}
                    options={[
                      { value: "all", label: "All rows" },
                      { value: "uncounted", label: "Uncounted" },
                      { value: "counted", label: "Counted" },
                      { value: "differences", label: "Differences only" },
                      { value: "low-stock", label: "Low stock" },
                    ]}
                  />
                  <Button variant="secondary" onClick={fillExpectedForUncounted}>
                    Fill matched
                  </Button>
                </div>
              </div>
              <p className="sr-only" aria-live="polite">
                {countedDetails.length} counted, {uncountedCount} uncounted,
                {differenceDetails.length} differences.
              </p>
            </DashboardToolbar>

            {finalizeError && (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {finalizeError}
              </p>
            )}

            <section className="dashboard-table-card">
              <div className="hidden overflow-x-auto lg:block">
                <table className="dashboard-table min-w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[26%] px-4 py-3">Item</th>
                      <th className="w-[14%] px-4 py-3">Category</th>
                      <th className="w-[14%] px-4 py-3">Depot</th>
                      <th className="w-[10%] px-4 py-3">Unit</th>
                      {showExpected && (
                        <th className="w-[10%] px-4 py-3 text-right">
                          Expected
                        </th>
                      )}
                      <th className="w-[12%] px-4 py-3">Counted</th>
                      <th className="w-[10%] px-4 py-3">Difference</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {visibleRowDetails.map(({ row, item, counted, difference }) => {
                      if (!item) return null;
                      const inputId = `counted-${item.id}`;
                      return (
                        <tr key={item.id} className="align-middle">
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-theme-inset ring-1 ring-black/5">
                                {item.image ? (
                                  <Image
                                    src={item.image}
                                    alt=""
                                    fill
                                    sizes="44px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full items-center justify-center text-theme-subtle">
                                    <UiIcon name="box" className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-theme-primary">
                                  {item.name}
                                </p>
                                <p className="truncate text-xs text-theme-muted">
                                  {item.item_code || item.sku || "Inventory item"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getCategoryLabel(item)}
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getDepotLabel(item)}
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getInventoryUnitLabel(
                              item.unit_type,
                              item.custom_unit_label
                            )}
                          </td>
                          {showExpected && (
                            <td className="px-4 py-3 text-right font-black text-theme-primary">
                              {row.expectedQuantity}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <label htmlFor={inputId} className="sr-only">
                              Counted quantity for {item.name}
                            </label>
                            <input
                              id={inputId}
                              inputMode="numeric"
                              type="number"
                              min="0"
                              step="1"
                              value={row.countedQuantity}
                              onChange={(event) =>
                                updateRow(item.id, {
                                  countedQuantity: event.target.value,
                                })
                              }
                              className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {counted === null ? (
                              <span className="rounded-full border border-theme bg-theme-inset px-2 py-1 text-xs font-bold text-theme-subtle">
                                Uncounted
                              </span>
                            ) : (
                              <span
                                className={`rounded-full border px-2 py-1 text-xs font-black ${
                                  difference > 0
                                    ? "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
                                    : difference < 0
                                      ? "border-red-400/30 bg-red-500/10 text-theme-danger"
                                      : "border-theme bg-theme-inset text-theme-secondary"
                                }`}
                              >
                                {difference === 0
                                  ? "No difference"
                                  : formatSigned(difference)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(event) =>
                                updateRow(item.id, { note: event.target.value })
                              }
                              aria-label={`Count note for ${item.name}`}
                              placeholder="Optional"
                              className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 p-3 lg:hidden">
                {visibleRowDetails.map(({ row, item, counted, difference }) => {
                  if (!item) return null;
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-theme bg-theme-inset p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-theme-surface ring-1 ring-black/5">
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-theme-primary">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-theme-muted">
                            {[item.item_code || item.sku, getCategoryLabel(item), getDepotLabel(item)]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                            Unit
                          </p>
                          <p className="mt-1 font-black text-theme-primary">
                            {getInventoryUnitLabel(
                              item.unit_type,
                              item.custom_unit_label
                            )}
                          </p>
                        </div>
                        {showExpected && (
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Expected
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {getInventoryQuantityLabel(
                                row.expectedQuantity,
                                item.unit_type,
                                item.custom_unit_label
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2">
                        <label className="grid gap-1 text-sm font-bold text-theme-primary">
                          Counted quantity
                          <input
                            inputMode="numeric"
                            type="number"
                            min="0"
                            step="1"
                            value={row.countedQuantity}
                            onChange={(event) =>
                              updateRow(item.id, {
                                countedQuantity: event.target.value,
                              })
                            }
                            className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-bold text-theme-primary">
                          Row note
                          <input
                            type="text"
                            value={row.note}
                            onChange={(event) =>
                              updateRow(item.id, { note: event.target.value })
                            }
                            className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                        </label>
                        <p className="text-xs font-bold text-theme-secondary">
                          Difference:{" "}
                          {counted === null
                            ? "Uncounted"
                            : difference === 0
                              ? "No difference"
                              : formatSigned(difference)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              {visibleRowDetails.length === 0 && (
                <div className="px-5 py-14 text-center">
                  <UiIcon
                    name="search"
                    className="mx-auto h-8 w-8 text-theme-accent"
                  />
                  <h2 className="mt-4 text-xl font-bold text-theme-primary">
                    No count rows match
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    Choose a scope to begin counting inventory, or adjust the
                    search and count filter.
                  </p>
                </div>
              )}
            </section>

            <section className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-[#2563eb]/25 bg-theme-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:bottom-auto sm:top-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-theme-secondary sm:flex sm:text-left">
                  <span className="rounded-xl bg-[#2563eb]/10 px-3 py-2 text-theme-accent">
                    {countedDetails.length}/{rows.length} counted
                  </span>
                  <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    {differenceDetails.length} differences
                  </span>
                  <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    Net {formatSigned(netDifference)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => setStep("setup")}>
                    Setup
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmClearDraft(true)}>
                    Restart
                  </Button>
                  <Button onClick={goToReview}>Review Count</Button>
                </div>
              </div>
            </section>
          </>
        ) : step === "review" ? (
          <>
            <section className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Counted", countedDetails.length],
                ["Uncounted", uncountedCount],
                ["No difference", matchedCount],
                ["Count higher", positiveDetails.length],
                ["Count lower", negativeDetails.length],
                ["Net diff", formatSigned(netDifference)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-theme bg-theme-inset px-3 py-2"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-black text-theme-primary">
                    {value}
                  </p>
                </div>
              ))}
            </section>
            {finalizeError && (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {finalizeError}
              </p>
            )}
            <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <div className="border-b border-theme p-4">
                <h2 className="text-xl font-black text-theme-primary">
                  Differences
                </h2>
                <p className="mt-1 text-sm text-theme-muted">
                  Review differences before finalizing. Only rows where counted
                  quantity differs from current stock will create adjustments.
                </p>
              </div>
              {differenceDetails.length > 0 ? (
                <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-[760px] w-full table-fixed text-left text-sm">
                    <thead className="border-b border-theme bg-theme-inset text-xs font-black uppercase tracking-[0.12em] text-theme-subtle">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3 text-right">Expected</th>
                        <th className="px-4 py-3 text-right">Counted</th>
                        <th className="px-4 py-3 text-right">Difference</th>
                        <th className="px-4 py-3">Direction</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-divider)]">
                      {differenceDetails.map(({ row, item, counted, difference }) => {
                        if (!item || counted === null) return null;
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-black text-theme-primary">
                                {item.name}
                              </p>
                              <p className="text-xs text-theme-muted">
                                {item.item_code || item.sku || getCategoryLabel(item)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {row.expectedQuantity}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {counted}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-black ${
                                difference > 0
                                  ? "text-theme-success"
                                  : "text-theme-danger"
                              }`}
                            >
                              {formatSigned(difference)}
                            </td>
                            <td className="px-4 py-3 text-theme-secondary">
                              {difference > 0
                                ? "Count is higher than current stock"
                                : "Count is lower than current stock"}
                            </td>
                            <td className="px-4 py-3 text-theme-muted">
                              {row.note || "Stock count adjustment"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-2 p-3 md:hidden">
                  {differenceDetails.map(({ row, item, counted, difference }) => {
                    if (!item || counted === null) return null;
                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-theme bg-theme-inset p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-black text-theme-primary">
                              {item.name}
                            </h3>
                            <p className="mt-1 truncate text-xs text-theme-muted">
                              {item.item_code || item.sku || getCategoryLabel(item)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${
                              difference > 0
                                ? "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
                                : "border-red-400/30 bg-red-500/10 text-theme-danger"
                            }`}
                          >
                            {formatSigned(difference)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Current
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {row.expectedQuantity}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Counted
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {counted}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Change
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {difference > 0 ? "Higher" : "Lower"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-theme-muted">
                          {row.note || "Stock count adjustment"}
                        </p>
                      </article>
                    );
                  })}
                </div>
                </>
              ) : (
                <div className="px-5 py-12 text-center">
                  <UiIcon
                    name="check"
                    className="mx-auto h-8 w-8 text-theme-success"
                  />
                  <h2 className="mt-4 text-xl font-bold text-theme-primary">
                    No differences found
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    Finalizing will record no stock movements and close this
                    device draft.
                  </p>
                </div>
              )}
            </section>
            <section className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-[#2563eb]/25 bg-theme-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:bottom-auto sm:top-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-start gap-2 text-xs font-bold text-theme-primary">
                  <input
                    type="checkbox"
                    checked={confirmFinalize}
                    onChange={(event) => setConfirmFinalize(event.target.checked)}
                    disabled={finalizing}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]/50"
                  />
                  Finalizing will record reviewed differences as stock movement
                  adjustments.
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => setStep("count")}
                    disabled={finalizing}
                  >
                    Back to Count
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmClearDraft(true)}
                    disabled={finalizing}
                  >
                    Cancel count
                  </Button>
                  <Button
                    onClick={() => void finalizeCount()}
                    disabled={!confirmFinalize || finalizing}
                    loading={finalizing}
                    loadingLabel="Finalizing..."
                  >
                    Finalize Count
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="grid gap-4 rounded-[22px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                Finalized
              </p>
              <h2 className="mt-1 text-2xl font-black text-theme-primary">
                Stock count complete
              </h2>
              <p className="mt-1 text-sm text-theme-muted">
                Inventory quantities were refreshed after finalization. Each
                discrepancy was processed through the existing stock movement
                adjustment workflow.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Adjusted
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.adjusted || 0}
                </p>
              </div>
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Skipped matched
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.skipped || 0}
                </p>
              </div>
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Failed
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.failed.length || 0}
                </p>
              </div>
            </div>
            {finalizeResult && finalizeResult.failed.length > 0 && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
                <p className="font-black text-theme-danger">
                  Failed adjustments
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-theme-danger">
                  {finalizeResult.failed.map((failure) => (
                    <li key={failure.itemId}>
                      {failure.name}: {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={clearDraft}>Start New Count</Button>
              <Button variant="secondary" onClick={() => setStep("count")}>
                View Count Rows
              </Button>
            </div>
          </section>
        )}
      </DashboardPageShell>

      {confirmClearDraft && (
        <DialogShell
          title="Clear stock count draft?"
          eyebrow="Device draft"
          description="This clears the stock count draft saved on this device. Finalized stock movements are not affected."
          tone="danger"
          onClose={() => setConfirmClearDraft(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmClearDraft(false)}
              >
                Keep draft
              </Button>
              <Button variant="danger" onClick={clearDraft}>
                Clear draft
              </Button>
            </>
          }
        />
      )}
    </main>
  );
}
