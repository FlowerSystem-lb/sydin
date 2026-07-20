import { supabase } from "./supabase";

export type AssetStatus =
  | "in_stock"
  | "in_use"
  | "in_repair"
  | "retired"
  | "lost";
export type AssetCondition =
  | "good"
  | "fair"
  | "poor"
  | "damaged"
  | "unknown";
export type AssetEventType =
  | "created"
  | "status_changed"
  | "condition_changed"
  | "assigned"
  | "unassigned"
  | "note_added"
  | "retired";

export interface InventoryAsset {
  id: number;
  inventory_item_id: number;
  public_id: string;
  status: AssetStatus;
  condition: AssetCondition | null;
  assigned_to_name: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function recordAssetEvent(
  assetId: number,
  eventType: AssetEventType,
  newStatus?: AssetStatus,
  newCondition?: AssetCondition,
  newAssignedTo?: string,
  notes?: string,
  recordedByName?: string
) {
  const { data, error } = await supabase.rpc("record_asset_event", {
    asset_id: assetId,
    event_type_arg: eventType,
    new_status_arg: newStatus || null,
    new_condition_arg: newCondition || null,
    new_assigned_to_arg: newAssignedTo || null,
    event_notes: notes || null,
    recorded_by_name: recordedByName || null,
  });

  if (error) throw error;
  return data as {
    success: boolean;
    asset_id: number;
    event_type: AssetEventType;
    new_status: AssetStatus;
    new_condition: AssetCondition | null;
    new_assigned_to: string | null;
  };
}

export async function getAssetsByItem(itemId: number): Promise<InventoryAsset[]> {
  const { data, error } = await supabase
    .from("inventory_assets")
    .select("*")
    .eq("inventory_item_id", itemId)
    .order("public_id", { ascending: true });

  if (error) throw error;
  return (data || []) as InventoryAsset[];
}

export async function getAssetAssigneeSuggestions(
  searchTerm: string = ""
): Promise<Array<{ name: string; count: number }>> {
  const { data: suggestions, error } = await supabase.rpc(
    "get_asset_assignee_suggestions",
    { search_term: searchTerm }
  );

  if (error) throw error;
  return (suggestions || []) as Array<{ name: string; count: number }>;
}

export async function isAssetTrackingMigrationMissing(): Promise<boolean> {
  try {
    // Try to call the RPC that was created by the migration
    // If the RPC doesn't exist, Supabase will error with "undefined function"
    const { error } = await supabase.rpc("record_asset_event", {
      asset_id: 0,
      event_type_arg: "created",
      new_status_arg: null,
      new_condition_arg: null,
      new_assigned_to_arg: null,
      event_notes: null,
      recorded_by_name: null,
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
    // On any exception, assume migration exists (tables are there, just had an issue)
    return false;
  }
}
