"use client";

import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
import CategorySelector from "@/components/CategorySelector";
import Select from "@/components/ui/Select";
import type { Category } from "@/app/lib/categories";
import { formatDepotLabel, type Depot } from "@/app/lib/depots";
import {
  calculateInventoryValue,
  DEFAULT_INVENTORY_UNIT_TYPE,
  formatInventoryPrice,
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNIT_TYPES,
  normalizeInventoryUnitType,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import type { Supplier } from "@/app/lib/suppliers";

export type EditItemFieldName =
  | "name"
  | "quantity"
  | "unitType"
  | "customUnitLabel"
  | "costPrice"
  | "sellingPrice"
  | "minStockLevel";

export type EditItemFieldErrors = Partial<Record<EditItemFieldName, string>>;

export interface EditableInventoryItem {
  id: number;
  name: string;
  category: string;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string | null;
  notes?: string | null;
  depot_id?: number | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
  barcode?: string | null;
  supplier_id?: number | null;
}

export interface EditItemFormValues {
  name: string;
  category: string;
  categoryId: string;
  depotId: string;
  quantity: string;
  unitType: InventoryUnitType;
  customUnitLabel: string;
  minStockLevel: string;
  costPrice: string;
  sellingPrice: string;
  sku: string;
  barcode: string;
  notes: string;
  supplierId: string;
}

export interface ParsedEditItemValues {
  name: string;
  category: string;
  category_id: number | null;
  depot_id: number | null;
  quantity: number;
  unit_type: InventoryUnitType;
  custom_unit_label: string | null;
  cost_price: number | null;
  selling_price: number | null;
  min_stock_level: number | null;
  sku: string;
  barcode: string | null;
  notes: string;
  supplier_id: number | null;
}

const inputClassName =
  "w-full min-h-11 rounded-xl border border-theme bg-theme-surface px-3.5 py-2.5 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-[#2563eb]/50 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] disabled:cursor-not-allowed disabled:opacity-60";
const errorInputClassName =
  "border-red-400/50 bg-red-500/[0.08] focus:border-red-300/70 focus:shadow-[0_0_0_4px_rgba(248,113,113,0.12)]";

function formatNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? String(numericValue) : "";
}

export function createEditItemFormValues(
  item: EditableInventoryItem
): EditItemFormValues {
  const unitType = normalizeInventoryUnitType(item.unit_type);

  return {
    name: item.name || "",
    category: item.category || "",
    categoryId: item.category_id
      ? String(item.category_id)
      : item.category?.trim()
        ? "legacy"
        : "",
    depotId: item.depot_id ? String(item.depot_id) : "",
    quantity: String(Number(item.quantity || 0)),
    unitType,
    customUnitLabel: unitType === "custom" ? item.custom_unit_label || "" : "",
    minStockLevel: formatNullableNumber(item.min_stock_level),
    costPrice: formatNullableNumber(item.cost_price),
    sellingPrice: formatNullableNumber(item.selling_price),
    sku: item.sku || "",
    barcode: item.barcode || "",
    notes: item.notes || "",
    supplierId: item.supplier_id ? String(item.supplier_id) : "",
  };
}

export function createEmptyEditItemFormValues(): EditItemFormValues {
  return {
    name: "",
    category: "",
    categoryId: "",
    depotId: "",
    quantity: "",
    unitType: DEFAULT_INVENTORY_UNIT_TYPE,
    customUnitLabel: "",
    minStockLevel: "",
    costPrice: "",
    sellingPrice: "",
    sku: "",
    barcode: "",
    notes: "",
    supplierId: "",
  };
}

export function validateEditItemFormValues(
  values: EditItemFormValues,
  categories: Category[] = []
) {
  const trimmedName = values.name.trim();
  const trimmedCustomUnitLabel = values.customUnitLabel.trim();
  const quantityValue = values.quantity === "" ? null : Number(values.quantity);
  const costPriceValue =
    values.costPrice === "" ? null : Number(values.costPrice);
  const sellingPriceValue =
    values.sellingPrice === "" ? null : Number(values.sellingPrice);
  const minStockLevelValue =
    values.minStockLevel === "" ? null : Number(values.minStockLevel);
  const errors: EditItemFieldErrors = {};

  if (!trimmedName) {
    errors.name = "Product name is required.";
  }

  if (
    quantityValue === null ||
    !Number.isFinite(quantityValue) ||
    !Number.isInteger(quantityValue) ||
    quantityValue < 0
  ) {
    errors.quantity = "Enter a whole quantity of 0 or more.";
  }

  if (!INVENTORY_UNIT_TYPES.includes(values.unitType)) {
    errors.unitType = "Choose a valid unit.";
  }

  if (values.unitType === "custom" && !trimmedCustomUnitLabel) {
    errors.customUnitLabel = "Add a label for the custom unit.";
  }

  if (
    costPriceValue !== null &&
    (!Number.isFinite(costPriceValue) || costPriceValue < 0)
  ) {
    errors.costPrice = "Cost price must be 0 or more.";
  }

  if (
    sellingPriceValue !== null &&
    (!Number.isFinite(sellingPriceValue) || sellingPriceValue < 0)
  ) {
    errors.sellingPrice = "Selling price must be 0 or more.";
  }

  if (
    minStockLevelValue !== null &&
    (!Number.isFinite(minStockLevelValue) ||
      !Number.isInteger(minStockLevelValue) ||
      minStockLevelValue < 0)
  ) {
    errors.minStockLevel =
      "Minimum stock must be a whole number of 0 or more.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      parsedValues: null,
    };
  }

  return {
    errors,
    parsedValues: {
      name: trimmedName,
      category:
        values.categoryId === "legacy"
          ? values.category.trim()
          : categories.find(
              (category) => String(category.id) === values.categoryId
            )?.name || "",
      category_id:
        values.categoryId && values.categoryId !== "legacy"
          ? Number(values.categoryId)
          : null,
      depot_id: values.depotId ? Number(values.depotId) : null,
      quantity: quantityValue as number,
      unit_type: values.unitType,
      custom_unit_label:
        values.unitType === "custom" ? trimmedCustomUnitLabel : null,
      cost_price: costPriceValue,
      selling_price: sellingPriceValue,
      min_stock_level: minStockLevelValue,
      sku: values.sku.trim(),
      barcode: values.barcode.trim() || null,
      notes: values.notes,
      supplier_id: values.supplierId ? Number(values.supplierId) : null,
    } satisfies ParsedEditItemValues,
  };
}

export function getEditSaveErrorMessage(error: {
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

  return "We could not update this item. Please try again.";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm font-semibold text-theme-danger">
      {message}
    </p>
  );
}

function SectionTitle({
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
      <h3 className="mt-1 text-xl font-black text-theme-primary">{title}</h3>
      <p className="mt-1.5 text-sm leading-5 text-theme-muted">{description}</p>
    </div>
  );
}

function DisclosureSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-[18px] border border-theme bg-theme-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition hover:bg-theme-surface focus-visible:bg-theme-surface [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-black text-theme-primary">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-theme-subtle">
            {summary}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme bg-theme-inset text-theme-secondary transition group-open:rotate-180 group-open:text-theme-accent">
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
      <div className="border-t border-theme px-4 py-4">{children}</div>
    </details>
  );
}

export default function EditItemForm({
  item,
  values,
  fieldErrors,
  depots,
  categories,
  suppliers,
  currencyCode,
  selectedImage,
  saving,
  error,
  onValueChange,
  onFieldErrorClear,
  onImageChange,
  onCancel,
  onSubmit,
}: {
  item: EditableInventoryItem;
  values: EditItemFormValues;
  fieldErrors: EditItemFieldErrors;
  depots: Depot[];
  categories: Category[];
  suppliers: Supplier[];
  currencyCode: string;
  selectedImage: File | null;
  saving: boolean;
  error: string;
  onValueChange: <Field extends keyof EditItemFormValues>(
    field: Field,
    value: EditItemFormValues[Field]
  ) => void;
  onFieldErrorClear: (field: EditItemFieldName) => void;
  onImageChange: (file: File | null) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const stockCostValue = calculateInventoryValue(
    values.quantity,
    values.costPrice
  );
  const stockRetailValue = calculateInventoryValue(
    values.quantity,
    values.sellingPrice
  );
  const formattedCostValue =
    stockCostValue === null
      ? null
      : formatInventoryPrice(stockCostValue, currencyCode);
  const formattedRetailValue =
    stockRetailValue === null
      ? null
      : formatInventoryPrice(stockRetailValue, currencyCode);
  const itemCode = item.item_code?.trim();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <section className="rounded-[20px] border border-theme bg-theme-surface p-4">
        <SectionTitle
          eyebrow="Basic"
          title="Basic Information"
          description="Update the product identity, image, category, and location."
        />

        <div className="grid grid-cols-1 gap-4 rounded-[18px] border border-theme bg-theme-inset p-3 md:grid-cols-[160px_1fr] md:items-center">
          {item.image ? (
            <div className="relative h-[140px] overflow-hidden rounded-xl bg-[#f4f0e8]">
              <Image
                src={item.image}
                alt={item.name}
                fill
                loading="lazy"
                sizes="150px"
                className="object-contain p-3"
              />
            </div>
          ) : (
            <div className="flex h-[140px] flex-col items-center justify-center rounded-xl bg-[#f4f0e8] text-theme-subtle">
              <span className="text-xs font-black uppercase tracking-[0.16em]">
                Image
              </span>
              <span className="mt-1 text-xs font-semibold">Not added</span>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-theme-secondary">
              Product photo
            </p>
            <p className="mt-2 text-sm leading-6 text-theme-subtle">
              Replace the image only if you want a new product photo.
            </p>
            <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-indigo-300/25 bg-indigo-500/15 px-3.5 py-2 text-sm font-bold text-theme-accent transition hover:bg-indigo-500/25">
              Choose replacement
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  onImageChange(event.target.files?.[0] || null)
                }
                disabled={saving}
                className="sr-only"
              />
            </label>
            {selectedImage && (
              <p className="mt-3 break-words text-sm font-semibold text-theme-accent">
                New image: {selectedImage.name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Product name <span className="text-theme-accent">*</span>
            </label>
            <input
              type="text"
              value={values.name}
              onChange={(event) => {
                onValueChange("name", event.target.value);
                onFieldErrorClear("name");
              }}
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.name)}
              className={`${inputClassName} ${
                fieldErrors.name ? errorInputClassName : ""
              }`}
            />
            <FieldError id="edit-name-error" message={fieldErrors.name} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Category
            </label>
            <CategorySelector
              categories={categories}
              value={values.categoryId}
              legacyCategory={values.category}
              onChange={(categoryId) =>
                onValueChange("categoryId", categoryId)
              }
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Depot / Location
            </label>
            <Select
                value={values.depotId}
                onChange={(value) =>
                  onValueChange("depotId", value)
                }
                disabled={saving}
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
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Supplier
            </label>
            <Select
                value={values.supplierId}
                onChange={(value) =>
                  onValueChange("supplierId", value)
                }
                disabled={saving}
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
            <p className="mt-2 text-xs leading-5 text-theme-subtle">
              Optional. Manage supplier records from the Suppliers page.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-theme bg-theme-surface p-4">
        <SectionTitle
          eyebrow="Stock"
          title="Stock"
          description="Control the current quantity, unit, and item-level low-stock target."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Quantity <span className="text-theme-accent">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.quantity}
              onKeyDown={(event) => {
                if (["-", "+", "e", "E", "."].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                onValueChange(
                  "quantity",
                  event.target.value.startsWith("-") ? "" : event.target.value
                );
                onFieldErrorClear("quantity");
              }}
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.quantity)}
              className={`${inputClassName} ${
                fieldErrors.quantity ? errorInputClassName : ""
              }`}
            />
            <FieldError
              id="edit-quantity-error"
              message={fieldErrors.quantity}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Unit <span className="text-theme-accent">*</span>
            </label>
            <Select
                value={values.unitType}
                onChange={(value) => {
                  const nextUnit = value as InventoryUnitType;
                  onValueChange("unitType", nextUnit);
                  onFieldErrorClear("unitType");

                  if (nextUnit !== "custom") {
                    onFieldErrorClear("customUnitLabel");
                  }
                }}
                disabled={saving}
                error={fieldErrors.unitType}
                options={INVENTORY_UNIT_TYPES.map((unit) => ({
                  value: unit,
                  label: INVENTORY_UNIT_LABELS[unit],
                }))}
              />
            <FieldError id="edit-unit-error" message={fieldErrors.unitType} />
          </div>

          {values.unitType === "custom" && (
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                Custom unit label <span className="text-theme-accent">*</span>
              </label>
              <input
                type="text"
                value={values.customUnitLabel}
                onChange={(event) => {
                  onValueChange("customUnitLabel", event.target.value);
                  onFieldErrorClear("customUnitLabel");
                }}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.customUnitLabel)}
                placeholder="e.g. Roll, Bottle, Tray"
                className={`${inputClassName} ${
                  fieldErrors.customUnitLabel ? errorInputClassName : ""
                }`}
              />
              <FieldError
                id="edit-custom-unit-error"
                message={fieldErrors.customUnitLabel}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Minimum stock level
            </label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.minStockLevel}
              onKeyDown={(event) => {
                if (["-", "+", "e", "E", "."].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                onValueChange(
                  "minStockLevel",
                  event.target.value.startsWith("-") ? "" : event.target.value
                );
                onFieldErrorClear("minStockLevel");
              }}
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.minStockLevel)}
              placeholder="Use business default"
              className={`${inputClassName} ${
                fieldErrors.minStockLevel ? errorInputClassName : ""
              }`}
            />
            <FieldError
              id="edit-min-stock-error"
              message={fieldErrors.minStockLevel}
            />
          </div>
        </div>
      </section>

      <DisclosureSection
        title="Pricing & Value"
        summary={`Private values in ${currencyCode}`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Cost price
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-theme-accent">
                {currencyCode}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.costPrice}
                onChange={(event) => {
                  onValueChange(
                    "costPrice",
                    event.target.value.startsWith("-")
                      ? ""
                      : event.target.value
                  );
                  onFieldErrorClear("costPrice");
                }}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.costPrice)}
                placeholder="0.00"
                className={`${inputClassName} pl-[5.5rem] ${
                  fieldErrors.costPrice ? errorInputClassName : ""
                }`}
              />
            </div>
            <FieldError
              id="edit-cost-price-error"
              message={fieldErrors.costPrice}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Selling price
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-theme-accent">
                {currencyCode}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.sellingPrice}
                onChange={(event) => {
                  onValueChange(
                    "sellingPrice",
                    event.target.value.startsWith("-")
                      ? ""
                      : event.target.value
                  );
                  onFieldErrorClear("sellingPrice");
                }}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.sellingPrice)}
                placeholder="0.00"
                className={`${inputClassName} pl-[5.5rem] ${
                  fieldErrors.sellingPrice ? errorInputClassName : ""
                }`}
              />
            </div>
            <FieldError
              id="edit-selling-price-error"
              message={fieldErrors.sellingPrice}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
              Stock cost value
            </p>
            <p className="mt-1.5 break-normal text-xl font-black text-theme-primary">
              {formattedCostValue || "Not calculated"}
            </p>
          </div>
          <div className="rounded-[18px] border border-violet-300/15 bg-violet-500/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
              Stock retail value
            </p>
            <p className="mt-1.5 break-normal text-xl font-black text-theme-primary">
              {formattedRetailValue || "Not calculated"}
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection
        title="Tracking Codes"
        summary="Read-only SydIN code, SKU, and barcode"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-theme-secondary">
              SydIN item code
            </p>
            <div className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-indigo-300/20 bg-indigo-500/10 px-3.5 py-2.5">
              <span className="break-words font-black text-theme-accent">
                {itemCode || "Not generated yet"}
              </span>
              <span className="rounded-xl border border-theme bg-theme-inset px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                Read only
              </span>
            </div>
            {!itemCode && (
              <p className="mt-2 text-xs leading-5 text-theme-subtle">
                Older items may not have generated item codes yet.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              SKU
            </label>
            <input
              type="text"
              value={values.sku}
              onChange={(event) => onValueChange("sku", event.target.value)}
              disabled={saving}
              autoCapitalize="characters"
              className={inputClassName}
            />
            <p className="mt-2 text-xs leading-5 text-theme-subtle">
              Your internal or supplier stock code.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-theme-secondary">
              Barcode
            </label>
            <input
              type="text"
              value={values.barcode}
              onChange={(event) =>
                onValueChange("barcode", event.target.value)
              }
              disabled={saving}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClassName} font-mono tracking-wide`}
            />
            <p className="mt-2 text-xs leading-5 text-theme-subtle">
              Product or scanned code. Leading zeroes are preserved.
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Notes" summary="Internal team context">
        <label className="mb-2 block text-sm font-semibold text-theme-secondary">
          Internal notes
        </label>
        <textarea
          value={values.notes}
          onChange={(event) => onValueChange("notes", event.target.value)}
          disabled={saving}
          className={`${inputClassName} min-h-[130px] resize-y`}
        />
      </DisclosureSection>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-theme-danger">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 mt-1 flex flex-col-reverse gap-2 border-t border-theme bg-[var(--sydin-surface-strong)] px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50 sm:flex-none"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition duration-[140ms] ease-[ease] hover:brightness-110 hover:shadow-[0_12px_28px_rgba(37,99,235,0.16),0_0_36px_rgba(125,92,255,0.18)] disabled:opacity-50 sm:flex-none"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
