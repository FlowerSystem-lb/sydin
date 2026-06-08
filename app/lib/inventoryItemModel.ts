export const INVENTORY_UNIT_TYPES = [
  "piece",
  "box",
  "dozen",
  "half_dozen",
  "pack",
  "kg",
  "meter",
  "custom",
] as const;

export type InventoryUnitType = (typeof INVENTORY_UNIT_TYPES)[number];

export const DEFAULT_INVENTORY_UNIT_TYPE: InventoryUnitType = "piece";

export const INVENTORY_UNIT_LABELS: Record<InventoryUnitType, string> = {
  piece: "Piece",
  box: "Box",
  dozen: "Dozen",
  half_dozen: "Half dozen",
  pack: "Pack",
  kg: "Kilogram",
  meter: "Meter",
  custom: "Custom",
};

export interface InventoryItemModelFields {
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
  barcode?: string | null;
}

export function normalizeInventoryUnitType(
  value: unknown
): InventoryUnitType {
  return typeof value === "string" &&
    INVENTORY_UNIT_TYPES.includes(value as InventoryUnitType)
    ? (value as InventoryUnitType)
    : DEFAULT_INVENTORY_UNIT_TYPE;
}

export function getInventoryUnitLabel(
  unitType: unknown,
  customUnitLabel?: string | null
) {
  const normalizedUnit = normalizeInventoryUnitType(unitType);
  const normalizedCustomLabel = customUnitLabel?.trim();

  if (normalizedUnit === "custom" && normalizedCustomLabel) {
    return normalizedCustomLabel;
  }

  return INVENTORY_UNIT_LABELS[normalizedUnit];
}

export function getInventoryQuantityLabel(
  quantity: unknown,
  unitType: unknown,
  customUnitLabel?: string | null
) {
  const normalizedQuantity = Number(quantity);
  const displayQuantity = Number.isFinite(normalizedQuantity)
    ? normalizedQuantity
    : 0;
  const normalizedUnit = normalizeInventoryUnitType(unitType);
  const customLabel = customUnitLabel?.trim();

  if (normalizedUnit === "custom" && customLabel) {
    return `${displayQuantity} ${customLabel}`;
  }

  const unitLabels: Record<InventoryUnitType, string> = {
    piece: displayQuantity === 1 ? "piece" : "pcs",
    box: displayQuantity === 1 ? "box" : "boxes",
    dozen: displayQuantity === 1 ? "dozen" : "dozen",
    half_dozen: "half dozen",
    pack: displayQuantity === 1 ? "pack" : "packs",
    kg: "kg",
    meter: displayQuantity === 1 ? "meter" : "meters",
    custom: displayQuantity === 1 ? "unit" : "units",
  };

  return `${displayQuantity} ${unitLabels[normalizedUnit]}`;
}

export function normalizeCurrencyCode(
  currencyCode: string | null | undefined,
  fallback = "USD"
) {
  const normalizedCurrency = currencyCode?.trim().toUpperCase();

  return normalizedCurrency && /^[A-Z]{3}$/.test(normalizedCurrency)
    ? normalizedCurrency
    : fallback;
}

function normalizeNonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalizedValue = Number(value);

  return Number.isFinite(normalizedValue) && normalizedValue >= 0
    ? normalizedValue
    : null;
}

export function formatInventoryPrice(
  value: unknown,
  currencyCode = "USD",
  locale = "en-US"
) {
  const normalizedValue = normalizeNonNegativeNumber(value);

  if (normalizedValue === null) {
    return null;
  }

  const normalizedCurrency = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalizedValue);
  } catch {
    return `${normalizedCurrency} ${normalizedValue.toFixed(2)}`;
  }
}

export function calculateInventoryValue(
  quantity: unknown,
  unitPrice: unknown
) {
  const normalizedQuantity = normalizeNonNegativeNumber(quantity);
  const normalizedPrice = normalizeNonNegativeNumber(unitPrice);

  if (normalizedQuantity === null || normalizedPrice === null) {
    return null;
  }

  return Math.round(normalizedQuantity * normalizedPrice * 100) / 100;
}

export function getEffectiveItemLowStockThreshold(
  minStockLevel: number | null | undefined,
  fallbackThreshold: number
) {
  if (
    typeof minStockLevel === "number" &&
    Number.isInteger(minStockLevel) &&
    minStockLevel >= 0
  ) {
    return minStockLevel;
  }

  if (Number.isFinite(fallbackThreshold) && fallbackThreshold >= 0) {
    return Math.round(fallbackThreshold);
  }

  return 0;
}
