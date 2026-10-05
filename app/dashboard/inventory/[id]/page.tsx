"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  createProductImagePath,
  prepareProductImage,
  getImageValidationError,
} from "@/app/lib/productImage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import ImageLightbox from "@/components/inventory/ImageLightbox";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import StockLevelChart from "@/components/inventory/StockLevelChart";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { StatusBadge } from "@/components/ui";
import {
  getActivityEventIcon,
  getActivityEventTone,
  type ActivityEventType,
} from "@/app/lib/activityFeed";
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
import ItemPanel from "@/components/inventory/ItemPanel";
import StockMovementDialog from "@/components/inventory/StockMovementDialog";
import {
  Button,
  buttonClassName,
  DialogShell,
} from "@/components/ui";
import {
  createCategoryInline,
  createDepotInline,
  createSupplierInline,
} from "@/app/lib/inlineCreate";
import { hasTrackedItemChanges, logInventoryHistory } from "@/app/lib/inventoryHistory";
import {
  calculateInventoryValue,
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { rememberRecentItem } from "@/app/lib/globalSearch";
import { getDocumentsForItem, type ItemDocument } from "@/app/lib/itemDocuments";
import { formatExactPrice, getCurrencyContext } from "@/app/lib/currency";
import { supabase } from "@/app/lib/supabase";
import { getBusinessUser } from "@/app/lib/business";
import { useCanDelete } from "@/components/dashboard/BusinessContext";
import DoneBy, { useBusinessPeople } from "@/components/dashboard/DoneBy";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import {
  exportItemActivityPdf,
  type ItemActivityReportKind,
  type ItemActivityReportTable,
} from "@/app/lib/itemActivityPdf";
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
  formatStockMovementNotes,
  getStockMovementsForItem,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
} from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
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
  actor_id?: string | null;
  created_at: string;
}


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

// backlog §16E: Stock Movements / Item History rows used a single first-letter
// avatar ("S" for Stock In, "C" for Created) — ambiguous, and this page had its
// own hand-rolled version of the same idea the Activity page and item
// slide-over already solved with real icons. Reuses only the pure
// icon/tone helpers from app/lib/activityFeed.ts, not its data-fetching —
// same boundary already recorded in SYDIN_DECISION_LOG.md for this file.
const HISTORY_ACTION_TO_EVENT_TYPE: Record<string, ActivityEventType> = {
  created: "item_created",
  edited: "item_edited",
  deleted: "item_edited",
};

function getActivityToneClasses(type: ActivityEventType) {
  switch (getActivityEventTone(type)) {
    case "success":
      return "border-emerald-300/25 bg-emerald-500/15 text-theme-success";
    case "danger":
      return "border-red-300/25 bg-red-500/15 text-theme-danger";
    case "warning":
      return "border-amber-300/25 bg-amber-500/15 text-theme-warning";
    case "accent":
      return "border-indigo-300/25 bg-indigo-500/15 text-theme-accent";
    default:
      return "border-theme bg-theme-inset text-theme-secondary";
  }
}

function formatDocumentDay(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function documentTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "cancelled") return "danger";
  if (status === "paid" || status === "received") return "success";
  if (status === "draft") return "warning";
  return "info";
}

function formatQuantity(quantity: number | null) {
  return quantity ?? "N/A";
}

function formatQuantityDelta(delta: number) {
  if (delta > 0) return `+${delta}`;

  return String(delta);
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
  const canDeleteRecords = useCanDelete();
  const params = useParams();
  const router = useRouter();
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const rawId = params.id;
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  /* An item with a long life has hundreds of entries; every one used to
     render as a ~110px card, so 100 movements was ~11,000px of page (Sayed,
     5 Oct 2026). The newest 10 show; "Show more" adds 20 at a time. */
  const [activityLimit, setActivityLimit] = useState(10);
  // "Now" for the 30-day sales pace, fixed when the page opens.
  const [pageOpenedAt] = useState(() => Date.now());
  const [activityFilter, setActivityFilter] = useState<
    "all" | "movements" | "edits" | "created"
  >("all");
  const [documentLimit, setDocumentLimit] = useState(10);
  // Which section's PDF is being built, so only its button shows "Preparing".
  const [pdfBusy, setPdfBusy] = useState<ItemActivityReportKind | null>(null);
  const [pdfError, setPdfError] = useState("");
  const people = useBusinessPeople();
  // Every invoice and purchase order this item is on (brief points 26, 40).
  const [itemDocuments, setItemDocuments] = useState<ItemDocument[]>([]);
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  /* A photo that 404s, or that the network drops, used to draw the browser's
     torn-page glyph on the item page -- see ProductThumbnail for why that is
     the one image a customer must never see. This page cannot use that
     component because its empty state is a "No photo yet" line rather than a
     box icon, so it keeps the same rule locally: hold the src that failed, so
     editing the item to a different photo clears the failure by itself. */
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const [backLabel, setBackLabel] = useState("Back to inventory");

  const fetchHistory = async (userId: string, historyItemId: number) => {
    const { data, error: historyError } = await supabase
      .from("inventory_history")
      .select("id, action, old_quantity, new_quantity, created_at, actor_id")
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
    // Same moment, same reason: the documents are the other half of the
    // item's history. A failure leaves the section empty, never the page.
    try {
      setItemDocuments(await getDocumentsForItem(userId, movementItemId));
    } catch {
      setItemDocuments([]);
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
    if (!item) return;

    const action = new URLSearchParams(window.location.search).get("action");
    const frame = window.requestAnimationFrame(() => {
      if (
        new URLSearchParams(window.location.search)
          .get("returnTo")
          ?.startsWith("/dashboard/categories")
      ) {
        setBackLabel("Back to Categories");
      }
      if (action === "edit") {
        setEditValues(createEditItemFormValues(item));
        setEditFieldErrors({});
        setEditImage(null);
        setEditError("");
        // ?action=edit used to open a full-page editor. That page rendered the
        // same EditItemForm as this dialog, so it was a second UI for one job —
        // and nothing in the app linked to it. The link now opens the dialog.
        setIsEditModalOpen(true);
      } else if (action === "stock") {
        setIsMovementModalOpen(true);
      } else if (action === "delete") {
        setIsDeleteDialogOpen(true);
      }

      if (action && action !== "edit") {
        const params = new URLSearchParams(window.location.search);
        params.delete("action");
        const query = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}${
            window.location.hash
          }`
        );
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [item]);

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
        } = await getBusinessUser();

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
        // Opening an item is what makes it recent — not searching for one.
        // Recording it here means the search's empty state can offer the thing
        // you were just looking at, however you got to it.
        if (loadedItem) rememberRecentItem(loadedItem);
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

  // Inventory's own list page does this for its Edit panel (search
  // "inventory-modal-open" in globals.css) so the mobile bottom nav bar
  // doesn't sit on top of the panel's Cancel/Save row. This page opens the
  // same panel but never picked up the same class toggle -- invisible on the
  // old centred dialog, which never reached the bottom of a short screen;
  // real once the panel became full height.
  useEffect(() => {
    const className = "inventory-modal-open";
    if (!isEditModalOpen) return;

    document.documentElement.classList.add(className);
    document.body.classList.add(className);

    return () => {
      document.documentElement.classList.remove(className);
      document.body.classList.remove(className);
    };
  }, [isEditModalOpen]);

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


  /* Same three as Inventory's own Edit panel -- this page owns its copies of
     the lists, so it wires its own. See app/lib/inlineCreate.ts. */
  const handleCreateCategoryInline = async (name: string) => {
    try {
      const created = await createCategoryInline(name);
      setCategories((current) => [...current, created]);
      return String(created.id);
    } catch {
      setEditError(`Could not add the category "${name}". Please try again.`);
      return null;
    }
  };

  const handleCreateDepotInline = async (name: string) => {
    try {
      const created = await createDepotInline(name);
      setDepots((current) => [...current, created]);
      return String(created.id);
    } catch {
      setEditError(`Could not add the depot "${name}". Please try again.`);
      return null;
    }
  };

  const handleCreateSupplierInline = async (name: string) => {
    try {
      const created = await createSupplierInline(name);
      setSuppliers((current) => [...current, created]);
      return String(created.id);
    } catch {
      setEditError(`Could not add the supplier "${name}". Please try again.`);
      return null;
    }
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
    setPageNotice("");
    setIsMovementModalOpen(true);
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
      } = await getBusinessUser();

      if (!user) {
        setEditError("Please sign in again before updating inventory.");
        return;
      }

      let imageUrl = item.image || "";

      if (editImage) {
        const imageError = getImageValidationError(editImage);

        if (imageError) {
          setEditError(imageError);
          return;
        }

        const upload = await prepareProductImage(editImage);
        const fileName = createProductImagePath(user.id, upload);
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, upload);

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

      // Only record an edit that changed something — saving the form untouched
      // used to append "Edited · 34233 → 34233" rows that describe nothing.
      if (
        hasTrackedItemChanges(
          oldItem as unknown as Record<string, unknown>,
          updatedRecord as unknown as Record<string, unknown>
        )
      ) {
        await logInventoryHistory({
          itemId: item.id,
          userId: user.id,
          action: "edited",
          oldQuantity: oldItem.quantity,
          newQuantity: updatedRecord.quantity,
          oldValues: oldItem,
          newValues: updatedRecord,
        });
      }

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
      } = await getBusinessUser();

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

  /* One section of the record as a PDF (Sayed, 5 Oct 2026): movements,
     history or documents, with the business header, the item, a summary
     and a table that never splits a row across pages. Built from what the
     page already loaded -- no new queries. */
  const downloadSectionPdf = async (kind: ItemActivityReportKind) => {
    if (!item || pdfBusy) return;
    setPdfBusy(kind);
    setPdfError("");

    const when = (value: string) =>
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value)
      );
    // "By" only means something when the business has more than one person;
    // the screen hides it for a business of one, so the paper does too.
    const showBy = Boolean(people && people.size > 1);
    const by = (actorId: string | null | undefined) =>
      (actorId && people?.get(actorId)) || "";

    let table: ItemActivityReportTable;
    let dates: string[];

    if (kind === "activity") {
      // Exactly what the Activity card is showing: its filter, all rows.
      table = {
        head: ["Date", "Event", "Before", "After", "Change", ...(showBy ? ["By"] : []), "Note"],
        rows: filteredActivity.map((event) => [
          when(event.at),
          event.title,
          event.before === null ? "-" : String(event.before),
          event.after === null ? "-" : String(event.after),
          event.delta === null ? "" : formatQuantityDelta(event.delta),
          ...(showBy ? [by(event.actorId)] : []),
          event.note,
        ]),
        columns: {
          0: { width: 34 },
          1: { width: 30 },
          2: { width: 15, align: "right" },
          3: { width: 15, align: "right" },
          4: { width: 16, align: "right", bold: true },
        },
      };
      dates = filteredActivity.map((event) => event.at);
    } else if (kind === "movements") {
      table = {
        head: ["Date", "Movement", "Before", "After", "Change", ...(showBy ? ["By"] : []), "Note"],
        rows: stockMovements.map((movement) => [
          when(movement.created_at),
          STOCK_MOVEMENT_LABELS[movement.movement_type],
          String(movement.quantity_before),
          String(movement.quantity_after),
          formatQuantityDelta(movement.quantity_delta),
          ...(showBy ? [by(movement.actor_id)] : []),
          movement.notes ? formatStockMovementNotes(movement.notes) : "",
        ]),
        columns: {
          0: { width: 34 },
          1: { width: 26 },
          2: { width: 15, align: "right" },
          3: { width: 15, align: "right" },
          4: { width: 16, align: "right", bold: true },
        },
      };
      dates = stockMovements.map((movement) => movement.created_at);
    } else if (kind === "history") {
      table = {
        head: ["Date", "Change", "Old quantity", "New quantity", ...(showBy ? ["By"] : [])],
        rows: history.map((entry) => [
          when(entry.created_at),
          formatAction(entry.action),
          String(formatQuantity(entry.old_quantity)),
          String(formatQuantity(entry.new_quantity)),
          ...(showBy ? [by(entry.actor_id)] : []),
        ]),
        columns: {
          0: { width: 36 },
          2: { width: 26, align: "right" },
          3: { width: 26, align: "right", bold: true },
        },
      };
      dates = history.map((entry) => entry.created_at);
    } else {
      table = {
        head: ["Date", "Document", "Customer / supplier", "Quantity", "Unit price", "Status"],
        rows: itemDocuments.map((document) => [
          document.date ? formatCreatedDate(document.date) : "",
          `${document.kind === "invoice" ? "Invoice" : "Purchase order"} ${document.number}`,
          document.party || "",
          document.kind === "invoice"
            ? `Sold ${document.quantity}`
            : `Ordered ${document.quantity}${
                document.received !== null && document.received > 0
                  ? `, received ${document.received}`
                  : ""
              }`,
          document.unitAmount !== null
            ? formatExactPrice(
                document.unitAmount,
                document.currency || getCurrencyContext().base
              ) || ""
            : "",
          document.status.replace(/_/g, " "),
        ]),
        columns: {
          0: { width: 26 },
          3: { width: 30 },
          4: { width: 24, align: "right" },
          5: { width: 24 },
        },
      };
      dates = itemDocuments
        .map((document) => document.date)
        .filter((value): value is string => Boolean(value));
    }

    const sorted = [...dates].sort();
    try {
      await exportItemActivityPdf({
        kind,
        item: {
          name: item.name,
          code: item.item_code,
          sku: item.sku,
          barcode: item.barcode,
          category: resolveCategoryDisplay(item, assignedCategory),
          depot: formatDepotLabel(assignedDepot),
          quantityLabel: itemQuantityLabel,
          lowStockLevel: String(itemLowStockThreshold),
        },
        table,
        branding: brandingFromSettings(businessSettings),
        period: sorted.length
          ? { from: sorted[0], to: sorted[sorted.length - 1] }
          : undefined,
      });
    } catch {
      setPdfError("The PDF could not be created. Please try again.");
    } finally {
      setPdfBusy(null);
    }
  };

  const pdfButton = (kind: ItemActivityReportKind, rowCount: number) => (
    <button
      type="button"
      onClick={() => void downloadSectionPdf(kind)}
      disabled={pdfBusy !== null}
      className={buttonClassName({ variant: "secondary", size: "sm" })}
      title={rowCount === 0 ? "Download an empty report" : "Download this section as a PDF"}
    >
      <UiIcon name="download" className="h-4 w-4" />
      {pdfBusy === kind ? "Preparing…" : "PDF"}
    </button>
  );

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
  /* ---- Item page v3 (5 Oct 2026, Sayed's reference) ---- */
  type TimelineEvent = {
    id: string;
    group: "movements" | "edits" | "created";
    tag: string;
    title: string;
    note: string;
    at: string;
    actorId: string | null | undefined;
    before: number | null;
    after: number | null;
    delta: number | null;
    icon: UiIconName;
    tone: string;
  };
  // Movements and edits in one timeline, newest first.
  const activity: TimelineEvent[] = [
    ...stockMovements.map((movement): TimelineEvent => ({
      id: `m-${movement.id}`,
      group: "movements",
      tag: "Movement",
      title: STOCK_MOVEMENT_LABELS[movement.movement_type],
      note: movement.notes ? formatStockMovementNotes(movement.notes) : "",
      at: movement.created_at,
      actorId: movement.actor_id,
      before: movement.quantity_before,
      after: movement.quantity_after,
      delta: movement.quantity_delta,
      icon: getActivityEventIcon(movement.movement_type) as UiIconName,
      tone: getActivityToneClasses(movement.movement_type),
    })),
    ...history.map((entry): TimelineEvent => {
      const eventType = HISTORY_ACTION_TO_EVENT_TYPE[entry.action] || "item_edited";
      const created = entry.action === "created";
      const before = typeof entry.old_quantity === "number" ? entry.old_quantity : null;
      const after = typeof entry.new_quantity === "number" ? entry.new_quantity : null;
      return {
        id: `h-${entry.id}`,
        group: created ? "created" : "edits",
        tag: created ? "Created" : "Edit",
        title: created ? "Item created" : `Item ${entry.action}`,
        note: created
          ? "Opening stock recorded"
          : before !== null && after !== null && before !== after
            ? "Quantity changed"
            : "Details updated",
        at: entry.created_at,
        actorId: entry.actor_id,
        before,
        after,
        delta: after !== null ? after - (before ?? 0) : null,
        icon: getActivityEventIcon(eventType) as UiIconName,
        tone: getActivityToneClasses(eventType),
      };
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const activityCounts = {
    all: activity.length,
    movements: activity.filter((event) => event.group === "movements").length,
    edits: activity.filter((event) => event.group === "edits").length,
    created: activity.filter((event) => event.group === "created").length,
  };
  const filteredActivity =
    activityFilter === "all"
      ? activity
      : activity.filter((event) => event.group === activityFilter);

  // Sales pace, from the invoices already loaded for this item.
  const thirtyDaysAgo = pageOpenedAt - 30 * 24 * 60 * 60 * 1000;
  const soldLast30 = itemDocuments
    .filter(
      (document) =>
        document.kind === "invoice" &&
        !["draft", "cancelled"].includes(document.status) &&
        document.date &&
        new Date(document.date).getTime() >= thirtyDaysAgo
    )
    .reduce((sum, document) => sum + Number(document.quantity || 0), 0);
  const daysOfStockLeft =
    item && soldLast30 > 0 ? Math.floor(item.quantity / (soldLast30 / 30)) : null;

  // The latest purchase order for this item, for the low-stock banner.
  const lastOrder =
    itemDocuments
      .filter((document) => document.kind === "order")
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      )[0] || null;

  const costNumber =
    item?.cost_price !== null && item?.cost_price !== undefined && item.cost_price !== ""
      ? Number(item.cost_price)
      : null;
  const sellNumber =
    item?.selling_price !== null && item?.selling_price !== undefined && item.selling_price !== ""
      ? Number(item.selling_price)
      : null;
  const marginNumber =
    costNumber !== null && sellNumber !== null ? sellNumber - costNumber : null;
  const marginPercent =
    marginNumber !== null && sellNumber ? Math.round((marginNumber / sellNumber) * 1000) / 10 : null;
  const potentialProfit =
    stockCostValue !== null && stockRetailValue !== null
      ? stockRetailValue - stockCostValue
      : null;

  const setupChecks = item
    ? [
        { label: "Photo", hint: "Recognise it at a glance", done: Boolean(item.image) },
        { label: "Category", hint: "Groups items in reports and filters", done: Boolean(item.category_id) },
        { label: "Depot", hint: "Where this stock physically sits", done: Boolean(item.depot_id) },
        { label: "Supplier", hint: "Who to reorder from", done: Boolean(item.supplier_id) },
        { label: "Cost price", hint: "Needed for stock value and margin", done: costNumber !== null },
        { label: "Selling price", hint: "Prefills invoices", done: sellNumber !== null },
        { label: "Minimum stock", hint: "When to warn you it is low", done: item.min_stock_level !== null && item.min_stock_level !== undefined },
        { label: "SKU", hint: "Matches your own codes", done: Boolean(item.sku) },
        { label: "Barcode", hint: "Scan it instead of searching", done: Boolean(item.barcode) },
      ]
    : [];
  const setupDone = setupChecks.filter((check) => check.done).length;
  const itemOut = item ? item.quantity <= 0 : false;
  const shortBy = item ? Math.max(0, itemLowStockThreshold - item.quantity) : 0;
  const restockHref = item
    ? `/dashboard/purchase-orders/new?items=${item.id}&returnTo=${encodeURIComponent(
        `/dashboard/inventory/${item.id}`
      )}`
    : "/dashboard/purchase-orders/new";

  const editDepotOptions = depots.filter(
    (depot) => depot.is_active || (item?.depot_id && depot.id === item.depot_id)
  );

  return (
    <div className="contents">
      {/* `item-detail` is the page scope for the Phase 2 type scale. This page
          is built from raw Tailwind utilities rather than a class namespace, so
          without a hook there is nothing for the scale to attach to -- it was
          rendering six different weights (400 through 900) all at 14px, which
          is weight doing every job and none of them well. */}
      <main className="item-detail">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
          {/* Item page v3 (5 Oct 2026), from Sayed's reference
              (docs/references/item-page-reference-2026-10-05.png). */}
          <section className="item-v3-header">
            <div className="item-v3-identity">
              <span className="item-v3-thumb" aria-hidden="true">
                {item?.image && failedImageSrc !== item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    onError={() => item && setFailedImageSrc(item.image)}
                  />
                ) : (
                  <UiIcon name="box" className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="item-v3-name">{item?.name || "Item details"}</h1>
                  {item && (
                    <StatusBadge
                      tone={itemOut ? "danger" : itemIsLowStock ? "warning" : "success"}
                    >
                      {itemOut ? "Out of stock" : itemIsLowStock ? "Low stock" : "In stock"}
                    </StatusBadge>
                  )}
                </div>
                {item && (
                  <p className="item-v3-meta">
                    {(item.item_code || item.sku) && (
                      <span className="item-v3-code">{item.item_code || item.sku}</span>
                    )}
                    <span>Unit · {itemUnitLabel}</span>
                    {item.created_at && (
                      <span>
                        Added{" "}
                        {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                          new Date(item.created_at)
                        )}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="item-v3-actions">
              <ContextBackButton
                fallbackHref="/dashboard/inventory"
                label={backLabel}
                className="min-h-9 rounded-lg px-3 py-1.5 text-sm"
              />
              {item && (
                <>
                  <ActionButton onClick={openEditModal} variant="secondary" icon="edit">
                    Edit item
                  </ActionButton>
                  <ActionButton onClick={openMovementModal} icon="movement">
                    Record movement
                  </ActionButton>
                </>
              )}
            </div>
          </section>

          {pageNotice && (
            <DashboardNotice tone="success">{pageNotice}</DashboardNotice>
          )}

          {pdfError && <DashboardNotice tone="danger">{pdfError}</DashboardNotice>}

          {loading && (
            <LoadingSkeletonGroup
              count={2}
              className="gap-5 xl:grid-cols-[1.15fr_0.85fr]"
              itemClassName="min-h-[420px] rounded-[32px]"
            />
          )}

          {!loading && authMissing && (
            <DashboardNotice tone="danger">
              Please sign in to view this item.
            </DashboardNotice>
          )}

          {!loading && !authMissing && (error || !item) && (
            <DashboardEmptyState
              icon="box"
              title="Item not found"
              description={
                error || "This item does not exist or you do not have access to it."
              }
              action={
                <Link href="/dashboard/inventory" className={buttonClassName()}>
                  Back to inventory
                </Link>
              }
            />
          )}


          {!loading && item && (
            <>
              {(itemOut || itemIsLowStock) && (
                <section
                  className={`item-v3-alert ${itemOut ? "item-v3-alert-danger" : ""}`}
                  role="status"
                >
                  <span className="item-v3-alert-icon" aria-hidden="true">
                    <UiIcon name="alert" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="item-v3-alert-title">
                      {itemOut
                        ? "Out of stock"
                        : shortBy > 0
                          ? `${shortBy} below minimum stock`
                          : "At its minimum stock level"}
                    </p>
                    <p className="item-v3-alert-text">
                      {itemQuantityLabel} on hand against a minimum of {itemLowStockThreshold}.
                      {lastOrder
                        ? lastOrder.status === "cancelled"
                          ? ` The last purchase order (${lastOrder.number}) was cancelled.`
                          : ["ordered", "partially_received"].includes(lastOrder.status)
                            ? ` Purchase order ${lastOrder.number} is on its way.`
                            : ` Last ordered on ${lastOrder.number}.`
                        : " There is no purchase order for this item yet."}
                    </p>
                  </div>
                  <div className="item-v3-alert-actions">
                    <button
                      type="button"
                      onClick={openEditModal}
                      className={buttonClassName({ variant: "secondary", size: "sm" })}
                    >
                      Adjust minimum
                    </button>
                    <Link href={restockHref} className={buttonClassName({ size: "sm" })}>
                      Create purchase order
                    </Link>
                  </div>
                </section>
              )}

              {/* The big photo Sayed asked for, beside the four numbers. */}
              <div className="item-v3-hero">
                <section className="item-v3-card item-v3-photo-card item-page-photo">
                  {item.image && failedImageSrc !== item.image ? (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="item-v3-photo group"
                      aria-label={`Enlarge image of ${item.name}`}
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        priority
                        sizes="(min-width: 1280px) 34rem, 100vw"
                        onError={() => setFailedImageSrc(item.image)}
                        className="object-contain"
                      />
                      <span className="item-v3-photo-zoom">
                        <UiIcon name="search" className="h-3.5 w-3.5" />
                        Click to enlarge
                      </span>
                    </button>
                  ) : (
                    <div className="item-v3-photo item-v3-photo-empty">
                      <UiIcon name="upload" className="h-8 w-8" />
                      <span>No photo yet</span>
                      <button
                        type="button"
                        onClick={openEditModal}
                        className={buttonClassName({ variant: "secondary", size: "sm" })}
                      >
                        Upload photo
                      </button>
                    </div>
                  )}
                </section>

                <div className="item-v3-figures">
                  <div className="item-v3-figure">
                    <span>On hand</span>
                    <strong>
                      {item.quantity}
                      <small> {itemUnitLabel.toLowerCase()}</small>
                    </strong>
                    <span
                      className={`item-v3-meter ${
                        itemOut ? "is-out" : itemIsLowStock ? "is-low" : "is-ok"
                      }`}
                      aria-hidden="true"
                    >
                      <i
                        style={{
                          width: `${Math.min(
                            100,
                            itemLowStockThreshold > 0
                              ? (item.quantity / (itemLowStockThreshold * 2)) * 100
                              : 100
                          )}%`,
                        }}
                      />
                    </span>
                    <small>
                      Minimum {itemLowStockThreshold}
                      {daysOfStockLeft !== null
                        ? ` · sold ${soldLast30} in 30 days · ~${daysOfStockLeft} days left`
                        : ""}
                    </small>
                  </div>
                  <div className="item-v3-figure">
                    <span>Stock value at cost</span>
                    <strong>{stockCostValueText || "—"}</strong>
                    <small>
                      {costPriceText
                        ? `${item.quantity} × ${costPriceText} cost price`
                        : "Add a cost price to see this"}
                    </small>
                  </div>
                  <div className="item-v3-figure">
                    <span>Stock value at retail</span>
                    <strong>{stockRetailValueText || "—"}</strong>
                    <small className={potentialProfit !== null && potentialProfit > 0 ? "is-positive" : ""}>
                      {potentialProfit !== null
                        ? `${formatInventoryPrice(potentialProfit, editCurrencyCode)} potential profit`
                        : "Add both prices to see profit"}
                    </small>
                  </div>
                  <div className="item-v3-figure">
                    <span>Margin per {itemUnitLabel.toLowerCase()}</span>
                    <strong>
                      {marginNumber !== null
                        ? formatInventoryPrice(marginNumber, editCurrencyCode)
                        : "—"}
                      {marginPercent !== null && (
                        <small className={marginPercent >= 0 ? "is-positive" : "is-negative"}>
                          {" "}
                          {marginPercent}%
                        </small>
                      )}
                    </strong>
                    <small>{sellingPriceText ? `Sells at ${sellingPriceText}` : "No selling price"}</small>
                  </div>
                </div>
              </div>

              <div className="item-v3-columns">
                <div className="item-v3-main">
                  <section className="item-v3-card">
                    <div className="item-v3-card-head">
                      <h2 className="item-v3-title">Item details</h2>
                      <button type="button" onClick={openEditModal} className="item-v3-link">
                        Edit
                      </button>
                    </div>
                    <dl className="item-v3-facts">
                      <div>
                        <dt>Category</dt>
                        <dd className={item.category_id ? "" : "is-empty"}>
                          {resolveCategoryDisplay(item, assignedCategory)}
                        </dd>
                      </div>
                      <div>
                        <dt>Depot</dt>
                        <dd className={item.depot_id ? "" : "is-empty"}>
                          {formatDepotLabel(assignedDepot)}
                        </dd>
                      </div>
                      <div>
                        <dt>Supplier</dt>
                        <dd className={assignedSupplier ? "" : "is-empty"}>
                          {assignedSupplier?.name || "No supplier"}
                        </dd>
                      </div>
                      <div>
                        <dt>Supplier contact</dt>
                        <dd className={assignedSupplier?.contact_name ? "" : "is-empty"}>
                          {assignedSupplier?.contact_name || "Not set"}
                          {(assignedSupplier?.phone || assignedSupplier?.email) && (
                            <small>{assignedSupplier?.phone || assignedSupplier?.email}</small>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Unit of measure</dt>
                        <dd>{itemUnitLabel}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatCreatedDate(item.created_at)}</dd>
                      </div>
                    </dl>

                    <div className="item-v3-pricing">
                      <div className="item-v3-card-head">
                        <h3>Pricing</h3>
                        <span className="text-xs text-theme-muted">
                          per {itemUnitLabel.toLowerCase()}
                        </span>
                      </div>
                      {costNumber !== null && sellNumber !== null && sellNumber > 0 ? (
                        <span className="item-v3-price-bar" aria-hidden="true">
                          <i
                            className="is-cost"
                            style={{ width: `${Math.min(100, Math.max(0, (costNumber / sellNumber) * 100))}%` }}
                          />
                          <i className="is-margin" />
                        </span>
                      ) : null}
                      <div className="item-v3-price-legend">
                        <div>
                          <span><i className="is-cost" />Cost</span>
                          <strong>{costPriceText || "Not set"}</strong>
                        </div>
                        <div>
                          <span><i className="is-margin" />Margin</span>
                          <strong>
                            {marginNumber !== null
                              ? formatInventoryPrice(marginNumber, editCurrencyCode)
                              : "—"}
                          </strong>
                        </div>
                        <div>
                          <span>Selling price</span>
                          <strong>{sellingPriceText || "Not set"}</strong>
                        </div>
                        {lastOrder && lastOrder.unitAmount !== null && (
                          <div>
                            <span>Last purchase</span>
                            <strong>
                              {formatExactPrice(
                                lastOrder.unitAmount,
                                lastOrder.currency || getCurrencyContext().base
                              )}
                            </strong>
                            <small>{lastOrder.number}</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Renders nothing until two movements exist. */}
                  <StockLevelChart
                    points={stockMovements.map((movement) => ({
                      at: movement.created_at,
                      quantity: movement.quantity_after,
                    }))}
                    threshold={itemLowStockThreshold}
                    unitLabel={(quantity) =>
                      getInventoryQuantityLabel(quantity, item.unit_type, item.custom_unit_label)
                    }
                  />

                  <section className="item-v3-card" id="history">
                    <div className="item-v3-card-head item-v3-card-head-wrap">
                      <div>
                        <h2 className="item-v3-title">Activity</h2>
                        <p className="item-v3-sub">Stock movements and edits in one timeline</p>
                      </div>
                      <div className="item-v3-head-tools">
                        <div className="item-v3-tabs" role="tablist" aria-label="Filter activity">
                          {(
                            [
                              ["all", "All"],
                              ["movements", "Movements"],
                              ["edits", "Edits"],
                              ["created", "Created"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              role="tab"
                              aria-selected={activityFilter === value}
                              onClick={() => {
                                setActivityFilter(value);
                                setActivityLimit(10);
                              }}
                              className={activityFilter === value ? "is-active" : ""}
                            >
                              {label}
                              <span>{activityCounts[value]}</span>
                            </button>
                          ))}
                        </div>
                        {pdfButton("activity", filteredActivity.length)}
                      </div>
                    </div>

                    {filteredActivity.length === 0 ? (
                      <p className="item-v3-empty">Nothing here yet.</p>
                    ) : (
                      <ul className="item-v3-timeline">
                        {filteredActivity.slice(0, activityLimit).map((event) => (
                          <li key={event.id}>
                            <span className={`item-v3-event-icon ${event.tone}`} aria-hidden="true">
                              <UiIcon name={event.icon} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="item-v3-event-title">
                                <strong>{event.title}</strong>
                                <span className="item-v3-tag">{event.tag}</span>
                              </p>
                              {event.note && (
                                <p className="item-v3-event-note" title={event.note}>
                                  {event.note}
                                </p>
                              )}
                              <p className="item-v3-event-meta">
                                {formatCreatedDate(event.at)}
                                <DoneBy actorId={event.actorId} className="done-by done-by-inline" />
                              </p>
                            </div>
                            <div className="item-v3-event-qty">
                              <span>
                                {event.before === null ? "—" : event.before} → {event.after === null ? "—" : event.after}
                              </span>
                              {event.delta !== null && (
                                <strong
                                  className={
                                    event.delta < 0
                                      ? "text-theme-danger"
                                      : event.delta > 0
                                        ? "text-theme-success"
                                        : "text-theme-muted"
                                  }
                                >
                                  {formatQuantityDelta(event.delta)}
                                </strong>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {filteredActivity.length > activityLimit && (
                      <button
                        type="button"
                        onClick={() => setActivityLimit((limit) => limit + 20)}
                        className={buttonClassName({ variant: "secondary", size: "sm", className: "mt-3" })}
                      >
                        Show more
                        <span className="text-theme-muted">
                          {" "}· {filteredActivity.length - activityLimit} older
                        </span>
                      </button>
                    )}
                  </section>

                  <section className="item-v3-card">
                    <div className="item-v3-card-head">
                      <div>
                        <h2 className="item-v3-title">Purchase &amp; sales documents</h2>
                        <p className="item-v3-sub">Orders and invoices that include this item</p>
                      </div>
                      <div className="item-v3-head-tools">
                        <span className="item-activity-count">
                          {itemDocuments.length}{" "}
                          {itemDocuments.length === 1 ? "document" : "documents"}
                        </span>
                        {pdfButton("documents", itemDocuments.length)}
                      </div>
                    </div>
                    {itemDocuments.length === 0 ? (
                      <p className="item-v3-empty">Not on any invoice or purchase order yet.</p>
                    ) : (
                      <div className="item-v3-table-wrap">
                        <table className="item-v3-table">
                          <thead>
                            <tr>
                              <th>Document</th>
                              <th>Date</th>
                              <th className="text-right">Qty</th>
                              <th className="text-right">Unit price</th>
                              <th className="text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemDocuments.slice(0, documentLimit).map((document) => (
                              <tr key={`${document.kind}-${document.id}`}>
                                <td>
                                  <Link href={document.href} className="item-v3-doc-link">
                                    <span className="po-line-type-chip" aria-hidden="true">
                                      <UiIcon
                                        name={document.kind === "invoice" ? "receipt" : "cart"}
                                        className="h-4 w-4"
                                      />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="item-v3-code">{document.number}</span>
                                      {document.party && <small>{document.party}</small>}
                                    </span>
                                  </Link>
                                </td>
                                <td>{document.date ? formatDocumentDay(document.date) : "—"}</td>
                                <td className="text-right tabular-nums">
                                  {document.quantity}
                                  {document.kind === "order" && document.received !== null && document.received > 0
                                    ? ` (${document.received} in)`
                                    : ""}
                                </td>
                                <td className="text-right tabular-nums">
                                  {document.unitAmount !== null
                                    ? formatExactPrice(
                                        document.unitAmount,
                                        document.currency || getCurrencyContext().base
                                      )
                                    : "—"}
                                </td>
                                <td className="text-right">
                                  <StatusBadge tone={documentTone(document.status)}>
                                    {document.status.replace(/_/g, " ")}
                                  </StatusBadge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {itemDocuments.length > documentLimit && (
                      <button
                        type="button"
                        onClick={() => setDocumentLimit((limit) => limit + 20)}
                        className={buttonClassName({ variant: "secondary", size: "sm", className: "mt-3" })}
                      >
                        Show more
                        <span className="text-theme-muted">
                          {" "}· {itemDocuments.length - documentLimit} older
                        </span>
                      </button>
                    )}
                  </section>

                  <section className="item-v3-card">
                    <div className="item-v3-card-head">
                      <h2 className="item-v3-title">Notes</h2>
                      <button type="button" onClick={openEditModal} className="item-v3-link">
                        {item.notes ? "Edit" : "Add a note"}
                      </button>
                    </div>
                    <p className={`item-v3-notes ${item.notes ? "" : "is-empty"}`}>
                      {item.notes || "Handling instructions, storage tips or anything your team should know."}
                    </p>
                  </section>
                </div>

                <aside className="item-v3-side">
                  <section className="item-v3-card">
                    <div className="item-v3-card-head">
                      <h2 className="item-v3-title">Item setup</h2>
                      <span className="item-v3-setup-count">
                        {setupDone} of {setupChecks.length}
                      </span>
                    </div>
                    <span className="item-v3-setup-bar" aria-hidden="true">
                      <i style={{ width: `${(setupDone / Math.max(1, setupChecks.length)) * 100}%` }} />
                    </span>
                    {setupDone < setupChecks.length ? (
                      <>
                        <p className="item-v3-sub mt-2">
                          Complete these so reorders, reports and labels work properly.
                        </p>
                        <ul className="item-v3-setup">
                          {setupChecks
                            .filter((check) => !check.done)
                            .map((check) => (
                              <li key={check.label}>
                                <span className="item-v3-setup-dot" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                  <strong>{check.label}</strong>
                                  <small>{check.hint}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={openEditModal}
                                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                                  aria-label={`Add ${check.label.toLowerCase()}`}
                                >
                                  Add
                                </button>
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : (
                      <p className="item-v3-sub mt-2">Everything is filled in.</p>
                    )}
                  </section>

                  <section className="item-v3-card">
                    <h2 className="item-v3-title">Identifiers</h2>
                    <dl className="item-v3-ids">
                      <div>
                        <dt>Item code</dt>
                        <dd className="item-v3-code">{item.item_code?.trim() || "Not generated yet"}</dd>
                      </div>
                      <div>
                        <dt>SKU</dt>
                        <dd className={item.sku ? "item-v3-code" : "is-empty"}>{item.sku || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>Barcode</dt>
                        <dd className={item.barcode ? "item-v3-code" : "is-empty"}>
                          {item.barcode || "Not set"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="item-v3-card item-v3-qr">
                    <h2 className="item-v3-title">Public QR code</h2>
                    <p className="item-v3-sub">Scan to open this item&rsquo;s public page</p>
                    <div ref={qrCodeRef} className="item-v3-qr-code">
                      {qrUrl ? (
                        <QRCode value={qrUrl} size={148} bgColor="#ffffff" fgColor="#02030a" level="M" />
                      ) : (
                        <div className="flex h-[148px] w-[148px] items-center justify-center text-center text-sm text-theme-subtle">
                          Public link unavailable
                        </div>
                      )}
                    </div>
                    {qrUrl && <p className="item-v3-qr-url">{qrUrl}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={copyQrLink}
                        disabled={!qrUrl}
                        className={buttonClassName({ variant: "secondary", size: "sm" })}
                      >
                        {copyLabel}
                      </button>
                      <button
                        type="button"
                        onClick={downloadQrCode}
                        disabled={!qrUrl}
                        className={buttonClassName({ size: "sm" })}
                      >
                        Download QR
                      </button>
                    </div>
                  </section>

                  {canDeleteRecords && (
                    <section className="item-v3-card item-v3-danger">
                      <div className="min-w-0">
                        <h2>Delete item</h2>
                        <p>Removes it from stock and reports</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        disabled={isDeleting}
                        className={buttonClassName({ variant: "danger", size: "sm" })}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </section>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      {/* The Inventory page already has this dialog; this page had a second,
          hand-built copy of it in emerald with its own validation. One
          dialog now, the item pre-selected. */}
      <StockMovementDialog
        open={isMovementModalOpen && Boolean(item)}
        items={item ? [item] : []}
        initialItemId={item?.id}
        onClose={() => setIsMovementModalOpen(false)}
        onRecorded={async (movement, itemId) => {
          if (!item) return;
          const {
            data: { user },
          } = await getBusinessUser();
          if (!user) return;

          const { data: refreshedItem, error: refreshError } = await supabase
            .from("inventory")
            .select("*")
            .eq("id", itemId)
            .eq("user_id", user.id)
            .limit(1);

          if (!refreshError && refreshedItem?.[0]) {
            setItem(refreshedItem[0] as Item);
          } else {
            setItem({ ...item, quantity: movement.quantity_after });
          }

          await fetchStockMovements(user.id, itemId);
          setPageNotice("Stock movement recorded successfully.");
        }}
      />

      {/* Same shell as Inventory's own quick edit (components/inventory/ItemPanel),
          so one design covers both instead of two dialogs doing the same job
          with a border color and a shadow value that had already drifted
          apart from each other. */}
      {isEditModalOpen && item && (
        <ItemPanel
          eyebrow="Edit item"
          title={item.name}
          onClose={() => closeEditModal()}
          closeDisabled={isEditing}
        >
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
            onCreateCategory={handleCreateCategoryInline}
            onCreateDepot={handleCreateDepotInline}
            onCreateSupplier={handleCreateSupplierInline}
          />
        </ItemPanel>
      )}

      {isDeleteDialogOpen && item && (
        <DialogShell
          title={`Delete ${item.name}?`}
          eyebrow="Delete inventory item"
          description="This removes the item from inventory. This action cannot be undone."
          tone="danger"
          onClose={() => setIsDeleteDialogOpen(false)}
          closeDisabled={isDeleting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void deleteItem()}
                loading={isDeleting}
                loadingLabel="Deleting..."
              >
                Delete Item
              </Button>
            </>
          }
        />
      )}

      {/* Mounted only while open, so zoom and pan reset on close by unmounting
          rather than by an effect syncing state back to its defaults. */}
      {item?.image && failedImageSrc !== item.image && lightboxOpen && (
        <ImageLightbox
          src={item.image}
          alt={item.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
