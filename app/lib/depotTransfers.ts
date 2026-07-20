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
    const { error } = await supabase
      .from("inventory_depot_transfers")
      .select("id", { count: "exact", head: true });

    if (error?.code === "42P01") {
      // Table doesn't exist
      return true;
    }

    return false;
  } catch {
    return true;
  }
}
