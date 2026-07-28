import { supabase } from "@/app/lib/supabase";

type InventoryHistoryAction = "created" | "edited" | "deleted";

interface InventoryHistoryInput {
  itemId: number;
  userId: string;
  action: InventoryHistoryAction;
  oldQuantity?: number | null;
  newQuantity?: number | null;
  oldValues?: unknown | null;
  newValues?: unknown | null;
}

/**
 * Fields an "edited" history entry is meant to describe. Anything outside this
 * list is either derived or bookkeeping (`updated_at`, `user_id`, `public_id`)
 * and must not, on its own, make an edit look like it happened.
 */
const TRACKED_ITEM_FIELDS = [
  "name",
  "sku",
  "item_code",
  "barcode",
  "category",
  "category_id",
  "quantity",
  "unit_type",
  "custom_unit_label",
  "cost_price",
  "selling_price",
  "min_stock_level",
  "depot_id",
  "supplier_id",
  "notes",
  "image",
] as const;

/** Treat null, undefined and "" as the same absent value, and compare numbers
 *  by value so 10 and "10" (Postgres numerics come back as strings) match. */
function isSameFieldValue(a: unknown, b: unknown) {
  if (a === b) return true;
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return String(a) === String(b);
}

/**
 * True when a save actually altered one of the tracked fields.
 *
 * Saving an edit form without touching anything used to write an "edited" row
 * regardless, so the audit trail filled up with entries like
 * "Edited · 34233 → 34233" that record nothing. History should describe changes
 * that happened, not attempts.
 */
export function hasTrackedItemChanges(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined
) {
  if (!oldValues || !newValues) return true; // Can't prove it was a no-op — log it.

  return TRACKED_ITEM_FIELDS.some(
    (field) => !isSameFieldValue(oldValues[field], newValues[field])
  );
}

export async function logInventoryHistory({
  itemId,
  userId,
  action,
  oldQuantity = null,
  newQuantity = null,
  oldValues = null,
  newValues = null,
}: InventoryHistoryInput) {
  try {
    const { error } = await supabase.from("inventory_history").insert([
      {
        item_id: itemId,
        user_id: userId,
        action,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        old_values: oldValues,
        new_values: newValues,
      },
    ]);

    if (error) {
      console.warn("Inventory history insert failed:", error.message);
    }
  } catch (error) {
    console.warn("Inventory history insert failed:", error);
  }
}
