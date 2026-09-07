"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import CategorySelector from "@/components/CategorySelector";
import Select from "@/components/ui/Select";
import { FieldGroup, FieldRow } from "@/components/ui";
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

function PhotoIcon() {
  return (
    <svg
      className="h-5 w-5"
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
  onCreateCategory,
  onCreateDepot,
  onCreateSupplier,
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
  /* This form doesn't own the category/depot/supplier lists -- the page
     around it does -- so creating one has to go back out to the page that
     can add it to the list it passed in. Optional: a caller that doesn't
     wire these up simply gets the old pick-from-what-exists dropdown. */
  onCreateCategory?: (name: string) => Promise<string | null>;
  onCreateDepot?: (name: string) => Promise<string | null>;
  onCreateSupplier?: (name: string) => Promise<string | null>;
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
  /* Last of the product-photo sites to get this: a photo that fails to load
     falls back to the plain placeholder icon an item without one shows,
     instead of the browser's broken-image glyph. */
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);

  /* A newly-picked file gets its own live preview in the photo tile rather
     than a filename printed underneath it -- the tile IS the preview now,
     there is nowhere else for "here is your new photo" to go. */
  const selectedImagePreviewUrl = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : ""),
    [selectedImage]
  );
  useEffect(() => {
    if (!selectedImagePreviewUrl) return;
    return () => URL.revokeObjectURL(selectedImagePreviewUrl);
  }, [selectedImagePreviewUrl]);

  /* Pricing, tracking codes and notes used to be three separate accordions --
     three repeats of the same header-and-chevron pattern to open one at a
     time. One reveal instead of three, and it opens by default whenever the
     item already carries any of that data: editing a priced, noted item
     should not hide its own price and notes behind a click. */
  const hasExtraDetails = Boolean(
    values.costPrice.trim() ||
      values.sellingPrice.trim() ||
      values.sku.trim() ||
      values.barcode.trim() ||
      values.notes.trim()
  );
  const [showMore, setShowMore] = useState(hasExtraDetails);

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <div className="item-form flex-1">
        <div className="item-panel-title-row">
          <label className="item-photo-tile" aria-label="Replace product photo">
            {selectedImagePreviewUrl ? (
              <Image
                src={selectedImagePreviewUrl}
                alt="New photo"
                fill
                unoptimized
                sizes="52px"
                className="object-cover"
              />
            ) : item.image && failedImageSrc !== item.image ? (
              <Image
                src={item.image}
                alt={item.name}
                fill
                loading="lazy"
                sizes="52px"
                onError={() => setFailedImageSrc(item.image)}
                className="object-cover"
              />
            ) : (
              <PhotoIcon />
            )}
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

          <div className="min-w-0 flex-1">
            <input
              id="edit-name-input"
              type="text"
              value={values.name}
              onChange={(event) => {
                onValueChange("name", event.target.value);
                onFieldErrorClear("name");
              }}
              disabled={saving}
              placeholder="Item name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "edit-name-error" : undefined}
              className="item-title-input"
            />
            <FieldError id="edit-name-error" message={fieldErrors.name} />
          </div>
        </div>

        {/* Two columns where there is room, stacked in the slide-over.
            Container query, not viewport -- see `.item-form-groups`. */}
        <div className="item-form-groups">
        <FieldGroup>
          <FieldRow label="Category">
            <CategorySelector
              categories={categories}
              value={values.categoryId}
              legacyCategory={values.category}
              onChange={(categoryId) => onValueChange("categoryId", categoryId)}
              disabled={saving}
              onCreate={onCreateCategory}
              compact
            />
          </FieldRow>

          <FieldRow label="Depot">
            <Select
              value={values.depotId}
              onChange={(value) => onValueChange("depotId", value)}
              disabled={saving}
              searchable={depots.length > 8}
              placeholder="Unassigned"
              onCreate={onCreateDepot}
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

          <FieldRow label="Supplier">
            <Select
              value={values.supplierId}
              onChange={(value) => onValueChange("supplierId", value)}
              disabled={saving}
              searchable={suppliers.length > 8}
              placeholder="No supplier"
              onCreate={onCreateSupplier}
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
        </FieldGroup>

        <FieldGroup label="Stock">
          <FieldRow
            label="Quantity"
            htmlFor="edit-quantity-input"
            required
            error={fieldErrors.quantity}
            errorId="edit-quantity-error"
          >
            <input
              id="edit-quantity-input"
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
              aria-describedby={fieldErrors.quantity ? "edit-quantity-error" : undefined}
            />
          </FieldRow>

          <FieldRow label="Unit" required error={fieldErrors.unitType}>
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
          </FieldRow>

          {values.unitType === "custom" && (
            <FieldRow
              label="Custom unit"
              htmlFor="edit-custom-unit-input"
              required
              error={fieldErrors.customUnitLabel}
              errorId="edit-custom-unit-error"
            >
              <input
                id="edit-custom-unit-input"
                type="text"
                value={values.customUnitLabel}
                onChange={(event) => {
                  onValueChange("customUnitLabel", event.target.value);
                  onFieldErrorClear("customUnitLabel");
                }}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.customUnitLabel)}
                aria-describedby={
                  fieldErrors.customUnitLabel ? "edit-custom-unit-error" : undefined
                }
                placeholder="e.g. Roll, Bottle, Tray"
              />
            </FieldRow>
          )}

          <FieldRow
            label="Min stock"
            htmlFor="edit-min-stock-input"
            error={fieldErrors.minStockLevel}
            errorId="edit-min-stock-error"
          >
            <input
              id="edit-min-stock-input"
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
              aria-describedby={
                fieldErrors.minStockLevel ? "edit-min-stock-error" : undefined
              }
              placeholder="Business default"
            />
          </FieldRow>
        </FieldGroup>

        {showMore && (
          <>
            <FieldGroup
              label="Pricing"
              action={
                <button
                  type="button"
                  onClick={() => setShowMore(false)}
                  className="text-xs font-bold text-theme-muted transition hover:text-theme-primary"
                >
                  Hide
                </button>
              }
            >
              <FieldRow
                label="Cost price"
                htmlFor="edit-cost-price-input"
                error={fieldErrors.costPrice}
                errorId="edit-cost-price-error"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-theme-accent">
                    {currencyCode}
                  </span>
                  <input
                    id="edit-cost-price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={values.costPrice}
                    onChange={(event) => {
                      onValueChange(
                        "costPrice",
                        event.target.value.startsWith("-") ? "" : event.target.value
                      );
                      onFieldErrorClear("costPrice");
                    }}
                    disabled={saving}
                    aria-invalid={Boolean(fieldErrors.costPrice)}
                    aria-describedby={
                      fieldErrors.costPrice ? "edit-cost-price-error" : undefined
                    }
                    placeholder="0.00"
                  />
                </div>
              </FieldRow>

              <FieldRow
                label="Selling price"
                htmlFor="edit-selling-price-input"
                error={fieldErrors.sellingPrice}
                errorId="edit-selling-price-error"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-theme-accent">
                    {currencyCode}
                  </span>
                  <input
                    id="edit-selling-price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={values.sellingPrice}
                    onChange={(event) => {
                      onValueChange(
                        "sellingPrice",
                        event.target.value.startsWith("-") ? "" : event.target.value
                      );
                      onFieldErrorClear("sellingPrice");
                    }}
                    disabled={saving}
                    aria-invalid={Boolean(fieldErrors.sellingPrice)}
                    aria-describedby={
                      fieldErrors.sellingPrice ? "edit-selling-price-error" : undefined
                    }
                    placeholder="0.00"
                  />
                </div>
              </FieldRow>

              <div className="mt-1 grid grid-cols-2 gap-3">
                <div className="rounded-[14px] border border-cyan-300/15 bg-cyan-500/[0.07] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-accent">
                    Cost value
                  </p>
                  <p className="mt-1 break-normal text-base font-black text-theme-primary">
                    {formattedCostValue || "—"}
                  </p>
                </div>
                <div className="rounded-[14px] border border-violet-300/15 bg-violet-500/[0.07] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-accent">
                    Retail value
                  </p>
                  <p className="mt-1 break-normal text-base font-black text-theme-primary">
                    {formattedRetailValue || "—"}
                  </p>
                </div>
              </div>
            </FieldGroup>

            <FieldGroup label="Tracking codes">
              <FieldRow label="Item code">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-theme-accent">
                    {itemCode || "Not generated yet"}
                  </span>
                  <span className="rounded-lg border border-theme bg-theme-inset px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-theme-muted">
                    Read only
                  </span>
                </div>
              </FieldRow>

              <FieldRow label="SKU">
                <input
                  type="text"
                  value={values.sku}
                  onChange={(event) => onValueChange("sku", event.target.value)}
                  disabled={saving}
                  autoCapitalize="characters"
                />
              </FieldRow>

              <FieldRow label="Barcode">
                <input
                  type="text"
                  value={values.barcode}
                  onChange={(event) => onValueChange("barcode", event.target.value)}
                  disabled={saving}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono tracking-wide"
                />
              </FieldRow>
            </FieldGroup>

            <FieldGroup label="Notes">
              <textarea
                value={values.notes}
                onChange={(event) => onValueChange("notes", event.target.value)}
                disabled={saving}
                placeholder="Internal notes..."
                className="item-panel-textarea"
              />
            </FieldGroup>
          </>
        )}
        </div>

        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-theme px-5 py-3 text-sm font-semibold text-theme-accent transition hover:bg-theme-hover"
          >
            Show pricing, tracking codes &amp; notes
          </button>
        )}

        {error && (
          <div className="mx-5 mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-theme-danger">
            {error}
          </div>
        )}
      </div>

      <div className="item-panel-footer">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition duration-[140ms] ease-[ease] hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
