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
    // Try a simple check: if the table doesn't exist, Supabase will error
    const { error } = await supabase
      .from("inventory_depot_transfers")
      .select("count")
      .limit(1);

    // Only consider migration missing if we get an explicit "does not exist" or 42P01 error
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      return true;
    }

    // All other responses (including RLS, auth, or successful queries) mean table exists
    return false;
  } catch (e) {
    const errorMsg = (e as Error)?.message || "";
    if (errorMsg.includes("does not exist")) {
      return true;
    }
    // On any other error, assume table exists
    return false;
  }
}
