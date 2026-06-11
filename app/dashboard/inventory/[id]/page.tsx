"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import BrandMark from "@/components/BrandMark";
import Sidebar from "@/components/Sidebar";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import EditItemForm, {
  createEditItemFormValues,
  createEmptyEditItemFormValues,
  getEditSaveErrorMessage,
  validateEditItemFormValues,
  type EditItemFieldErrors,
  type EditItemFieldName,
  type EditItemFormValues,
} from "@/app/dashboard/inventory/EditItemForm";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import {
  calculateInventoryValue,
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
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
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  getStockMovementsForItem,
  recordStockMovement,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
  type StockMovementType,
} from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
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
  created_at?: string;
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

interface InventoryHistory {
  id: number;
  action: string;
  old_quantity: number | null;
  new_quantity: number | null;
  created_at: string;
}

const movementTypes: StockMovementType[] = [
  "stock_in",
  "stock_out",
  "adjustment",
  "damaged_lost",
];

const movementHelperText: Record<StockMovementType, string> = {
  stock_in: "Stock In adds quantity to current stock.",
  stock_out: "Stock Out removes quantity from current stock.",
  adjustment: "Adjustment sets the final quantity for this item.",
  damaged_lost: "Damaged / Lost removes damaged or missing stock.",
};

function formatCreatedDate(date?: string) {
  if (!date) return "Not available";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatAction(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function formatQuantity(quantity: number | null) {
  return quantity ?? "N/A";
}

function formatQuantityDelta(delta: number) {
  if (delta > 0) return `+${delta}`;

  return String(delta);
}

function DetailCard({
  label,
  value,
  detail,
  accent = "slate",
  monospace = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: "slate" | "indigo" | "cyan" | "violet" | "amber";
  monospace?: boolean;
}) {
  const toneClass =
    accent === "indigo"
      ? "border-indigo-300/20 bg-indigo-500/10 text-indigo-100"
      : accent === "cyan"
        ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
        : accent === "violet"
          ? "border-violet-300/20 bg-violet-500/10 text-violet-100"
          : accent === "amber"
            ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
            : "border-white/10 bg-black/25 text-white";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-lg font-black ${
          monospace ? "font-mono tracking-wide" : ""
        }`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
      )}
    </div>
  );
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

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const rawId = params.id;
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [qrUrl, setQrUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy Link");
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageNotice, setPageNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMissing, setAuthMissing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editValues, setEditValues] = useState<EditItemFormValues>(
    createEmptyEditItemFormValues
  );
  const [editFieldErrors, setEditFieldErrors] =
    useState<EditItemFieldErrors>({});
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editCurrencyCode, setEditCurrencyCode] = useState("USD");
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [movementType, setMovementType] =
    useState<StockMovementType>("stock_in");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [movementError, setMovementError] = useState("");
  const [isRecordingMovement, setIsRecordingMovement] = useState(false);

  const fetchHistory = async (userId: string, historyItemId: number) => {
    const { data, error: historyError } = await supabase
      .from("inventory_history")
      .select("id, action, old_quantity, new_quantity, created_at")
      .eq("item_id", historyItemId)
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (historyError) {
      setHistory([]);
      return;
    }

    setHistory((data as InventoryHistory[]) || []);
  };

  const fetchStockMovements = async (userId: string, movementItemId: number) => {
    try {
      const movements = await getStockMovementsForItem(userId, movementItemId);

      setStockMovements(movements);
    } catch {
      setStockMovements([]);
    }
  };

  useEffect(() => {
    if (!item?.public_id) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setQrUrl(
        `${window.location.origin}/item/${item.public_id}`
      );
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [item?.public_id]);

  useEffect(() => {
    let isActive = true;

    const loadItem = async () => {
      if (!itemId) {
        if (isActive) {
          setError("Item not found.");
          setLoading(false);
        }
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isActive) return;

        if (userError || !user) {
          setAuthMissing(true);
          setLoading(false);
          return;
        }

        const [
          { data, error: itemError },
          settings,
          loadedDepots,
          loadedSubscription,
          loadedSuppliers,
          loadedCategories,
          loadedCurrency,
        ] = await Promise.all([
          supabase
            .from("inventory")
            .select("*")
            .eq("id", Number(itemId))
            .eq("user_id", user.id)
            .limit(1),
          getOrCreateBusinessSettings(user.id),
          getDepotsForUser(user.id).catch(() => []),
          getUserSubscription(user.id),
          getSuppliersForUser(user.id).catch(() => []),
          getCategoriesForUser(user.id).catch(() => []),
          getBusinessCurrency(user.id),
        ]);

        if (!isActive) return;

        if (itemError) {
          setError("We could not load this item. Refresh the page and try again.");
          setLoading(false);
          return;
        }

        const loadedItem = (data?.[0] as Item | undefined) || null;

        setItem(loadedItem);
        setBusinessSettings(settings);
        setDepots(loadedDepots);
        setSubscription(loadedSubscription);
        setSuppliers(loadedSuppliers);
        setCategories(loadedCategories);
        setEditCurrencyCode(loadedCurrency);

        if (loadedItem) {
          await fetchHistory(user.id, loadedItem.id);
          await fetchStockMovements(user.id, loadedItem.id);
        } else {
          setHistory([]);
          setStockMovements([]);
        }

        setLoading(false);
      } catch {
        if (!isActive) return;

        setError("We could not load this item. Refresh the page and try again.");
        setLoading(false);
      }
    };

    loadItem();

    return () => {
      isActive = false;
    };
  }, [itemId]);

  const openEditModal = () => {
    if (!item) return;

    setEditValues(createEditItemFormValues(item));
    setEditFieldErrors({});
    setEditImage(null);
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = (force = false) => {
    if (isEditing && !force) return;

    setIsEditModalOpen(false);
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

  const openMovementModal = () => {
    if (!item) return;

    setMovementType("stock_in");
    setMovementQuantity("");
    setMovementNotes("");
    setMovementError("");
    setIsMovementModalOpen(true);
  };

  const closeMovementModal = (force = false) => {
    if (isRecordingMovement && !force) return;

    setIsMovementModalOpen(false);
    setMovementType("stock_in");
    setMovementQuantity("");
    setMovementNotes("");
    setMovementError("");
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || isRecordingMovement) return;

    const quantityValue = Number(movementQuantity);

    if (
      movementQuantity === "" ||
      Number.isNaN(quantityValue) ||
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
      setIsRecordingMovement(true);
      setMovementError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMovementError("Please sign in again before recording movement.");
        return;
      }

      const movement = await recordStockMovement({
        itemId: item.id,
        movementType,
        quantity: quantityValue,
        notes: movementNotes,
      });

      const { data: refreshedItem, error: refreshError } = await supabase
        .from("inventory")
        .select("*")
        .eq("id", item.id)
        .eq("user_id", user.id)
        .limit(1);

      if (!refreshError && refreshedItem?.[0]) {
        setItem(refreshedItem[0] as Item);
      } else {
        setItem({
          ...item,
          quantity: movement.quantity_after,
        });
      }

      await fetchStockMovements(user.id, item.id);
      closeMovementModal(true);
      setPageNotice("Stock movement recorded successfully.");
    } catch (movementError) {
      setMovementError(
        movementError instanceof Error
          ? movementError.message
          : "We could not record this movement. Please try again."
      );
    } finally {
      setIsRecordingMovement(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || isEditing) return;

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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEditError("Please sign in again before updating inventory.");
        return;
      }

      let imageUrl = item.image || "";

      if (editImage) {
        const fileName = `${Date.now()}-${editImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, editImage);

        if (uploadError) {
          setEditError(
            "Image upload failed. Try a smaller file or a different image."
          );
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const oldItem = { ...item };
      const updatedItem = {
        ...validation.parsedValues,
        image: imageUrl,
      };

      const { data, error: updateError } = await supabase
        .from("inventory")
        .update(updatedItem)
        .eq("id", item.id)
        .eq("user_id", user.id)
        .select("*");

      if (updateError) {
        setEditError(getEditSaveErrorMessage(updateError));
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        return;
      }

      const updatedRecord = data[0] as Item;

      await logInventoryHistory({
        itemId: item.id,
        userId: user.id,
        action: "edited",
        oldQuantity: oldItem.quantity,
        newQuantity: updatedRecord.quantity,
        oldValues: oldItem,
        newValues: updatedRecord,
      });

      setItem(updatedRecord);
      await fetchHistory(user.id, item.id);
      closeEditModal(true);
    } catch {
      setEditError("Something went wrong while updating this item.");
    } finally {
      setIsEditing(false);
    }
  };

  const deleteItem = async () => {
    if (!item || isDeleting) return;

    try {
      setIsDeleting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in again before deleting inventory.");
        return;
      }

      await logInventoryHistory({
        itemId: item.id,
        userId: user.id,
        action: "deleted",
        oldQuantity: item.quantity,
        oldValues: item,
      });

      const { error: deleteError } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (deleteError) {
        setError("We could not delete this item. Please try again.");
        return;
      }

      router.push("/dashboard/inventory");
    } catch {
      setError("Something went wrong while deleting this item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyQrLink = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopyLabel("Copied");

      window.setTimeout(() => {
        setCopyLabel("Copy Link");
      }, 1800);
    } catch {
      setCopyLabel("Copy failed");

      window.setTimeout(() => {
        setCopyLabel("Copy Link");
      }, 1800);
    }
  };

  const downloadQrCode = () => {
    const svg = qrCodeRef.current?.querySelector("svg");

    if (!svg || !item) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${item.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "item"}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const assignedDepot =
    depots.find((depot) => depot.id === item?.depot_id) || null;
  const assignedSupplier =
    suppliers.find((supplier) => supplier.id === item?.supplier_id) || null;
  const assignedCategory =
    categories.find((category) => category.id === item?.category_id) || null;
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscription,
    businessSettings.low_stock_threshold
  );
  const planCapabilities = getSubscriptionCapabilities(subscription);
  const itemLowStockThreshold =
    item && planCapabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          effectiveLowStockThreshold
        )
      : effectiveLowStockThreshold;
  const itemIsLowStock = item
    ? item.quantity <= itemLowStockThreshold
    : false;
  const itemUnitLabel = item
    ? getInventoryUnitLabel(item.unit_type, item.custom_unit_label)
    : "Piece";
  const itemQuantityLabel = item
    ? getInventoryQuantityLabel(
        item.quantity,
        item.unit_type,
        item.custom_unit_label
      )
    : "0 pcs";
  const costPriceText =
    item?.cost_price !== null && item?.cost_price !== undefined
      ? formatInventoryPrice(item.cost_price, editCurrencyCode)
      : null;
  const sellingPriceText =
    item?.selling_price !== null && item?.selling_price !== undefined
      ? formatInventoryPrice(item.selling_price, editCurrencyCode)
      : null;
  const stockCostValue = item
    ? calculateInventoryValue(item.quantity, item.cost_price)
    : null;
  const stockRetailValue = item
    ? calculateInventoryValue(item.quantity, item.selling_price)
    : null;
  const stockCostValueText =
    stockCostValue !== null
      ? formatInventoryPrice(stockCostValue, editCurrencyCode)
      : null;
  const stockRetailValueText =
    stockRetailValue !== null
      ? formatInventoryPrice(stockRetailValue, editCurrencyCode)
      : null;
  const editDepotOptions = depots.filter(
    (depot) => depot.is_active || (item?.depot_id && depot.id === item.depot_id)
  );

  return (
    <div className="liquid-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar
        planName={formatPlanName(subscription.plan)}
        businessName={businessSettings.business_name}
        businessLogoUrl={businessSettings.business_logo_url}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Product record
                </p>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {item?.name || "Item Details"}
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Review item metadata, stock levels, image, notes, history, and public QR access.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
                >
                  Back to Inventory
                </Link>

                {item && (
                  <>
                    <button
                      type="button"
                      onClick={openMovementModal}
                      className="rounded-2xl border border-emerald-300/25 bg-emerald-500/15 px-5 py-4 text-base font-bold text-emerald-100 transition hover:border-emerald-300/45 hover:bg-emerald-500/25"
                    >
                      Record Movement
                    </button>

                    <button
                      type="button"
                      onClick={openEditModal}
                      className="rounded-2xl bg-white px-5 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                    >
                      Edit Item
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isDeleting}
                      className="rounded-2xl border border-red-400/25 bg-red-500/15 px-5 py-4 text-base font-bold text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Delete Item"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {pageNotice && (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-200">
              {pageNotice}
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="min-h-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
                <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
              </div>

              <div className="min-h-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
                <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
              </div>
            </div>
          )}

          {!loading && authMissing && (
            <div className="rounded-[32px] border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">
              Please login to view this item.
            </div>
          )}

          {!loading && !authMissing && (error || !item) && (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <h2 className="text-3xl font-bold">
                Item not found
              </h2>

              <p className="mx-auto mt-3 max-w-md text-slate-400">
                {error || "This item does not exist or you do not have access to it."}
              </p>

              <Link
                href="/dashboard/inventory"
                className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-slate-200"
              >
                Back to Inventory
              </Link>
            </div>
          )}

          {!loading && item && (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-6">
                <div className="flex min-h-[360px] items-center justify-center rounded-[28px] bg-[#f4f0e8] p-5 sm:min-h-[460px]">
                  {item.image ? (
                    <div className="relative h-[320px] w-full sm:h-[420px]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        priority
                        sizes="(min-width: 1280px) 55vw, 100vw"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-3xl border border-slate-300/35 bg-white/35 text-center text-slate-500">
                      <span className="text-sm font-black uppercase tracking-[0.18em]">
                        Image
                      </span>

                      <span className="mt-2 text-base font-semibold">
                        Not added yet
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-6">
                <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                        Product
                      </p>

                      <h2 className="mt-2 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        {item.name}
                      </h2>
                    </div>

                    {itemIsLowStock && (
                      <span className="self-start rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300">
                        Low Stock
                      </span>
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <DetailCard
                      label="Category"
                      value={resolveCategoryDisplay(item, assignedCategory)}
                    />
                    <DetailCard
                      label="Depot"
                      value={formatDepotLabel(assignedDepot)}
                    />
                    <DetailCard
                      label="Created"
                      value={formatCreatedDate(item.created_at)}
                    />
                  </div>

                  <section className="mt-5 rounded-[26px] border border-indigo-300/15 bg-indigo-500/[0.07] p-4 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">
                          Stock & Unit
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-white">
                          {itemQuantityLabel}
                        </h3>
                      </div>
                      <span className="self-start rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-slate-300 sm:self-auto">
                        Unit: {itemUnitLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailCard
                        label="Current stock"
                        value={itemQuantityLabel}
                        accent="indigo"
                      />
                      <DetailCard
                        label="Minimum stock"
                        value={
                          item.min_stock_level !== null &&
                          item.min_stock_level !== undefined
                            ? String(item.min_stock_level)
                            : "Business default"
                        }
                        detail={`Low-stock threshold used here: ${itemLowStockThreshold}`}
                        accent={
                          item.min_stock_level !== null &&
                          item.min_stock_level !== undefined
                            ? "amber"
                            : "slate"
                        }
                      />
                    </div>
                  </section>

                  <section className="mt-5 rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">
                      Private Supplier
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      This supplier information is visible only inside your authenticated workspace.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailCard
                        label="Supplier"
                        value={assignedSupplier?.name || "No supplier"}
                        accent={assignedSupplier ? "cyan" : "slate"}
                      />
                      <DetailCard
                        label="Contact"
                        value={assignedSupplier?.contact_name || "Not set"}
                        detail={
                          assignedSupplier?.phone ||
                          assignedSupplier?.whatsapp ||
                          assignedSupplier?.email ||
                          undefined
                        }
                      />
                    </div>
                  </section>

                  <section className="mt-5 rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">
                      Pricing & Value
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Private values are visible only inside the authenticated dashboard.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailCard
                        label="Cost price"
                        value={costPriceText || "Not set"}
                        detail={
                          stockCostValueText
                            ? `Stock cost value: ${stockCostValueText}`
                            : undefined
                        }
                        accent={costPriceText ? "cyan" : "slate"}
                      />
                      <DetailCard
                        label="Selling price"
                        value={sellingPriceText || "Not set"}
                        detail={
                          stockRetailValueText
                            ? `Stock retail value: ${stockRetailValueText}`
                            : undefined
                        }
                        accent={sellingPriceText ? "violet" : "slate"}
                      />
                    </div>
                  </section>

                  <section className="mt-5 rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">
                      Tracking Codes
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailCard
                        label="Item code"
                        value={item.item_code?.trim() || "Not generated yet"}
                        detail={
                          item.item_code
                            ? "SydIN-generated read-only code."
                            : "Older items may not have a generated code."
                        }
                        accent={item.item_code ? "indigo" : "slate"}
                        monospace={Boolean(item.item_code)}
                      />
                      <DetailCard
                        label="SKU"
                        value={item.sku || "Not set"}
                        detail="Internal or supplier stock code."
                        monospace={Boolean(item.sku)}
                      />
                      <DetailCard
                        label="Barcode"
                        value={item.barcode || "Not set"}
                        detail="Product or scanned code."
                        accent={item.barcode ? "cyan" : "slate"}
                        monospace={Boolean(item.barcode)}
                      />
                    </div>
                  </section>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-slate-500">
                      Notes
                    </p>

                    <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-300">
                      {item.notes || "No notes added yet."}
                    </p>
                  </div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                    Item QR Code
                  </p>

                  <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-indigo-300/25 bg-black/25 p-5 text-center sm:p-6">
                    <div className="mb-5 flex flex-col items-center gap-3">
                      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-lg font-black shadow-[0_18px_55px_rgba(99,102,241,0.28)]">
                        {businessSettings.business_logo_url ? (
                          <Image
                            src={businessSettings.business_logo_url}
                            alt={businessSettings.business_name}
                            fill
                            sizes="56px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <BrandMark compact className="border-0 shadow-none" />
                        )}
                      </div>

                      <p className="text-sm font-bold text-indigo-100">
                        {businessSettings.business_name}
                      </p>
                    </div>

                    <div
                      ref={qrCodeRef}
                      className="rounded-3xl bg-white p-4 shadow-[0_24px_80px_rgba(255,255,255,0.08)]"
                    >
                      {qrUrl ? (
                        <QRCode
                          value={qrUrl}
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#02030a"
                          level="M"
                        />
                      ) : (
                        <div className="flex h-[180px] w-[180px] items-center justify-center text-sm font-semibold text-slate-500">
                          Public link unavailable
                        </div>
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-bold">
                      Item QR Code
                    </h3>

                    <p className="mt-2 text-slate-400">
                      Scan to open this public item page.
                    </p>

                    <p className="mt-2 text-sm text-indigo-200">
                      This QR opens the public item page.
                    </p>

                    {qrUrl && (
                      <p className="mt-3 max-w-full break-all rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-slate-400">
                        {qrUrl}
                      </p>
                    )}

                    <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={copyQrLink}
                        disabled={!qrUrl}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                      >
                        {copyLabel}
                      </button>

                      <button
                        type="button"
                        onClick={downloadQrCode}
                        disabled={!qrUrl}
                        className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        Download QR
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              </div>

              <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      Stock activity
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Stock Movements
                    </h2>
                  </div>

                  <span className="self-start rounded-full border border-emerald-300/25 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 sm:self-auto">
                    {stockMovements.length}{" "}
                    {stockMovements.length === 1 ? "movement" : "movements"}
                  </span>
                </div>

                {stockMovements.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {stockMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="rounded-[26px] border border-white/10 bg-black/25 p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-500/15 text-sm font-black text-emerald-100">
                              {STOCK_MOVEMENT_LABELS[
                                movement.movement_type
                              ].charAt(0)}
                            </div>

                            <div>
                              <h3 className="text-xl font-bold text-white">
                                {
                                  STOCK_MOVEMENT_LABELS[
                                    movement.movement_type
                                  ]
                                }
                              </h3>

                              <p className="mt-1 text-sm font-medium text-slate-400">
                                {formatCreatedDate(movement.created_at)}
                              </p>

                              {movement.notes && (
                                <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                                  {movement.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Before
                              </p>

                              <p className="mt-2 text-2xl font-black text-slate-200">
                                {movement.quantity_before}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Change
                              </p>

                              <p
                                className={`mt-2 text-2xl font-black ${
                                  movement.quantity_delta < 0
                                    ? "text-red-200"
                                    : movement.quantity_delta > 0
                                      ? "text-emerald-200"
                                      : "text-slate-200"
                                }`}
                              >
                                {formatQuantityDelta(movement.quantity_delta)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                After
                              </p>

                              <p className="mt-2 text-2xl font-black text-indigo-100">
                                {movement.quantity_after}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[26px] border border-dashed border-emerald-300/25 bg-black/25 px-5 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/15 text-lg font-black text-emerald-100">
                      0
                    </div>

                    <h3 className="mt-5 text-2xl font-bold text-white">
                      No stock movements yet
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-base leading-7 text-slate-400">
                      Stock in, stock out, adjustments, and damaged or lost
                      activity will appear here.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                      Audit trail
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Item History
                    </h2>
                  </div>

                  <span className="self-start rounded-full border border-indigo-300/25 bg-indigo-500/15 px-4 py-2 text-sm font-bold text-indigo-100 sm:self-auto">
                    {history.length} {history.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                {history.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative rounded-[26px] border border-white/10 bg-black/25 p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 text-sm font-black text-indigo-100">
                              {formatAction(entry.action).charAt(0)}
                            </div>

                            <div>
                              <h3 className="text-xl font-bold text-white">
                                {formatAction(entry.action)}
                              </h3>

                              <p className="mt-1 text-sm font-medium text-slate-400">
                                {formatCreatedDate(entry.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Old quantity
                              </p>

                              <p className="mt-2 text-2xl font-black text-slate-200">
                                {formatQuantity(entry.old_quantity)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                New quantity
                              </p>

                              <p className="mt-2 text-2xl font-black text-indigo-100">
                                {formatQuantity(entry.new_quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[26px] border border-dashed border-indigo-300/25 bg-black/25 px-5 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-lg font-black text-indigo-100">
                      0
                    </div>

                    <h3 className="mt-5 text-2xl font-bold text-white">
                      No history yet
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-base leading-7 text-slate-400">
                      Create, edit, and delete activity for this item will appear here as the record changes.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {isMovementModalOpen && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/80 p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#080b18]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-9">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Stock activity
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                  Record Movement
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Current quantity:{" "}
                  <span className="font-bold text-indigo-100">
                    {item.quantity}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeMovementModal()}
                disabled={isRecordingMovement}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleRecordMovement}
              className="flex flex-col gap-5 sm:gap-6"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Movement Type
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {movementTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMovementType(type)}
                      disabled={isRecordingMovement}
                      className={`rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        movementType === type
                          ? "border-emerald-300/60 bg-emerald-500/15 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
                          : "border-white/10 bg-white/[0.045] hover:border-white/20 hover:bg-white/[0.08]"
                      }`}
                      aria-pressed={movementType === type}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${
                            movementType === type
                              ? "border-emerald-300/35 bg-emerald-400/20 text-emerald-100"
                              : "border-white/10 bg-black/25 text-slate-300"
                          }`}
                        >
                          {STOCK_MOVEMENT_LABELS[type].charAt(0)}
                        </span>

                        <span className="min-w-0">
                          <span className="block text-base font-bold text-white">
                            {STOCK_MOVEMENT_LABELS[type]}
                          </span>

                          <span className="mt-1 block text-sm leading-5 text-slate-400">
                            {movementHelperText[type]}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-start">
                <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  {movementType === "adjustment"
                    ? "Final Quantity"
                    : "Quantity"}
                </label>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-1 transition focus-within:border-emerald-300/60 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={movementQuantity}
                      onChange={(e) => setMovementQuantity(e.target.value)}
                      disabled={isRecordingMovement}
                      className="w-full rounded-[14px] bg-transparent px-4 py-4 text-2xl font-black text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                  <p className="text-sm font-bold text-emerald-100">
                    {STOCK_MOVEMENT_LABELS[movementType]}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {movementHelperText[movementType]}
                  </p>

                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Current quantity: {item.quantity}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Notes
                </label>

                <textarea
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  disabled={isRecordingMovement}
                  className="min-h-[120px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-emerald-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)] disabled:opacity-50 sm:text-lg"
                  placeholder="Optional reason, order note, or context"
                />
              </div>

              {movementError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
                  {movementError}
                </div>
              )}

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => closeMovementModal()}
                  disabled={isRecordingMovement}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] py-4 text-base font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isRecordingMovement}
                  className="flex-1 rounded-2xl bg-white py-4 text-base font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {isRecordingMovement ? "Recording..." : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/80 p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#080b18]/95 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Product details
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Edit Item</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Update stock, pricing, tracking codes, and product details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeEditModal()}
                disabled={isEditing}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <EditItemForm
              item={item}
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

      {isDeleteDialogOpen && item && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02030a]/85 p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-detail-item-title"
            className="w-full max-w-md rounded-[28px] border border-red-400/20 bg-[#080b18]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:p-7"
          >
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-300">
              Delete inventory item
            </p>
            <h2 id="delete-detail-item-title" className="mt-3 break-words text-2xl font-bold text-white">
              Delete {item.name}?
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              This removes the item from inventory. This action cannot be undone.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 font-bold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteItem()}
                disabled={isDeleting}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
