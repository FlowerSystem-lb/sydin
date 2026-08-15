"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import ScannerModal from "@/components/scanner/ScannerModal";
import { resolveScannedCode } from "@/app/lib/scannerResolve";
import ItemDetailsSlideOver, {
  type SlideOverInventoryItem,
} from "@/components/inventory/ItemDetailsSlideOver";
import InventoryItemCard from "@/components/inventory/InventoryItemCard";
import SetAlertLevelDialog from "@/components/inventory/SetAlertLevelDialog";
import StockMovementDialog from "@/components/inventory/StockMovementDialog";
import { Button, DialogShell, Select } from "@/components/ui";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
  MetricCard,
} from "@/components/dashboard/Workspace";
import CategorySelector from "@/components/CategorySelector";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  LockedActionLabel,
  UpgradeDialog,
} from "@/components/UpgradePrompt";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import EditItemForm, {
  createEditItemFormValues,
  createEmptyEditItemFormValues,
  getEditSaveErrorMessage,
  validateEditItemFormValues,
  type EditItemFieldErrors,
  type EditItemFieldName,
  type EditItemFormValues,
} from "@/app/dashboard/inventory/EditItemForm";
import { hasTrackedItemChanges, logInventoryHistory } from "@/app/lib/inventoryHistory";
import { logImportExport } from "@/app/lib/importExportHistory";
import {
  calculateInventoryValue,
  DEFAULT_INVENTORY_UNIT_TYPE,
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNIT_TYPES,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  normalizeInventoryUnitType,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { supabase } from "@/app/lib/supabase";
import {
  getSuppliersForUser,
  type Supplier,
} from "@/app/lib/suppliers";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { exportInventoryExcel } from "@/app/lib/inventoryExcelExport";
import {
  exportInventoryPdf,
  type InventoryPdfBrandingMode,
  type InventoryPdfGroupBy,
  type InventoryPdfIncludeSettings,
  type InventoryPdfReportType,
  type InventoryPdfScope,
} from "@/app/lib/inventoryPdfExport";
import {
  SCANNER_REQUEST_EVENT,
  SCANNER_REQUEST_STORAGE_KEY,
} from "@/app/lib/scannerNavigation";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  getUpgradePlanForCurrentPlan,
  type UpgradePlan,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

interface Item {
  id: number;
  name: string;
  category: string;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
  depot_id?: number | null;
  public_id?: string | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
  barcode?: string | null;
  supplier_id?: number | null;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

type DepotFilter = "all" | "unassigned" | string;
type CategoryFilter = "all" | "uncategorized" | string;
type StockFilter = "all" | "low";
type QuickFilter =
  | "all"
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "no-image"
  | "no-price"
  | "no-activity"
  | "unassigned";
type SortOption = "newest" | "name-az" | "quantity-asc" | "quantity-desc";
type ViewMode = "grid" | "list" | "table";
type ItemDetailsTarget = {
  id: number;
  tab: "details" | "activity" | "alerts";
} | null;
type BulkDialogMode = "edit" | "move" | "delete" | null;
type PdfSettings = {
  reportType: InventoryPdfReportType;
  scope: InventoryPdfScope;
  groupBy: InventoryPdfGroupBy;
  brandingMode: InventoryPdfBrandingMode;
  include: InventoryPdfIncludeSettings;
};
type LockedFeature = {
  feature: string;
  benefit: string;
  requiredPlan: UpgradePlan;
  source: string;
};

const PDF_SETTINGS_STORAGE_KEY = "sydin:inventory-pdf-settings";
const COMPACT_SELECT_BUTTON_CLASS =
  "min-h-10 rounded-xl px-3 py-2 text-xs font-bold";
const SORT_SELECT_BUTTON_CLASS =
  "inventory-sort-trigger min-h-10 rounded-xl px-3 py-2 text-xs font-bold";
const QUICK_FILTER_OPTIONS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "no-image", label: "No image" },
  // Finds items contributing nothing to Inventory Value. Added 2026-08-12
  // alongside the "priced items only (N of M)" caption on the Dashboard card:
  // that caption makes the gap visible, this makes it actionable in one click.
  { value: "no-price", label: "No price" },
  // The specific gap named in the 2026-08-04 decision ("items with no
  // movement history... is precisely what unlocks the predictive metrics
  // later"). Backed by movedItemIds, populated from a lean stock_movements
  // query on mount.
  { value: "no-activity", label: "No activity" },
  { value: "unassigned", label: "Unassigned" },
];

// "No price" means the item cannot contribute to inventory value at all — the
// Dashboard computes per-item value as quantity × (selling_price ?? cost_price),
// so an item counts as priced if EITHER price is set. Kept in one place so the
// filter and that calculation cannot drift apart.
function itemHasNoPrice(item: { cost_price?: number | string | null; selling_price?: number | string | null }) {
  const hasCost = item.cost_price !== null && item.cost_price !== undefined && String(item.cost_price).trim() !== "";
  const hasSelling =
    item.selling_price !== null && item.selling_price !== undefined && String(item.selling_price).trim() !== "";

  return !hasCost && !hasSelling;
}
const DEFAULT_PDF_SETTINGS: PdfSettings = {
  reportType: "summary",
  scope: "all",
  groupBy: "none",
  brandingMode: "sydin",
  include: {
    images: true,
    sku: true,
    barcode: false,
    category: true,
    depot: true,
    supplier: true,
    minStock: true,
    pricing: true,
    notes: true,
  },
};

const CSV_HEADERS = [
  "Name",
  "SKU",
  "Category",
  "Depot",
  "Quantity",
  "Low Stock",
  "Notes",
  "Image URL",
  "Public Item URL",
  "Item Code",
  "Unit Type",
  "Custom Unit Label",
  "Cost Price",
  "Selling Price",
  "Stock Cost Value",
  "Stock Retail Value",
  "Min Stock Level",
  "Barcode",
  "Supplier Name",
];

function InventoryActionMenu({
  label,
  labelHidden = false,
  buttonClassName,
  menuClassName,
  children,
}: {
  label: string;
  /** Renders the trigger as icon-only; `label` stays as the accessible name. */
  labelHidden?: boolean;
  buttonClassName: string;
  menuClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const positionMenu = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const reservedBottom =
      window.matchMedia("(max-width: 639px)").matches ? 104 : viewportPadding;
    const menuWidth = menuRef.current?.offsetWidth || 224;
    const menuHeight = menuRef.current?.offsetHeight || 252;
    const left = Math.min(
      Math.max(rect.right - menuWidth, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );
    const opensUp =
      rect.bottom + menuHeight + reservedBottom > window.innerHeight;
    const top = opensUp
      ? Math.max(viewportPadding, rect.top - menuHeight - 8)
      : rect.bottom + 8;
    const availableHeight = Math.max(
      176,
      window.innerHeight - top - reservedBottom
    );

    setMenuStyle({
      position: "fixed",
      left,
      top,
      width: menuWidth,
      maxHeight: availableHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    positionMenu();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        menuRootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, positionMenu]);

  return (
    <div ref={menuRootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          positionMenu();
          setOpen((current) => !current);
        }}
        className={buttonClassName}
        aria-label={labelHidden ? label : undefined}
        title={labelHidden ? label : undefined}
      >
        <UiIcon name="more" />
        {labelHidden ? <span className="sr-only">{label}</span> : label}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            onClick={(event) => {
              const action = (event.target as HTMLElement).closest("a,button");
              if (action) setOpen(false);
            }}
            className={
              menuClassName ||
              "inventory-floating-menu z-[120] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
            }
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}

function InventoryThumbnail({
  src,
  alt,
  imgClassName = "object-contain p-1.5",
  iconClassName = "h-5 w-5",
}: {
  src?: string | null;
  alt: string;
  imgClassName?: string;
  iconClassName?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src || ""}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailedSrc(src || null)}
        className={`h-full w-full ${imgClassName}`}
      />
    );
  }

  return (
    <span className="flex h-full items-center justify-center text-theme-subtle">
      <UiIcon name="box" className={iconClassName} />
    </span>
  );
}

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sydin"
  );
}


function formatCompactCurrency(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizeCurrencyCode(currencyCode, "USD"),
      notation: Math.abs(value) >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${normalizeCurrencyCode(currencyCode, "USD")} ${value.toFixed(0)}`;
  }
}




async function getBusinessCurrency(userId: string) {
  const { data, error } = await supabase
    .from("business_settings")
    .select("currency_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return "USD";

  return normalizeCurrencyCode(data?.currency_code, "USD");
}

export default function InventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<DepotFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    () => new Set()
  );
  const [bulkDialogMode, setBulkDialogMode] =
    useState<BulkDialogMode>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkNotice, setBulkNotice] = useState("");
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkDeleteConfirmed, setBulkDeleteConfirmed] = useState(false);
  const [bulkCategoryMode, setBulkCategoryMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkDepotMode, setBulkDepotMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkDepotId, setBulkDepotId] = useState("");
  const [bulkSupplierMode, setBulkSupplierMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkSupplierId, setBulkSupplierId] = useState("");
  const [bulkUnitEnabled, setBulkUnitEnabled] = useState(false);
  const [bulkUnitType, setBulkUnitType] = useState<InventoryUnitType>(
    DEFAULT_INVENTORY_UNIT_TYPE
  );
  const [bulkCustomUnitLabel, setBulkCustomUnitLabel] = useState("");
  const [bulkMinStockMode, setBulkMinStockMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkMinStockLevel, setBulkMinStockLevel] = useState("");
  const [bulkCostMode, setBulkCostMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkCostPrice, setBulkCostPrice] = useState("");
  const [bulkSellingMode, setBulkSellingMode] =
    useState<"keep" | "set" | "clear">("keep");
  const [bulkSellingPrice, setBulkSellingPrice] = useState("");
  const [bulkNotesEnabled, setBulkNotesEnabled] = useState(false);
  const [bulkNotesMode, setBulkNotesMode] =
    useState<"append" | "replace">("append");
  const [bulkNotes, setBulkNotes] = useState("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPdfSettingsOpen, setIsPdfSettingsOpen] = useState(false);
  const [pdfSettings, setPdfSettings] =
    useState<PdfSettings>(DEFAULT_PDF_SETTINGS);
  const [pdfExportStatus, setPdfExportStatus] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<LockedFeature | null>(
    null
  );

  // Modal State
  const [depots, setDepots] = useState<Depot[]>([]);
  // Dashboard's "data completeness" section (backlog item 3, the 2026-08-04
  // decision: predictive stats aren't computable yet, but completeness gaps
  // are) links here via ?quick=no-activity. A lean item_id-only query, not a
  // reuse of getRecentStockMovements — that one is capped/ordered for a
  // "recent" list, this only needs "has this item ever moved at all."
  const [movedItemIds, setMovedItemIds] = useState<Set<number>>(new Set());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [usageLoading, setUsageLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editValues, setEditValues] = useState<EditItemFormValues>(
    createEmptyEditItemFormValues
  );
  const [editFieldErrors, setEditFieldErrors] =
    useState<EditItemFieldErrors>({});
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editCurrencyCode, setEditCurrencyCode] = useState("USD");
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<Item | null>(null);
  const [movementItem, setMovementItem] = useState<Item | null>(null);
  const [alertLevelItem, setAlertLevelItem] = useState<Item | null>(null);
  const [detailsItem, setDetailsItem] = useState<ItemDetailsTarget>(null);
  const inventoryModalOpen =
    isScannerOpen ||
    isEditModalOpen ||
    isPdfSettingsOpen ||
    bulkDialogMode !== null ||
    pendingDeleteItem !== null ||
    movementItem !== null ||
    alertLevelItem !== null ||
    detailsItem !== null ||
    lockedFeature !== null;
  const [inventoryContextReady, setInventoryContextReady] = useState(false);
  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const canUseScanner = Boolean(planCapabilities.scanner);
  const canExportPdf = planCapabilities.pdfExport !== "none";
  const canExportExcel = planCapabilities.excelExport;
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );

  useEffect(() => {
    const className = "inventory-modal-open";
    if (!inventoryModalOpen) return;

    document.documentElement.classList.add(className);
    document.body.classList.add(className);

    return () => {
      document.documentElement.classList.remove(className);
      document.body.classList.remove(className);
    };
  }, [inventoryModalOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      // Restore the user's compact-mode preference (default: stats visible).
      setShowStats(
        window.localStorage.getItem("sydin:inventory-show-stats") !== "off"
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleShowStats = () => {
    setShowStats((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          "sydin:inventory-show-stats",
          next ? "on" : "off"
        );
      } catch {
        // Preference persistence is optional.
      }
      return next;
    });
  };

  const fetchItems = async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      setPageError("Please sign in again to view your inventory.");
      setUsageLoading(false);
      return;
    }

    const [
      { data, error },
      usage,
      settings,
      loadedDepots,
      loadedSuppliers,
      loadedCategories,
      loadedCurrency,
    ] =
      await Promise.all([
        supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .order("id", {
            ascending: false,
          }),
        getSubscriptionUsage(user.id),
        getOrCreateBusinessSettings(user.id),
        getDepotsForUser(user.id).catch(() => []),
        getSuppliersForUser(user.id).catch(() => []),
        getCategoriesForUser(user.id).catch(() => []),
        getBusinessCurrency(user.id),
      ]);

    if (error) {
      setPageError("We could not load your inventory. Refresh the page and try again.");
      setUsageLoading(false);
      return;
    }

    setItems(data || []);
    setSubscriptionUsage(usage);
    setBusinessSettings(settings);
    setDepots(loadedDepots);
    setSuppliers(loadedSuppliers);
    setCategories(loadedCategories);
    setEditCurrencyCode(loadedCurrency);
    setUsageLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (!isActive) return;

      if (userError) {
        setPageError("We could not confirm your session. Please sign in again.");
        setLoadingItems(false);
        setUsageLoading(false);
        return;
      }

      if (!user) {
        setPageError("Please sign in again to view your inventory.");
        setLoadingItems(false);
        setUsageLoading(false);
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
        getDepotsForUser(user.id).catch(() => []),
        getSuppliersForUser(user.id).catch(() => []),
        getCategoriesForUser(user.id).catch(() => []),
        getBusinessCurrency(user.id),
        supabase
          .from("stock_movements")
          .select("item_id")
          .eq("user_id", user.id)
          .then(
            (result) => result,
            () => ({ data: null, error: null })
          ),
      ])
        .then(
          ([
            { data, error },
            usage,
            settings,
            loadedDepots,
            loadedSuppliers,
            loadedCategories,
            loadedCurrency,
            { data: movementRows },
          ]) => {
          if (!isActive) return;

          if (error) {
            setPageError("We could not load your inventory. Refresh the page and try again.");
            setLoadingItems(false);
            setUsageLoading(false);
            return;
          }

          setItems(data || []);
          setSubscriptionUsage(usage);
          setBusinessSettings(settings);
          setDepots(loadedDepots);
          setSuppliers(loadedSuppliers);
          setCategories(loadedCategories);
          setEditCurrencyCode(loadedCurrency);
          // A failed lookup here (movementRows null) leaves the set empty,
          // meaning "no activity" would list every item — the filter chip
          // stays available but its count staying wrong is more visible than
          // the page breaking, so this is deliberately non-fatal.
          setMovedItemIds(
            new Set(
              (movementRows || [])
                .map((row: { item_id: number | null }) => row.item_id)
                .filter((id: number | null): id is number => id !== null)
            )
          );
          setLoadingItems(false);
          setUsageLoading(false);
          }
        )
        .catch(() => {
          if (!isActive) return;

          setPageError("Something went wrong while loading inventory.");
          setLoadingItems(false);
          setUsageLoading(false);
        });
    }).catch(() => {
      if (!isActive) return;

      setPageError("Something went wrong while checking your session.");
      setLoadingItems(false);
      setUsageLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setFiltersOpen(
          window.localStorage.getItem("sydin:inventory-filters-open") ===
            "true"
        );
        const storedPdfSettings = window.localStorage.getItem(
          PDF_SETTINGS_STORAGE_KEY
        );
        if (storedPdfSettings) {
          const parsed = JSON.parse(storedPdfSettings) as Partial<PdfSettings>;
          setPdfSettings({
            ...DEFAULT_PDF_SETTINGS,
            ...parsed,
            scope: "all",
            include: {
              ...DEFAULT_PDF_SETTINGS.include,
              ...(parsed.include || {}),
            },
          });
        }
      } catch {
        setFiltersOpen(false);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get("search") || "");

      const requestedDepot = params.get("depot");
      if (requestedDepot) setDepotFilter(requestedDepot);

      const requestedCategory = params.get("category");
      if (requestedCategory) setCategoryFilter(requestedCategory);

      const requestedStock = params.get("stock");
      if (requestedStock === "all" || requestedStock === "low") {
        setStockFilter(requestedStock);
      }

      const requestedQuick = params.get("quick");
      if (
        requestedQuick === "all" ||
        requestedQuick === "in-stock" ||
        requestedQuick === "low-stock" ||
        requestedQuick === "out-of-stock" ||
        requestedQuick === "no-image" ||
        requestedQuick === "no-price" ||
        requestedQuick === "no-activity" ||
        requestedQuick === "unassigned"
      ) {
        setQuickFilter(requestedQuick);
      }

      const requestedSort = params.get("sort");
      if (
        requestedSort === "newest" ||
        requestedSort === "name-az" ||
        requestedSort === "quantity-asc" ||
        requestedSort === "quantity-desc"
      ) {
        setSortBy(requestedSort);
      }

      const requestedView = params.get("view");
      if (
        requestedView === "grid" ||
        requestedView === "list" ||
        requestedView === "table"
      ) {
        setViewMode(requestedView);
      } else if (window.matchMedia("(max-width: 640px)").matches) {
        setViewMode("list");
      }

      setInventoryContextReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleFiltersOpen = () => {
    setFiltersOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          "sydin:inventory-filters-open",
          String(next)
        );
      } catch {
        // Preference still applies for this session.
      }
      return next;
    });
  };

  useEffect(() => {
    try {
      const storedSettings: Partial<PdfSettings> = {
        ...pdfSettings,
      };
      delete storedSettings.scope;
      window.localStorage.setItem(
        PDF_SETTINGS_STORAGE_KEY,
        JSON.stringify(storedSettings)
      );
    } catch {
      // Export preferences are non-critical.
    }
  }, [pdfSettings]);



  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  const openScanner = useCallback(() => {
    if (!canUseScanner) {
      setLockedFeature({
        feature: "Inventory scanner",
        benefit:
          "Scan SydIN QR codes and product barcodes directly from your inventory workspace.",
        requiredPlan: "Standard",
        source: "scanner",
      });
      return;
    }

    setPageError("");
    setPageNotice("");
    setIsScannerOpen(true);
  }, [canUseScanner]);

  useEffect(() => {
    const handleScannerRequest = () => {
      if (usageLoading) {
        try {
          window.sessionStorage.setItem(
            SCANNER_REQUEST_STORAGE_KEY,
            "true"
          );
        } catch {
          // The inventory page remains usable without storage access.
        }
        return;
      }

      openScanner();
    };

    let pendingRequest = false;
    try {
      pendingRequest =
        window.sessionStorage.getItem(SCANNER_REQUEST_STORAGE_KEY) === "true";
    } catch {
      pendingRequest = false;
    }

    if (pendingRequest && !usageLoading) {
      try {
        window.sessionStorage.removeItem(SCANNER_REQUEST_STORAGE_KEY);
      } catch {
        // Opening the scanner does not depend on clearing the hint.
      }
      window.requestAnimationFrame(openScanner);
    }

    window.addEventListener(SCANNER_REQUEST_EVENT, handleScannerRequest);
    return () => {
      window.removeEventListener(SCANNER_REQUEST_EVENT, handleScannerRequest);
    };
  }, [openScanner, usageLoading]);

  const handleScannedText = useCallback((scannedValue: string) => {
    const scannedText = scannedValue.trim();

    if (!scannedText) {
      setPageNotice("We could not read that code. Try scanning again.");
      closeScanner();
      return;
    }

    const resolution = resolveScannedCode(scannedText, items);

    if (resolution.kind === "item") {
      closeScanner();
      router.push(`/dashboard/inventory/${resolution.item.id}`);
      return;
    }

    if (resolution.kind === "ambiguous") {
      setSearch(resolution.query);
      setPageNotice(
        `Found ${resolution.items.length} items with that code. Showing matches.`
      );
      closeScanner();
      return;
    }

    // backlog item 1 (P1, approved): a code that matches nothing used to
    // fall back to a search that was guaranteed to show zero results — a
    // dead end. Per the approved spec ("scan the barcode... then fill in the
    // rest"), route straight into Add Item with the code prefilled instead
    // of leaving the user at an empty results page.
    closeScanner();
    router.push(
      `/dashboard/add-item?barcode=${encodeURIComponent(
        resolution.query
      )}&returnTo=${encodeURIComponent("/dashboard/inventory")}`
    );
  }, [closeScanner, items, router]);

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setEditValues(createEditItemFormValues(item));
    setEditFieldErrors({});
    setEditImage(null);
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = (force = false) => {
    if (isEditing && !force) return;

    setIsEditModalOpen(false);
    setSelectedItem(null);
    setEditValues(createEmptyEditItemFormValues());
    setEditFieldErrors({});
    setEditImage(null);
    setEditError("");
  };

  const updateEditValue = <Field extends keyof EditItemFormValues>(
    field: Field,
    value: EditItemFormValues[Field]
  ) => {
    setEditValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const clearEditFieldError = (field: EditItemFieldName) => {
    setEditFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem || isEditing) return;

    const validation = validateEditItemFormValues(editValues, categories);

    if (!validation.parsedValues) {
      setEditFieldErrors(validation.errors);
      setEditError("Review the highlighted fields before saving.");
      return;
    }

    try {
      setIsEditing(true);
      setEditError("");
      setEditFieldErrors({});
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEditError("Please sign in again before updating inventory.");
        setIsEditing(false);
        return;
      }

      let imageUrl = selectedItem.image || "";

      if (editImage) {
        const fileName = `${Date.now()}-${editImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, editImage);

        if (uploadError) {
          setEditError(
            "Image upload failed. Try a smaller file or a different image."
          );
          setIsEditing(false);
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const oldItem = { ...selectedItem };
      const updatedItem = {
        ...validation.parsedValues,
        image: imageUrl,
      };

      const { data, error } = await supabase
        .from("inventory")
        .update(updatedItem)
        .eq("id", selectedItem.id)
        .eq("user_id", user.id)
        .select("*");

      if (error) {
        setEditError(getEditSaveErrorMessage(error));
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        setIsEditing(false);
        return;
      }

      // Only record history when a field actually changed. Saving the edit form
      // untouched used to write an "Edited" row with identical old/new values,
      // which buries genuine changes in noise and makes the audit trail lie
      // about when the item was last modified.
      const savedItem = data[0] as Item;
      const changedFields = (
        Object.keys(updatedItem) as (keyof typeof updatedItem)[]
      ).filter((field) => {
        const before = (oldItem as Record<string, unknown>)[field as string];
        const after = (savedItem as unknown as Record<string, unknown>)[
          field as string
        ];
        // Treat null/undefined/"" as equivalent — the form round-trips empty
        // optional fields between those representations without user intent.
        const normalize = (value: unknown) =>
          value === null || value === undefined || value === "" ? "" : value;
        return normalize(before) !== normalize(after);
      });

      if (changedFields.length > 0) {
        await logInventoryHistory({
          itemId: selectedItem.id,
          userId: user.id,
          action: "edited",
          oldQuantity: oldItem.quantity,
          newQuantity: savedItem.quantity,
          oldValues: oldItem,
          newValues: savedItem,
        });
      }

      await fetchItems();
      setPageNotice("Item updated successfully.");
      closeEditModal(true);
    } catch {
      setEditError("Something went wrong while updating this item.");
    } finally {
      setIsEditing(false);
    }
  };

  const deleteItem = async (
    id: number
  ) => {
    if (deletingId) return;

    try {
      setDeletingId(id);
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageError("Please sign in again before deleting inventory.");
        return;
      }

      const itemToDelete = items.find((item) => item.id === id);

      if (itemToDelete) {
        await logInventoryHistory({
          itemId: itemToDelete.id,
          userId: user.id,
          action: "deleted",
          oldQuantity: itemToDelete.quantity,
          oldValues: itemToDelete,
        });
      }

      const { error } =
        await supabase
          .from("inventory")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

      if (error) {
        setPageError("We could not delete this item. Please try again.");
        return;
      }

      setPageNotice("Item deleted successfully.");
      setPendingDeleteItem(null);
      await fetchItems();
    } catch {
      setPageError("Something went wrong while deleting this item.");
    } finally {
      setDeletingId(null);
    }
  };

  const exportInventoryCsv = (itemsToExport = items) => {
    if (loadingItems || itemsToExport.length === 0) return;

    try {
      setPageError("");
      setPageNotice("");

      const publicBaseUrl = window.location.origin;
      const rows = itemsToExport.map((item) => [
        item.name,
        item.sku || "",
        getCategoryLabel(item),
        formatDepotLabel(depots.find((depot) => depot.id === item.depot_id)),
        item.quantity,
        item.quantity <=
        getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          effectiveLowStockThreshold
        )
          ? "Yes"
          : "No",
        item.notes || "",
        item.image || "",
        item.public_id ? `${publicBaseUrl}/item/${item.public_id}` : "",
        item.item_code || "",
        normalizeInventoryUnitType(item.unit_type),
        item.unit_type === "custom" ? item.custom_unit_label || "" : "",
        item.cost_price ?? "",
        item.selling_price ?? "",
        calculateInventoryValue(item.quantity, item.cost_price) ?? "",
        calculateInventoryValue(item.quantity, item.selling_price) ?? "",
        item.min_stock_level ?? "",
        item.barcode || "",
        suppliers.find((supplier) => supplier.id === item.supplier_id)?.name || "",
      ]);
      const csv = [CSV_HEADERS, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\r\n");
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const businessSlug = slugifyFilename(
        businessSettings.business_name || DEFAULT_BUSINESS_SETTINGS.business_name
      );
      const dateStamp = formatDateForFilename(new Date());

      link.href = downloadUrl;
      link.download = `${businessSlug}-inventory-${dateStamp}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      // Record the export so it shows up on the Import & Export history page.
      // Fire-and-forget: the file already downloaded, so a logging failure must
      // never surface as an export failure.
      const exportedFileName = link.download;
      const exportedCount = itemsToExport.length;
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        return logImportExport({
          userId: user.id,
          operation_type: "export",
          file_name: exportedFileName,
          item_count: exportedCount,
          status: "success",
        });
      });

      setPageNotice(`Exported ${itemsToExport.length} inventory item${itemsToExport.length === 1 ? "" : "s"}.`);
    } catch {
      setPageError("We could not export your inventory. Please try again.");
    }
  };

  const getPdfScopeItems = (scope: InventoryPdfScope) => {
    if (scope === "selected") return selectedItems;
    if (scope === "filtered") return visibleItems;
    return items;
  };

  const getPdfScopeLabel = (scope: InventoryPdfScope, itemCount: number) => {
    if (scope === "selected") {
      return `${itemCount} selected item${itemCount === 1 ? "" : "s"}`;
    }

    if (scope === "filtered") {
      const parts = [
        search.trim() ? `Search: ${search.trim()}` : "",
        depotFilter !== "all"
          ? activeFilterChips.find((chip) => chip.label.startsWith("Depot:"))
              ?.label || "Depot filter"
          : "",
        categoryFilter !== "all"
          ? activeFilterChips.find((chip) => chip.label.startsWith("Category:"))
              ?.label || "Category filter"
          : "",
        stockFilter === "low" ? "Low-stock items" : "",
      ].filter(Boolean);

      return parts.length > 0
        ? parts.join(" | ")
        : "Current inventory filters";
    }

    return "All inventory";
  };

  const openPdfSettings = (scope: InventoryPdfScope = "all") => {
    if (!canExportPdf) {
      setLockedFeature({
        feature: "PDF inventory export",
        benefit:
          "Create a polished, branded PDF inventory report for sharing and review.",
        requiredPlan: "Standard",
        source: "pdf-export",
      });
      return;
    }

    setPdfExportStatus("");
    setPdfSettings((current) => ({
      ...current,
      scope,
    }));
    setIsPdfSettingsOpen(true);
  };

  const updatePdfInclude = (
    key: keyof InventoryPdfIncludeSettings,
    value: boolean
  ) => {
    setPdfSettings((current) => ({
      ...current,
      include: {
        ...current.include,
        [key]: value,
      },
    }));
  };

  const exportInventoryReportPdf = async (
    overrideScope?: InventoryPdfScope
  ) => {
    if (!canExportPdf) {
      setLockedFeature({
        feature: "PDF inventory export",
        benefit:
          "Create a polished, branded PDF inventory report for sharing and review.",
        requiredPlan: "Standard",
        source: "pdf-export",
      });
      return;
    }

    const resolvedScope = overrideScope || pdfSettings.scope;
    const itemsToExport = getPdfScopeItems(resolvedScope);

    if (loadingItems || isExportingPdf) return;

    if (resolvedScope === "selected" && itemsToExport.length === 0) {
      setPdfExportStatus("Select one or more items before exporting.");
      return;
    }

    try {
      setIsExportingPdf(true);
      setPageError("");
      setPageNotice("");
      setPdfExportStatus("Preparing PDF...");

      const filename = await exportInventoryPdf({
        items: itemsToExport.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: getCategoryLabel(item),
          quantity: item.quantity,
          itemCode: item.item_code,
          unitType: normalizeInventoryUnitType(item.unit_type),
          customUnitLabel: item.custom_unit_label,
          costPrice: item.cost_price,
          sellingPrice: item.selling_price,
          minStockLevel: item.min_stock_level,
          barcode: item.barcode,
          notes: item.notes,
          image: item.image,
          depotLabel: formatDepotLabel(
            depots.find((depot) => depot.id === item.depot_id)
          ),
          supplierLabel:
            suppliers.find((supplier) => supplier.id === item.supplier_id)
              ?.name || "",
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          businessLogoUrl: businessSettings.business_logo_url,
          contactEmail:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_email
              : "",
          contactPhone:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_phone
              : "",
          contactWebsite:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_website
              : "",
        },
        lowStockThreshold: effectiveLowStockThreshold,
        currencyCode: editCurrencyCode,
        reportType: pdfSettings.reportType,
        scope: resolvedScope,
        scopeLabel: getPdfScopeLabel(resolvedScope, itemsToExport.length),
        groupBy: pdfSettings.groupBy,
        include: pdfSettings.include,
        brandingMode: pdfSettings.brandingMode,
        allowBusinessLogo: planCapabilities.customBusinessLogo,
        onProgress: setPdfExportStatus,
      });

      setPageNotice(
        `${filename} exported for ${itemsToExport.length} inventory item${
          itemsToExport.length === 1 ? "" : "s"
        }.`
      );
      setPdfExportStatus("PDF downloaded.");
      setIsPdfSettingsOpen(false);
    } catch {
      setPdfExportStatus("");
      setPageError("We could not export your PDF report. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const exportInventoryReportExcel = async (itemsToExport = items) => {
    if (!canExportExcel) {
      setLockedFeature({
        feature: "Excel inventory export",
        benefit:
          "Export a structured Excel workbook with item details, depot assignments, and public links.",
        requiredPlan: "Standard",
        source: "excel-export",
      });
      return;
    }

    if (loadingItems || itemsToExport.length === 0 || isExportingExcel) return;

    try {
      setIsExportingExcel(true);
      setPageError("");
      setPageNotice("");

      const publicBaseUrl = window.location.origin;

      await exportInventoryExcel({
        items: itemsToExport.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: getCategoryLabel(item),
          quantity: item.quantity,
          itemCode: item.item_code,
          unitType: normalizeInventoryUnitType(item.unit_type),
          customUnitLabel: item.custom_unit_label,
          costPrice: item.cost_price,
          sellingPrice: item.selling_price,
          minStockLevel: item.min_stock_level,
          barcode: item.barcode,
          notes: item.notes,
          image: item.image,
          publicItemUrl: item.public_id
            ? `${publicBaseUrl}/item/${item.public_id}`
            : "",
          depotLabel: formatDepotLabel(
            depots.find((depot) => depot.id === item.depot_id)
          ),
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          businessLogoUrl: businessSettings.business_logo_url,
          contactEmail: businessSettings.contact_email,
          contactPhone: businessSettings.contact_phone,
          contactWebsite: businessSettings.contact_website,
        },
        lowStockThreshold: effectiveLowStockThreshold,
        currencyCode: editCurrencyCode,
      });

      setPageNotice(
        `Excel report exported for ${itemsToExport.length} inventory item${
          itemsToExport.length === 1 ? "" : "s"
        }.`
      );
    } catch {
      setPageError("We could not export your Excel report. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const buildBulkUpdatePayload = (item: Item) => {
    const payload: Record<string, unknown> = {};

    if (bulkCategoryMode === "set") {
      const category = categories.find(
        (candidate) => String(candidate.id) === bulkCategoryId
      );
      payload.category_id = category ? category.id : null;
      payload.category = category ? category.name : null;
    } else if (bulkCategoryMode === "clear") {
      payload.category_id = null;
      payload.category = null;
    }

    if (bulkDepotMode === "set") {
      payload.depot_id = bulkDepotId ? Number(bulkDepotId) : null;
    } else if (bulkDepotMode === "clear") {
      payload.depot_id = null;
    }

    if (bulkSupplierMode === "set") {
      payload.supplier_id = bulkSupplierId ? Number(bulkSupplierId) : null;
    } else if (bulkSupplierMode === "clear") {
      payload.supplier_id = null;
    }

    if (bulkUnitEnabled) {
      payload.unit_type = bulkUnitType;
      payload.custom_unit_label =
        bulkUnitType === "custom" ? bulkCustomUnitLabel.trim() || null : null;
    }

    if (bulkMinStockMode === "set") {
      payload.min_stock_level =
        bulkMinStockLevel === "" ? null : Number(bulkMinStockLevel);
    } else if (bulkMinStockMode === "clear") {
      payload.min_stock_level = null;
    }

    if (bulkCostMode === "set") {
      payload.cost_price = bulkCostPrice === "" ? null : Number(bulkCostPrice);
    } else if (bulkCostMode === "clear") {
      payload.cost_price = null;
    }

    if (bulkSellingMode === "set") {
      payload.selling_price =
        bulkSellingPrice === "" ? null : Number(bulkSellingPrice);
    } else if (bulkSellingMode === "clear") {
      payload.selling_price = null;
    }

    if (bulkNotesEnabled) {
      payload.notes =
        bulkNotesMode === "append"
          ? [item.notes?.trim(), bulkNotes.trim()].filter(Boolean).join("\n")
          : bulkNotes;
    }

    return payload;
  };

  const getBulkChangeSummary = () => {
    const changes = [
      bulkCategoryMode !== "keep" ? "category" : "",
      bulkDepotMode !== "keep" ? "depot/location" : "",
      bulkSupplierMode !== "keep" ? "supplier" : "",
      bulkUnitEnabled ? "unit" : "",
      bulkMinStockMode !== "keep" ? "minimum stock" : "",
      bulkCostMode !== "keep" ? "cost price" : "",
      bulkSellingMode !== "keep" ? "selling price" : "",
      bulkNotesEnabled ? `${bulkNotesMode} notes` : "",
    ].filter(Boolean);

    return changes;
  };

  const getBulkClearWarnings = () =>
    [
      bulkCategoryMode === "clear" ? "category" : "",
      bulkDepotMode === "clear" ? "depot/location" : "",
      bulkSupplierMode === "clear" ? "supplier" : "",
      bulkMinStockMode === "clear" ? "minimum stock threshold" : "",
      bulkCostMode === "clear" ? "cost price" : "",
      bulkSellingMode === "clear" ? "selling price" : "",
    ].filter(Boolean);

  const getBulkDestinationSummary = () =>
    [
      bulkCategoryMode === "set"
        ? `Category: ${
            categories.find((category) => String(category.id) === bulkCategoryId)
              ?.name || "Uncategorized"
          }`
        : bulkCategoryMode === "clear"
          ? "Category: clear value"
          : "",
      bulkDepotMode === "set"
        ? `Depot/location: ${
            formatDepotLabel(
              activeDepots.find((depot) => String(depot.id) === bulkDepotId) ||
                null
            ) || "Unassigned"
          }`
        : bulkDepotMode === "clear"
          ? "Depot/location: clear value"
          : "",
    ].filter(Boolean);

  const applyBulkEdit = async (action: "edit" | "move" = "edit") => {
    if (bulkSubmitting || selectedItems.length === 0) return;

    const changes = getBulkChangeSummary();
    if (changes.length === 0) {
      setBulkError("Choose at least one field to update.");
      return;
    }

    if (!bulkConfirmed) {
      setBulkError("Review the summary and confirm before applying changes.");
      return;
    }

    if (
      bulkUnitEnabled &&
      bulkUnitType === "custom" &&
      !bulkCustomUnitLabel.trim()
    ) {
      setBulkError("Add a custom unit label before applying.");
      return;
    }

    try {
      setBulkSubmitting(true);
      setBulkError("");
      setBulkNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBulkError("Please sign in again before updating inventory.");
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const item of selectedItems) {
        const payload = buildBulkUpdatePayload(item);
        const { data, error } = await supabase
          .from("inventory")
          .update(payload)
          .eq("id", item.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (error || !data) {
          failureCount += 1;
          continue;
        }

        successCount += 1;
        // A bulk action can include items the payload doesn't actually change
        // (setting a depot on items already in it). Don't log those as edits.
        if (
          hasTrackedItemChanges(
            item as unknown as Record<string, unknown>,
            data as Record<string, unknown>
          )
        ) {
          await logInventoryHistory({
            itemId: item.id,
            userId: user.id,
            action: "edited",
            oldQuantity: item.quantity,
            newQuantity: (data as Item).quantity,
            oldValues: item,
            newValues: data,
          });
        }
      }

      await fetchItems();
      setBulkNotice(
        `${action === "move" ? "Moved" : "Updated"} ${successCount} item${successCount === 1 ? "" : "s"}${
          failureCount ? `; ${failureCount} failed` : ""
        }.`
      );
      setPageNotice(
        `${action === "move" ? "Move updated" : "Bulk edit updated"} ${successCount} item${
          successCount === 1 ? "" : "s"
        }.`
      );
      if (!failureCount) setBulkDialogMode(null);
    } catch {
      setBulkError("Something went wrong while updating selected items.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const applyBulkDelete = async () => {
    if (bulkSubmitting || selectedItems.length === 0) return;

    if (!bulkDeleteConfirmed) {
      setBulkError("Confirm that you understand selected items will be deleted.");
      return;
    }

    try {
      setBulkSubmitting(true);
      setBulkError("");
      setBulkNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBulkError("Please sign in again before deleting inventory.");
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const item of selectedItems) {
        await logInventoryHistory({
          itemId: item.id,
          userId: user.id,
          action: "deleted",
          oldQuantity: item.quantity,
          oldValues: item,
        });

        const { error } = await supabase
          .from("inventory")
          .delete()
          .eq("id", item.id)
          .eq("user_id", user.id);

        if (error) failureCount += 1;
        else successCount += 1;
      }

      await fetchItems();
      setSelectedItemIds((current) => {
        const next = new Set(current);
        selectedItems.forEach((item) => next.delete(item.id));
        return next;
      });
      setBulkNotice(
        `Deleted ${successCount} item${successCount === 1 ? "" : "s"}${
          failureCount ? `; ${failureCount} failed` : ""
        }.`
      );
      setPageNotice(
        `Deleted ${successCount} selected item${
          successCount === 1 ? "" : "s"
        }.`
      );
      if (!failureCount) setBulkDialogMode(null);
    } catch {
      setBulkError("Something went wrong while deleting selected items.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const activeDepots = depots.filter((depot) => depot.is_active);
  const bulkChangeSummary = getBulkChangeSummary();
  const bulkClearWarnings = getBulkClearWarnings();
  const bulkDestinationSummary = getBulkDestinationSummary();
  const editDepotOptions = depots.filter(
    (depot) =>
      depot.is_active ||
      (selectedItem?.depot_id && depot.id === selectedItem.depot_id)
  );
  const getDepotForItem = (item: Item) =>
    depots.find((depot) => depot.id === item.depot_id) || null;
  const getSupplierForItem = (item: Item) =>
    suppliers.find((supplier) => supplier.id === item.supplier_id) || null;
  const getCategoryForItem = (item: Item) =>
    categories.find((category) => category.id === item.category_id) || null;
  const getCategoryLabel = (item: Item) =>
    resolveCategoryDisplay(item, getCategoryForItem(item));
  const getLowStockThresholdForItem = (item: Item) =>
    planCapabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          effectiveLowStockThreshold
        )
      : effectiveLowStockThreshold;
  const isItemLowStock = (item: Item) =>
    item.quantity <= getLowStockThresholdForItem(item);
  const getStockStatus = (item: Item) => {
    if (item.quantity <= 0) {
      return { label: "Out of Stock", tone: "danger" as const };
    }

    if (isItemLowStock(item)) {
      return { label: "Low Stock", tone: "warning" as const };
    }

    return { label: "In Stock", tone: "success" as const };
  };
  const normalizedSearch = search.trim().toLowerCase();
  const depotFilterOptions = depots.filter(
    (depot) =>
      depot.is_active || items.some((item) => item.depot_id === depot.id)
  );
  const hasActiveFilters =
    normalizedSearch !== "" ||
    depotFilter !== "all" ||
    categoryFilter !== "all" ||
    stockFilter !== "all" ||
    quickFilter !== "all";
  const activeFilterCount = [
    depotFilter !== "all",
    categoryFilter !== "all",
    stockFilter !== "all",
    quickFilter !== "all",
  ].filter(Boolean).length;
  const activeQuickFilterLabel =
    QUICK_FILTER_OPTIONS.find((option) => option.value === quickFilter)
      ?.label || "Quick filter";
  const activeFilterChips = [
    depotFilter !== "all"
      ? {
          label:
            depotFilter === "unassigned"
              ? "Depot: Unassigned"
              : `Depot: ${formatDepotLabel(
                  depots.find((depot) => String(depot.id) === depotFilter) ||
                    null
                )}`,
          onClear: () => setDepotFilter("all"),
        }
      : null,
    categoryFilter !== "all"
      ? {
          label:
            categoryFilter === "uncategorized"
              ? "Category: Uncategorized"
              : `Category: ${
                  categories.find(
                    (category) => String(category.id) === categoryFilter
                  )?.name || "Selected"
                }`,
          onClear: () => setCategoryFilter("all"),
        }
      : null,
    stockFilter !== "all"
      ? {
          label: "Low stock only",
          onClear: () => setStockFilter("all"),
        }
      : null,
    quickFilter !== "all"
      ? {
          label: `Quick: ${activeQuickFilterLabel}`,
          onClear: () => setQuickFilter("all"),
        }
      : null,
  ].filter(
    (chip): chip is { label: string; onClear: () => void } => Boolean(chip)
  );
  const resetFolderFilters = () => {
    setCategoryFilter("all");
    setDepotFilter("all");
    setStockFilter("all");
    setQuickFilter("all");
  };
  const mobileFolderOptions = [
    {
      key: "all",
      label: "All Items",
      count: items.length,
      icon: "box" as UiIconName,
      active:
        categoryFilter === "all" &&
        depotFilter === "all" &&
        stockFilter === "all" &&
        quickFilter === "all",
      onSelect: resetFolderFilters,
    },
    ...categories.map((category) => ({
      key: `category-${category.id}`,
      label: category.name,
      count: items.filter((item) => item.category_id === category.id).length,
      icon: "categories" as UiIconName,
      active:
        categoryFilter === String(category.id) &&
        stockFilter === "all" &&
        quickFilter === "all",
      onSelect: () => {
        setCategoryFilter(String(category.id));
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("all");
      },
    })),
    {
      key: "uncategorized",
      label: "Uncategorized",
      count: items.filter(
        (item) => !item.category_id && !item.category?.trim()
      ).length,
      icon: "categories" as UiIconName,
      active: categoryFilter === "uncategorized" && quickFilter === "all",
      onSelect: () => {
        setCategoryFilter("uncategorized");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("all");
      },
    },
    {
      key: "low-stock",
      label: "Low Stock",
      count: items.filter((item) => isItemLowStock(item)).length,
      icon: "alert" as UiIconName,
      active: quickFilter === "low-stock" || stockFilter === "low",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("low-stock");
      },
    },
    {
      key: "out-of-stock",
      label: "Out of Stock",
      count: items.filter((item) => Number(item.quantity || 0) <= 0).length,
      icon: "alert" as UiIconName,
      active: quickFilter === "out-of-stock",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("out-of-stock");
      },
    },
    {
      key: "no-image",
      label: "No Image",
      count: items.filter((item) => !item.image?.trim()).length,
      icon: "box" as UiIconName,
      active: quickFilter === "no-image",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("no-image");
      },
    },
    {
      key: "no-price",
      label: "No Price",
      count: items.filter(itemHasNoPrice).length,
      icon: "usage" as UiIconName,
      active: quickFilter === "no-price",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("no-price");
      },
    },
    {
      key: "no-activity",
      label: "No Activity",
      count: items.filter((item) => !movedItemIds.has(item.id)).length,
      icon: "movement" as UiIconName,
      active: quickFilter === "no-activity",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("no-activity");
      },
    },
    {
      key: "unassigned",
      label: "Unassigned",
      count: items.filter((item) => !item.depot_id).length,
      icon: "depots" as UiIconName,
      active: quickFilter === "unassigned" || depotFilter === "unassigned",
      onSelect: () => {
        setCategoryFilter("all");
        setDepotFilter("all");
        setStockFilter("all");
        setQuickFilter("unassigned");
      },
    },
  ];
  const activeMobileFolder =
    mobileFolderOptions.find((folder) => folder.active) ||
    mobileFolderOptions[0];

  const resetInventoryControls = () => {
    setSearch("");
    setDepotFilter("all");
    setCategoryFilter("all");
    setStockFilter("all");
    setQuickFilter("all");
    setSortBy("newest");
  };

  const clearInventoryFilters = () => {
    setDepotFilter("all");
    setCategoryFilter("all");
    setStockFilter("all");
    setQuickFilter("all");
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      const next = !current;
      if (!next) setSelectedItemIds(new Set());
      return next;
    });
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectVisibleItems = () => {
    setSelectionMode(true);
    setSelectedItemIds((current) => {
      const next = new Set(current);
      visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedItemIds(new Set());
    setBulkNotice("");
    setBulkError("");
  };

  const resetBulkDraft = () => {
    setBulkError("");
    setBulkNotice("");
    setBulkConfirmed(false);
    setBulkDeleteConfirmed(false);
    setBulkCategoryMode("keep");
    setBulkCategoryId("");
    setBulkDepotMode("keep");
    setBulkDepotId("");
    setBulkSupplierMode("keep");
    setBulkSupplierId("");
    setBulkUnitEnabled(false);
    setBulkUnitType(DEFAULT_INVENTORY_UNIT_TYPE);
    setBulkCustomUnitLabel("");
    setBulkMinStockMode("keep");
    setBulkMinStockLevel("");
    setBulkCostMode("keep");
    setBulkCostPrice("");
    setBulkSellingMode("keep");
    setBulkSellingPrice("");
    setBulkNotesEnabled(false);
    setBulkNotesMode("append");
    setBulkNotes("");
  };

  const openBulkDialog = (mode: BulkDialogMode) => {
    resetBulkDraft();
    setBulkDialogMode(mode);
  };

  const openQrCenterForItems = (ids: number[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("items", ids.join(","));
    const query = params.toString();
    router.push(`/dashboard/qr-center${query ? `?${query}` : ""}`);
  };

  const openStockCountForItems = (ids: number[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("items", ids.join(","));
    const query = params.toString();
    router.push(`/dashboard/stock-counts${query ? `?${query}` : ""}`);
  };

  const openPickListForItems = (ids: number[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("items", ids.join(","));
    const query = params.toString();
    router.push(`/dashboard/pick-lists${query ? `?${query}` : ""}`);
  };

  const openPurchaseOrderForItems = (ids: number[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("items", ids.join(","));
    params.set("returnTo", "/dashboard/inventory");
    router.push(`/dashboard/purchase-orders/new?${params.toString()}`);
  };

  const openReceivingForItems = (ids: number[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("items", ids.join(","));
    const query = params.toString();
    router.push(`/dashboard/receiving${query ? `?${query}` : ""}`);
  };

  const searchMatchedItems = items.filter((item) => {
    if (!normalizedSearch) return true;

    const depot = getDepotForItem(item);
    const supplier = getSupplierForItem(item);
    const searchableText = [
      item.name,
      item.item_code,
      item.sku,
      item.barcode,
      getCategoryLabel(item),
      item.category,
      item.notes,
      formatDepotLabel(depot),
      depot?.name,
      depot?.code,
      depot?.notes,
      supplier?.name,
      supplier?.contact_name,
      supplier?.phone,
      supplier?.whatsapp,
      supplier?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  const filteredItems = searchMatchedItems.filter((item) => {
    const matchesDepot =
      depotFilter === "all" ||
      (depotFilter === "unassigned" && !item.depot_id) ||
      String(item.depot_id) === depotFilter;
    const matchesStock =
      stockFilter === "all" || isItemLowStock(item);
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "uncategorized" &&
        !item.category_id &&
        !item.category?.trim()) ||
      String(item.category_id) === categoryFilter;

    return matchesDepot && matchesCategory && matchesStock;
  });

  const quickFilteredItems = filteredItems.filter((item) => {
    if (quickFilter === "in-stock")
      return Number(item.quantity || 0) > 0 && !isItemLowStock(item);
    if (quickFilter === "low-stock") return isItemLowStock(item);
    if (quickFilter === "out-of-stock") return Number(item.quantity || 0) <= 0;
    if (quickFilter === "no-image") return !item.image?.trim();
    if (quickFilter === "no-price") return itemHasNoPrice(item);
    if (quickFilter === "no-activity") return !movedItemIds.has(item.id);
    if (quickFilter === "unassigned") return !item.depot_id;
    return true;
  });

  const visibleItems = [...quickFilteredItems].sort((firstItem, secondItem) => {
    if (sortBy === "name-az") {
      return firstItem.name.localeCompare(secondItem.name);
    }

    if (sortBy === "quantity-asc") {
      return firstItem.quantity - secondItem.quantity;
    }

    if (sortBy === "quantity-desc") {
      return secondItem.quantity - firstItem.quantity;
    }

    return secondItem.id - firstItem.id;
  });
  const selectedItems = items.filter((item) => selectedItemIds.has(item.id));
  const visibleSelectedCount = visibleItems.filter((item) =>
    selectedItemIds.has(item.id)
  ).length;
  const hiddenSelectedCount = selectedItems.length - visibleSelectedCount;

  const currentContext = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (depotFilter !== "all") params.set("depot", depotFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (stockFilter !== "all") params.set("stock", stockFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (viewMode !== "grid") params.set("view", viewMode);
    const query = params.toString();
    return `/dashboard/inventory${query ? `?${query}` : ""}`;
  }, [categoryFilter, depotFilter, search, sortBy, stockFilter, viewMode]);

  useEffect(() => {
    if (!inventoryContextReady) return;
    const frame = window.requestAnimationFrame(() => {
      window.history.replaceState({}, "", currentContext);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentContext, inventoryContextReady]);

  const handleSlideOverItemUpdated = async (
    updatedItem: SlideOverInventoryItem
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== updatedItem.id) return item;

        return {
          ...item,
          ...updatedItem,
          category: updatedItem.category || item.category,
          sku: updatedItem.sku || undefined,
          notes: updatedItem.notes || undefined,
        };
      })
    );
    setPageNotice("Stock movement recorded successfully.");
  };

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const exportDisabled = loadingItems || items.length === 0;
  const pdfExportDisabled =
    usageLoading || (canExportPdf && (loadingItems || isExportingPdf));
  const excelExportDisabled =
    usageLoading || (canExportExcel && (exportDisabled || isExportingExcel));
  const totalQuantity = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const lowStockCount = items.filter(isItemLowStock).length;
  const assignedDepotCount = new Set(
    items
      .map((item) => item.depot_id)
      .filter((depotId): depotId is number => typeof depotId === "number")
  ).size;
  const outOfStockCount = items.filter((item) => item.quantity <= 0).length;
  const inventoryStats: Array<{
    icon: UiIconName;
    label: string;
    value: string;
    detail: string;
  }> = [
    {
      icon: "box",
      label: "Items",
      value: items.length.toLocaleString(),
      detail: `${visibleItems.length.toLocaleString()} visible`,
    },
    {
      icon: "layers",
      label: "Stock units",
      value: totalQuantity.toLocaleString(),
      detail: `${assignedDepotCount.toLocaleString()} location${
        assignedDepotCount === 1 ? "" : "s"
      }`,
    },
    {
      icon: "alert",
      label: "Needs attention",
      value: lowStockCount.toLocaleString(),
      detail: `${outOfStockCount.toLocaleString()} out of stock`,
    },
  ];
  const lowStockAlerts = items
    .filter((item) => isItemLowStock(item))
    .sort((first, second) => first.quantity - second.quantity)
    .slice(0, 4);
  const stockByLocation = Array.from(
    items.reduce((locationMap, item) => {
      const label = formatDepotLabel(getDepotForItem(item));
      locationMap.set(label, (locationMap.get(label) || 0) + item.quantity);
      return locationMap;
    }, new Map<string, number>())
  )
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4);
  const stockByCategory = Array.from(
    items.reduce((categoryMap, item) => {
      const label = getCategoryLabel(item);
      categoryMap.set(label, (categoryMap.get(label) || 0) + item.quantity);
      return categoryMap;
    }, new Map<string, number>())
  )
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4);
  const pdfScopeItemCount = getPdfScopeItems(pdfSettings.scope).length;
  const canSelectPdfScope = selectedItems.length > 0;
  const businessLogoAvailable = Boolean(
    businessSettings.business_logo_url && planCapabilities.customBusinessLogo
  );
  const pdfReportTypeOptions: {
    value: InventoryPdfReportType;
    label: string;
  }[] = [
    { value: "summary", label: "Inventory Summary" },
    { value: "detailed", label: "Detailed Inventory" },
    { value: "low-stock", label: "Low Stock Report" },
    { value: "valuation", label: "Inventory Valuation" },
  ];

  const renderItemActionMenu = (
    item: Item,
    menuClassName =
      "inventory-floating-menu z-[120] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
  ) => (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <InventoryActionMenu
        label="More"
        buttonClassName="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-theme bg-theme-surface px-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20"
        menuClassName={menuClassName}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => setDetailsItem({ id: item.id, tab: "details" })}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="file" className="h-4 w-4" />
          View details
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => setMovementItem(item)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="movement" className="h-4 w-4" />
          Adjust stock
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => setAlertLevelItem(item)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="alert" className="h-4 w-4" />
          Set alert level
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => openEditModal(item)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="appearance" className="h-4 w-4" />
          Edit
        </button>
        <div className="my-1 border-t border-slate-200" />
        <button
          type="button"
          role="menuitem"
          onClick={() => setDetailsItem({ id: item.id, tab: "activity" })}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="clock" className="h-4 w-4" />
          Activity
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => openQrCenterForItems([item.id])}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="qr" className="h-4 w-4" />
          Create QR / Label
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => openPurchaseOrderForItems([item.id])}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
        >
          <UiIcon name="file" className="h-4 w-4" />
          Create purchase order
        </button>
        <div className="my-1 border-t border-slate-200" />
        <button
          type="button"
          role="menuitem"
          onClick={() => setPendingDeleteItem(item)}
          disabled={deletingId === item.id}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UiIcon name="trash" className="h-4 w-4" />
          {deletingId === item.id ? "Deleting..." : "Delete"}
        </button>
      </InventoryActionMenu>
    </div>
  );

  return (
    <div className="contents">
      <main className="min-w-0 overflow-x-clip">
        <div
          className={`inventory-workspace mx-auto flex w-full max-w-[1600px] flex-col gap-2.5 pt-1 ${
            showStats ? "" : "inventory-workspace-summary-hidden"
          } ${
            selectionMode ? "pb-36 sm:pb-0" : ""
          }`}
        >
          <section className="inventory-hero-card inventory-mobile-header-card">
            <div className="inventory-hero-top">
              <div className="inventory-hero-title-block">
                <p className="inventory-mobile-kicker inventory-hero-kicker">
                  {businessSettings.business_name}
                </p>

                <h1 className="inventory-mobile-title inventory-hero-title">
                  Inventory
                </h1>

                <p className="inventory-mobile-description inventory-hero-description">
                  {loadingItems
                    ? "Loading inventory..."
                    : `Manage ${items.length.toLocaleString()} item${
                        items.length === 1 ? "" : "s"
                      }, stock levels, and locations from one clean workspace.`}
                </p>
                <div className="inventory-hero-badges" aria-label="Current inventory view">
                  <span>{visibleItems.length.toLocaleString()} visible</span>
                  <span>{currentPlanName} plan</span>
                  {hasActiveFilters && (
                    <span>{activeFilterCount} active filters</span>
                  )}
                </div>
              </div>

              <div className="inventory-page-actions inventory-hero-actions">
                <ActionButton
                  href="/dashboard/add-item"
                  icon="plus"
                  className="inventory-action-primary"
                >
                  Add Item
                </ActionButton>

                <ActionButton
                  onClick={openScanner}
                  disabled={usageLoading}
                  icon={!usageLoading && canUseScanner ? "scan" : undefined}
                  variant="secondary"
                  className={`inventory-action-secondary ${
                    canUseScanner
                      ? ""
                      : "border-sky-300/15 bg-theme-surface text-theme-muted"
                  }`}
                >
                  {!usageLoading && !canUseScanner ? (
                    <LockedActionLabel>Scan</LockedActionLabel>
                  ) : (
                    "Scan"
                  )}
                </ActionButton>

                <InventoryActionMenu
                  label="More inventory actions"
                  labelHidden
                  buttonClassName="dashboard-action-button dashboard-action-button-secondary inventory-action-secondary inventory-action-more"
                >
                    <Link
                      href="/dashboard/inventory/import"
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"
                    >
                      <UiIcon name="upload" className="h-4 w-4" />
                      {!usageLoading && !planCapabilities.csvExcelImport ? (
                        <LockedActionLabel>Import</LockedActionLabel>
                      ) : (
                        "Import inventory"
                      )}
                    </Link>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => exportInventoryCsv()}
                      disabled={exportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="file" className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        openPdfSettings(hasActiveFilters ? "filtered" : "all")
                      }
                      disabled={pdfExportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="download" className="h-4 w-4" />
                      {!usageLoading && !canExportPdf
                        ? "Export PDF (locked)"
                        : isExportingPdf
                          ? "Exporting PDF..."
                          : "Export PDF"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void exportInventoryReportExcel()}
                      disabled={excelExportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="sheet" className="h-4 w-4" />
                      {!usageLoading && !canExportExcel
                        ? "Export Excel (locked)"
                        : isExportingExcel
                          ? "Exporting Excel..."
                          : "Export Excel"}
                    </button>
                    <div className="my-1 border-t border-slate-200" />
                    <Link
                      href="/dashboard/import-export"
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"
                    >
                      <UiIcon name="clock" className="h-4 w-4" />
                      Import &amp; export history
                    </Link>
                </InventoryActionMenu>
              </div>
            </div>

            <div className="inventory-mobile-breadcrumb" aria-live="polite">
              Items{activeMobileFolder?.label ? ` / ${activeMobileFolder.label}` : ""}
            </div>

            <div className="inventory-mobile-folder-strip" aria-label="Inventory folders">
              {mobileFolderOptions.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  onClick={folder.onSelect}
                  aria-pressed={folder.active}
                  className={`inventory-mobile-folder ${
                    folder.active ? "inventory-mobile-folder-active" : ""
                  }`}
                >
                  <span className="inventory-mobile-folder-icon">
                    <UiIcon name={folder.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="inventory-mobile-folder-name">
                      {folder.label}
                    </span>
                    <span className="inventory-mobile-folder-count">
                      {folder.count.toLocaleString()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {showStats && (
            <section
              aria-label="Inventory summary"
              className="inventory-stat-grid"
            >
              {inventoryStats.map((stat) => (
                <MetricCard
                  key={stat.label}
                  icon={stat.icon}
                  label={stat.label}
                  value={loadingItems ? "--" : stat.value}
                  detail={loadingItems ? "Loading..." : stat.detail}
                />
              ))}
            </section>
          )}

          {(pageNotice || pageError) && (
            <DashboardNotice tone={pageError ? "danger" : "success"}>
              {pageError || pageNotice}
            </DashboardNotice>
          )}

          <section className="inventory-toolbar-panel">
            <div className="inventory-toolbar-stack">
              <div className="inventory-toolbar-main">
                <div className="inventory-toolbar-search">
                  <label htmlFor="inventory-search" className="sr-only">
                    Search inventory
                  </label>
                  <div className="relative">
                    <UiIcon
                      name="search"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
                    />

                    <input
                      id="inventory-search"
                      type="text"
                      placeholder="Search items, SKU, barcode, depot..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="inventory-search-input"
                    />
                  </div>
                </div>

                <div className="inventory-toolbar-actions">
                  <button
                    type="button"
                    onClick={toggleFiltersOpen}
                    aria-expanded={filtersOpen}
                    className={`inventory-toolbar-button ${
                      hasActiveFilters
                        ? "inventory-toolbar-button-active"
                        : ""
                    }`}
                  >
                    <UiIcon name="settings" className="h-4 w-4" />
                    Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={toggleShowStats}
                    aria-pressed={!showStats}
                    className="inventory-toolbar-button"
                    title={
                      showStats
                        ? "Hide the stats and insights for a bigger item view"
                        : "Show the stats and insights"
                    }
                  >
                    <UiIcon
                      name={showStats ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                    {showStats ? "Compact" : "Stats"}
                  </button>
                  <Select
                    ariaLabel="Sort"
                    value={sortBy}
                    onChange={(value) => setSortBy(value as SortOption)}
                    buttonClassName={SORT_SELECT_BUTTON_CLASS}
                    options={[
                      { value: "newest", label: "Newest" },
                      { value: "name-az", label: "Name A-Z" },
                      {
                        value: "quantity-asc",
                        label: "Quantity: low to high",
                      },
                      {
                        value: "quantity-desc",
                        label: "Quantity: high to low",
                      },
                    ]}
                  />
                  <Select
                    ariaLabel="View"
                    value={viewMode}
                    onChange={(value) => setViewMode(value as ViewMode)}
                    buttonClassName={COMPACT_SELECT_BUTTON_CLASS}
                    options={[
                      { value: "grid", label: "Grid view" },
                      { value: "list", label: "List view" },
                      { value: "table", label: "Table view" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    className="inventory-toolbar-button"
                  >
                    <UiIcon name="check" className="h-4 w-4" />
                    {selectionMode ? "Exit selection" : "Select items"}
                  </button>
                </div>
              </div>

              <div className="inventory-toolbar-secondary">
                <div className="inventory-toolbar-chips">
                  <FilterBar
                    label="Quick inventory filters"
                    className="inventory-quick-filters"
                  >
                    {QUICK_FILTER_OPTIONS.map((option) => {
                      const active = quickFilter === option.value;

                      return (
                        <FilterChip
                          key={option.value}
                          onClick={() => setQuickFilter(option.value)}
                          active={active}
                          className="inventory-quick-filter"
                        >
                          {option.label}
                        </FilterChip>
                      );
                    })}
                  </FilterBar>

                  {activeFilterChips.length > 0 && (
                  <div className="inventory-active-chips">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={chip.onClear}
                        className="inventory-active-chip"
                      >
                        {chip.label}
                        <UiIcon name="close" className="h-3 w-3" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={resetInventoryControls}
                      className="inventory-clear-chips"
                    >
                      Clear all
                    </button>
                  </div>
                  )}
                </div>

                <p className="inventory-toolbar-count">
                  Showing {visibleItems.length} of {items.length} items
                </p>
              </div>

              {filtersOpen && (
              <div className="inventory-filter-panel grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <Select
                    ariaLabel="Depot"
                    value={depotFilter}
                    onChange={setDepotFilter}
                    searchable={depotFilterOptions.length > 8}
                    buttonClassName={COMPACT_SELECT_BUTTON_CLASS}
                    options={[
                      { value: "all", label: "All depots" },
                      { value: "unassigned", label: "Unassigned" },
                      ...depotFilterOptions.map((depot) => ({
                        value: String(depot.id),
                        label: formatDepotLabel(depot),
                      })),
                    ]}
                  />
                </div>

                <div>
                  <Select
                    ariaLabel="Category"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    searchable={categories.length > 8}
                    buttonClassName={COMPACT_SELECT_BUTTON_CLASS}
                    options={[
                      { value: "all", label: "All categories" },
                      { value: "uncategorized", label: "Uncategorized" },
                      ...categories.map((category) => ({
                        value: String(category.id),
                        label: category.name,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <Select
                    ariaLabel="Stock"
                    value={stockFilter}
                    onChange={(value) => setStockFilter(value as StockFilter)}
                    buttonClassName={COMPACT_SELECT_BUTTON_CLASS}
                    options={[
                      { value: "all", label: "All stock" },
                      { value: "low", label: "Low stock only" },
                    ]}
                  />
                </div>

                <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={clearInventoryFilters}
                    disabled={!activeFilterCount}
                    className="min-h-10 flex-1 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="min-h-10 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-black transition hover:bg-slate-200 sm:flex-none"
                  >
                    Apply
                  </button>
                </div>
              </div>
              )}
            </div>
          </section>

          {selectionMode && (
            <section
              className="inventory-selection-bar fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-cyan-300/25 bg-theme-surface p-2.5 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:top-2 sm:bottom-auto sm:z-20 sm:shadow-[0_12px_30px_rgba(15,23,42,0.1)]"
              aria-live="polite"
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rounded-xl bg-cyan-500/10 px-3 py-1.5 text-sm font-black text-theme-accent">
                    <span className="sr-only">Selected inventory item count: </span>
                    {selectedItems.length} selected
                  </p>
                  {hiddenSelectedCount > 0 && (
                    <p className="text-xs font-semibold text-theme-subtle">
                      {hiddenSelectedCount} hidden by filters
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={selectVisibleItems}
                    className="rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Select visible
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    className="rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Exit selection
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openBulkDialog("edit")}
                    disabled={selectedItems.length === 0}
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Bulk edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openBulkDialog("move")}
                    disabled={selectedItems.length === 0}
                    className="rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openQrCenterForItems(selectedItems.map((item) => item.id))
                    }
                    disabled={selectedItems.length === 0}
                    className="rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                  >
                    Create labels
                  </button>
                  <InventoryActionMenu
                    label="More"
                    buttonClassName="inline-flex items-center gap-2 rounded-xl border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                    menuClassName="absolute bottom-full right-0 z-50 mb-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.16)] sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2"
                  >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => exportInventoryCsv(selectedItems)}
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Export selected CSV
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openPdfSettings("selected")}
                        disabled={selectedItems.length === 0 || isExportingPdf}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Export selected PDF
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void exportInventoryReportExcel(selectedItems)}
                        disabled={selectedItems.length === 0 || isExportingExcel}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                          Export selected Excel
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          openStockCountForItems(
                            selectedItems.map((item) => item.id)
                          )
                        }
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Count selected
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          openPickListForItems(
                            selectedItems.map((item) => item.id)
                          )
                        }
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Create pick list
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          openPurchaseOrderForItems(
                            selectedItems.map((item) => item.id)
                          )
                        }
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Create purchase order
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          openReceivingForItems(
                            selectedItems.map((item) => item.id)
                          )
                        }
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Receive stock
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={clearSelection}
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Clear selection
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openBulkDialog("delete")}
                        disabled={selectedItems.length === 0}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                          Delete selected
                      </button>
                  </InventoryActionMenu>
                </div>
              </div>
            </section>
          )}

          <div
            className={`inventory-content-grid ${
              showStats ? "" : "inventory-content-grid-summary-hidden"
            }`}
          >
            <section className="min-w-0 space-y-2.5" aria-label="Inventory items">
          {/* Items */}
          {loadingItems ? (
            <LoadingSkeletonGroup
              count={6}
              className="inventory-items-grid"
              itemClassName="inventory-item-skeleton"
            />
          ) : viewMode === "grid" ? (
            <div className="inventory-items-grid">
              {visibleItems.map((item) => {
                const status = getStockStatus(item);
                const itemValue =
                  calculateInventoryValue(item.quantity, item.selling_price) ??
                  calculateInventoryValue(item.quantity, item.cost_price);

                return (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    itemCode={item.item_code || item.barcode}
                    quantityLabel={getInventoryQuantityLabel(
                      item.quantity,
                      item.unit_type,
                      item.custom_unit_label
                    )}
                    categoryLabel={getCategoryLabel(item)}
                    depotLabel={
                      getDepotForItem(item)
                        ? formatDepotLabel(getDepotForItem(item))
                        : null
                    }
                    supplierLabel={getSupplierForItem(item)?.name || null}
                    valueLabel={
                      itemValue === null
                        ? null
                        : formatCompactCurrency(itemValue, editCurrencyCode)
                    }
                    lowStock={isItemLowStock(item)}
                    stockStatusLabel={status.label}
                    stockStatusTone={status.tone}
                    deleting={deletingId === item.id}
                    selectable={selectionMode}
                    selected={selectedItemIds.has(item.id)}
                    onToggleSelected={() => toggleItemSelection(item.id)}
                    onOpenDetails={() =>
                      setDetailsItem({ id: item.id, tab: "details" })
                    }
                    onHistory={() =>
                      setDetailsItem({ id: item.id, tab: "activity" })
                    }
                    onCreateQrLabel={() => openQrCenterForItems([item.id])}
                    onAdjust={() => setMovementItem(item)}
                    onSetAlertLevel={() => setAlertLevelItem(item)}
                    onEdit={() => openEditModal(item)}
                    onDelete={() => setPendingDeleteItem(item)}
                    detailsHref={`/dashboard/inventory/${item.id}?returnTo=${encodeURIComponent(
                      currentContext
                    )}`}
                  />
                );
              })}
            </div>
          ) : viewMode === "list" ? (
            <div className="inventory-list">
              {visibleItems.map((item) => {
                const selected = selectedItemIds.has(item.id);
                const quantityLabel = getInventoryQuantityLabel(
                  item.quantity,
                  item.unit_type,
                  item.custom_unit_label
                );
                const depot = getDepotForItem(item);
                const supplier = getSupplierForItem(item);
                const status = getStockStatus(item);

                return (
                  <div
                    key={item.id}
                    role={selectionMode ? "checkbox" : "button"}
                    tabIndex={0}
                    aria-checked={selectionMode ? selected : undefined}
                    aria-label={`${selectionMode ? "Select" : "View"} ${item.name}`}
                    onClick={() =>
                      selectionMode
                        ? toggleItemSelection(item.id)
                        : setDetailsItem({ id: item.id, tab: "details" })
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (selectionMode) {
                        toggleItemSelection(item.id);
                        return;
                      }
                      setDetailsItem({ id: item.id, tab: "details" });
                    }}
                    /* The thumbnail track must match the thumbnail: it was
                       2.5rem/2.75rem holding a 3rem/3.5rem image, so the image
                       overran its column by 8px (mobile) / 12px (desktop) and
                       sat on top of the first characters of the name and SKU. */
                    className={`inventory-list-row grid cursor-pointer grid-cols-[auto_3rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border bg-theme-surface p-2 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20 sm:grid-cols-[auto_3.5rem_minmax(0,1fr)_auto] ${
                      selected
                        ? "border-cyan-300 bg-cyan-500/[0.08] ring-2 ring-cyan-300/30"
                        : "border-theme"
                    }`}
                  >
                    {selectionMode ? (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleItemSelection(item.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`${selected ? "Deselect" : "Select"} ${item.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                      />
                    ) : (
                      <span className="h-4 w-4" aria-hidden="true" />
                    )}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-black/5 sm:h-14 sm:w-14">
                      {/* `cover` crops to the centre, which turns a wide product
                          logo into a meaningless middle slice. `contain` shows
                          the whole image — these are labels and logos, not
                          photography that can be cropped freely. */}
                      <InventoryThumbnail
                        src={item.image}
                        alt=""
                        imgClassName="object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-theme-primary" title={item.name}>
                          {item.name}
                        </p>
                        {status.tone !== "success" && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              status.tone === "danger"
                                ? "border-red-200 bg-red-50 text-red-600"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {status.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs font-semibold text-theme-muted">
                        {[item.item_code || item.sku, getCategoryLabel(item), depot ? formatDepotLabel(depot) : "", supplier?.name]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>
                    <div className="inventory-list-actions flex items-center justify-between gap-2 sm:justify-end">
                      <span className="inventory-list-quantity rounded-lg border border-theme bg-theme-inset px-2.5 py-1 text-xs font-black text-theme-primary">
                        {quantityLabel}
                      </span>
                      {renderItemActionMenu(item)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid gap-2 md:hidden">
                {visibleItems.map((item) => {
                  const selected = selectedItemIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      role={selectionMode ? "checkbox" : "button"}
                      tabIndex={0}
                      aria-checked={selectionMode ? selected : undefined}
                      onClick={() =>
                        selectionMode
                          ? toggleItemSelection(item.id)
                          : setDetailsItem({ id: item.id, tab: "details" })
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        if (selectionMode) {
                          toggleItemSelection(item.id);
                          return;
                        }
                        setDetailsItem({ id: item.id, tab: "details" });
                      }}
                      className={`flex items-center gap-2.5 rounded-2xl border bg-theme-surface p-2.5 text-left ${
                        selected
                          ? "border-cyan-300 bg-cyan-500/[0.08]"
                          : "border-theme"
                      }`}
                    >
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleItemSelection(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${selected ? "Deselect" : "Select"} ${item.name}`}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-theme-primary">
                          {item.name}
                        </span>
                        <span className="block truncate text-xs font-semibold text-theme-muted">
                          {getCategoryLabel(item)}
                        </span>
                      </span>
                      <span className="text-xs font-black text-theme-primary">
                        {getInventoryQuantityLabel(
                          item.quantity,
                          item.unit_type,
                          item.custom_unit_label
                        )}
                      </span>
                      {renderItemActionMenu(item)}
                    </div>
                  );
                })}
              </div>
              <div className="inventory-table-shell hidden overflow-hidden rounded-2xl border border-theme bg-theme-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:block">
                <div className="inventory-table-scroll">
                  <table className="inventory-table table-fixed text-left text-sm">
                    <thead className="border-b border-theme bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                      <tr>
                        <th className="w-10 px-3 py-2.5">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="px-3 py-2.5">Item</th>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Depot</th>
                        <th className="px-3 py-2.5 text-right">Stock</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Value</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-divider)]">
                      {visibleItems.map((item) => {
                        const selected = selectedItemIds.has(item.id);
                        const depot = getDepotForItem(item);
                        const status = getStockStatus(item);
                        const itemValue =
                          calculateInventoryValue(
                            item.quantity,
                            item.selling_price
                          ) ??
                          calculateInventoryValue(item.quantity, item.cost_price);
                        return (
                          <tr
                            key={item.id}
                            tabIndex={0}
                            aria-selected={selectionMode ? selected : undefined}
                            onClick={() =>
                              selectionMode
                                ? toggleItemSelection(item.id)
                                : setDetailsItem({ id: item.id, tab: "details" })
                            }
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              if (selectionMode) {
                                toggleItemSelection(item.id);
                                return;
                              }
                              setDetailsItem({ id: item.id, tab: "details" });
                            }}
                            className={`cursor-pointer transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20 ${
                              selected ? "bg-cyan-500/[0.08]" : ""
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              {selectionMode && (
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleItemSelection(item.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label={`${selected ? "Deselect" : "Select"} ${item.name}`}
                                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2.5">
                                {/* `contain` on white, matching grid and list:
                                    cropping a wide logo to its centre makes the
                                    thumbnail useless for recognising the item. */}
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-black/5">
                                  <InventoryThumbnail
                                    src={item.image}
                                    alt=""
                                    imgClassName="object-contain"
                                    iconClassName="h-4 w-4"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-black text-theme-primary [overflow-wrap:anywhere]" title={item.name}>
                                    {item.name}
                                  </p>
                                  {/* Only show the barcode line when there is a
                                      barcode. It used to fall back to the words
                                      "Inventory item", which printed on every
                                      row of a table that is entirely inventory
                                      items — a line of noise per row. */}
                                  {item.barcode && (
                                    <p className="text-xs font-semibold text-theme-muted [overflow-wrap:anywhere]">
                                      {item.barcode}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-theme-secondary">
                              <span
                                className="block [overflow-wrap:anywhere]"
                                title={
                                  item.item_code ||
                                  item.sku ||
                                  item.barcode ||
                                  "No code"
                                }
                              >
                                {item.item_code ||
                                  item.sku ||
                                  item.barcode ||
                                  "No code"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-theme-secondary">
                              {getCategoryLabel(item)}
                            </td>
                            <td className="px-3 py-2.5 text-theme-secondary">
                              {depot ? formatDepotLabel(depot) : "Unassigned"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-black text-theme-primary">
                              {getInventoryQuantityLabel(
                                item.quantity,
                                item.unit_type,
                                item.custom_unit_label
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  status.tone === "danger"
                                    ? "border-red-200 bg-red-50 text-red-600"
                                    : status.tone === "warning"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-black text-theme-primary">
                              {itemValue === null
                                ? "--"
                                : formatCompactCurrency(
                                    itemValue,
                                    editCurrencyCode
                                  )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {renderItemActionMenu(item)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {!loadingItems && visibleItems.length ===
            0 && (
            <DashboardEmptyState
              icon={items.length === 0 ? "box" : "search"}
              title={items.length === 0 ? "No inventory items yet" : "No items found"}
              description={
                items.length === 0
                  ? "Add an item, import a file, or scan a code to start building your inventory workspace."
                  : "No products match the current search or filters."
              }
              action={
                items.length === 0 ? (
                  <div className="inventory-empty-actions">
                    <ActionButton href="/dashboard/add-item" icon="plus">
                      Add Item
                    </ActionButton>
                    <ActionButton
                      href="/dashboard/inventory/import"
                      icon="upload"
                      variant="secondary"
                    >
                      {!usageLoading && !planCapabilities.csvExcelImport ? (
                        <LockedActionLabel>Import</LockedActionLabel>
                      ) : (
                        "Import Inventory"
                      )}
                    </ActionButton>
                    <ActionButton
                      onClick={openScanner}
                      disabled={usageLoading}
                      icon={!usageLoading && canUseScanner ? "scan" : undefined}
                      variant="secondary"
                    >
                      {!usageLoading && !canUseScanner ? (
                        <LockedActionLabel>Scan</LockedActionLabel>
                      ) : (
                        "Scan item"
                      )}
                    </ActionButton>
                  </div>
                ) : (
                  <ActionButton onClick={resetInventoryControls} variant="secondary">
                    Clear filters
                  </ActionButton>
                )
              }
            />
          )}
            </section>

            {showStats && (
            <aside className="inventory-insights-rail" aria-label="Inventory insights">
              <section className="inventory-insight-card">
                <div className="inventory-insight-card-header">
                  <span>
                    <UiIcon name="alert" className="h-4 w-4" />
                    Low Stock Alerts
                  </span>
                  <strong>{lowStockCount.toLocaleString()}</strong>
                </div>
                {lowStockAlerts.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    {lowStockAlerts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setDetailsItem({ id: item.id, tab: "alerts" })
                        }
                        className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-theme bg-theme-inset px-3 py-2 text-left transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-theme-primary">
                            {item.name}
                          </span>
                          <span className="block text-[11px] font-semibold text-theme-muted">
                            Reorder at {getLowStockThresholdForItem(item)}
                          </span>
                        </span>
                        <span className="text-xs font-black text-theme-danger">
                          {item.quantity}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    All stocked
                  </p>
                )}
              </section>

              <section className="inventory-insight-card">
                <div className="inventory-insight-card-header">
                  <span>
                    <UiIcon name="depots" className="h-4 w-4" />
                    Stock by Location
                  </span>
                </div>
                <div className="mt-2 grid gap-2">
                  {(stockByLocation.length > 0
                    ? stockByLocation
                    : [["Unassigned", 0] as [string, number]]
                  ).map(([label, quantity]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate font-bold text-theme-secondary">
                        {label}
                      </span>
                      <strong className="shrink-0 text-theme-primary">
                        {quantity.toLocaleString()}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="inventory-insight-card">
                <div className="inventory-insight-card-header">
                  <span>
                    <UiIcon name="categories" className="h-4 w-4" />
                    Stock by Category
                  </span>
                </div>
                <div className="mt-2 grid gap-2">
                  {(stockByCategory.length > 0
                    ? stockByCategory
                    : [["Uncategorized", 0] as [string, number]]
                  ).map(([label, quantity]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate font-bold text-theme-secondary">
                        {label}
                      </span>
                      <strong className="shrink-0 text-theme-primary">
                        {quantity.toLocaleString()}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="inventory-insight-card">
                <div className="inventory-insight-card-header">
                  <span>
                    <UiIcon name="usage" className="h-4 w-4" />
                    Stock Health
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                      Out
                    </span>
                    <strong className="text-base text-theme-danger">
                      {outOfStockCount.toLocaleString()}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                      Healthy
                    </span>
                    <strong className="text-base text-theme-primary">
                      {Math.max(
                        0,
                        items.length - lowStockCount
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </section>
            </aside>
            )}
          </div>
        </div>
      </main>

      <ScannerModal
        open={isScannerOpen}
        onClose={closeScanner}
        onDecode={handleScannedText}
      />

      <UpgradeDialog
        open={Boolean(lockedFeature)}
        onClose={() => setLockedFeature(null)}
        feature={lockedFeature?.feature || ""}
        benefit={lockedFeature?.benefit || ""}
        currentPlan={currentPlanName}
        requiredPlan={lockedFeature?.requiredPlan || "Standard"}
        source={lockedFeature?.source || "inventory"}
      />

      {isPdfSettingsOpen && (
        <DialogShell
          title="Export inventory PDF"
          eyebrow="Business report"
          description="Choose the report format, scope, branding, and fields for this PDF."
          onClose={() => {
            if (!isExportingPdf) setIsPdfSettingsOpen(false);
          }}
          closeDisabled={isExportingPdf}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setIsPdfSettingsOpen(false)}
                disabled={isExportingPdf}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void exportInventoryReportPdf()}
                disabled={
                  isExportingPdf ||
                  (pdfSettings.scope === "selected" && !canSelectPdfScope)
                }
                loading={isExportingPdf}
                loadingLabel="Generating..."
              >
                Generate PDF
              </Button>
            </>
          }
        >
          <div className="grid gap-4" aria-live="polite">
            {pdfExportStatus && (
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-theme-accent">
                {pdfExportStatus}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Report type
                <Select
                  value={pdfSettings.reportType}
                  onChange={(value) =>
                    setPdfSettings((current) => ({
                      ...current,
                      reportType: value as InventoryPdfReportType,
                    }))
                  }
                  options={pdfReportTypeOptions}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Scope
                <Select
                  value={pdfSettings.scope}
                  onChange={(value) => {
                    if (value === "selected" && !canSelectPdfScope) {
                      setPdfExportStatus(
                        "Select one or more items before using selected-items scope."
                      );
                      return;
                    }

                    setPdfSettings((current) => ({
                      ...current,
                      scope: value as InventoryPdfScope,
                    }));
                    setPdfExportStatus("");
                  }}
                  options={[
                    { value: "all", label: `All inventory (${items.length})` },
                    {
                      value: "filtered",
                      label: `Current filters (${visibleItems.length})`,
                    },
                    ...(canSelectPdfScope
                      ? [
                          {
                            value: "selected",
                            label: `Selected items (${selectedItems.length})`,
                          },
                        ]
                      : []),
                  ]}
                />
                <span className="text-xs font-semibold text-theme-subtle">
                  {pdfScopeItemCount} item
                  {pdfScopeItemCount === 1 ? "" : "s"} in this export
                </span>
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Group by
                <Select
                  value={pdfSettings.groupBy}
                  onChange={(value) =>
                    setPdfSettings((current) => ({
                      ...current,
                      groupBy: value as InventoryPdfGroupBy,
                    }))
                  }
                  options={[
                    { value: "none", label: "None" },
                    { value: "category", label: "Category" },
                    { value: "depot", label: "Depot / location" },
                  ]}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Branding
                <Select
                  value={pdfSettings.brandingMode}
                  onChange={(value) =>
                    setPdfSettings((current) => ({
                      ...current,
                      brandingMode: value as InventoryPdfBrandingMode,
                    }))
                  }
                  options={[
                    {
                      value: "business",
                      label: businessLogoAvailable
                        ? "Business logo"
                        : "Business logo (falls back to SydIN)",
                    },
                    { value: "sydin", label: "SydIN logo" },
                    { value: "none", label: "No logo" },
                  ]}
                />
              </label>
            </div>

            <fieldset className="rounded-2xl border border-theme bg-theme-inset p-3">
              <legend className="px-1 text-sm font-black text-theme-primary">
                Include
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["images", "Product images"],
                    ["sku", "SKU / item code"],
                    ["barcode", "Barcode"],
                    ["category", "Category"],
                    ["depot", "Depot / location"],
                    ["supplier", "Supplier"],
                    ["minStock", "Minimum stock"],
                    ["pricing", "Pricing"],
                    ["notes", "Notes"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-sm font-semibold text-theme-primary"
                  >
                    <input
                      type="checkbox"
                      checked={pdfSettings.include[key]}
                      onChange={(event) =>
                        updatePdfInclude(key, event.target.checked)
                      }
                      className="h-4 w-4 accent-cyan-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="text-xs leading-5 text-theme-subtle">
              Name, image, SKU, barcode, prices, quantity, category, depot,
              supplier, notes, and stock status come from the loaded inventory
              dataset. Internal private IDs are not printed.
            </p>
          </div>
        </DialogShell>
      )}

      {bulkDialogMode === "edit" && (
        <DialogShell
          title="Bulk edit selected items"
          eyebrow="Safe bulk edit"
          description={`${selectedItems.length} selected item${
            selectedItems.length === 1 ? "" : "s"
          }. Only enabled fields will change.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkDialogMode(null);
          }}
          closeDisabled={bulkSubmitting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setBulkDialogMode(null)}
                disabled={bulkSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void applyBulkEdit()}
                disabled={
                  bulkSubmitting ||
                  selectedItems.length === 0 ||
                  !bulkConfirmed
                }
                loading={bulkSubmitting}
                loadingLabel="Applying..."
              >
                Apply Changes
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            {bulkError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {bulkError}
              </div>
            )}
            {bulkNotice && (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-theme-success">
                {bulkNotice}
              </div>
            )}

            <div className="rounded-2xl border border-theme bg-theme-inset p-3 text-sm text-theme-secondary">
              <p className="font-black text-theme-primary">
                Review before applying
              </p>
              <p className="mt-1">
                {selectedItems.length} selected item
                {selectedItems.length === 1 ? "" : "s"} will be updated.
              </p>
              <p className="mt-2 font-semibold">
                Changes:{" "}
                {bulkChangeSummary.length > 0
                  ? bulkChangeSummary.join(", ")
                  : "Choose fields below"}
              </p>
              {bulkClearWarnings.length > 0 && (
                <p className="mt-2 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                  Clearing: {bulkClearWarnings.join(", ")}.
                </p>
              )}
              <label className="mt-3 flex items-start gap-2 text-xs font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkConfirmed}
                  onChange={(event) => setBulkConfirmed(event.target.checked)}
                  disabled={bulkSubmitting || bulkChangeSummary.length === 0}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                />
                Confirm these enabled fields should change for the selected
                items.
              </label>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkCategoryMode !== "keep"}
                  onChange={(event) =>
                    setBulkCategoryMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change category
              </label>
              {bulkCategoryMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkCategoryMode}
                    onChange={(value) =>
                      setBulkCategoryMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkCategoryMode === "set" && (
                    <CategorySelector
                      categories={categories}
                      value={bulkCategoryId}
                      onChange={setBulkCategoryId}
                      disabled={bulkSubmitting}
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkDepotMode !== "keep"}
                  onChange={(event) =>
                    setBulkDepotMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change depot/location
              </label>
              {bulkDepotMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkDepotMode}
                    onChange={(value) =>
                      setBulkDepotMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkDepotMode === "set" && (
                    <Select
                      value={bulkDepotId}
                      onChange={setBulkDepotId}
                      placeholder="Unassigned"
                      searchable={activeDepots.length > 8}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...activeDepots.map((depot) => ({
                          value: String(depot.id),
                          label: formatDepotLabel(depot),
                        })),
                      ]}
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkSupplierMode !== "keep"}
                  onChange={(event) =>
                    setBulkSupplierMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change supplier
              </label>
              {bulkSupplierMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkSupplierMode}
                    onChange={(value) =>
                      setBulkSupplierMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkSupplierMode === "set" && (
                    <Select
                      value={bulkSupplierId}
                      onChange={setBulkSupplierId}
                      placeholder="No supplier"
                      searchable={suppliers.length > 8}
                      options={[
                        { value: "", label: "No supplier" },
                        ...suppliers.map((supplier) => ({
                          value: String(supplier.id),
                          label: supplier.name,
                        })),
                      ]}
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkUnitEnabled}
                  onChange={(event) => setBulkUnitEnabled(event.target.checked)}
                />
                Change unit
              </label>
              {bulkUnitEnabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={bulkUnitType}
                    onChange={(value) =>
                      setBulkUnitType(value as InventoryUnitType)
                    }
                    options={INVENTORY_UNIT_TYPES.map((unit) => ({
                      value: unit,
                      label: INVENTORY_UNIT_LABELS[unit],
                    }))}
                  />
                  {bulkUnitType === "custom" && (
                    <input
                      type="text"
                      value={bulkCustomUnitLabel}
                      onChange={(event) =>
                        setBulkCustomUnitLabel(event.target.value)
                      }
                      placeholder="Custom unit label"
                      className="quick-add-input"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkMinStockMode !== "keep"}
                  onChange={(event) =>
                    setBulkMinStockMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change minimum stock threshold
              </label>
              {bulkMinStockMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkMinStockMode}
                    onChange={(value) =>
                      setBulkMinStockMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkMinStockMode === "set" && (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={bulkMinStockLevel}
                      onChange={(event) =>
                        setBulkMinStockLevel(event.target.value)
                      }
                      className="quick-add-input"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkCostMode !== "keep"}
                  onChange={(event) =>
                    setBulkCostMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change cost price
              </label>
              {bulkCostMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkCostMode}
                    onChange={(value) =>
                      setBulkCostMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkCostMode === "set" && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkCostPrice}
                      onChange={(event) => setBulkCostPrice(event.target.value)}
                      className="quick-add-input"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkSellingMode !== "keep"}
                  onChange={(event) =>
                    setBulkSellingMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change selling price
              </label>
              {bulkSellingMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkSellingMode}
                    onChange={(value) =>
                      setBulkSellingMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkSellingMode === "set" && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkSellingPrice}
                      onChange={(event) =>
                        setBulkSellingPrice(event.target.value)
                      }
                      className="quick-add-input"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkNotesEnabled}
                  onChange={(event) =>
                    setBulkNotesEnabled(event.target.checked)
                  }
                />
                Update notes
              </label>
              {bulkNotesEnabled && (
                <div className="grid gap-2">
                  <Select
                    value={bulkNotesMode}
                    onChange={(value) =>
                      setBulkNotesMode(value as "append" | "replace")
                    }
                    options={[
                      { value: "append", label: "Append to existing notes" },
                      { value: "replace", label: "Replace notes" },
                    ]}
                  />
                  {bulkNotesMode === "replace" && (
                    <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                      Replacement overwrites existing notes for selected items.
                    </p>
                  )}
                  <textarea
                    value={bulkNotes}
                    onChange={(event) => setBulkNotes(event.target.value)}
                    className="quick-add-input min-h-[88px] resize-y"
                  />
                </div>
              )}
            </div>
          </div>
        </DialogShell>
      )}

      {bulkDialogMode === "move" && (
        <DialogShell
          title="Move selected items"
          eyebrow="Move"
          description={`${selectedItems.length} selected item${
            selectedItems.length === 1 ? "" : "s"
          }. Change category, depot/location, or both.`}
          onClose={() => {
            if (!bulkSubmitting) setBulkDialogMode(null);
          }}
          closeDisabled={bulkSubmitting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setBulkDialogMode(null)}
                disabled={bulkSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void applyBulkEdit("move")}
                disabled={
                  bulkSubmitting ||
                  selectedItems.length === 0 ||
                  (bulkCategoryMode === "keep" && bulkDepotMode === "keep") ||
                  !bulkConfirmed
                }
                loading={bulkSubmitting}
                loadingLabel="Moving..."
              >
                Move Items
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            {bulkError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {bulkError}
              </div>
            )}
            <div className="rounded-2xl border border-theme bg-theme-inset p-3 text-sm text-theme-secondary">
              <p className="font-black text-theme-primary">
                Review move destination
              </p>
              <p className="mt-1">
                {selectedItems.length} selected item
                {selectedItems.length === 1 ? "" : "s"} will keep the same
                item records and move to the destination below.
              </p>
              <p className="mt-2 font-semibold">
                Destination:{" "}
                {bulkDestinationSummary.length > 0
                  ? bulkDestinationSummary.join(", ")
                  : "Choose category, depot/location, or both"}
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkConfirmed}
                  onChange={(event) => setBulkConfirmed(event.target.checked)}
                  disabled={
                    bulkSubmitting ||
                    (bulkCategoryMode === "keep" && bulkDepotMode === "keep")
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                />
                Confirm this move for the selected items.
              </label>
            </div>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkCategoryMode !== "keep"}
                  onChange={(event) =>
                    setBulkCategoryMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change category
              </label>
              {bulkCategoryMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkCategoryMode}
                    onChange={(value) =>
                      setBulkCategoryMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkCategoryMode === "set" && (
                    <CategorySelector
                      categories={categories}
                      value={bulkCategoryId}
                      onChange={setBulkCategoryId}
                      disabled={bulkSubmitting}
                    />
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm font-bold text-theme-primary">
                <input
                  type="checkbox"
                  checked={bulkDepotMode !== "keep"}
                  onChange={(event) =>
                    setBulkDepotMode(event.target.checked ? "set" : "keep")
                  }
                />
                Change depot/location
              </label>
              {bulkDepotMode !== "keep" && (
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <Select
                    value={bulkDepotMode}
                    onChange={(value) =>
                      setBulkDepotMode(value as "set" | "clear")
                    }
                    options={[
                      { value: "set", label: "Set value" },
                      { value: "clear", label: "Clear value" },
                    ]}
                  />
                  {bulkDepotMode === "set" && (
                    <Select
                      value={bulkDepotId}
                      onChange={setBulkDepotId}
                      placeholder="Unassigned"
                      searchable={activeDepots.length > 8}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...activeDepots.map((depot) => ({
                          value: String(depot.id),
                          label: formatDepotLabel(depot),
                        })),
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogShell>
      )}

      {bulkDialogMode === "delete" && (
        <DialogShell
          title="Delete selected items?"
          eyebrow="Delete inventory items"
          description={`${selectedItems.length} selected item${
            selectedItems.length === 1 ? "" : "s"
          } will be permanently removed.`}
          tone="danger"
          onClose={() => {
            if (!bulkSubmitting) setBulkDialogMode(null);
          }}
          closeDisabled={bulkSubmitting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setBulkDialogMode(null)}
                disabled={bulkSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void applyBulkDelete()}
                disabled={
                  bulkSubmitting ||
                  selectedItems.length === 0 ||
                  !bulkDeleteConfirmed
                }
                loading={bulkSubmitting}
                loadingLabel="Deleting..."
              >
                Delete Selected
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            {bulkError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {bulkError}
              </div>
            )}
            <p className="text-sm leading-6 text-theme-muted">
              This uses the same permanent delete behavior as deleting one item.
              There is no trash or soft-delete recovery in this workflow.
            </p>
            <label className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-theme-danger">
              <input
                type="checkbox"
                checked={bulkDeleteConfirmed}
                onChange={(event) =>
                  setBulkDeleteConfirmed(event.target.checked)
                }
                disabled={bulkSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-300"
              />
              Confirm deletion of {selectedItems.length} selected item
              {selectedItems.length === 1 ? "" : "s"}.
            </label>
            <ul className="max-h-44 overflow-y-auto rounded-xl border border-theme bg-theme-inset p-3 text-sm text-theme-secondary">
              {selectedItems.slice(0, 8).map((item) => (
                <li key={item.id} className="py-1 font-semibold">
                  {item.name}
                </li>
              ))}
              {selectedItems.length > 8 && (
                <li className="py-1 text-theme-subtle">
                  +{selectedItems.length - 8} more
                </li>
              )}
            </ul>
          </div>
        </DialogShell>
      )}

      {pendingDeleteItem && (
        <DialogShell
          title={`Delete ${pendingDeleteItem.name}?`}
          description="This removes the item from inventory. This action cannot be undone."
          eyebrow="Delete inventory item"
          tone="danger"
          onClose={() => setPendingDeleteItem(null)}
          closeDisabled={deletingId !== null}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingDeleteItem(null)}
                disabled={deletingId !== null}
                className="sm:min-w-28"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void deleteItem(pendingDeleteItem.id)}
                disabled={deletingId !== null}
                loading={deletingId === pendingDeleteItem.id}
                loadingLabel="Deleting..."
                className="sm:min-w-32"
              >
                Delete Item
              </Button>
            </>
          }
        />
      )}

      <StockMovementDialog
        open={Boolean(movementItem)}
        items={items}
        initialItemId={movementItem?.id}
        onClose={() => setMovementItem(null)}
        onRecorded={async () => {
          setPageNotice("Stock movement recorded successfully.");
          await fetchItems();
        }}
      />

      <SetAlertLevelDialog
        open={alertLevelItem !== null}
        item={alertLevelItem}
        defaultThreshold={effectiveLowStockThreshold}
        canUseItemThreshold={planCapabilities.customLowStockThreshold}
        currentPlanLabel={currentPlanName}
        upgradePlan={getUpgradePlanForCurrentPlan(
          subscriptionUsage.subscription.plan
        )}
        onClose={() => setAlertLevelItem(null)}
        onSaved={(itemId, minStockLevel) => {
          setItems((currentItems) =>
            currentItems.map((entry) =>
              entry.id === itemId
                ? { ...entry, min_stock_level: minStockLevel }
                : entry
            )
          );
          setPageNotice("Alert level updated.");
        }}
      />

      {detailsItem && (
        <ItemDetailsSlideOver
          itemId={detailsItem.id}
          initialTab={detailsItem.tab}
          returnTo={currentContext}
          onClose={() => {
            const itemId = detailsItem.id;
            setDetailsItem(null);
            window.requestAnimationFrame(() => {
              document
                .querySelector<HTMLButtonElement>(
                  `[data-item-actions="${itemId}"]`
                )
                ?.focus();
            });
          }}
          onItemUpdated={handleSlideOverItemUpdated}
        />
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && selectedItem && (
        <div className="inventory-modal-overlay fixed inset-0 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-[var(--border-default)] bg-[var(--sydin-surface-strong)] p-5 shadow-[0_30px_90px_rgba(0,5,20,0.4)] backdrop-blur-2xl sm:p-7 md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Product details
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Edit Item</h2>

                <p className="mt-2 text-theme-muted">
                  Update stock, pricing, tracking codes, and product details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeEditModal()}
                disabled={isEditing}
                className="rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary disabled:opacity-50"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <EditItemForm
              item={selectedItem}
              values={editValues}
              fieldErrors={editFieldErrors}
              depots={editDepotOptions}
              categories={categories}
              suppliers={suppliers}
              currencyCode={editCurrencyCode}
              selectedImage={editImage}
              saving={isEditing}
              error={editError}
              onValueChange={updateEditValue}
              onFieldErrorClear={clearEditFieldError}
              onImageChange={setEditImage}
              onCancel={() => closeEditModal()}
              onSubmit={handleUpdateItem}
            />
          </div>
        </div>
      )}
    </div>
  );
}
