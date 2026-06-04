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
