"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  createProductImagePath,
  getImageValidationError,
} from "@/app/lib/productImage";
import Link from "next/link";
import CategorySelector from "@/components/CategorySelector";
import {
  ActionButton,
  DashboardNotice,
} from "@/components/dashboard/Workspace";
import Select from "@/components/ui/Select";
import {
  buttonClassName,
  FieldGroup,
  FieldRow,
  UnsavedChangesGuard,
  useToast,
} from "@/components/ui";
import ScannerModal from "@/components/scanner/ScannerModal";
import { LockedActionLabel, UpgradeDialog } from "@/components/UpgradePrompt";
import {
  getCategoriesForUser,
  type Category,
} from "@/app/lib/categories";
import {
  formatDepotLabel,
  getActiveDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  createCategoryInline,
  createDepotInline,
  createSupplierInline,
} from "@/app/lib/inlineCreate";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import {
  calculateInventoryValue,
  DEFAULT_INVENTORY_UNIT_TYPE,
  formatInventoryPrice,
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNIT_TYPES,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { resolveScannedCode, type ScannableItem } from "@/app/lib/scannerResolve";
import { supabase } from "@/app/lib/supabase";
import {
  getSuppliersForUser,
  type Supplier,
} from "@/app/lib/suppliers";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getPlanLimitMessage,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  type SubscriptionUsage,
  type UpgradePlan,
} from "@/app/lib/subscription";

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

// Minimal shape for the duplicate-barcode check — a leaner query than
// loading the full inventory list this page has never needed before.
interface ScanCandidateItem extends ScannableItem {
  id: number;
  name: string;
}

type FieldName =
  | "name"
  | "quantity"
  | "unitType"
  | "customUnitLabel"
  | "costPrice"
  | "sellingPrice"
  | "minStockLevel";

type FieldErrors = Partial<Record<FieldName, string>>;

async function getBusinessCurrency(userId: string) {
  const { data, error } = await supabase
    .from("business_settings")
    .select("currency_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return "USD";

  return normalizeCurrencyCode(data?.currency_code, "USD");
}

function getSaveErrorMessage(error: {
  code?: string;
  message?: string;
  details?: string;
}) {
  const errorText = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  if (errorText.includes("supplier")) {
    return "The supplier could not be linked. Choose one of your own suppliers or contact support if this keeps happening.";
  }
  if (errorText.includes("category")) {
    return "The category could not be linked. Choose one of your own categories or contact support if this keeps happening.";
  }

  const phaseFields = [
    "unit_type",
    "custom_unit_label",
    "cost_price",
    "selling_price",
    "min_stock_level",
    "barcode",
    "category_id",
  ];

  if (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    phaseFields.some((field) => errorText.includes(field))
  ) {
    return "Some item detail fields are not available in this workspace yet. Contact support if this keeps happening.";
  }

  return "We could not save this item. Please try again.";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm font-semibold text-theme-danger">
      {message}
    </p>
  );
}

function PhotoIcon() {
  return (
    // No fixed size: `.item-photo-tile svg` sizes it as a share of the tile,
    // which is now three different sizes (panel, wide panel, page).
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="m3.5 16 4.5-4.3a2 2 0 0 1 2.8 0L15 15.5m-3-2.8 1.3-1.3a2 2 0 0 1 2.8 0L20.5 15"
      />
      <circle cx="8.5" cy="10" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface AddItemFormProps {
  /** Prefills the barcode field without a round trip through the URL --
   *  used when Inventory opens this form as a panel straight from a scan
   *  that matched no existing item. The standalone page still supports the
   *  same thing via a `?barcode=` query param, read below. */
  initialBarcode?: string;
  /** Preselects a category without a URL round trip -- the Categories page
   *  opens this panel with its own category already chosen. The standalone
   *  page still supports the same thing via `?category=`. */
  initialCategoryId?: string;
  /** Called once the item is created and its history entry is logged.
   *  The page and the panel each decide what "done" means for them --
   *  navigate away, or close and refresh the list -- so this form only
   *  reports success, never navigates itself. */
  onSaved: () => void;
  onCancel: () => void;
}

export default function AddItemForm({
  initialBarcode,
  initialCategoryId,
  onSaved,
  onCancel,
}: AddItemFormProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitType, setUnitType] = useState<InventoryUnitType>(
    DEFAULT_INVENTORY_UNIT_TYPE
  );
  const [customUnitLabel, setCustomUnitLabel] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [selectedDepotId, setSelectedDepotId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  /* Everything here starts empty, so any value at all is work worth keeping.
     Off while saving, so the redirect after a successful save is not
     challenged. In the slide-over the sidebar sits behind an overlay and is
     not clickable, so this is really guarding the full page -- but the
     tab-close half applies to both. */
  const hasUnsavedWork =
    !loading &&
    Boolean(
      name.trim() ||
        sku.trim() ||
        barcode.trim() ||
        quantity.trim() ||
        minStockLevel.trim() ||
        costPrice.trim() ||
        sellingPrice.trim() ||
        notes.trim() ||
        image ||
        selectedCategoryId ||
        selectedDepotId ||
        selectedSupplierId
    );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLimitError, setIsLimitError] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* The "Add quantity, pricing & more" disclosure exists so the narrow
     slide-over asks for four things instead of twenty. It stops earning its
     keep the moment the form is wide enough for two columns -- the wide panel
     and the standalone page both were, and both sat there with an empty right
     half and a button asking you to fill it.

     720px is not a second opinion about the layout: it is the same threshold
     `.item-form-groups` uses to go two-column, read off the element itself
     rather than off the window, because the same form renders at 30rem and at
     1180px. Measured, not assumed -- nothing here can tell which one it is.

     `showAdvanced || roomy` and never `setShowAdvanced` from in here: opening
     it by hand while narrow must survive the panel being widened and narrowed
     again. */
  const formRef = useRef<HTMLDivElement>(null);
  const [roomy, setRoomy] = useState(false);

  useEffect(() => {
    const element = formRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setRoomy(entry.contentRect.width >= 720);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const advancedOpen = showAdvanced || roomy;

  // backlog item 1 (P1, approved): scan the barcode on the carton, then fill
  // in the rest. `isScannerOpen` drives the shared ScannerModal (already used
  // by Inventory's own Scan button — nothing new built here); `barcodeNotice`
  // reports what the scan found; `lockedFeature` reuses the same
  // plan-gate pattern Inventory/Scanner already use for this capability.
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [barcodeNotice, setBarcodeNotice] = useState<{
    tone: "success" | "warning";
    text: string;
    existingItemId?: number;
  } | null>(null);
  const [lockedFeature, setLockedFeature] = useState<{
    feature: string;
    benefit: string;
    requiredPlan: UpgradePlan;
    source: string;
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setUsageLoading(false);
          return;
        }

        Promise.all([
          getSubscriptionUsage(user.id),
          getActiveDepotsForUser(user.id).catch(() => []),
          getSuppliersForUser(user.id).catch(() => []),
          getCategoriesForUser(user.id).catch(() => []),
          getBusinessCurrency(user.id),
        ])
          .then(
            ([
              usage,
              loadedDepots,
              loadedSuppliers,
              loadedCategories,
              loadedCurrency,
            ]) => {
              if (!isActive) return;

              setSubscriptionUsage(usage);
              setDepots(loadedDepots);
              setSuppliers(loadedSuppliers);
              setCategories(loadedCategories);

              // The standalone page still supports arriving with a category
              // preselected (Categories' own "Add item" deep link). The
              // panel never sets this — it opens from Inventory, which has
              // no such notion — so this simply finds nothing there.
              const navigationParams = new URLSearchParams(
                window.location.search
              );
              const requestedCategoryId =
                initialCategoryId || navigationParams.get("category");
              if (
                requestedCategoryId &&
                loadedCategories.some(
                  (category) => String(category.id) === requestedCategoryId
                )
              ) {
                setSelectedCategoryId(requestedCategoryId);
              }

              // Arriving from a scan that matched no existing item. The panel
              // passes this straight as a prop; the standalone page (reached
              // by a direct link rather than opened in place) still supports
              // the same thing via `?barcode=`.
              const requestedBarcode =
                initialBarcode || navigationParams.get("barcode");
              if (requestedBarcode) {
                setBarcode(requestedBarcode);
                setBarcodeNotice({
                  tone: "success",
                  text: `Barcode ${requestedBarcode} added from your scan. Fill in the rest below.`,
                });
                // Otherwise this lands in a field hidden behind the closed
                // "Add Optional Details" gate — the whole point of scanning
                // first is seeing it landed.
                setShowAdvanced(true);
              }

              setCurrencyCode(loadedCurrency);
              setUsageLoading(false);
            }
          )
          .catch(() => {
            if (!isActive) return;

            setCurrencyCode("USD");
            setUsageLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;

        setUsageLoading(false);
      });

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image]
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;

    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const stockCostValue = useMemo(
    () => calculateInventoryValue(quantity, costPrice),
    [costPrice, quantity]
  );
  const stockRetailValue = useMemo(
    () => calculateInventoryValue(quantity, sellingPrice),
    [quantity, sellingPrice]
  );

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  /* Add a category/depot/supplier straight from its dropdown. Each one adds
     the new record to the list it just came from and returns its id, which
     the Select then selects -- so the answer to "it isn't in here" is one
     row, not a trip to another page and back. A failure surfaces in the
     form's own error line rather than silently doing nothing. */
  const handleCreateCategory = async (name: string) => {
    try {
      const created = await createCategoryInline(name);
      setCategories((current) => [...current, created]);
      return String(created.id);
    } catch {
      setFormError(`Could not add the category "${name}". Please try again.`);
      return null;
    }
  };

  const handleCreateDepot = async (name: string) => {
    try {
      const created = await createDepotInline(name);
      setDepots((current) => [...current, created]);
      return String(created.id);
    } catch {
      setFormError(`Could not add the depot "${name}". Please try again.`);
      return null;
    }
  };

  const handleCreateSupplier = async (name: string) => {
    try {
      const created = await createSupplierInline(name);
      setSuppliers((current) => [...current, created]);
      return String(created.id);
    } catch {
      setFormError(`Could not add the supplier "${name}". Please try again.`);
      return null;
    }
  };

  const handleImageChange = (file: File | null) => {
    setImageError("");

    if (!file) {
      setImage(null);
      return;
    }

    const validationError = getImageValidationError(file);

    if (validationError) {
      setImage(null);
      setImageError(validationError);
      return;
    }

    setImage(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    setIsLimitError(false);

    const trimmedName = name.trim();
    const trimmedCustomUnitLabel = customUnitLabel.trim();
    // Blank means 0, not invalid: quick add lets you save a name-only item and
    // set stock later. Treating blank as an error would fail the form on a
    // field that lives inside the collapsed "Add Optional Details" section.
    const quantityValue = quantity === "" ? 0 : Number(quantity);
    const costPriceValue = costPrice === "" ? null : Number(costPrice);
    const sellingPriceValue =
      sellingPrice === "" ? null : Number(sellingPrice);
    const minStockLevelValue =
      minStockLevel === "" ? null : Number(minStockLevel);
    const nextFieldErrors: FieldErrors = {};

    if (!trimmedName) {
      nextFieldErrors.name = "Product name is required.";
    }

    if (
      !Number.isFinite(quantityValue) ||
      !Number.isInteger(quantityValue) ||
      quantityValue < 0
    ) {
      nextFieldErrors.quantity = "Enter a whole quantity of 0 or more.";
    }

    if (!INVENTORY_UNIT_TYPES.includes(unitType)) {
      nextFieldErrors.unitType = "Choose a valid unit.";
    }

    if (unitType === "custom" && !trimmedCustomUnitLabel) {
      nextFieldErrors.customUnitLabel = "Add a label for the custom unit.";
    }

    if (
      costPriceValue !== null &&
      (!Number.isFinite(costPriceValue) || costPriceValue < 0)
    ) {
      nextFieldErrors.costPrice = "Cost price must be 0 or more.";
    }

    if (
      sellingPriceValue !== null &&
      (!Number.isFinite(sellingPriceValue) || sellingPriceValue < 0)
    ) {
      nextFieldErrors.sellingPrice = "Selling price must be 0 or more.";
    }

    if (
      minStockLevelValue !== null &&
      (!Number.isFinite(minStockLevelValue) ||
        !Number.isInteger(minStockLevelValue) ||
        minStockLevelValue < 0)
    ) {
      nextFieldErrors.minStockLevel =
        "Minimum stock must be a whole number of 0 or more.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError("Review the highlighted fields before saving.");

      // Every field except the name lives inside "Add Optional Details". Asking
      // someone to review a highlighted field while it is collapsed out of view
      // is a dead end, so open the section whenever it holds an error.
      const hasHiddenError = Object.keys(nextFieldErrors).some(
        (field) => field !== "name"
      );
      if (hasHiddenError) setShowAdvanced(true);

      return;
    }

    try {
      setLoading(true);
      setFormError("");
      setFieldErrors({});
      setImageError("");
      setIsLimitError(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFormError("Please sign in again before adding inventory.");
        return;
      }

      const usage = await getSubscriptionUsage(user.id, {
        strictCount: true,
      });
      setSubscriptionUsage(usage);

      if (usage.usedItems >= usage.subscription.item_limit) {
        setFormError(getPlanLimitMessage(usage.subscription.plan));
        setIsLimitError(true);
        return;
      }

      let imageUrl = "";

      if (image) {
        const validationError = getImageValidationError(image);

        if (validationError) {
          setImageError(validationError);
          return;
        }

        const fileName = createProductImagePath(user.id, image);
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          setFormError(
            "Image upload failed. Try a smaller file or a different image."
          );
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const newItem = {
        name: trimmedName,
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        category:
          categories.find(
            (category) => String(category.id) === selectedCategoryId
          )?.name || null,
        category_id: selectedCategoryId
          ? Number(selectedCategoryId)
          : null,
        quantity: quantityValue as number,
        unit_type: unitType,
        custom_unit_label:
          unitType === "custom" ? trimmedCustomUnitLabel : null,
        cost_price: costPriceValue,
        selling_price: sellingPriceValue,
        min_stock_level: minStockLevelValue,
        notes,
        image: imageUrl,
        depot_id: selectedDepotId ? Number(selectedDepotId) : null,
        supplier_id: selectedSupplierId ? Number(selectedSupplierId) : null,
        user_id: user.id,
      };

      const { data: createdItem, error } = await supabase
        .from("inventory")
        .insert([newItem])
        .select("*")
        .single();

      if (error) {
        setFormError(getSaveErrorMessage(error));
        return;
      }

      if (createdItem) {
        await logInventoryHistory({
          itemId: createdItem.id,
          userId: user.id,
          action: "created",
          newQuantity: createdItem.quantity,
          newValues: createdItem,
        });
      }

      showToast({
        tone: "success",
        message: createdItem
          ? `${createdItem.name} added to your inventory.`
          : "Item added to your inventory.",
      });

      onSaved();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving this item."
      );
    } finally {
      setLoading(false);
    }
  };

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const canUseScanner = Boolean(planCapabilities.scanner);

  const openBarcodeScanner = () => {
    if (!canUseScanner) {
      setLockedFeature({
        feature: "Barcode scanner",
        benefit:
          "Scan a product's barcode to fill it in instantly instead of typing it.",
        requiredPlan: "Standard",
        source: "add-item-scan",
      });
      return;
    }

    setBarcodeNotice(null);
    setIsScannerOpen(true);
  };

  const closeBarcodeScanner = () => setIsScannerOpen(false);

  // backlog item 1: "a barcode identifies a product type, not a physical
  // unit, so 'same barcode = same item' is right for inventory." Scanning a
  // code that already belongs to an item must not silently create a
  // duplicate — it should point at the existing item instead. Reuses the
  // same resolveScannedCode() every other scan surface in the app uses, so a
  // code is interpreted identically everywhere; this page just adds a new
  // call site, no new resolution logic.
  // Shared by the Scan button and by typing a barcode in by hand, so both
  // paths interpret a code identically. Returns null when the check could not
  // run (not signed in / query failed) — callers treat that as "unknown", never
  // as "no duplicate", so a failed lookup can't silently green-light a dupe.
  const lookupBarcodeOwner = async (code: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("inventory")
      .select("id, name, sku, barcode, public_id")
      .eq("user_id", user.id);

    if (error) return null;

    return resolveScannedCode<ScanCandidateItem>(
      code,
      (data as ScanCandidateItem[] | null) || []
    );
  };

  const describeBarcodeConflict = (
    resolution: NonNullable<Awaited<ReturnType<typeof lookupBarcodeOwner>>>
  ) => {
    if (resolution.kind === "item") {
      return {
        tone: "warning" as const,
        text: `This code already belongs to “${resolution.item.name}.” Go there to adjust its stock instead of creating a duplicate.`,
        existingItemId: resolution.item.id,
      };
    }

    if (resolution.kind === "ambiguous") {
      return {
        tone: "warning" as const,
        text: `${resolution.items.length} existing items share that code — check Inventory before adding a new one.`,
      };
    }

    return null;
  };

  const handleBarcodeScanned = async (scannedValue: string) => {
    const scannedText = scannedValue.trim();
    closeBarcodeScanner();

    if (!scannedText) {
      setBarcodeNotice({
        tone: "warning",
        text: "We could not read that code. Try scanning again, or type it in below.",
      });
      return;
    }

    const acceptScannedCode = () => {
      setBarcode(scannedText);
      setBarcodeNotice({
        tone: "success",
        text: `Barcode ${scannedText} added. Fill in the rest below.`,
      });
    };

    try {
      setIsCheckingBarcode(true);

      const resolution = await lookupBarcodeOwner(scannedText);

      if (!resolution) {
        acceptScannedCode();
        return;
      }

      const conflict = describeBarcodeConflict(resolution);

      if (conflict) {
        setBarcodeNotice(conflict);
        return;
      }

      acceptScannedCode();
    } catch {
      acceptScannedCode();
    } finally {
      setIsCheckingBarcode(false);
    }
  };

  // backlog item 1 follow-up: only the scan path checked for duplicates, so a
  // barcode TYPED by hand could still create the "same barcode, two items"
  // state the founder's own rule rules out. Checked on blur (once the field is
  // finished) rather than per keystroke, which would query on every character.
  // Warns rather than blocks the save: the scan path already prevents the dupe
  // at source, and hard-blocking an existing working form is a bigger
  // behaviour change than this gap warrants. If duplicates still show up in
  // practice, promoting this to a blocking validation is the next step.
  const handleBarcodeBlur = async () => {
    const typedText = barcode.trim();

    if (!typedText || isCheckingBarcode) return;
    // Don't re-warn about a conflict already on screen for this same code.
    if (barcodeNotice?.tone === "warning" && barcodeNotice.existingItemId) return;

    try {
      setIsCheckingBarcode(true);

      const resolution = await lookupBarcodeOwner(typedText);

      if (!resolution) return;

      const conflict = describeBarcodeConflict(resolution);

      if (conflict) setBarcodeNotice(conflict);
    } catch {
      // A failed check leaves the typed value alone and says nothing rather
      // than claiming the code is free.
    } finally {
      setIsCheckingBarcode(false);
    }
  };
  const itemUsageText = `${subscriptionUsage.usedItems} / ${subscriptionUsage.subscription.item_limit} items`;
  const formattedCostValue =
    stockCostValue === null
      ? null
      : formatInventoryPrice(stockCostValue, currencyCode);
  const formattedRetailValue =
    stockRetailValue === null
      ? null
      : formatInventoryPrice(stockRetailValue, currencyCode);

  return (
    <div className="contents">
      <form
        onSubmit={handleSubmit}
        aria-busy={loading}
        noValidate
        className="flex min-h-full flex-col"
      >
        <UnsavedChangesGuard when={hasUnsavedWork} what="this new item" />

        <div ref={formRef} className="item-form flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-theme px-5 py-2.5 text-xs">
            <span className="font-bold text-theme-secondary">
              {usageLoading ? "Checking plan..." : `${currentPlanName} plan`}
            </span>
            <span className="font-black text-theme-primary">
              {usageLoading ? "" : itemUsageText}
            </span>
          </div>

          <div className="item-panel-title-row">
            <label className="item-photo-tile" aria-label="Add product photo">
              {image && imagePreviewUrl ? (
                <Image
                  src={imagePreviewUrl}
                  alt="Selected product preview"
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-cover"
                />
              ) : (
                <PhotoIcon />
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) =>
                  handleImageChange(event.target.files?.[0] || null)
                }
                disabled={loading}
                className="sr-only"
              />
            </label>

            <div className="min-w-0 flex-1">
              <input
                id="product-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFieldError("name");
                }}
                disabled={loading}
                placeholder="Item name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "product-name-error" : undefined
                }
                className="item-title-input"
              />
              <FieldError id="product-name-error" message={fieldErrors.name} />
              {imageError && (
                <p className="mt-1 text-xs font-semibold text-theme-danger">
                  {imageError}
                </p>
              )}
            </div>
          </div>

          {/* Wide enough (the standalone page) and these lay out in two
              columns; in the slide-over they stay stacked. See
              `.item-form-groups` -- a container query, not a viewport one,
              because the same form renders at 30rem and at 1180px. */}
          <div className="item-form-groups">
          <FieldGroup>
            <FieldRow label="Category">
              <CategorySelector
                id="category"
                categories={categories}
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                disabled={loading}
                onCreate={handleCreateCategory}
                compact
              />
            </FieldRow>

            <FieldRow label="Depot">
              <Select
                id="depot"
                value={selectedDepotId}
                onChange={setSelectedDepotId}
                disabled={loading}
                searchable={depots.length > 8}
                placeholder="Unassigned"
                onCreate={handleCreateDepot}
                createNoun="depot"
                options={[
                  { value: "", label: "Unassigned" },
                  ...depots.map((depot) => ({
                    value: String(depot.id),
                    label: formatDepotLabel(depot),
                  })),
                ]}
              />
            </FieldRow>
          </FieldGroup>

          {advancedOpen && (
            <>
              <FieldGroup label="Stock">
                <FieldRow
                  label="Quantity"
                  htmlFor="quantity"
                  error={fieldErrors.quantity}
                  errorId="quantity-error"
                >
                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={quantity}
                    onKeyDown={(event) => {
                      if (["-", "+", "e", "E", "."].includes(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      setQuantity(
                        event.target.value.startsWith("-")
                          ? ""
                          : event.target.value
                      );
                      clearFieldError("quantity");
                    }}
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                    aria-describedby={
                      fieldErrors.quantity ? "quantity-error" : undefined
                    }
                    placeholder="0"
                  />
                </FieldRow>

                <FieldRow label="Unit" required error={fieldErrors.unitType}>
                  <Select
                    id="unit-type"
                    value={unitType}
                    onChange={(value) => {
                      const nextUnit = value as InventoryUnitType;
                      setUnitType(nextUnit);
                      clearFieldError("unitType");

                      if (nextUnit !== "custom") {
                        clearFieldError("customUnitLabel");
                      }
                    }}
                    disabled={loading}
                    error={fieldErrors.unitType}
                    options={INVENTORY_UNIT_TYPES.map((unit) => ({
                      value: unit,
                      label: INVENTORY_UNIT_LABELS[unit],
                    }))}
                  />
                </FieldRow>

                {unitType === "custom" && (
                  <FieldRow
                    label="Custom unit"
                    htmlFor="custom-unit"
                    required
                    error={fieldErrors.customUnitLabel}
                    errorId="custom-unit-error"
                  >
                    <input
                      id="custom-unit"
                      type="text"
                      value={customUnitLabel}
                      onChange={(event) => {
                        setCustomUnitLabel(event.target.value);
                        clearFieldError("customUnitLabel");
                      }}
                      disabled={loading}
                      aria-invalid={Boolean(fieldErrors.customUnitLabel)}
                      aria-describedby={
                        fieldErrors.customUnitLabel
                          ? "custom-unit-error"
                          : undefined
                      }
                      placeholder="e.g. Roll, Bottle, Tray"
                    />
                  </FieldRow>
                )}

                <FieldRow
                  label="Min stock"
                  htmlFor="min-stock-level"
                  error={fieldErrors.minStockLevel}
                  errorId="min-stock-level-error"
                >
                  <input
                    id="min-stock-level"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={minStockLevel}
                    onKeyDown={(event) => {
                      if (["-", "+", "e", "E", "."].includes(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      setMinStockLevel(
                        event.target.value.startsWith("-")
                          ? ""
                          : event.target.value
                      );
                      clearFieldError("minStockLevel");
                    }}
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.minStockLevel)}
                    aria-describedby={
                      fieldErrors.minStockLevel
                        ? "min-stock-level-error"
                        : undefined
                    }
                    placeholder="Business default"
                  />
                </FieldRow>
              </FieldGroup>

              <FieldGroup label="Supplier &amp; pricing">
                <FieldRow label="Supplier">
                  <Select
                    id="supplier"
                    value={selectedSupplierId}
                    onChange={setSelectedSupplierId}
                    disabled={loading}
                    searchable={suppliers.length > 8}
                    placeholder="No supplier"
                    onCreate={handleCreateSupplier}
                    createNoun="supplier"
                    options={[
                      { value: "", label: "No supplier" },
                      ...suppliers.map((supplier) => ({
                        value: String(supplier.id),
                        label: supplier.name,
                      })),
                    ]}
                  />
                </FieldRow>

                <FieldRow
                  label="Cost price"
                  htmlFor="cost-price"
                  error={fieldErrors.costPrice}
                  errorId="cost-price-error"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-theme-accent">
                      {currencyCode}
                    </span>
                    <input
                      id="cost-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={costPrice}
                      onChange={(event) => {
                        setCostPrice(
                          event.target.value.startsWith("-")
                            ? ""
                            : event.target.value
                        );
                        clearFieldError("costPrice");
                      }}
                      disabled={loading}
                      aria-invalid={Boolean(fieldErrors.costPrice)}
                      aria-describedby={
                        fieldErrors.costPrice ? "cost-price-error" : undefined
                      }
                      placeholder="0.00"
                    />
                  </div>
                </FieldRow>

                <FieldRow
                  label="Selling price"
                  htmlFor="selling-price"
                  error={fieldErrors.sellingPrice}
                  errorId="selling-price-error"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-theme-accent">
                      {currencyCode}
                    </span>
                    <input
                      id="selling-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={sellingPrice}
                      onChange={(event) => {
                        setSellingPrice(
                          event.target.value.startsWith("-")
                            ? ""
                            : event.target.value
                        );
                        clearFieldError("sellingPrice");
                      }}
                      disabled={loading}
                      aria-invalid={Boolean(fieldErrors.sellingPrice)}
                      aria-describedby={
                        fieldErrors.sellingPrice
                          ? "selling-price-error"
                          : undefined
                      }
                      placeholder="0.00"
                    />
                  </div>
                </FieldRow>

                <div className="mt-1 grid grid-cols-2 gap-3">
                  {/* Both tiles were tinted, cyan for cost and violet for
                      retail -- the only cyan and the only violet in the form.
                      The tints encoded nothing: same label colour, same value
                      colour, and the captions already say which is which. Two
                      boxes in a form that is deliberately unboxed everywhere
                      else. Same neutral inset for both now; the words do the
                      distinguishing. */}
                  <div className="rounded-[14px] border border-theme bg-theme-inset p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-accent">
                      Cost value
                    </p>
                    <p className="mt-1 break-words text-base font-black text-theme-primary">
                      {formattedCostValue || "—"}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-theme bg-theme-inset p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-accent">
                      Retail value
                    </p>
                    <p className="mt-1 break-words text-base font-black text-theme-primary">
                      {formattedRetailValue || "—"}
                    </p>
                  </div>
                </div>
              </FieldGroup>

              <FieldGroup label="Tracking codes">
                <FieldRow label="Item code">
                  <span className="text-sm font-black text-theme-accent">
                    Generated after saving
                  </span>
                </FieldRow>

                <FieldRow label="SKU">
                  <input
                    id="sku"
                    type="text"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    disabled={loading}
                    autoCapitalize="characters"
                    placeholder="e.g. FLOWER-RED-01"
                  />
                </FieldRow>

                <FieldRow label="Barcode">
                  <div className="flex items-center gap-2">
                    <input
                      id="barcode"
                      type="text"
                      value={barcode}
                      onChange={(event) => {
                        setBarcode(event.target.value);
                        if (barcodeNotice) setBarcodeNotice(null);
                      }}
                      onBlur={() => void handleBarcodeBlur()}
                      disabled={loading}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="e.g. 0012345678905"
                      className="font-mono tracking-wide"
                    />
                    {/* backlog item 1 (P1): scan the carton's barcode instead
                        of typing it — manual entry stays as the fallback,
                        unchanged. */}
                    <button
                      type="button"
                      onClick={openBarcodeScanner}
                      disabled={loading || isCheckingBarcode}
                      className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-theme bg-theme-surface px-2.5 py-1.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!usageLoading && !canUseScanner ? (
                        <LockedActionLabel>Scan</LockedActionLabel>
                      ) : isCheckingBarcode ? (
                        "..."
                      ) : (
                        "Scan"
                      )}
                    </button>
                  </div>
                  {barcodeNotice && (
                    <p
                      role="status"
                      className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold leading-5 ${
                        barcodeNotice.tone === "warning"
                          ? "border-amber-400/30 bg-amber-500/10 text-theme-warning"
                          : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
                      }`}
                    >
                      {barcodeNotice.text}
                      {barcodeNotice.existingItemId && (
                        <>
                          {" "}
                          <Link
                            href={`/dashboard/inventory/${barcodeNotice.existingItemId}`}
                            className="underline hover:no-underline"
                          >
                            View item
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                </FieldRow>
              </FieldGroup>

              <FieldGroup label="Notes">
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={loading}
                  placeholder="Internal notes..."
                  className="item-panel-textarea"
                />
              </FieldGroup>
            </>
          )}
          </div>

          {!advancedOpen && (
            <button
              type="button"
              onClick={() => setShowAdvanced(true)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-theme px-5 py-3 text-sm font-semibold text-theme-accent transition hover:bg-theme-hover"
            >
              Add quantity, pricing &amp; more
            </button>
          )}

          {formError && (
            <div className="mx-5 mb-4">
              <DashboardNotice tone="danger">
                <p className="font-semibold">{formError}</p>

                {isLimitError && (
                  <ActionButton
                    href={getUpgradeRequestHref(
                      subscriptionUsage.subscription.plan,
                      "item-limit"
                    )}
                    className="mt-4"
                  >
                    {getUpgradeActionLabel(subscriptionUsage.subscription.plan)}
                  </ActionButton>
                )}
              </DashboardNotice>
            </div>
          )}
        </div>

        <div className="item-panel-footer">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className={buttonClassName({ className: "min-w-[140px]" })}
          >
            {loading ? "Saving..." : "Save Item"}
          </button>
        </div>
      </form>

      <ScannerModal
        open={isScannerOpen}
        onClose={closeBarcodeScanner}
        onDecode={handleBarcodeScanned}
        eyebrow="Add item"
        title="Scan Barcode"
        description="Scan the barcode or QR code printed on the item."
      />

      <UpgradeDialog
        open={Boolean(lockedFeature)}
        onClose={() => setLockedFeature(null)}
        feature={lockedFeature?.feature || ""}
        benefit={lockedFeature?.benefit || ""}
        currentPlan={currentPlanName}
        requiredPlan={lockedFeature?.requiredPlan || "Standard"}
        source={lockedFeature?.source || "add-item"}
      />
    </div>
  );
}
