import {
  calculateInventoryValue,
  getEffectiveItemLowStockThreshold,
} from "@/app/lib/inventoryItemModel";
import type {
  StockMovement,
  StockMovementType,
} from "@/app/lib/stockMovements";

export interface InventoryReportItem {
  id: number;
  name: string;
  item_code?: string | null;
  category?: string | null;
  category_id?: number | null;
  quantity: number | string | null;
  unit_type?: string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
  depot_id?: number | null;
  supplier_id?: number | null;
}

export interface ReportStockMovement extends StockMovement {
  item_id: number;
}

export interface StockHealthReportItem extends InventoryReportItem {
  normalizedQuantity: number;
  threshold: number;
}

export interface RankedValueItem {
  item: InventoryReportItem;
  value: number;
}

export interface GroupedInventoryValue {
  label: string;
  costValue: number;
  retailValue: number;
  itemCount: number;
}

export interface MovementTotals {
  movementCount: number;
  stockIn: number;
  stockOut: number;
  damagedLost: number;
  adjustmentCount: number;
  netAdjustment: number;
}

export interface MovementTimeBucket {
  key: string;
  label: string;
  stockIn: number;
  stockOut: number;
}

export function normalizeReportNumber(
  value: unknown,
  fallback = 0
): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : fallback;
}

export function hasReportPrice(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue >= 0;
}

export function getItemCostValue(item: InventoryReportItem) {
  return calculateInventoryValue(item.quantity, item.cost_price);
}

export function getItemRetailValue(item: InventoryReportItem) {
  return calculateInventoryValue(item.quantity, item.selling_price);
}

export function getPriceDataCoverage(items: InventoryReportItem[]) {
  return items.reduce(
    (coverage, item) => {
      const hasCostPrice = hasReportPrice(item.cost_price);
      const hasSellingPrice = hasReportPrice(item.selling_price);

      if (hasCostPrice) coverage.costPriceItems += 1;
      if (hasSellingPrice) coverage.retailPriceItems += 1;
      if (hasCostPrice || hasSellingPrice) coverage.itemsWithPriceData += 1;

      return coverage;
    },
    {
      itemsWithPriceData: 0,
      costPriceItems: 0,
      retailPriceItems: 0,
    }
  );
}

function getStockHealthItem(
  item: InventoryReportItem,
  fallbackThreshold: number,
  useItemThreshold: boolean
): StockHealthReportItem {
  const normalizedQuantity = Math.max(
    0,
    normalizeReportNumber(item.quantity)
  );
  const threshold = useItemThreshold
    ? getEffectiveItemLowStockThreshold(
        item.min_stock_level,
        fallbackThreshold
      )
    : getEffectiveItemLowStockThreshold(null, fallbackThreshold);

  return {
    ...item,
    normalizedQuantity,
    threshold,
  };
}

export function getLowStockReport(
  items: InventoryReportItem[],
  fallbackThreshold: number,
  useItemThreshold: boolean
) {
  return items
    .map((item) =>
      getStockHealthItem(item, fallbackThreshold, useItemThreshold)
    )
    .filter(
      (item) =>
        item.normalizedQuantity > 0 &&
        item.normalizedQuantity <= item.threshold
    )
    .sort(
      (left, right) =>
        left.normalizedQuantity - right.normalizedQuantity ||
        left.name.localeCompare(right.name)
    );
}

export function getOutOfStockReport(items: InventoryReportItem[]) {
  return items
    .map((item) => ({
      ...item,
      normalizedQuantity: Math.max(
        0,
        normalizeReportNumber(item.quantity)
      ),
      threshold: 0,
    }))
    .filter((item) => normalizeReportNumber(item.quantity) <= 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getRankedValueItems(
  items: InventoryReportItem[],
  valueType: "cost" | "retail",
  limit = 10
) {
  const priceKey =
    valueType === "cost" ? ("cost_price" as const) : ("selling_price" as const);

  return items
    .filter((item) => hasReportPrice(item[priceKey]))
    .map<RankedValueItem>((item) => ({
      item,
      value:
        (valueType === "cost"
          ? getItemCostValue(item)
          : getItemRetailValue(item)) || 0,
    }))
    .sort(
      (left, right) =>
        right.value - left.value ||
        left.item.name.localeCompare(right.item.name)
    )
    .slice(0, Math.max(0, limit));
}

export function getInventoryValueTotals(items: InventoryReportItem[]) {
  let totalCostValue = 0;
  let totalRetailValue = 0;

  items.forEach((item) => {
    totalCostValue += getItemCostValue(item) || 0;
    totalRetailValue += getItemRetailValue(item) || 0;
  });

  return {
    totalCostValue: Math.round(totalCostValue * 100) / 100,
    totalRetailValue: Math.round(totalRetailValue * 100) / 100,
    estimatedMarginValue:
      Math.round((totalRetailValue - totalCostValue) * 100) / 100,
  };
}

export function groupInventoryValues(
  items: InventoryReportItem[],
  getLabel: (item: InventoryReportItem) => string
) {
  const groups = new Map<string, GroupedInventoryValue>();

  items.forEach((item) => {
    const label = getLabel(item).trim() || "Uncategorized";
    const current = groups.get(label) || {
      label,
      costValue: 0,
      retailValue: 0,
      itemCount: 0,
    };

    current.costValue += getItemCostValue(item) || 0;
    current.retailValue += getItemRetailValue(item) || 0;
    current.itemCount += 1;
    groups.set(label, current);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      costValue: Math.round(group.costValue * 100) / 100,
      retailValue: Math.round(group.retailValue * 100) / 100,
    }))
    .sort(
      (left, right) =>
        right.costValue - left.costValue ||
        left.label.localeCompare(right.label)
    );
}

export function summarizeTopValueGroups(
  groups: GroupedInventoryValue[],
  limit = 6
) {
  if (groups.length <= limit) return groups;

  const visibleGroups = groups.slice(0, limit);
  const other = groups.slice(limit).reduce<GroupedInventoryValue>(
    (summary, group) => ({
      label: "Other",
      costValue: summary.costValue + group.costValue,
      retailValue: summary.retailValue + group.retailValue,
      itemCount: summary.itemCount + group.itemCount,
    }),
    {
      label: "Other",
      costValue: 0,
      retailValue: 0,
      itemCount: 0,
    }
  );

  return [...visibleGroups, other];
}

function getMovementMagnitude(
  movementType: StockMovementType,
  quantityDelta: unknown
) {
  const quantity = normalizeReportNumber(quantityDelta);

  if (movementType === "adjustment") return quantity;
  return Math.abs(quantity);
}

export function getMovementTotals(
  movements: ReportStockMovement[]
): MovementTotals {
  return movements.reduce<MovementTotals>(
    (totals, movement) => {
      const quantity = getMovementMagnitude(
        movement.movement_type,
        movement.quantity_delta
      );

      totals.movementCount += 1;

      if (movement.movement_type === "stock_in") {
        totals.stockIn += quantity;
      } else if (movement.movement_type === "stock_out") {
        totals.stockOut += quantity;
      } else if (movement.movement_type === "damaged_lost") {
        totals.damagedLost += quantity;
      } else {
        totals.adjustmentCount += 1;
        totals.netAdjustment += quantity;
      }

      return totals;
    },
    {
      movementCount: 0,
      stockIn: 0,
      stockOut: 0,
      damagedLost: 0,
      adjustmentCount: 0,
      netAdjustment: 0,
    }
  );
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatBucketLabel(start: Date, end?: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (!end || start.getTime() === end.getTime()) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function getMovementTimeBuckets({
  movements,
  startDate,
  endDate,
  bucketSize,
}: {
  movements: ReportStockMovement[];
  startDate: Date;
  endDate: Date;
  bucketSize: "day" | "week";
}) {
  const normalizedStart = startOfUtcDay(startDate);
  const normalizedEnd = startOfUtcDay(endDate);
  const bucketDays = bucketSize === "week" ? 7 : 1;
  const buckets: MovementTimeBucket[] = [];
  const bucketIndex = new Map<string, number>();

  for (
    let cursor = normalizedStart;
    cursor.getTime() <= normalizedEnd.getTime();
    cursor = addUtcDays(cursor, bucketDays)
  ) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(
      Math.min(
        addUtcDays(bucketStart, bucketDays - 1).getTime(),
        normalizedEnd.getTime()
      )
    );
    const key = bucketStart.toISOString().slice(0, 10);

    bucketIndex.set(key, buckets.length);
    buckets.push({
      key,
      label: formatBucketLabel(
        bucketStart,
        bucketSize === "week" ? bucketEnd : undefined
      ),
      stockIn: 0,
      stockOut: 0,
    });
  }

  movements.forEach((movement) => {
    if (
      movement.movement_type !== "stock_in" &&
      movement.movement_type !== "stock_out"
    ) {
      return;
    }

    const movementDate = startOfUtcDay(new Date(movement.created_at));

    if (
      Number.isNaN(movementDate.getTime()) ||
      movementDate < normalizedStart ||
      movementDate > normalizedEnd
    ) {
      return;
    }

    const elapsedDays = Math.floor(
      (movementDate.getTime() - normalizedStart.getTime()) / 86_400_000
    );
    const bucketStart = addUtcDays(
      normalizedStart,
      Math.floor(elapsedDays / bucketDays) * bucketDays
    );
    const index = bucketIndex.get(bucketStart.toISOString().slice(0, 10));

    if (index === undefined) return;

    const quantity = Math.abs(
      normalizeReportNumber(movement.quantity_delta)
    );

    if (movement.movement_type === "stock_in") {
      buckets[index].stockIn += quantity;
    } else {
      buckets[index].stockOut += quantity;
    }
  });

  return buckets;
}
