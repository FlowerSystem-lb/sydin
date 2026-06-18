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
} from "react";
import { createPortal } from "react-dom";
import UiIcon from "@/components/UiIcon";
import { Select } from "@/components/ui";
import { cx } from "@/components/ui/utils";
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

function formatAction(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export default function ItemDetailsSlideOver({
  itemId,
  returnTo,
  onClose,
  onItemUpdated,
}: {
  itemId: number;
  returnTo?: string;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<ItemDetailsTab>("details");
  const [menuOpen, setMenuOpen] = useState(false);
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
    setMenuOpen(false);
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

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

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

  const detailFields = useMemo(() => {
    if (!item) return [];

    return [
      {
        label: "Item code",
        value: item.item_code?.trim() || "",
        mono: true,
      },
      { label: "SKU", value: item.sku?.trim() || "", mono: true },
      {
        label: "Category",
        value: resolveCategoryDisplay(item, assignedCategory),
      },
      { label: "Depot", value: formatDepotLabel(assignedDepot) },
      { label: "Supplier", value: assignedSupplier?.name || "No supplier" },
      { label: "Quantity", value: quantityLabel },
      { label: "Unit", value: unitLabel },
      { label: "Minimum stock", value: String(itemLowStockThreshold) },
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
      { label: "Barcode", value: item.barcode?.trim() || "", mono: true },
      { label: "Created", value: formatDateTime(item.created_at) },
    ].filter((field) => field.value);
  }, [
    assignedCategory,
    assignedDepot,
    assignedSupplier,
    costPrice,
    currencyCode,
    item,
    itemLowStockThreshold,
    quantityLabel,
    sellingPrice,
    stockCostValue,
    stockRetailValue,
    unitLabel,
  ]);

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
    setMenuOpen(false);
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
          <div ref={menuRef} className="item-details-menu-wrap">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="item-details-icon-button"
              aria-label="More item actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={!item}
            >
              <UiIcon name="more" className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="item-details-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleFullDetails}
                  className="item-details-menu-item"
                >
                  <UiIcon name="file" className="h-4 w-4" />
                  Open full page
                </button>
              </div>
            )}
          </div>
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
          {error && (
            <div role="alert" className="item-details-alert item-details-alert-error">
              {error}
            </div>
          )}

          {loading && (
            <div className="item-details-loading">
              <div />
              <div />
              <div />
            </div>
          )}

          {!loading && item && (
            <>
              {(notice || refreshing) && (
                <p
                  role="status"
                  className="item-details-alert item-details-alert-success"
                >
                  {refreshing ? "Refreshing latest activity..." : notice}
                </p>
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

                    <dl className="item-details-field-grid">
                      {detailFields.map((field) => (
                        <DetailField
                          key={field.label}
                          label={field.label}
                          value={field.value}
                          mono={field.mono}
                        />
                      ))}
                    </dl>
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
                    {movements.length > 0 ? (
                      <div className="item-details-activity-list">
                        {movements.map((movement, index) => (
                          <article
                            key={movement.id}
                            className={index === 0 && quantityChanged ? "is-new" : undefined}
                          >
                            <div>
                              <strong>
                                {STOCK_MOVEMENT_LABELS[movement.movement_type]}
                              </strong>
                              <span>{formatDateTime(movement.created_at)}</span>
                              {movement.notes && (
                                <p>{formatStockMovementNotes(movement.notes)}</p>
                              )}
                            </div>
                            <div className="item-details-activity-values">
                              <span
                                className={
                                  movement.quantity_delta < 0
                                    ? "text-theme-danger"
                                    : movement.quantity_delta > 0
                                      ? "text-theme-success"
                                      : "text-theme-secondary"
                                }
                              >
                                {formatDelta(movement.quantity_delta)}
                              </span>
                              <span>{movement.quantity_after}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="item-details-empty">
                        No stock movements yet.
                      </p>
                    )}

                    {history.length > 0 && (
                      <section className="item-details-history">
                        <h3>Inventory history</h3>
                        {history.slice(0, 6).map((entry) => (
                          <div key={entry.id}>
                            <span>{formatAction(entry.action)}</span>
                            <span>{formatDateTime(entry.created_at)}</span>
                            <span>
                              {entry.old_quantity ?? "N/A"} to{" "}
                              {entry.new_quantity ?? "N/A"}
                            </span>
                          </div>
                        ))}
                      </section>
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
