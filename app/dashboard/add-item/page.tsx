"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import CategorySelector from "@/components/CategorySelector";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import {
  ActionButton,
  DashboardNotice,
} from "@/components/dashboard/Workspace";
import Select from "@/components/ui/Select";
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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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

const inputClassName =
  "w-full min-h-11 rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3.5 py-2.5 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-[#2563eb]/50 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] disabled:cursor-not-allowed disabled:opacity-60";
const errorInputClassName =
  "border-red-400/50 bg-red-500/[0.08] focus:border-red-300/70 focus:shadow-[0_0_0_4px_rgba(248,113,113,0.12)]";

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageValidationError(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 5MB or smaller.";
  }

  return "";
}

function getImageExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] || "jpg";
}

function createImagePath(userId: string, file: File) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `${userId}/${Date.now()}-${random}.${getImageExtension(file)}`;
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-theme-accent">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-theme-primary sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-5 text-theme-muted">
        {description}
      </p>
    </div>
  );
}

function DisclosureSection({
  eyebrow,
  title,
  description,
  summary,
  children,
  defaultOpen = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[18px] border border-theme bg-theme-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 outline-none transition hover:bg-theme-hover focus-visible:ring-4 focus-visible:ring-indigo-400/20 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
            {eyebrow}
          </span>
          <span className="mt-0.5 block text-base font-black text-theme-primary">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs leading-5 text-theme-subtle">
            {summary}
          </span>
        </span>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme bg-theme-inset text-theme-secondary transition group-open:rotate-180 group-open:border-indigo-300/30 group-open:text-theme-accent">
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m6 9 6 6 6-6"
            />
          </svg>
        </span>
      </summary>

      <div className="border-t border-theme px-4 py-4">
        <p className="mb-4 max-w-2xl text-xs leading-5 text-theme-muted">
          {description}
        </p>
        {children}
      </div>
    </details>
  );
}

export default function AddItemPage() {
  const router = useRouter();

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
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLimitError, setIsLimitError] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);
  const [backLabel, setBackLabel] = useState("Back to Inventory");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Set once, on mount, from the `?barcode=` deep link — drives the Tracking
  // Codes section's initial open state so a scanned code is immediately
  // visible instead of hidden behind two disclosure levels (Add Optional
  // Details, then Tracking Codes itself).
  const [arrivedFromScan, setArrivedFromScan] = useState(false);

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
              const navigationParams = new URLSearchParams(
                window.location.search
              );
              const requestedCategoryId = navigationParams.get("category");
              if (
                navigationParams
                  .get("returnTo")
                  ?.startsWith("/dashboard/categories")
              ) {
                setBackLabel("Back to Categories");
              }
              if (
                requestedCategoryId &&
                loadedCategories.some(
                  (category) => String(category.id) === requestedCategoryId
                )
              ) {
                setSelectedCategoryId(requestedCategoryId);
              }
              // Arriving from Inventory's Scan button after a code matched no
              // existing item (see handleScannedText there) — the code was
              // already resolved as new there, so it's trusted here as-is.
              const requestedBarcode = navigationParams.get("barcode");
              if (requestedBarcode) {
                setBarcode(requestedBarcode);
                setBarcodeNotice({
                  tone: "success",
                  text: `Barcode ${requestedBarcode} added from your scan. Fill in the rest below.`,
                });
                // Otherwise this lands in a field hidden behind two closed
                // disclosures — the whole point of scanning first is seeing
                // it landed.
                setShowAdvanced(true);
                setArrivedFromScan(true);
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
  }, []);

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image]
  );

  const stockCostValue = useMemo(
    () => calculateInventoryValue(quantity, costPrice),
    [costPrice, quantity]
  );
  const stockRetailValue = useMemo(
    () => calculateInventoryValue(quantity, sellingPrice),
    [quantity, sellingPrice]
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;

    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
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

  const clearImage = () => {
    setImage(null);
    setImageError("");
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

        const fileName = createImagePath(user.id, image);
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

      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo"
      );
      router.push(
        returnTo?.startsWith("/dashboard") && !returnTo.startsWith("//")
          ? returnTo
          : "/dashboard/inventory"
      );
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
      <main className="operations-workspace operations-add-item">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3">
          {/* The top bar already reads "Inventory / Add Item", so the eyebrow and
              heading only repeat it above 640px — hidden there, kept for screen
              readers, and left visible on phones where the chrome title is
              sr-only. Same rule as every other page header. */}
          <section className="rounded-[14px] border border-theme bg-theme-surface px-4 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent sm:hidden">
                  New product
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:sr-only sm:mt-0">
                  Add Item
                </h1>
                <p className="mt-1 max-w-xl text-sm leading-6 text-theme-muted sm:mt-0">
                  Start with the basics. Add quantity, pricing, and more details
                  when you&rsquo;re ready.
                </p>
              </div>

              <ContextBackButton
                fallbackHref="/dashboard/inventory"
                label={backLabel}
                className="min-h-10 rounded-xl px-3.5 py-2 text-sm"
              />
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            aria-busy={loading}
            noValidate
            className="flex flex-col gap-3"
          >
            <section className="rounded-xl border border-indigo-300/20 bg-indigo-500/10 px-3.5 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-xs font-bold text-theme-secondary">
                    Current plan
                  </p>
                  <p className="text-sm font-black text-theme-primary">
                    {usageLoading ? (
                      <span className="dashboard-skeleton-block block h-8 w-28 min-h-0" />
                    ) : (
                      currentPlanName
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-theme bg-theme-inset px-2.5 py-1.5 text-xs font-black text-theme-primary">
                  {usageLoading ? "Checking usage..." : itemUsageText}
                </div>
              </div>
            </section>

            <section className="rounded-[20px] border border-theme bg-theme-surface p-4 shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
              <SectionHeading
                eyebrow="Step 1"
                title="Basic Information"
                description="Start with the details your team uses to recognize and locate this product."
              />

              <div className="rounded-2xl border border-dashed border-indigo-300/25 bg-theme-inset p-3 transition hover:border-indigo-300/45">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                  <label className="group flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-xl border border-theme bg-theme-surface px-4 py-4 text-center transition hover:border-indigo-300/45 hover:bg-theme-hover">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/25 bg-indigo-500/20 text-theme-accent transition group-hover:bg-indigo-500/30">
                      <UiIcon name="upload" className="h-5 w-5" />
                    </span>
                    <span className="mt-2 text-sm font-black text-theme-primary">
                      Add product photo
                    </span>
                    <span className="mt-1 text-xs leading-5 text-theme-muted">
                      JPG, PNG, or WebP - 5MB max
                    </span>
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

                  <div className="min-h-[132px] rounded-xl border border-theme bg-theme-inset p-3">
                    {image && imagePreviewUrl ? (
                      <div className="grid h-full grid-cols-[96px_1fr] items-center gap-3">
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f0e8]">
                          <Image
                            src={imagePreviewUrl}
                            alt="Selected product preview"
                            fill
                            unoptimized
                            sizes="96px"
                            className="object-contain p-2"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                            Product photo ready
                          </p>
                          <p className="mt-2 break-words text-base font-semibold text-theme-primary">
                            {image.name}
                          </p>
                          <p className="mt-1 text-sm text-theme-muted">
                            {formatFileSize(image.size)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <label className="cursor-pointer rounded-lg border border-theme bg-theme-surface px-3 py-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover">
                              Replace
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(event) =>
                                  handleImageChange(
                                    event.target.files?.[0] || null
                                  )
                                }
                                disabled={loading}
                                className="sr-only"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={clearImage}
                              disabled={loading}
                              className="rounded-lg border border-theme bg-theme-surface px-3 py-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[106px] flex-col justify-center rounded-xl bg-theme-surface px-4 py-4">
                        <p className="text-sm font-semibold text-theme-primary">
                          No product photo yet
                        </p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-theme-subtle">
                          Photos make inventory faster to identify, but you can
                          save the item without one.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {imageError && (
                  <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                    {imageError}
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="product-name"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Product name <span className="text-theme-accent">*</span>
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearFieldError("name");
                    }}
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "product-name-error" : undefined
                    }
                    placeholder="e.g. Premium Rose Bouquet"
                    className={`${inputClassName} ${
                      fieldErrors.name ? errorInputClassName : ""
                    }`}
                  />
                  <FieldError
                    id="product-name-error"
                    message={fieldErrors.name}
                  />
                </div>

                <div>
                  <label
                    htmlFor="category"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Category
                  </label>
                  <CategorySelector
                    id="category"
                    categories={categories}
                    value={selectedCategoryId}
                    onChange={setSelectedCategoryId}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="depot"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Depot / Location
                  </label>
                  <Select
                    id="depot"
                    value={selectedDepotId}
                    onChange={setSelectedDepotId}
                    disabled={loading}
                    searchable={depots.length > 8}
                    placeholder="Unassigned"
                    options={[
                      { value: "", label: "Unassigned" },
                      ...depots.map((depot) => ({
                        value: String(depot.id),
                        label: formatDepotLabel(depot),
                      })),
                    ]}
                  />
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Leave unassigned if the location is not decided yet.
                  </p>
                </div>
              </div>
            </section>

            {/* Quick add: essentials only until user clicks expand */}
            {!showAdvanced && (
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="w-full rounded-xl border border-indigo-300/30 bg-indigo-500/10 px-4 py-3 text-center text-sm font-semibold text-theme-accent transition hover:bg-indigo-500/20"
              >
                <span className="inline-flex items-center gap-2">
                  <UiIcon name="plus" className="h-4 w-4" />
                  Add Optional Details
                </span>
              </button>
            )}

            {showAdvanced && (
            <>
            <section className="rounded-[20px] border border-theme bg-theme-surface p-4 shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
              <SectionHeading
                eyebrow="Step 2"
                title="Stock"
                description="Set the opening quantity, how this item is counted, and an optional low-stock target."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="quantity"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Quantity
                  </label>
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
                    className={`${inputClassName} ${
                      fieldErrors.quantity ? errorInputClassName : ""
                    }`}
                  />
                  <FieldError
                    id="quantity-error"
                    message={fieldErrors.quantity}
                  />
                </div>

                <div>
                  <label
                    htmlFor="unit-type"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Unit <span className="text-theme-accent">*</span>
                  </label>
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
                  <FieldError
                    id="unit-type-error"
                    message={fieldErrors.unitType}
                  />
                </div>

                {unitType === "custom" && (
                  <div className="md:col-span-2">
                    <label
                      htmlFor="custom-unit"
                      className="mb-2 block text-sm font-semibold text-theme-secondary"
                    >
                      Custom unit label{" "}
                      <span className="text-theme-accent">*</span>
                    </label>
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
                      className={`${inputClassName} ${
                        fieldErrors.customUnitLabel ? errorInputClassName : ""
                      }`}
                    />
                    <FieldError
                      id="custom-unit-error"
                      message={fieldErrors.customUnitLabel}
                    />
                  </div>
                )}

              </div>
            </section>

            <DisclosureSection
              eyebrow="Optional"
              title="Stock alert"
              summary={
                minStockLevel
                  ? `Alert at or below ${minStockLevel} units`
                  : "Use the business low-stock threshold"
              }
              description="Set an item-specific minimum only when this product needs a different low-stock target."
            >
              <label
                htmlFor="min-stock-level"
                className="mb-2 block text-sm font-semibold text-theme-secondary"
              >
                Minimum stock level
              </label>
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
                    : "min-stock-level-help"
                }
                placeholder="Use business default"
                className={`${inputClassName} ${
                  fieldErrors.minStockLevel ? errorInputClassName : ""
                }`}
              />
              <FieldError
                id="min-stock-level-error"
                message={fieldErrors.minStockLevel}
              />
              {!fieldErrors.minStockLevel && (
                <p
                  id="min-stock-level-help"
                  className="mt-2 text-xs leading-5 text-theme-subtle"
                >
                  Leave empty to use the existing business low-stock threshold.
                </p>
              )}
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Supplier"
              summary={
                suppliers.find(
                  (supplier) => String(supplier.id) === selectedSupplierId
                )?.name || "No supplier selected"
              }
              description="Link this item to an existing supplier record."
            >
              <label
                htmlFor="supplier"
                className="mb-2 block text-sm font-semibold text-theme-secondary"
              >
                Supplier
              </label>
              <Select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={setSelectedSupplierId}
                  disabled={loading}
                  searchable={suppliers.length > 8}
                  placeholder="No supplier"
                  options={[
                    { value: "", label: "No supplier" },
                    ...suppliers.map((supplier) => ({
                      value: String(supplier.id),
                      label: supplier.name,
                    })),
                  ]}
                />
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Pricing"
              summary={
                costPrice || sellingPrice
                  ? `Cost${costPrice ? ` ${currencyCode} ${costPrice}` : ""}${
                      sellingPrice
                        ? ` · Selling ${currencyCode} ${sellingPrice}`
                        : ""
                    }`
                  : `No prices added · ${currencyCode}`
              }
              description="Prices stay on the private inventory record. Stock values below are previews and are not stored separately."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="cost-price"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Cost price
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-theme-accent">
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
                      className={`${inputClassName} pl-[5.5rem] ${
                        fieldErrors.costPrice ? errorInputClassName : ""
                      }`}
                    />
                  </div>
                  <FieldError
                    id="cost-price-error"
                    message={fieldErrors.costPrice}
                  />
                </div>

                <div>
                  <label
                    htmlFor="selling-price"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Selling price
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-theme-accent">
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
                      className={`${inputClassName} pl-[5.5rem] ${
                        fieldErrors.sellingPrice ? errorInputClassName : ""
                      }`}
                    />
                  </div>
                  <FieldError
                    id="selling-price-error"
                    message={fieldErrors.sellingPrice}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                    Stock cost value
                  </p>
                  <p className="mt-1 break-words text-base font-black text-theme-primary">
                    {formattedCostValue || "Not calculated"}
                  </p>
                  <p className="mt-1 text-xs leading-4 text-theme-subtle">
                    Quantity multiplied by cost price.
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                    Stock retail value
                  </p>
                  <p className="mt-1 break-words text-base font-black text-theme-primary">
                    {formattedRetailValue || "Not calculated"}
                  </p>
                  <p className="mt-1 text-xs leading-4 text-theme-subtle">
                    Quantity multiplied by selling price.
                  </p>
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Tracking Codes"
              summary={
                sku || barcode
                  ? `${sku ? `SKU ${sku}` : ""}${
                      sku && barcode ? " · " : ""
                    }${barcode ? `Barcode ${barcode}` : ""}`
                  : "SKU and barcode not added"
              }
              description="Each code has a different role. Add only the codes your business already uses."
              defaultOpen={arrivedFromScan}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-semibold text-theme-secondary">
                    SydIN item code
                  </p>
                  <div className="flex min-h-[58px] items-center justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-4">
                    <span className="font-black text-theme-accent">
                      Generated after saving
                    </span>
                    <span className="rounded-xl border border-theme bg-theme-inset px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                      Read only
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    SydIN creates a unique internal item code automatically.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="sku"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    SKU
                  </label>
                  <input
                    id="sku"
                    type="text"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    disabled={loading}
                    autoCapitalize="characters"
                    placeholder="e.g. FLOWER-RED-01"
                    className={inputClassName}
                  />
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Your internal or supplier stock code.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor="barcode"
                      className="block text-sm font-semibold text-theme-secondary"
                    >
                      Barcode
                    </label>
                    {/* backlog item 1 (P1): scan the carton's barcode instead
                        of typing it — manual entry below stays as the
                        fallback, unchanged. */}
                    <button
                      type="button"
                      onClick={openBarcodeScanner}
                      disabled={loading || isCheckingBarcode}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-theme bg-theme-surface px-3 py-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UiIcon name="scan" className="h-3.5 w-3.5" />
                      {!usageLoading && !canUseScanner ? (
                        <LockedActionLabel>Scan</LockedActionLabel>
                      ) : isCheckingBarcode ? (
                        "Checking..."
                      ) : (
                        "Scan"
                      )}
                    </button>
                  </div>
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
                    className={`${inputClassName} font-mono tracking-wide`}
                  />
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Product or scanned code. Leading zeroes are preserved.
                  </p>
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
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Notes"
              summary={
                notes.trim()
                  ? `${notes.trim().slice(0, 64)}${
                      notes.trim().length > 64 ? "…" : ""
                    }`
                  : "No internal notes"
              }
              description="Use notes for product details, handling instructions, or other private inventory context."
            >
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-semibold text-theme-secondary"
              >
                Internal notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={loading}
                placeholder="Add private details about this item..."
                className={`${inputClassName} min-h-[110px] resize-y`}
              />
            </DisclosureSection>
            </>
            )}

            {formError && (
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
                    {getUpgradeActionLabel(
                      subscriptionUsage.subscription.plan
                    )}
                  </ActionButton>
                )}
              </DashboardNotice>
            )}

            <div className="mt-1 flex flex-col-reverse gap-3 rounded-[18px] border border-theme bg-theme-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-sm text-theme-subtle sm:block">
                Required fields are marked with an asterisk.
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-xl border border-theme bg-theme-surface px-5 py-3 text-center text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="min-w-[160px] rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Saving item..." : "Save Item"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

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
