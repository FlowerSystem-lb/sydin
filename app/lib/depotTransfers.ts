import { supabase } from "./supabase";

export async function transferInventoryItemToDepot(
  itemId: number,
  newDepotId: number,
  movedByName?: string,
  notes?: string
) {
  const { data, error } = await supabase.rpc("transfer_inventory_item_to_depot", {
    item_id: itemId,
    new_depot_id: newDepotId,
    moved_by_name: movedByName || null,
    transfer_notes: notes || null,
  });

  if (error) throw error;
  return data as {
    success: boolean;
    item_name: string;
    from_depot: string | null;
    to_depot: string;
    moved_by: string;
    notes: string | null;
  };
}

export async function isDepotTransferMigrationMissing(): Promise<boolean> {
  try {
    // Try to call the RPC that was created by the migration
    // If the RPC doesn't exist, Supabase will error with "undefined function"
    const { error } = await supabase.rpc("transfer_inventory_item_to_depot", {
      item_id: 0,
      new_depot_id: 0,
      moved_by_name: null,
      transfer_notes: null,
    });

    // Check if the error is specifically about function not existing
    const errorMsg = error?.message || "";
    const errorCode = error?.code || "";

    if (
      errorMsg.includes("undefined function") ||
      errorMsg.includes("does not exist") ||
      errorCode === "42883"
    ) {
      // Function doesn't exist = migration not applied
      return true;
    }

    // Any other response (including permission errors) means migration exists
    return false;
  } catch (e) {
    // On any exception, assume migration exists (table is there, just had an issue)
    return false;
  }
}
