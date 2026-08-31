"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Select } from "@/components/ui";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { cx } from "@/components/ui/utils";
import {
  getActivityEventIcon,
  getActivityEventLabel,
  getActivityEventTone,
  type ActivityEventType,
} from "@/app/lib/activityFeed";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
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
  calculateInventoryValue,
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  formatStockMovementNotes,
  getStockMovementsForItem,
  recordStockMovement,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
  type StockMovementType,
} from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";
import type { Supplier } from "@/app/lib/suppliers";
import { getSuppliersForUser } from "@/app/lib/suppliers";

export interface SlideOverInventoryItem {
  id: number;
  name: string;
  category: string | null;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string | null;
  notes?: string | null;
  created_at?: string | null;
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

interface InventoryHistoryEntry {
  id: number;
  action: string;
  old_quantity: number | null;
  new_quantity: number | null;
  created_at: string;
}

type ItemDetailsTab = "details" | "activity" | "alerts";

const movementTypes = Object.keys(
  STOCK_MOVEMENT_LABELS
) as StockMovementType[];

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function isFocusable(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden")) {
    return false;
  }
  if (element.offsetParent === null && element !== document.activeElement) {
    return false;
  }
  return Boolean(
    element.matches(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="item-details-field">
      <dt>{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}

// backlog §16D: group related facts (Stock & Unit / Supplier / Pricing & Value /
// Tracking Codes) instead of one flat 14-row list, mirroring the order already
// established on the full item page (app/dashboard/inventory/[id]/page.tsx).
// A local helper, not `DashboardFormSection` from Workspace.tsx: that primitive
// picks up the dashboard-wide frosted-glass `!important` treatment
// (app/globals.css ~16711), which would visually clash with this panel's
// deliberately flat, solid-surface `.item-details-*` design (Sprint 5).
function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="item-details-group">
      <h3 className="item-details-group-title">{title}</h3>
      <dl className="item-details-field-grid">{children}</dl>
    </section>
  );
}

// A merged, chronologically-sorted view of this item's stock movements and
// created/edited history, so the Activity tab is one design instead of two.
// Deliberately NOT `getActivityFeed` from app/lib/activityFeed.ts: that function
// has no itemId filter, and its po_received events carry no itemId at all (a PO
// can cover many items with no per-item attribution available). Filtering its
// global, limit-capped output by itemId client-side would silently truncate an
// item's own older history once other items' activity fills the limit window —
// correct at today's low activity volume, a real bug once usage grows. This
// reuses only its pure presentation helpers (icon/label/tone), not its query.
interface SlideOverActivityEvent {
  id: string;
  type: ActivityEventType;
  createdAt: string;
  notes?: string | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  quantityDelta?: number;
}

const HISTORY_ACTION_TO_EVENT_TYPE: Record<string, ActivityEventType> = {
  created: "item_created",
  edited: "item_edited",
  deleted: "item_edited",
};

function getActivityToneClass(type: ActivityEventType) {
  switch (getActivityEventTone(type)) {
    case "success":
      return "item-details-activity-icon-success";
    case "danger":
      return "item-details-activity-icon-danger";
    case "warning":
      return "item-details-activity-icon-warning";
    case "accent":
      return "item-details-activity-icon-accent";
    default:
      return "";
  }
}

export default function ItemDetailsSlideOver({
  itemId,
  returnTo,
  initialTab = "details",
  onClose,
  onItemUpdated,
}: {
  itemId: number;
  returnTo?: string;
  initialTab?: ItemDetailsTab;
  onClose: () => void;
  onItemUpdated?: (
    item: SlideOverInventoryItem,
    movement?: StockMovement
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const detailsPanelId = useId();
  const activityPanelId = useId();
  const alertsPanelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<ItemDetailsTab>(initialTab);
  const [item, setItem] = useState<SlideOverInventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [announce, setAnnounce] = useState("");
  const [quantityChanged, setQuantityChanged] = useState(false);
  const [movementType, setMovementType] =
    useState<StockMovementType>("stock_in");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [movementError, setMovementError] = useState("");
  const [savingMovement, setSavingMovement] = useState(false);

  const loadPanelData = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Please sign in again to view this item.");
        }

        const [
          { data: itemRows, error: itemError },
          { data: historyRows },
          settings,
          loadedDepots,
          loadedSuppliers,
          loadedCategories,
          loadedSubscription,
          loadedMovements,
        ] = await Promise.all([
          supabase
            .from("inventory")
            .select("*")
            .eq("id", itemId)
            .eq("user_id", user.id)
            .limit(1),
          supabase
            .from("inventory_history")
            .select("id, action, old_quantity, new_quantity, created_at")
            .eq("item_id", itemId)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          getOrCreateBusinessSettings(user.id),
          getDepotsForUser(user.id).catch(() => []),
          getSuppliersForUser(user.id).catch(() => []),
          getCategoriesForUser(user.id).catch(() => []),
          getUserSubscription(user.id),
          getStockMovementsForItem(user.id, itemId).catch(() => []),
        ]);

        if (itemError) throw itemError;

        const loadedItem = (itemRows?.[0] as
          | SlideOverInventoryItem
          | undefined) || null;
        if (!loadedItem) {
          throw new Error("This item does not exist or you do not have access to it.");
        }

        setItem(loadedItem);
        setHistory((historyRows as InventoryHistoryEntry[]) || []);
        setBusinessSettings(settings);
        setDepots(loadedDepots);
        setSuppliers(loadedSuppliers);
        setCategories(loadedCategories);
        setSubscription(loadedSubscription);
        setMovements(loadedMovements);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load this item."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [itemId]
  );

  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      setMounted(true);
      panelRef.current?.focus();
      void loadPanelData(true);
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      window.cancelAnimationFrame(focusFrame);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [loadPanelData]);

  useEffect(() => {
    if (!quantityChanged) return;
    const timeout = window.setTimeout(() => setQuantityChanged(false), 900);
    return () => window.clearTimeout(timeout);
  }, [quantityChanged]);

  const beginClose = useCallback(() => {
    if (savingMovement || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 190);
  }, [closing, onClose, savingMovement]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        beginClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(isFocusable) as HTMLElement[];

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [beginClose]);

  const assignedDepot =
    depots.find((depot) => depot.id === item?.depot_id) || null;
  const assignedSupplier =
    suppliers.find((supplier) => supplier.id === item?.supplier_id) || null;
  const assignedCategory =
    categories.find((category) => category.id === item?.category_id) || null;
  const planCapabilities = getSubscriptionCapabilities(subscription);
  const defaultThreshold = getEffectiveLowStockThreshold(
    subscription,
    businessSettings.low_stock_threshold
  );
  const itemLowStockThreshold =
    item && planCapabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(item.min_stock_level, defaultThreshold)
      : defaultThreshold;
  const lowStock = item ? item.quantity <= itemLowStockThreshold : false;
  const currencyCode = normalizeCurrencyCode(businessSettings.currency_code);
  const quantityLabel = item
    ? getInventoryQuantityLabel(
        item.quantity,
        item.unit_type,
        item.custom_unit_label
      )
    : "";
  const unitLabel = item
    ? getInventoryUnitLabel(item.unit_type, item.custom_unit_label)
    : "";
  const costPrice = item ? formatInventoryPrice(item.cost_price, currencyCode) : null;
  const sellingPrice = item
    ? formatInventoryPrice(item.selling_price, currencyCode)
    : null;
  const stockCostValue = item
    ? calculateInventoryValue(item.quantity, item.cost_price)
    : null;
  const stockRetailValue = item
    ? calculateInventoryValue(item.quantity, item.selling_price)
    : null;

  // backlog §16D: grouped, not one flat 14-row list — order mirrors the full
  // item page's established sections (app/dashboard/inventory/[id]/page.tsx:
  // identity/category basics -> Stock & Unit -> Supplier -> Pricing & Value ->
  // Tracking Codes), so the two views of the same item read the same way.
  const detailGroups = useMemo(() => {
    const empty = { identity: [], stock: [], supplier: [], pricing: [], tracking: [] };
    if (!item) return empty;

    // Unit and Supplier moved up here. Each was previously a group of exactly
    // one row, under a heading that repeated the row's own label — "Supplier"
    // above "Supplier: No supplier". A heading that says the same word as the
    // single row beneath it is not organisation, it is an extra line to read.
    const identity = [
      { label: "Category", value: resolveCategoryDisplay(item, assignedCategory) },
      { label: "Depot", value: formatDepotLabel(assignedDepot) },
      { label: "Unit", value: unitLabel },
      { label: "Supplier", value: assignedSupplier?.name || "No supplier" },
      { label: "Created", value: formatDateTime(item.created_at) },
    ].filter((field) => field.value);

    // Emptied deliberately. Quantity and Minimum stock are already the two big
    // numbers in the strip at the top of the panel ("Current quantity" and
    // "Threshold"), so listing them again printed the same facts twice on every
    // item. Unit is the only thing left, and one row does not deserve a heading
    // of its own — it joins the identity list below.
    const stock: { label: string; value: string }[] = [];

    // Emptied for the same reason as `stock`: it was one row under a heading
    // repeating that row's own label. The supplier now sits in `identity`.
    const supplier: { label: string; value: string }[] = [];

    const pricing = [
      { label: "Cost price", value: costPrice || "" },
      {
        label: "Stock cost value",
        value:
          stockCostValue !== null
            ? formatInventoryPrice(stockCostValue, currencyCode) || ""
            : "",
      },
      { label: "Selling price", value: sellingPrice || "" },
      {
        label: "Stock retail value",
        value:
          stockRetailValue !== null
            ? formatInventoryPrice(stockRetailValue, currencyCode) || ""
            : "",
      },
    ].filter((field) => field.value);

    const tracking = [
      { label: "Item code", value: item.item_code?.trim() || "", mono: true },
      { label: "SKU", value: item.sku?.trim() || "", mono: true },
      { label: "Barcode", value: item.barcode?.trim() || "", mono: true },
    ].filter((field) => field.value);

    return { identity, stock, supplier, pricing, tracking };
  }, [
    assignedCategory,
    assignedDepot,
    assignedSupplier,
    costPrice,
    currencyCode,
    item,
    sellingPrice,
    stockCostValue,
    stockRetailValue,
    unitLabel,
  ]);

  const combinedActivity = useMemo<SlideOverActivityEvent[]>(() => {
    const movementEvents: SlideOverActivityEvent[] = movements.map((movement) => ({
      id: `sm-${movement.id}`,
      type: movement.movement_type,
      createdAt: movement.created_at,
      notes: movement.notes,
      quantityBefore: movement.quantity_before,
      quantityAfter: movement.quantity_after,
      quantityDelta: movement.quantity_delta,
    }));

    const historyEvents: SlideOverActivityEvent[] = history.map((entry) => ({
      id: `ih-${entry.id}`,
      type: HISTORY_ACTION_TO_EVENT_TYPE[entry.action] || "item_edited",
      createdAt: entry.created_at,
      quantityBefore: entry.old_quantity,
      quantityAfter: entry.new_quantity,
    }));

    return [...movementEvents, ...historyEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [history, movements]);

  const editHref = item
    ? `/dashboard/inventory/${item.id}?action=edit${
        returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
      }`
    : "";
  const fullDetailsHref = item
    ? `/dashboard/inventory/${item.id}${
        returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
      }`
    : "";

  const handleEdit = () => {
    if (!editHref) return;
    router.push(editHref);
  };

  const handleFullDetails = () => {
    if (!fullDetailsHref) return;
    router.push(fullDetailsHref);
  };

  const tabs: {
    value: ItemDetailsTab;
    label: string;
    panelId: string;
  }[] = [
    { value: "details", label: "Details", panelId: detailsPanelId },
    { value: "activity", label: "Activity", panelId: activityPanelId },
    { value: "alerts", label: "Alerts", panelId: alertsPanelId },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ItemDetailsTab
  ) => {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = tabs.findIndex((tabItem) => tabItem.value === currentTab);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setTab(nextTab.value);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`${nextTab.panelId}-tab`)
        ?.focus({ preventScroll: true });
    });
  };

  const handleMovementSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || savingMovement) return;

    const quantityValue = Number(movementQuantity);

    if (
      movementQuantity === "" ||
      !Number.isFinite(quantityValue) ||
      !Number.isInteger(quantityValue) ||
      quantityValue < 0
    ) {
      setMovementError("Enter a whole quantity of 0 or more.");
      return;
    }

    if (
      (movementType === "stock_out" || movementType === "damaged_lost") &&
      item.quantity - quantityValue < 0
    ) {
      setMovementError("This movement would make the item quantity negative.");
      return;
    }

    try {
      setSavingMovement(true);
      setMovementError("");
      setNotice("");

      const movement = await recordStockMovement({
        itemId: item.id,
        movementType,
        quantity: quantityValue,
        notes: movementNotes,
      });

      const updatedItem = { ...item, quantity: movement.quantity_after };
      setItem(updatedItem);
      setMovements((current) => [{ ...movement, item_id: item.id }, ...current]);
      setMovementQuantity("");
      setMovementNotes("");
      setQuantityChanged(true);
      setNotice("Stock movement recorded.");
      setAnnounce(
        `${item.name} quantity updated to ${movement.quantity_after}.`
      );
      await onItemUpdated?.(updatedItem, movement);
      void loadPanelData(false);
    } catch (movementErrorValue) {
      setMovementError(
        movementErrorValue instanceof Error
          ? movementErrorValue.message
          : "We could not record this movement. Please try again."
      );
    } finally {
      setSavingMovement(false);
    }
  };

  const panel = (
    <div
      className={cx(
        "item-details-overlay",
        mounted && "item-details-overlay-mounted",
        closing && "item-details-overlay-closing"
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) beginClose();
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cx(
          "item-details-panel",
          mounted && "item-details-panel-mounted",
          closing && "item-details-panel-closing"
        )}
      >
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
        <header className="item-details-header">
          <button
            type="button"
            onClick={beginClose}
            className="item-details-back-button"
            aria-label="Back from item details"
            disabled={savingMovement}
          >
            <UiIcon name="chevron-left" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p id={descriptionId} className="item-details-eyebrow">
              {item?.item_code || item?.sku || "Item details"}
            </p>
            <h2 id={titleId} className="item-details-title">
              {item?.name || "Loading item"}
            </h2>
          </div>
          {item && (
            <span
              className={cx(
                "item-details-status",
                lowStock
                  ? "item-details-status-danger"
                  : "item-details-status-success"
              )}
            >
              {lowStock ? "Low stock" : "In stock"}
            </span>
          )}
          <button
            type="button"
            onClick={handleEdit}
            className="item-details-action"
            disabled={!item}
          >
            <UiIcon name="appearance" className="h-4 w-4" />
            Edit
          </button>
          {/* This was a "⋯" dropdown whose entire contents were this one action.
              A menu costs a click, hides the action, and carries open/close
              state plus outside-click handling — none of it earned by a single
              item. It is a plain button now. */}
          <button
            type="button"
            onClick={handleFullDetails}
            className="item-details-action"
            disabled={!item}
            title="Open the full item page"
          >
            <UiIcon name="file" className="h-4 w-4" />
            Full page
          </button>
          <button
            type="button"
            onClick={beginClose}
            className="item-details-close-button"
            aria-label="Close item details"
            disabled={savingMovement}
          >
            <UiIcon name="close" className="h-5 w-5" />
          </button>
        </header>

        <nav
          className="item-details-tabs"
          role="tablist"
          aria-label="Item details tabs"
        >
          {tabs.map((tabItem) => (
            <button
              key={tabItem.value}
              id={`${tabItem.panelId}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === tabItem.value}
              aria-controls={tabItem.panelId}
              tabIndex={tab === tabItem.value ? 0 : -1}
              onClick={() => setTab(tabItem.value)}
              onKeyDown={(event) => handleTabKeyDown(event, tabItem.value)}
              className={tab === tabItem.value ? "is-active" : undefined}
            >
              {tabItem.label}
            </button>
          ))}
        </nav>

        <div className="item-details-body">
          {error && item && (
            <DashboardNotice tone="danger" className="item-details-notice">
              {error}
            </DashboardNotice>
          )}

          {loading && (
            <LoadingSkeletonGroup
              count={3}
              className="item-details-loading"
              itemClassName="min-h-28"
            />
          )}

          {!loading && !item && (
            <DashboardEmptyState
              icon="box"
              title="Item not found"
              description={
                error ||
                "This item does not exist or you do not have access to it."
              }
              action={
                <ActionButton
                  variant="secondary"
                  icon="chevron-left"
                  onClick={beginClose}
                >
                  Back to inventory
                </ActionButton>
              }
            />
          )}

          {!loading && item && (
            <>
              {(notice || refreshing) && (
                <DashboardNotice tone="success" className="item-details-notice">
                  {refreshing ? "Refreshing latest activity..." : notice}
                </DashboardNotice>
              )}

              <div
                id={
                  tab === "details"
                    ? detailsPanelId
                    : tab === "activity"
                      ? activityPanelId
                      : alertsPanelId
                }
                className="item-details-tab-panel"
                role="tabpanel"
                aria-labelledby={`${
                  tab === "details"
                    ? detailsPanelId
                    : tab === "activity"
                      ? activityPanelId
                      : alertsPanelId
                }-tab`}
              >
                {tab === "details" && (
                  <div className="item-details-tab-content">
                    <section className="item-details-image-area">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 560px"
                          className="object-contain p-3"
                        />
                      ) : (
                        <div className="item-details-image-placeholder">
                          <UiIcon name="box" className="h-8 w-8" />
                          <span>No image</span>
                        </div>
                      )}
                    </section>

                    <section className="item-details-quantity-strip">
                      <div>
                        <p>Current quantity</p>
                        <strong
                          className={
                            quantityChanged ? "item-details-quantity-flash" : ""
                          }
                        >
                          {quantityLabel}
                        </strong>
                      </div>
                      <div>
                        <p>Threshold</p>
                        <strong>{itemLowStockThreshold}</strong>
                      </div>
                    </section>

                    {/* backlog §16D: facts before the action. Category / Depot /
                        Created lead (identity, unlabeled — matches the full
                        item page's top grouping), then the labeled groups,
                        then Adjust Stock, then Notes last. Previously the
                        Adjust Stock form sat here, ahead of every fact about
                        the item — you had to scroll past a form to find out
                        what depot or supplier it belonged to. */}
                    {detailGroups.identity.length > 0 && (
                      <dl className="item-details-field-grid">
                        {detailGroups.identity.map((field) => (
                          <DetailField
                            key={field.label}
                            label={field.label}
                            value={field.value}
                          />
                        ))}
                      </dl>
                    )}

                    {detailGroups.stock.length > 0 && (
                      <DetailGroup title="Stock & Unit">
                        {detailGroups.stock.map((field) => (
                          <DetailField
                            key={field.label}
                            label={field.label}
                            value={field.value}
                          />
                        ))}
                      </DetailGroup>
                    )}

                    {detailGroups.supplier.length > 0 && (
                      <DetailGroup title="Supplier">
                        {detailGroups.supplier.map((field) => (
                          <DetailField
                            key={field.label}
                            label={field.label}
                            value={field.value}
                          />
                        ))}
                      </DetailGroup>
                    )}

                    {detailGroups.pricing.length > 0 && (
                      <DetailGroup title="Pricing & Value">
                        {detailGroups.pricing.map((field) => (
                          <DetailField
                            key={field.label}
                            label={field.label}
                            value={field.value}
                          />
                        ))}
                      </DetailGroup>
                    )}

                    {detailGroups.tracking.length > 0 && (
                      <DetailGroup title="Tracking Codes">
                        {detailGroups.tracking.map((field) => (
                          <DetailField
                            key={field.label}
                            label={field.label}
                            value={field.value}
                            mono={field.mono}
                          />
                        ))}
                      </DetailGroup>
                    )}

                    <form
                      onSubmit={handleMovementSubmit}
                      className="item-details-adjust"
                    >
                      <div className="item-details-adjust-heading">
                        <div>
                          <p className="item-details-eyebrow">Quick action</p>
                          <h3>Adjust stock</h3>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <Select
                          ariaLabel="Movement type"
                          value={movementType}
                          onChange={(value) => {
                            setMovementType(value as StockMovementType);
                            setMovementError("");
                          }}
                          disabled={savingMovement}
                          options={movementTypes.map((type) => ({
                            value: type,
                            label: STOCK_MOVEMENT_LABELS[type],
                          }))}
                        />
                        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
                          <label>
                            <span className="sr-only">
                              {movementType === "adjustment"
                                ? "Final quantity"
                                : "Quantity"}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={movementQuantity}
                              onChange={(event) => {
                                setMovementQuantity(event.target.value);
                                setMovementError("");
                              }}
                              disabled={savingMovement}
                              placeholder={
                                movementType === "adjustment" ? "Final" : "Qty"
                              }
                              className="item-details-input"
                              required
                            />
                          </label>
                          <label>
                            <span className="sr-only">Reason or note</span>
                            <input
                              type="text"
                              value={movementNotes}
                              onChange={(event) =>
                                setMovementNotes(event.target.value)
                              }
                              disabled={savingMovement}
                              placeholder="Reason or note"
                              className="item-details-input"
                            />
                          </label>
                        </div>
                        {movementError && (
                          <p role="alert" className="item-details-form-error">
                            {movementError}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={savingMovement}
                          className="item-details-submit"
                        >
                          <UiIcon name="movement" className="h-4 w-4" />
                          {savingMovement ? "Recording..." : "Record movement"}
                        </button>
                      </div>
                    </form>

                    {item.notes?.trim() && (
                      <div className="item-details-notes">
                        <p>Notes</p>
                        <div>{item.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {tab === "activity" && (
                  <div className="item-details-tab-content">
                    {/* backlog §16D: one merged, one-styled feed instead of a
                        stock-movements list followed by a separately-styled
                        inventory-history list. See combinedActivity above. */}
                    {combinedActivity.length > 0 ? (
                      <div className="item-details-activity-list">
                        {combinedActivity.map((event, index) => (
                          <article
                            key={event.id}
                            className={index === 0 && quantityChanged ? "is-new" : undefined}
                          >
                            <div
                              className={cx(
                                "item-details-activity-icon",
                                getActivityToneClass(event.type)
                              )}
                            >
                              <UiIcon
                                name={getActivityEventIcon(event.type) as UiIconName}
                                className="h-4 w-4"
                              />
                            </div>
                            <div>
                              <strong>{getActivityEventLabel(event.type)}</strong>
                              <span>{formatDateTime(event.createdAt)}</span>
                              {event.notes && (
                                <p>{formatStockMovementNotes(event.notes)}</p>
                              )}
                            </div>
                            {event.quantityDelta !== undefined ? (
                              <div className="item-details-activity-values">
                                <span
                                  className={
                                    event.quantityDelta < 0
                                      ? "text-theme-danger"
                                      : event.quantityDelta > 0
                                        ? "text-theme-success"
                                        : "text-theme-secondary"
                                  }
                                >
                                  {formatDelta(event.quantityDelta)}
                                </span>
                                <span>{event.quantityAfter}</span>
                              </div>
                            ) : (
                              // "N/A to N/A" was printed against every edit that
                              // did not touch quantity — which is most of them.
                              // It reads as a fault in the record rather than
                              // what it is: an edit that changed something else.
                              // Nothing is the honest answer, so nothing is shown.
                              event.quantityBefore != null ||
                              event.quantityAfter != null ? (
                                <div className="item-details-activity-values">
                                  <span className="text-theme-secondary">
                                    {event.quantityBefore ?? "—"} to{" "}
                                    {event.quantityAfter ?? "—"}
                                  </span>
                                </div>
                              ) : null
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <DashboardEmptyState
                        icon="movement"
                        title="No activity yet"
                        description="Stock in, stock out, adjustments, edits, and other updates for this item will appear here."
                      />
                    )}
                  </div>
                )}

                {tab === "alerts" && (
                  <div className="item-details-tab-content">
                    <div
                      className={cx(
                        "item-details-alert-card",
                        lowStock && "item-details-alert-card-danger"
                      )}
                    >
                      <UiIcon
                        name={lowStock ? "alert" : "check"}
                        className="h-5 w-5"
                      />
                      <div>
                        <strong>
                          {lowStock ? "Low-stock threshold reached" : "Stock is above threshold"}
                        </strong>
                        <p>
                          Current stock is {item.quantity}. The active low-stock
                          threshold is {itemLowStockThreshold}.
                        </p>
                      </div>
                    </div>
                    <dl className="item-details-field-grid">
                      <DetailField
                        label="Business default"
                        value={String(defaultThreshold)}
                      />
                      {planCapabilities.customLowStockThreshold &&
                        item.min_stock_level !== null &&
                        item.min_stock_level !== undefined && (
                          <DetailField
                            label="Item minimum stock"
                            value={String(item.min_stock_level)}
                          />
                        )}
                    </dl>
                    <p className="item-details-empty">
                      Alert settings use the existing low-stock behavior. Open
                      Edit to change supported item fields.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(panel, document.body);
}
