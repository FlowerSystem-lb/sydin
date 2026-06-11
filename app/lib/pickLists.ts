import { getInventoryUnitLabel } from "@/app/lib/inventoryItemModel";
import { supabase } from "@/app/lib/supabase";

export type PickListStatus =
  | "draft"
  | "preparing"
  | "completed"
  | "cancelled";

export type PickListCompletionStockAction = "deducted" | "skipped" | null;

export interface PickList {
  id: number;
  user_id: string;
  title: string;
  customer_name: string | null;
  due_date: string | null;
  status: PickListStatus;
  notes: string | null;
  completion_stock_action: PickListCompletionStockAction;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface PickListSummary extends PickList {
  item_count: number;
  required_total: number;
  prepared_total: number;
  shortage_count: number;
}

export interface PickListInventoryItem {
  id: number;
  name: string;
  item_code: string | null;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unit_type: string | null;
  custom_unit_label: string | null;
  category_id: number | null;
  supplier_id: number | null;
}

export interface PickListItem {
  id: number;
  pick_list_id: number;
  inventory_item_id: number | null;
  required_quantity: number;
  prepared_quantity: number;
  notes: string | null;
  item_name_snapshot: string;
  item_code_snapshot: string | null;
  sku_snapshot: string | null;
  unit_label_snapshot: string | null;
  created_at: string;
  updated_at: string;
  inventory: PickListInventoryItem | null;
}

export interface PickListDetail extends PickList {
  items: PickListItem[];
}

export interface PickListInput {
  title: string;
  customer_name?: string;
  due_date?: string;
  notes?: string;
}

export interface PickListItemInput {
  inventoryItemId: number;
  requiredQuantity: number;
  notes?: string;
}

export interface PickListItemUpdate {
  requiredQuantity: number;
  preparedQuantity: number;
  notes?: string;
}

type PickListRow = Partial<PickList>;
type PickListItemRow = Omit<Partial<PickListItem>, "inventory"> & {
  inventory?: Partial<PickListInventoryItem> | Partial<PickListInventoryItem>[];
};

const PICK_LIST_SELECT =
  "id, user_id, title, customer_name, due_date, status, notes, completion_stock_action, created_at, updated_at, completed_at, cancelled_at";

const PICK_LIST_ITEM_SELECT =
  "id, pick_list_id, inventory_item_id, required_quantity, prepared_quantity, notes, item_name_snapshot, item_code_snapshot, sku_snapshot, unit_label_snapshot, created_at, updated_at, inventory:inventory_item_id(id, name, item_code, sku, barcode, quantity, unit_type, custom_unit_label, category_id, supplier_id)";

function normalizePickList(row: PickListRow): PickList {
  return {
    id: Number(row.id),
    user_id: row.user_id || "",
    title: row.title?.trim() || "Untitled pick list",
    customer_name: row.customer_name?.trim() || null,
    due_date: row.due_date || null,
    status: (row.status || "draft") as PickListStatus,
    notes: row.notes?.trim() || null,
    completion_stock_action:
      (row.completion_stock_action as PickListCompletionStockAction) || null,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    completed_at: row.completed_at || null,
    cancelled_at: row.cancelled_at || null,
  };
}

function normalizeInventoryItem(
  row: Partial<PickListInventoryItem> | undefined
): PickListInventoryItem | null {
  if (!row?.id) return null;

  return {
    id: Number(row.id),
    name: row.name?.trim() || "Unnamed item",
    item_code: row.item_code?.trim() || null,
    sku: row.sku?.trim() || null,
    barcode: row.barcode?.trim() || null,
    quantity: Number(row.quantity || 0),
    unit_type: row.unit_type || null,
    custom_unit_label: row.custom_unit_label?.trim() || null,
    category_id: row.category_id ? Number(row.category_id) : null,
    supplier_id: row.supplier_id ? Number(row.supplier_id) : null,
  };
}

function normalizePickListItem(row: PickListItemRow): PickListItem {
  const relatedInventory = Array.isArray(row.inventory)
    ? row.inventory[0]
    : row.inventory;

  return {
    id: Number(row.id),
    pick_list_id: Number(row.pick_list_id),
    inventory_item_id: row.inventory_item_id
      ? Number(row.inventory_item_id)
      : null,
    required_quantity: Number(row.required_quantity || 0),
    prepared_quantity: Number(row.prepared_quantity || 0),
    notes: row.notes?.trim() || null,
    item_name_snapshot: row.item_name_snapshot?.trim() || "Unavailable item",
    item_code_snapshot: row.item_code_snapshot?.trim() || null,
    sku_snapshot: row.sku_snapshot?.trim() || null,
    unit_label_snapshot: row.unit_label_snapshot?.trim() || null,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    inventory: normalizeInventoryItem(relatedInventory),
  };
}

function normalizePickListInput(input: PickListInput) {
  return {
    title: input.title.trim(),
    customer_name: input.customer_name?.trim() || null,
    due_date: input.due_date || null,
    notes: input.notes?.trim() || null,
  };
}

export function isPickListActive(status: PickListStatus) {
  return status === "draft" || status === "preparing";
}

export function getPickListProgress(items: PickListItem[]) {
  const required = items.reduce(
    (total, item) => total + item.required_quantity,
    0
  );
  const prepared = items.reduce(
    (total, item) => total + item.prepared_quantity,
    0
  );

  return {
    required,
    prepared,
    percent:
      required > 0 ? Math.min(100, Math.round((prepared / required) * 100)) : 0,
  };
}

export async function getPickListsForUser(
  userId: string
): Promise<PickListSummary[]> {
  const { data: listRows, error } = await supabase
    .from("pick_lists")
    .select(PICK_LIST_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const lists = ((listRows || []) as PickListRow[]).map(normalizePickList);

  if (lists.length === 0) return [];

  const { data: itemRows, error: itemError } = await supabase
    .from("pick_list_items")
    .select(
      "pick_list_id, required_quantity, prepared_quantity, inventory:inventory_item_id(quantity)"
    )
    .in(
      "pick_list_id",
      lists.map((list) => list.id)
    );

  if (itemError) throw itemError;

  const summaries = new Map<
    number,
    {
      item_count: number;
      required_total: number;
      prepared_total: number;
      shortage_count: number;
    }
  >();

  for (const rawRow of itemRows || []) {
    const row = rawRow as {
      pick_list_id: number;
      required_quantity: number;
      prepared_quantity: number;
      inventory?:
        | { quantity?: number | null }
        | { quantity?: number | null }[]
        | null;
    };
    const inventory = Array.isArray(row.inventory)
      ? row.inventory[0]
      : row.inventory;
    const current = summaries.get(Number(row.pick_list_id)) || {
      item_count: 0,
      required_total: 0,
      prepared_total: 0,
      shortage_count: 0,
    };
    const requiredQuantity = Number(row.required_quantity || 0);

    current.item_count += 1;
    current.required_total += requiredQuantity;
    current.prepared_total += Number(row.prepared_quantity || 0);

    if (
      !inventory ||
      Number(inventory.quantity || 0) < requiredQuantity
    ) {
      current.shortage_count += 1;
    }

    summaries.set(Number(row.pick_list_id), current);
  }

  return lists.map((list) => ({
    ...list,
    ...(summaries.get(list.id) || {
      item_count: 0,
      required_total: 0,
      prepared_total: 0,
      shortage_count: 0,
    }),
  }));
}

export async function countActivePickLists(userId: string) {
  const { count, error } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["draft", "preparing"]);

  if (error) throw error;
  return count || 0;
}

export async function getPickListDetail(
  userId: string,
  pickListId: number
): Promise<PickListDetail | null> {
  const [{ data: listRow, error }, { data: itemRows, error: itemError }] =
    await Promise.all([
      supabase
        .from("pick_lists")
        .select(PICK_LIST_SELECT)
        .eq("id", pickListId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("pick_list_items")
        .select(PICK_LIST_ITEM_SELECT)
        .eq("pick_list_id", pickListId)
        .order("created_at", { ascending: true }),
    ]);

  if (error) throw error;
  if (itemError) throw itemError;
  if (!listRow) return null;

  return {
    ...normalizePickList(listRow as PickListRow),
    items: ((itemRows || []) as PickListItemRow[]).map(normalizePickListItem),
  };
}

export async function getPickListInventoryItems(
  userId: string
): Promise<PickListInventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select(
      "id, name, item_code, sku, barcode, quantity, unit_type, custom_unit_label, category_id, supplier_id"
    )
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data || []) as Partial<PickListInventoryItem>[])
    .map(normalizeInventoryItem)
    .filter((item): item is PickListInventoryItem => Boolean(item));
}

export async function createPickList(
  userId: string,
  input: PickListInput,
  activeLimit: number | null
) {
  const normalizedInput = normalizePickListInput(input);

  if (!normalizedInput.title) {
    throw new Error("Pick list title is required.");
  }

  const activeCount = await countActivePickLists(userId);

  if (activeLimit !== null && activeCount >= activeLimit) {
    throw new Error(
      `You reached your plan limit of ${activeLimit} active pick lists.`
    );
  }

  const { data, error } = await supabase
    .from("pick_lists")
    .insert({
      user_id: userId,
      ...normalizedInput,
    })
    .select(PICK_LIST_SELECT)
    .single();

  if (error) throw error;
  return normalizePickList(data as PickListRow);
}

export async function updatePickList(
  userId: string,
  pickListId: number,
  input: PickListInput
) {
  const normalizedInput = normalizePickListInput(input);

  if (!normalizedInput.title) {
    throw new Error("Pick list title is required.");
  }

  const { data, error } = await supabase
    .from("pick_lists")
    .update(normalizedInput)
    .eq("id", pickListId)
    .eq("user_id", userId)
    .in("status", ["draft", "preparing"])
    .select(PICK_LIST_SELECT)
    .single();

  if (error) throw error;
  return normalizePickList(data as PickListRow);
}

export async function startPreparingPickList(
  userId: string,
  pickListId: number
) {
  const { data, error } = await supabase
    .from("pick_lists")
    .update({ status: "preparing" })
    .eq("id", pickListId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .select(PICK_LIST_SELECT)
    .single();

  if (error) throw error;
  return normalizePickList(data as PickListRow);
}

export async function cancelPickList(userId: string, pickListId: number) {
  const { data, error } = await supabase
    .from("pick_lists")
    .update({ status: "cancelled" })
    .eq("id", pickListId)
    .eq("user_id", userId)
    .in("status", ["draft", "preparing"])
    .select(PICK_LIST_SELECT)
    .single();

  if (error) throw error;
  return normalizePickList(data as PickListRow);
}

export async function addPickListItem(
  userId: string,
  pickListId: number,
  input: PickListItemInput
) {
  if (
    !Number.isInteger(input.requiredQuantity) ||
    input.requiredQuantity <= 0
  ) {
    throw new Error("Required quantity must be a whole number above zero.");
  }

  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory")
    .select(
      "id, name, item_code, sku, unit_type, custom_unit_label"
    )
    .eq("id", input.inventoryItemId)
    .eq("user_id", userId)
    .single();

  if (inventoryError) throw inventoryError;

  const { data, error } = await supabase
    .from("pick_list_items")
    .insert({
      pick_list_id: pickListId,
      inventory_item_id: input.inventoryItemId,
      required_quantity: input.requiredQuantity,
      prepared_quantity: 0,
      notes: input.notes?.trim() || null,
      item_name_snapshot: inventory.name,
      item_code_snapshot: inventory.item_code?.trim() || null,
      sku_snapshot: inventory.sku?.trim() || null,
      unit_label_snapshot: getInventoryUnitLabel(
        inventory.unit_type,
        inventory.custom_unit_label
      ),
    })
    .select(PICK_LIST_ITEM_SELECT)
    .single();

  if (error) throw error;
  return normalizePickListItem(data as PickListItemRow);
}

export async function updatePickListItem(
  pickListItemId: number,
  input: PickListItemUpdate
) {
  if (
    !Number.isInteger(input.requiredQuantity) ||
    input.requiredQuantity <= 0
  ) {
    throw new Error("Required quantity must be a whole number above zero.");
  }

  if (
    !Number.isInteger(input.preparedQuantity) ||
    input.preparedQuantity < 0 ||
    input.preparedQuantity > input.requiredQuantity
  ) {
    throw new Error(
      "Prepared quantity must be between zero and the required quantity."
    );
  }

  const { data, error } = await supabase
    .from("pick_list_items")
    .update({
      required_quantity: input.requiredQuantity,
      prepared_quantity: input.preparedQuantity,
      notes: input.notes?.trim() || null,
    })
    .eq("id", pickListItemId)
    .select(PICK_LIST_ITEM_SELECT)
    .single();

  if (error) throw error;
  return normalizePickListItem(data as PickListItemRow);
}

export async function removePickListItem(pickListItemId: number) {
  const { error } = await supabase
    .from("pick_list_items")
    .delete()
    .eq("id", pickListItemId);

  if (error) throw error;
}

export async function completePickList(
  pickListId: number,
  deductStock: boolean
) {
  const { data, error } = await supabase.rpc("complete_pick_list", {
    p_pick_list_id: pickListId,
    p_deduct_stock: deductStock,
  });

  if (error) throw error;
  return normalizePickList(data as PickListRow);
}

export function getPickListErrorMessage(error: unknown) {
  const pickListError = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const message =
    `${pickListError?.message || ""} ${pickListError?.details || ""}`.trim();
  const normalized = message.toLowerCase();

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    pickListError?.code === "42P01" ||
    pickListError?.code === "PGRST204" ||
    normalized.includes("pick_lists") ||
    normalized.includes("pick_list_items")
  ) {
    return "Pick List storage is not ready yet. Apply the Phase 7 SQL migration, then try again.";
  }

  if (pickListError?.code === "23505" || normalized.includes("duplicate")) {
    return normalized.includes("stock")
      ? "Stock has already been deducted for this pick list item."
      : "This inventory item is already on the pick list.";
  }

  if (normalized.includes("insufficient stock")) {
    return message || "One or more items do not have enough stock.";
  }

  if (
    normalized.includes("fully prepared") ||
    normalized.includes("at least one item") ||
    normalized.includes("no longer available") ||
    normalized.includes("active pick list") ||
    normalized.includes("pick list limit")
  ) {
    return message;
  }

  if (
    pickListError?.code === "42501" ||
    normalized.includes("authenticated") ||
    normalized.includes("ownership")
  ) {
    return "You do not have access to this pick list or inventory item.";
  }

  if (
    normalized.includes("completed or cancelled") ||
    normalized.includes("status transition") ||
    normalized.includes("only preparing")
  ) {
    return message;
  }

  return "We could not save this pick list change. Please try again.";
}
