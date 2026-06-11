"use client";

import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
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
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg";
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

export function validateEditItemFormValues(values: EditItemFormValues) {
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
      category: values.category.trim(),
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
    return "The supplier could not be linked. Confirm the Phase 4C migration is applied and choose one of your own suppliers.";
  }

  const phaseFields = [
    "unit_type",
    "custom_unit_label",
    "cost_price",
    "selling_price",
    "min_stock_level",
    "barcode",
  ];

  if (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    phaseFields.some((field) => errorText.includes(field))
  ) {
    return "The Phase 4A inventory fields are not available yet. Apply the approved database migration, then try again.";
  }

  return "We could not update this item. Please try again.";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm font-semibold text-red-200">
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
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-2xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
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
    <details className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.035]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 outline-none transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-lg font-black text-white">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-slate-500">
            {summary}
          </span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-slate-300 transition group-open:rotate-180 group-open:text-indigo-100">
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
      <div className="border-t border-white/10 px-5 py-5">{children}</div>
    </details>
  );
}

export default function EditItemForm({
  item,
  values,
  fieldErrors,
  depots,
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
        <SectionTitle
          eyebrow="Basic"
          title="Basic Information"
          description="Update the product identity, image, category, and location."
        />

        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 md:grid-cols-[150px_1fr] md:items-center">
          {item.image ? (
            <div className="relative h-[140px] overflow-hidden rounded-2xl bg-[#f4f0e8]">
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
            <div className="flex h-[140px] flex-col items-center justify-center rounded-2xl bg-[#f4f0e8] text-slate-500">
              <span className="text-xs font-black uppercase tracking-[0.16em]">
                Image
              </span>
              <span className="mt-1 text-xs font-semibold">Not added</span>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-300">
              Product photo
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Replace the image only if you want a new product photo.
            </p>
            <label className="mt-4 inline-flex cursor-pointer rounded-2xl border border-indigo-300/25 bg-indigo-500/15 px-4 py-3 text-sm font-bold text-indigo-100 transition hover:bg-indigo-500/25">
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
              <p className="mt-3 break-words text-sm font-semibold text-indigo-100">
                New image: {selectedImage.name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Product name <span className="text-indigo-300">*</span>
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
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Category
            </label>
            <input
              type="text"
              value={values.category}
              onChange={(event) =>
                onValueChange("category", event.target.value)
              }
              disabled={saving}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Depot / Location
            </label>
            <div className="relative">
              <select
                value={values.depotId}
                onChange={(event) =>
                  onValueChange("depotId", event.target.value)
                }
                disabled={saving}
                className={`${inputClassName} appearance-none pr-12`}
              >
                <option value="">Unassigned</option>
                {depots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {formatDepotLabel(depot)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
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
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Supplier
            </label>
            <div className="relative">
              <select
                value={values.supplierId}
                onChange={(event) =>
                  onValueChange("supplierId", event.target.value)
                }
                disabled={saving}
                className={`${inputClassName} appearance-none pr-12`}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
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
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Optional. Manage supplier records from the Suppliers page.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
        <SectionTitle
          eyebrow="Stock"
          title="Stock"
          description="Control the current quantity, unit, and item-level low-stock target."
        />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Quantity <span className="text-indigo-300">*</span>
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
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Unit <span className="text-indigo-300">*</span>
            </label>
            <div className="relative">
              <select
                value={values.unitType}
                onChange={(event) => {
                  const nextUnit = event.target.value as InventoryUnitType;
                  onValueChange("unitType", nextUnit);
                  onFieldErrorClear("unitType");

                  if (nextUnit !== "custom") {
                    onFieldErrorClear("customUnitLabel");
                  }
                }}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.unitType)}
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
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
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
            <FieldError id="edit-unit-error" message={fieldErrors.unitType} />
          </div>

          {values.unitType === "custom" && (
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Custom unit label <span className="text-indigo-300">*</span>
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
            <label className="mb-2 block text-sm font-semibold text-slate-300">
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Cost price
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-indigo-200">
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
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Selling price
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-sm font-black text-indigo-200">
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

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-cyan-300/15 bg-cyan-500/[0.07] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Stock cost value
            </p>
            <p className="mt-2 break-words text-2xl font-black text-white">
              {formattedCostValue || "Not calculated"}
            </p>
          </div>
          <div className="rounded-3xl border border-violet-300/15 bg-violet-500/[0.07] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
              Stock retail value
            </p>
            <p className="mt-2 break-words text-2xl font-black text-white">
              {formattedRetailValue || "Not calculated"}
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection
        title="Tracking Codes"
        summary="Read-only SydIN code, SKU, and barcode"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-300">
              SydIN item code
            </p>
            <div className="flex min-h-[58px] items-center justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-4">
              <span className="break-words font-black text-indigo-100">
                {itemCode || "Not generated yet"}
              </span>
              <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Read only
              </span>
            </div>
            {!itemCode && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Older items may not have generated item codes yet.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
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
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Your internal or supplier stock code.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
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
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Product or scanned code. Leading zeroes are preserved.
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Notes" summary="Internal team context">
        <label className="mb-2 block text-sm font-semibold text-slate-300">
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
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#080b18]/95 px-5 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] py-4 text-base font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50 sm:flex-none sm:px-7"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-white py-4 text-base font-bold text-black transition hover:bg-slate-200 disabled:opacity-50 sm:flex-none sm:px-7"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
