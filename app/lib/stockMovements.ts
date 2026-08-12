import { notifyIfCrossedIntoLowStock } from "@/app/lib/notifications";
import { supabase } from "@/app/lib/supabase";

export type StockMovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "damaged_lost";

export interface StockMovement {
  id: number;
  item_id?: number;
  movement_type: StockMovementType;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
}

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  adjustment: "Adjustment",
  damaged_lost: "Damaged / Lost",
};

export function formatStockMovementNotes(notes: string | null) {
  if (!notes) return "";

  const pickListMatch = notes.match(/^Pick list #(\d+):\s*(.+)$/i);

  if (pickListMatch) {
    return `Pick List #${pickListMatch[1]} — ${pickListMatch[2]}`;
  }

  const purchaseOrderMatch = notes.match(/^Purchase order #(\d+):\s*(.+)$/i);

  if (purchaseOrderMatch) {
    return `PO #${purchaseOrderMatch[1]} — ${purchaseOrderMatch[2]}`;
  }

  return notes;
}

function normalizeMovement(data: Partial<StockMovement>): StockMovement {
  return {
    id: Number(data.id),
    item_id:
      data.item_id === null || data.item_id === undefined
        ? undefined
        : Number(data.item_id),
    movement_type: (data.movement_type || "adjustment") as StockMovementType,
    quantity_delta: Number(data.quantity_delta || 0),
    quantity_before: Number(data.quantity_before || 0),
    quantity_after: Number(data.quantity_after || 0),
    notes: data.notes || null,
    created_at: data.created_at || "",
  };
}

export async function getRecentStockMovements(
  userId: string,
  limit = 100
) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, item_id, movement_type, quantity_delta, quantity_before, quantity_after, notes, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(Math.max(1, Math.min(limit, 250)));

  if (error) {
    throw error;
  }

  return ((data || []) as Partial<StockMovement>[]).map(normalizeMovement);
}

export async function getStockMovementsForItem(
  userId: string,
  itemId: number
) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, movement_type, quantity_delta, quantity_before, quantity_after, notes, created_at"
    )
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return ((data || []) as Partial<StockMovement>[]).map(normalizeMovement);
}

export async function recordStockMovement({
  itemId,
  movementType,
  quantity,
  notes,
}: {
  itemId: number;
  movementType: StockMovementType;
  quantity: number;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("record_stock_movement", {
    p_item_id: itemId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw error;
  }

  const movement = normalizeMovement(data as Partial<StockMovement>);

  // backlog §6: every stock-change path in the app (Scanner's 8 modes, the
  // item page, the slide-over, Receiving, Stock Counts) already calls this
  // one function, so this is the single, complete-coverage place to generate
  // a low/out-of-stock notification — not each of those 6 call sites
  // individually. Best-effort: a notification failure must never surface
  // here or undo a movement that already succeeded.
  supabase.auth
    .getUser()
    .then(({ data: { user } }) => {
      if (!user) return;

      return notifyIfCrossedIntoLowStock({
        userId: user.id,
        itemId,
        quantityBefore: movement.quantity_before,
        quantityAfter: movement.quantity_after,
      });
    })
    .catch(() => {
      // Best-effort, by design — see comment above.
    });

  return movement;
}
