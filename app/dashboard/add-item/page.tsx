"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import CategorySelector from "@/components/CategorySelector";
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
import { supabase } from "@/app/lib/supabase";
import {
  getSuppliersForUser,
  type Supplier,
} from "@/app/lib/suppliers";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getPlanLimitMessage,
  getSubscriptionUsage,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

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
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg";
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
    return "The supplier could not be linked. Confirm the Phase 4C migration is applied and choose one of your own suppliers.";
  }
  if (errorText.includes("category")) {
    return "The category could not be linked. Run the Phase 6A migration and choose one of your own categories.";
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
    return "The Phase 4A inventory fields are not available yet. Apply the approved database migration, then try again.";
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
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-theme-accent">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-theme-primary sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-muted">
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
}: {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-[28px] border border-theme bg-theme-surface shadow-[0_20px_70px_rgba(0,0,0,0.2)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 outline-none transition hover:bg-theme-surface focus-visible:bg-theme-surface sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-theme-accent">
            {eyebrow}
          </span>
          <span className="mt-1 block text-xl font-black text-theme-primary">
            {title}
          </span>
          <span className="mt-1 block text-sm leading-5 text-theme-subtle">
            {summary}
          </span>
        </span>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-theme bg-theme-inset text-theme-secondary transition group-open:rotate-180 group-open:border-indigo-300/30 group-open:text-theme-accent">
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

      <div className="border-t border-theme px-5 py-6 sm:px-6">
        <p className="mb-6 max-w-2xl text-sm leading-6 text-theme-muted">
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
    const quantityValue = quantity === "" ? null : Number(quantity);
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
      quantityValue === null ||
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

      router.push("/dashboard/inventory");
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
      <main>
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
          <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  New product
                </p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-theme-primary sm:text-6xl lg:text-7xl">
                  Add Item
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-theme-muted sm:mt-4 sm:text-lg sm:leading-7">
                  Create a clear, complete inventory record in a few quick
                  steps.
                </p>
              </div>

              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-center text-base font-bold text-theme-primary transition hover:border-theme-strong hover:bg-theme-hover"
              >
                Back to Inventory
              </Link>
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            aria-busy={loading}
            noValidate
            className="flex flex-col gap-5"
          >
            <section className="rounded-[28px] border border-indigo-300/20 bg-indigo-500/10 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-theme-accent">
                    Current plan
                  </p>
                  <p className="mt-1 text-2xl font-black text-theme-primary">
                    {usageLoading ? (
                      <span className="block h-8 w-28 animate-pulse rounded-2xl bg-theme-surface" />
                    ) : (
                      currentPlanName
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-theme bg-theme-inset px-4 py-3 text-sm font-black text-theme-primary">
                  {usageLoading ? "Checking usage..." : itemUsageText}
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-7 lg:p-8">
              <SectionHeading
                eyebrow="Step 1"
                title="Basic Information"
                description="Start with the details your team uses to recognize and locate this product."
              />

              <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-theme-inset p-4 transition hover:border-indigo-300/45 hover:bg-theme-inset sm:p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr] lg:items-center">
                  <label className="group flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-theme bg-theme-surface px-5 py-6 text-center transition hover:border-indigo-300/45 hover:bg-theme-hover">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/20 text-theme-accent transition group-hover:bg-indigo-500/30">
                      <UiIcon name="upload" className="h-7 w-7" />
                    </span>
                    <span className="mt-4 text-lg font-black text-theme-primary">
                      Take or upload photo
                    </span>
                    <span className="mt-2 max-w-[220px] text-sm leading-5 text-theme-muted">
                      Use your camera or choose a JPG, PNG, or WebP up to 5MB.
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

                  <div className="min-h-[190px] rounded-3xl border border-theme bg-theme-inset p-4">
                    {image && imagePreviewUrl ? (
                      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f4f0e8]">
                          <Image
                            src={imagePreviewUrl}
                            alt="Selected product preview"
                            fill
                            unoptimized
                            sizes="140px"
                            className="object-contain p-3"
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
                          <button
                            type="button"
                            onClick={clearImage}
                            disabled={loading}
                            className="mt-4 rounded-2xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[158px] flex-col justify-center rounded-2xl border border-white/5 bg-theme-surface px-4 py-5">
                        <p className="text-base font-semibold text-theme-primary">
                          No product photo yet
                        </p>
                        <p className="mt-2 max-w-md text-sm leading-6 text-theme-subtle">
                          Photos make inventory faster to identify, but you can
                          save the item without one.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {imageError && (
                  <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                    {imageError}
                  </p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
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
                  <div className="relative">
                    <select
                      id="depot"
                      value={selectedDepotId}
                      onChange={(event) =>
                        setSelectedDepotId(event.target.value)
                      }
                      disabled={loading}
                      className={`${inputClassName} appearance-none pr-12`}
                    >
                      <option value="">Unassigned</option>
                      {depots.map((depot) => (
                        <option key={depot.id} value={depot.id}>
                          {formatDepotLabel(depot)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-theme-subtle">
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
                  </div>
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Leave unassigned if the location is not decided yet.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-7 lg:p-8">
              <SectionHeading
                eyebrow="Step 2"
                title="Stock"
                description="Set the opening quantity, how this item is counted, and an optional low-stock target."
              />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="quantity"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Quantity <span className="text-theme-accent">*</span>
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
                    htmlFor="supplier"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Supplier
                  </label>
                  <div className="relative">
                    <select
                      id="supplier"
                      value={selectedSupplierId}
                      onChange={(event) =>
                        setSelectedSupplierId(event.target.value)
                      }
                      disabled={loading}
                      className={`${inputClassName} appearance-none pr-12`}
                    >
                      <option value="">No supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-theme-subtle">
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
                  </div>
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Optional. Create suppliers from the Suppliers page first.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="unit-type"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Unit <span className="text-theme-accent">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="unit-type"
                      value={unitType}
                      onChange={(event) => {
                        const nextUnit = event.target
                          .value as InventoryUnitType;
                        setUnitType(nextUnit);
                        clearFieldError("unitType");

                        if (nextUnit !== "custom") {
                          clearFieldError("customUnitLabel");
                        }
                      }}
                      disabled={loading}
                      aria-invalid={Boolean(fieldErrors.unitType)}
                      aria-describedby={
                        fieldErrors.unitType ? "unit-type-error" : undefined
                      }
                      className={`${inputClassName} appearance-none pr-12 ${
                        fieldErrors.unitType ? errorInputClassName : ""
                      }`}
                    >
                      {INVENTORY_UNIT_TYPES.map((unit) => (
                        <option key={unit} value={unit}>
                          {INVENTORY_UNIT_LABELS[unit]}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-theme-subtle">
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
                  </div>
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

                <div className="md:col-span-2">
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
                      Leave empty to use the existing business low-stock
                      threshold.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <DisclosureSection
              eyebrow="Optional"
              title="Pricing & Value"
              summary={`Track cost and selling value in ${currencyCode}`}
              description="Prices stay on the private inventory record. Stock values below are previews and are not stored separately."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-cyan-300/15 bg-cyan-500/[0.07] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                    Stock cost value
                  </p>
                  <p className="mt-2 break-words text-2xl font-black text-theme-primary">
                    {formattedCostValue || "Not calculated"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Quantity multiplied by cost price.
                  </p>
                </div>

                <div className="rounded-3xl border border-violet-300/15 bg-violet-500/[0.07] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                    Stock retail value
                  </p>
                  <p className="mt-2 break-words text-2xl font-black text-theme-primary">
                    {formattedRetailValue || "Not calculated"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Quantity multiplied by selling price.
                  </p>
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Tracking Codes"
              summary="Item code, SKU, and product barcode"
              description="Each code has a different role. Add only the codes your business already uses."
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
                  <label
                    htmlFor="barcode"
                    className="mb-2 block text-sm font-semibold text-theme-secondary"
                  >
                    Barcode
                  </label>
                  <input
                    id="barcode"
                    type="text"
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value)}
                    disabled={loading}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="e.g. 0012345678905"
                    className={`${inputClassName} font-mono tracking-wide`}
                  />
                  <p className="mt-2 text-xs leading-5 text-theme-subtle">
                    Product or scanned code. Leading zeroes are preserved.
                  </p>
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection
              eyebrow="Optional"
              title="Notes"
              summary="Add internal context for your team"
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
                className={`${inputClassName} min-h-[140px] resize-y`}
              />
            </DisclosureSection>

            {formError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-theme-danger"
              >
                <p className="font-semibold">{formError}</p>

                {isLimitError && (
                  <Link
                    href={getUpgradeRequestHref(
                      subscriptionUsage.subscription.plan,
                      "item-limit"
                    )}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-slate-200"
                  >
                    {getUpgradeActionLabel(
                      subscriptionUsage.subscription.plan
                    )}
                  </Link>
                )}
              </div>
            )}

            <div className="sticky bottom-0 z-20 -mx-4 mt-2 flex flex-col-reverse gap-3 border-t border-theme bg-[#050713]/95 px-4 py-4 shadow-[0_-18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px] sm:border sm:px-5">
              <p className="hidden text-sm text-theme-subtle sm:block">
                Required fields are marked with an asterisk.
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl border border-theme bg-theme-surface px-6 py-4 text-center text-base font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="min-w-[170px] rounded-2xl bg-white px-7 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Saving item..." : "Save Item"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
