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
      .select("id", { count: "exact", head: true })
      .limit(1);

    // If we get a "table not found" error, migration is missing
    if (error?.code === "42P01") {
      return true;
    }

    // If we got any other response (even an RLS error), the table exists
    // Only return "missing" if we explicitly get table-not-found
    return false;
  } catch {
    // Network/auth errors — assume missing to be safe
    return true;
  }
}
