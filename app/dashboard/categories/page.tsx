"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InventoryItemCard from "@/components/inventory/InventoryItemCard";
import UiIcon from "@/components/UiIcon";
import { DialogShell } from "@/components/ui";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  createCategory,
  deleteCategory,
  filterCategories,
  getCategoriesForUser,
  getCategoryErrorMessage,
  updateCategory,
  type Category,
  type CategoryInput,
} from "@/app/lib/categories";
import {
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionCategoryLimit,
  getSubscriptionUsage,
  getUpgradePlanForCategoryLimit,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface CategoryInventoryItem {
  id: number;
  name: string;
  category: string | null;
  category_id: number | null;
  quantity: number;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  min_stock_level?: number | null;
  depot_id?: number | null;
  created_at?: string | null;
  recent_activity_at?: string | null;
}

type WorkspaceSelection =
  | { type: "all" }
  | { type: "uncategorized" }
  | { type: "low" }
  | { type: "recent" }
  | { type: "category"; id: number };
type ItemView = "list" | "cards-2" | "cards-3" | "table";
type StockFilter = "all" | "low" | "healthy";
type SortOption = "updated" | "name" | "quantity-asc" | "quantity-desc";

const EMPTY_FORM: CategoryInput = { name: "", description: "" };
const VIEW_STORAGE_KEY = "sydin:category-item-view";
const SIDEBAR_ROUTE_EVENT = "sydin:sidebar-route-collapse";
const RECENT_CUTOFF = Date.now() - 30 * 24 * 60 * 60 * 1000;
const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};
const inputClassName =
  "w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3.5 py-3 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] disabled:opacity-60";

const markerTones = [
  "from-cyan-400 to-blue-600",
  "from-indigo-400 to-violet-600",
  "from-violet-400 to-fuchsia-600",
  "from-sky-400 to-indigo-600",
  "from-teal-400 to-cyan-600",
];

function getCategoryMarker(categoryId: number) {
  return markerTones[Math.abs(categoryId) % markerTones.length];
}

function parseDate(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatUpdatedDate(value?: string | null) {
  const time = parseDate(value);
  if (!time) return "No update date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(time));
}

function CategoryForm({
  editing,
  values,
  error,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  editing: boolean;
  values: CategoryInput;
  error: string;
  saving: boolean;
  onChange: (field: keyof CategoryInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-4">
        <label>
          <span className="mb-2 block text-sm font-bold text-theme-secondary">
            Category name <span className="text-theme-danger">*</span>
          </span>
          <input
            autoFocus
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            disabled={saving}
            required
            placeholder="e.g. Flower Arrangements"
            className={inputClassName}
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-theme-secondary">
            Description
          </span>
          <textarea
            value={values.description || ""}
            onChange={(event) => onChange("description", event.target.value)}
            disabled={saving}
            placeholder="Optional internal description"
            className={`${inputClassName} min-h-28 resize-y`}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-theme bg-theme-surface px-5 py-3 text-sm font-bold text-theme-primary hover:bg-theme-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !values.name.trim()}
          className="rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(79,70,229,0.2)] disabled:opacity-50"
        >
          {saving ? "Saving..." : editing ? "Save Changes" : "Add Category"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<CategoryInventoryItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [lowStockThreshold, setLowStockThreshold] = useState(0);
  const [userId, setUserId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [depotFilter, setDepotFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [selection, setSelection] = useState<WorkspaceSelection>({
    type: "all",
  });
  const [itemView, setItemView] = useState<ItemView>("cards-2");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formValues, setFormValues] = useState<CategoryInput>(EMPTY_FORM);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const loadWorkspace = async (knownUserId: string) => {
    const [
      loadedCategories,
      loadedUsage,
      loadedSettings,
      loadedDepots,
      { data: loadedItems, error: itemError },
      { data: loadedHistory },
    ] = await Promise.all([
      getCategoriesForUser(knownUserId),
      getSubscriptionUsage(knownUserId),
      getOrCreateBusinessSettings(knownUserId),
      getDepotsForUser(knownUserId).catch(() => []),
      supabase
        .from("inventory")
        .select(
          "id, name, category, category_id, quantity, image, sku, item_code, unit_type, custom_unit_label, min_stock_level, depot_id, created_at"
        )
        .eq("user_id", knownUserId)
        .order("id", { ascending: false }),
      supabase
        .from("inventory_history")
        .select("item_id, created_at")
        .eq("user_id", knownUserId)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (itemError) throw itemError;

    setCategories(loadedCategories);
    setUsage(loadedUsage);
    setDepots(loadedDepots);
    const recentActivity = new Map<number, string>();
    for (const entry of loadedHistory || []) {
      const itemId = Number(entry.item_id);
      if (!recentActivity.has(itemId) && entry.created_at) {
        recentActivity.set(itemId, String(entry.created_at));
      }
    }
    setItems(
      ((loadedItems || []) as CategoryInventoryItem[]).map((item) => ({
        ...item,
        recent_activity_at:
          recentActivity.get(item.id) || item.created_at || null,
      }))
    );
    setLowStockThreshold(
      getEffectiveLowStockThreshold(
        loadedUsage.subscription,
        loadedSettings.low_stock_threshold
      )
    );
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_ROUTE_EVENT, {
          detail: { collapsed: true },
        })
      );
      try {
        const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
        if (
          storedView === "list" ||
          storedView === "cards-2" ||
          storedView === "cards-3" ||
          storedView === "table"
        ) {
          setItemView(storedView);
        }
      } catch {
        // The default view remains available without local storage.
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_ROUTE_EVENT, {
          detail: { collapsed: null },
        })
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) throw new Error("Please sign in again to manage categories.");
        if (!active) return;
        setUserId(user.id);
        await loadWorkspace(user.id);
        if (active) setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setPageError(
          error instanceof Error
            ? error.message
            : "We could not load categories."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const capabilities = getSubscriptionCapabilities(usage.subscription);
  const categoryLimit = getSubscriptionCategoryLimit(usage.subscription);
  const limitReached = categories.length >= categoryLimit;
  const currentPlanName = formatPlanName(usage.subscription.plan);
  const requiredPlan = getUpgradePlanForCategoryLimit(usage.subscription.plan);
  const visibleCategories = useMemo(
    () => filterCategories(categories, categorySearch),
    [categories, categorySearch]
  );
  const selectedCategory =
    selection.type === "category"
      ? categories.find((category) => category.id === selection.id) || null
      : null;

  const isItemLowStock = (item: CategoryInventoryItem) => {
    const threshold = capabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          lowStockThreshold
        )
      : lowStockThreshold;
    return Number(item.quantity || 0) <= threshold;
  };
  const isRecent = (item: CategoryInventoryItem) =>
    parseDate(item.recent_activity_at || item.created_at) >= RECENT_CUTOFF;
  const uncategorizedCount = items.filter(
    (item) => !item.category_id && !item.category?.trim()
  ).length;
  const lowStockCount = items.filter(isItemLowStock).length;
  const recentCount = items.filter(isRecent).length;

  const selectionItems = items.filter((item) => {
    if (selection.type === "all") return true;
    if (selection.type === "uncategorized") {
      return !item.category_id && !item.category?.trim();
    }
    if (selection.type === "low") return isItemLowStock(item);
    if (selection.type === "recent") return isRecent(item);
    return item.category_id === selection.id;
  });
  const normalizedItemSearch = itemSearch.trim().toLowerCase();
  const filteredItems = selectionItems
    .filter((item) => {
      const matchesSearch =
        !normalizedItemSearch ||
        [item.name, item.sku, item.item_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedItemSearch);
      const lowStock = isItemLowStock(item);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && lowStock) ||
        (stockFilter === "healthy" && !lowStock);
      const matchesDepot =
        depotFilter === "all" ||
        (depotFilter === "unassigned" && !item.depot_id) ||
        String(item.depot_id) === depotFilter;
      return matchesSearch && matchesStock && matchesDepot;
    })
    .sort((first, second) => {
      if (sortBy === "name") return first.name.localeCompare(second.name);
      if (sortBy === "quantity-asc") {
        return Number(first.quantity) - Number(second.quantity);
      }
      if (sortBy === "quantity-desc") {
        return Number(second.quantity) - Number(first.quantity);
      }
      return (
        parseDate(second.recent_activity_at || second.created_at) -
        parseDate(first.recent_activity_at || first.created_at)
      );
    });

  const selectionTitle =
    selection.type === "all"
      ? "All Items"
      : selection.type === "uncategorized"
        ? "Uncategorized"
        : selection.type === "low"
          ? "Low Stock"
          : selection.type === "recent"
            ? "Recently Updated"
            : selectedCategory?.name || "Category";
  const selectedTotalQuantity = selectionItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const selectedLowStockCount = selectionItems.filter(isItemLowStock).length;
  const latestItem = [...selectionItems].sort(
    (first, second) =>
      parseDate(second.recent_activity_at || second.created_at) -
      parseDate(first.recent_activity_at || first.created_at)
  )[0];
  const addItemHref = selectedCategory
    ? `/dashboard/add-item?category=${selectedCategory.id}`
    : "/dashboard/add-item";

  const setWorkspaceSelection = (next: WorkspaceSelection) => {
    setSelection(next);
    setMobileDetailOpen(true);
    setItemSearch("");
    setStockFilter("all");
    setDepotFilter("all");
  };

  const updateItemView = (view: ItemView) => {
    setItemView(view);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // The selected view still applies for this session.
    }
  };

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (category: Category) => {
    setEditingCategory(category);
    setFormValues({
      name: category.name,
      description: category.description || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = (force = false) => {
    if (saving && !force) return;
    setFormOpen(false);
    setEditingCategory(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || saving || !formValues.name.trim()) return;

    const duplicate = categories.some(
      (category) =>
        category.id !== editingCategory?.id &&
        category.name.trim().toLowerCase() ===
          formValues.name.trim().toLowerCase()
    );
    if (duplicate) {
      setFormError("A category with this name already exists.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setPageError("");
      setPageNotice("");

      if (!editingCategory) {
        const [freshCategories, freshUsage] = await Promise.all([
          getCategoriesForUser(userId),
          getSubscriptionUsage(userId),
        ]);
        const freshLimit = getSubscriptionCategoryLimit(
          freshUsage.subscription
        );
        if (freshCategories.length >= freshLimit) {
          setFormError(
            `You reached the ${formatPlanName(
              freshUsage.subscription.plan
            )} plan limit of ${freshLimit} categories.`
          );
          return;
        }
        const created = await createCategory(userId, formValues);
        setSelection({ type: "category", id: created.id });
        setMobileDetailOpen(true);
        setPageNotice("Category added successfully.");
      } else {
        await updateCategory(userId, editingCategory.id, formValues);
        setPageNotice("Category updated across linked inventory.");
      }

      closeForm(true);
      await loadWorkspace(userId);
    } catch (error) {
      setFormError(getCategoryErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || deletingId || !userId) return;

    try {
      setDeletingId(pendingDelete.id);
      setPageError("");
      await deleteCategory(userId, pendingDelete.id);
      if (
        selection.type === "category" &&
        selection.id === pendingDelete.id
      ) {
        setSelection({ type: "uncategorized" });
      }
      setPendingDelete(null);
      setPageNotice(
        "Category deleted. Linked items are now uncategorized; no items were deleted."
      );
      await loadWorkspace(userId);
    } catch {
      setPageError("We could not delete this category. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const getDepot = (item: CategoryInventoryItem) =>
    depots.find((depot) => depot.id === item.depot_id) || null;
  const getCategoryLabel = (item: CategoryInventoryItem) =>
    categories.find((category) => category.id === item.category_id)?.name ||
    item.category?.trim() ||
    "Uncategorized";
  const openItemAction = (
    item: CategoryInventoryItem,
    action?: "edit" | "stock" | "delete"
  ) => {
    router.push(
      `/dashboard/inventory/${item.id}${action ? `?action=${action}` : ""}`
    );
  };

  const smartFilters: {
    type: WorkspaceSelection["type"];
    label: string;
    count: number;
    icon: "box" | "categories" | "alert" | "clock";
  }[] = [
    { type: "all", label: "All Items", count: items.length, icon: "box" },
    {
      type: "uncategorized",
      label: "Uncategorized",
      count: uncategorizedCount,
      icon: "categories",
    },
    { type: "low", label: "Low Stock", count: lowStockCount, icon: "alert" },
    {
      type: "recent",
      label: "Recently Updated",
      count: recentCount,
      icon: "clock",
    },
  ];

  const renderCompactRow = (item: CategoryInventoryItem) => (
    <article
      key={item.id}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-theme bg-theme-surface p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center"
    >
      <Link
        href={`/dashboard/inventory/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-theme bg-theme-inset text-theme-accent">
          <UiIcon name="box" className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-theme-primary">
            {item.name}
          </span>
          <span className="mt-1 block truncate text-xs text-theme-muted">
            {item.item_code || item.sku || "No identifier"} ·{" "}
            {getInventoryQuantityLabel(
              item.quantity,
              item.unit_type,
              item.custom_unit_label
            )}
          </span>
        </span>
      </Link>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openItemAction(item, "stock")}
          className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-theme-secondary hover:bg-theme-hover"
        >
          Adjust
        </button>
        <button
          type="button"
          onClick={() => openItemAction(item, "edit")}
          className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-theme-secondary hover:bg-theme-hover"
        >
          Edit
        </button>
        <Link
          href={`/dashboard/inventory/${item.id}#history`}
          className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-theme-secondary hover:bg-theme-hover"
        >
          History
        </Link>
      </div>
    </article>
  );

  return (
    <main className="min-w-0">
      <div className="mx-auto w-full max-w-[1600px]">
        {(pageError || pageNotice) && (
          <p
            role={pageError ? "alert" : "status"}
            className={`mb-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
              pageError
                ? "border-red-400/25 bg-red-500/10 text-theme-danger"
                : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
            }`}
          >
            {pageError || pageNotice}
          </p>
        )}

        {!loading && limitReached && (
          <div className="mb-3">
            <LockedFeaturePanel
              feature={`${currentPlanName} category limit reached`}
              benefit={`${currentPlanName} includes up to ${categoryLimit} categories. Existing categories remain viewable, selectable, editable, and deletable.`}
              currentPlan={currentPlanName}
              requiredPlan={requiredPlan}
              source="category-limit"
              compact
            />
          </div>
        )}

        <div className="overflow-hidden rounded-[24px] border border-theme bg-theme-surface shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:grid lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside
            className={`border-theme bg-theme-inset lg:border-r ${
              mobileDetailOpen ? "hidden lg:flex" : "flex"
            } min-h-[calc(100vh-8rem)] flex-col`}
          >
            <div className="border-b border-theme p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-theme-accent">
                    Organize
                  </p>
                  <h1 className="text-xl font-black text-theme-primary">
                    Categories
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={openCreateForm}
                  disabled={loading || limitReached}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-white shadow-sm disabled:opacity-50"
                  aria-label="Add category"
                >
                  <UiIcon name="plus" className="h-5 w-5" />
                </button>
              </div>

              <label className="relative mt-4 block">
                <span className="sr-only">Search categories</span>
                <UiIcon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
                />
                <input
                  type="search"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search categories"
                  className={`${inputClassName} py-2.5 pl-9`}
                />
              </label>
            </div>

            <div className="border-b border-theme p-3">
              <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-theme-subtle">
                Smart filters
              </p>
              <div className="grid gap-1">
                {smartFilters.map((filter) => {
                  const selected = selection.type === filter.type;
                  return (
                    <button
                      key={filter.type}
                      type="button"
                      onClick={() =>
                        setWorkspaceSelection({ type: filter.type } as WorkspaceSelection)
                      }
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/15 ${
                        selected
                          ? "bg-indigo-500/12 text-theme-primary ring-1 ring-indigo-300/30"
                          : "text-theme-secondary hover:bg-theme-hover"
                      }`}
                    >
                      <UiIcon
                        name={filter.icon}
                        className={`h-4 w-4 ${
                          selected ? "text-theme-accent" : "text-theme-subtle"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {filter.label}
                      </span>
                      <span className="text-xs font-black text-theme-subtle">
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-theme-subtle">
                  Workspace categories
                </p>
                <span className="text-[10px] font-bold text-theme-subtle">
                  {categories.length}/{categoryLimit}
                </span>
              </div>

              {loading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4].map((key) => (
                    <div
                      key={key}
                      className="h-14 animate-pulse rounded-xl bg-theme-surface"
                    />
                  ))}
                </div>
              ) : visibleCategories.length > 0 ? (
                <div className="grid gap-1">
                  {visibleCategories.map((category) => {
                    const selected =
                      selection.type === "category" &&
                      selection.id === category.id;
                    return (
                      <div
                        key={category.id}
                        className={`group flex items-center gap-1 rounded-xl pr-1 transition ${
                          selected
                            ? "bg-indigo-500/12 ring-1 ring-indigo-300/30"
                            : "hover:bg-theme-hover"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setWorkspaceSelection({
                              type: "category",
                              id: category.id,
                            })
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/15"
                        >
                          <span
                            className={`h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br ${getCategoryMarker(
                              category.id
                            )} p-[1px] shadow-sm`}
                          >
                            <span className="flex h-full w-full items-center justify-center rounded-[7px] bg-white/90 text-indigo-700">
                              <UiIcon name="categories" className="h-4 w-4" />
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-theme-primary">
                              {category.name}
                            </span>
                            <span className="block text-[11px] text-theme-subtle">
                              {category.item_count || 0} item
                              {category.item_count === 1 ? "" : "s"}
                            </span>
                          </span>
                        </button>
                        <details className="relative">
                          <summary
                            aria-label={`Actions for ${category.name}`}
                            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-theme-subtle hover:bg-theme-surface hover:text-theme-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/15 [&::-webkit-details-marker]:hidden"
                          >
                            <UiIcon name="more" className="h-4 w-4" />
                          </summary>
                          <div className="absolute right-0 z-30 mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                            <button
                              type="button"
                              onClick={() => openEditForm(category)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(category)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ) : categories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-theme p-5 text-center">
                  <p className="text-sm font-bold text-theme-primary">
                    No categories yet
                  </p>
                  <button
                    type="button"
                    onClick={openCreateForm}
                    disabled={limitReached}
                    className="mt-3 text-sm font-bold text-theme-accent"
                  >
                    Add your first category
                  </button>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-theme p-5 text-center text-sm text-theme-muted">
                  No categories match your search.
                </p>
              )}
            </div>
          </aside>

          <section
            className={`min-w-0 ${mobileDetailOpen ? "block" : "hidden lg:block"}`}
          >
            <header className="border-b border-theme bg-theme-surface p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="mb-3 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-theme-secondary lg:hidden"
              >
                <UiIcon name="chevron-left" className="h-4 w-4" />
                Back to Categories
              </button>

              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${
                      selectedCategory
                        ? getCategoryMarker(selectedCategory.id)
                        : "from-cyan-400 to-indigo-600"
                    } text-white shadow-[0_10px_24px_rgba(79,70,229,0.2)]`}
                  >
                    <UiIcon
                      name={
                        selection.type === "low"
                          ? "alert"
                          : selection.type === "recent"
                            ? "clock"
                            : selection.type === "all"
                              ? "box"
                              : "categories"
                      }
                      className="h-6 w-6"
                    />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black tracking-tight text-theme-primary">
                      {selectionTitle}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-theme-muted">
                      {selectedCategory?.description ||
                        (selection.type === "uncategorized"
                          ? "Items that are not assigned to a managed category."
                          : selection.type === "low"
                            ? "Items currently at or below their low-stock threshold."
                            : selection.type === "recent"
                              ? "Items created or updated during the last 30 days."
                              : "A complete view of inventory across all categories.")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={addItemHref}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <UiIcon name="plus" className="h-4 w-4" />
                    Add Item
                  </Link>
                  {selectedCategory && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditForm(selectedCategory)}
                        className="rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary hover:bg-theme-hover"
                      >
                        Edit Category
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(selectedCategory)}
                        className="rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-theme-danger hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-2 border-b border-theme bg-theme-inset sm:grid-cols-4">
              {[
                ["Items", selectionItems.length.toLocaleString()],
                ["Total quantity", selectedTotalQuantity.toLocaleString()],
                ["Low stock", selectedLowStockCount.toLocaleString()],
                [
                  "Last updated",
                  latestItem
                    ? formatUpdatedDate(
                        latestItem.recent_activity_at || latestItem.created_at
                      )
                    : "No items",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-r border-theme px-4 py-3 last:border-r-0 sm:border-b-0"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-theme-subtle">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-theme-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 sm:p-4">
              <div className="rounded-2xl border border-theme bg-theme-surface p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(9rem,auto))]">
                  <label className="relative">
                    <span className="sr-only">Search selected category</span>
                    <UiIcon
                      name="search"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
                    />
                    <input
                      type="search"
                      value={itemSearch}
                      onChange={(event) => setItemSearch(event.target.value)}
                      placeholder="Search items"
                      className={`${inputClassName} py-2.5 pl-9`}
                    />
                  </label>
                  <select
                    value={stockFilter}
                    onChange={(event) =>
                      setStockFilter(event.target.value as StockFilter)
                    }
                    aria-label="Filter by stock status"
                    className={`${inputClassName} py-2.5`}
                  >
                    <option value="all">All stock</option>
                    <option value="low">Low stock</option>
                    <option value="healthy">Healthy stock</option>
                  </select>
                  <select
                    value={depotFilter}
                    onChange={(event) => setDepotFilter(event.target.value)}
                    aria-label="Filter by depot"
                    className={`${inputClassName} py-2.5`}
                  >
                    <option value="all">All depots</option>
                    <option value="unassigned">Unassigned</option>
                    {depots.map((depot) => (
                      <option key={depot.id} value={depot.id}>
                        {formatDepotLabel(depot)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as SortOption)
                    }
                    aria-label="Sort items"
                    className={`${inputClassName} py-2.5`}
                  >
                    <option value="updated">Recently updated</option>
                    <option value="name">Name A-Z</option>
                    <option value="quantity-asc">Quantity low-high</option>
                    <option value="quantity-desc">Quantity high-low</option>
                  </select>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-3">
                  <p className="text-xs font-bold text-theme-muted">
                    {filteredItems.length} of {selectionItems.length} items
                  </p>
                  <div
                    role="group"
                    aria-label="Item view"
                    className="flex flex-wrap gap-1 rounded-xl border border-theme bg-theme-inset p-1"
                  >
                    {(
                      [
                        ["list", "List"],
                        ["cards-2", "2 columns"],
                        ["cards-3", "3 columns"],
                        ["table", "Table"],
                      ] as [ItemView, string][]
                    ).map(([view, label]) => (
                      <button
                        key={view}
                        type="button"
                        aria-pressed={itemView === view}
                        onClick={() => updateItemView(view)}
                        className={`rounded-lg px-2.5 py-2 text-xs font-bold ${
                          itemView === view
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-theme-muted hover:text-theme-primary"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((key) => (
                    <div
                      key={key}
                      className="h-48 animate-pulse rounded-2xl border border-theme bg-theme-inset"
                    />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-theme bg-theme-inset px-4 py-14 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-200/60 bg-white text-theme-accent">
                    <UiIcon
                      name={selectionItems.length === 0 ? "box" : "search"}
                      className="h-5 w-5"
                    />
                  </span>
                  <h3 className="mt-4 text-lg font-black text-theme-primary">
                    {selectionItems.length === 0
                      ? `No items in ${selectionTitle}`
                      : "No matching items"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-theme-muted">
                    {selectionItems.length === 0
                      ? "Add an item here or choose another category from the list."
                      : "Try changing the item search or filters."}
                  </p>
                  {selectionItems.length === 0 && (
                    <Link
                      href={addItemHref}
                      className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Add Item
                    </Link>
                  )}
                </div>
              ) : itemView === "list" ? (
                <div className="mt-3 grid gap-2">
                  {filteredItems.map(renderCompactRow)}
                </div>
              ) : itemView === "table" ? (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-theme">
                  <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                    <thead className="bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Depot</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Updated</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-theme text-theme-secondary"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/inventory/${item.id}`}
                              className="font-bold text-theme-primary hover:text-theme-accent"
                            >
                              {item.name}
                            </Link>
                            <p className="text-xs text-theme-subtle">
                              {item.item_code || item.sku || "No identifier"}
                            </p>
                          </td>
                          <td className="px-4 py-3">{getCategoryLabel(item)}</td>
                          <td className="px-4 py-3">
                            {formatDepotLabel(getDepot(item))}
                          </td>
                          <td className="px-4 py-3 font-bold text-theme-primary">
                            {getInventoryQuantityLabel(
                              item.quantity,
                              item.unit_type,
                              item.custom_unit_label
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {formatUpdatedDate(
                              item.recent_activity_at || item.created_at
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/dashboard/inventory/${item.id}`}
                              className="font-bold text-theme-accent"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className={`mt-3 grid grid-cols-1 gap-3 ${
                    itemView === "cards-3"
                      ? "md:grid-cols-2 2xl:grid-cols-3"
                      : "md:grid-cols-2"
                  }`}
                >
                  {filteredItems.map((item) => (
                    <InventoryItemCard
                      key={item.id}
                      item={item}
                      itemCode={item.item_code}
                      quantityLabel={getInventoryQuantityLabel(
                        item.quantity,
                        item.unit_type,
                        item.custom_unit_label
                      )}
                      categoryLabel={getCategoryLabel(item)}
                      depotLabel={
                        getDepot(item) ? formatDepotLabel(getDepot(item)) : null
                      }
                      lowStock={isItemLowStock(item)}
                      deleting={false}
                      onAdjust={() => openItemAction(item, "stock")}
                      onEdit={() => openItemAction(item, "edit")}
                      onDelete={() => openItemAction(item, "delete")}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <DialogShell
        open={formOpen}
        title={editingCategory ? "Edit Category" : "Add Category"}
        eyebrow="Inventory organization"
        description={
          editingCategory
            ? "Update the category name or internal description."
            : "Create a category that can be assigned across inventory."
        }
        onClose={closeForm}
        className="max-w-lg"
      >
        <CategoryForm
          editing={Boolean(editingCategory)}
          values={formValues}
          error={formError}
          saving={saving}
          onChange={(field, value) =>
            setFormValues((current) => ({ ...current, [field]: value }))
          }
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      </DialogShell>

      <DialogShell
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : "Delete category"}
        eyebrow="Delete category"
        description="This action cannot be undone."
        onClose={() => {
          if (!deletingId) setPendingDelete(null);
        }}
        tone="danger"
        className="max-w-md"
      >
        {pendingDelete && (
          <>
            <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-theme-secondary">
              <strong>{pendingDelete.item_count || 0}</strong> linked item
              {pendingDelete.item_count === 1 ? "" : "s"} will become
              Uncategorized. Inventory items will not be deleted.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="rounded-xl border border-theme px-5 py-3 text-sm font-bold text-theme-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </>
        )}
      </DialogShell>
    </main>
  );
}
