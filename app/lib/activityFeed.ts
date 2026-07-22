import { supabase } from "@/app/lib/supabase";

export type ActivityEventType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "damaged_lost"
  | "item_created"
  | "item_edited"
  | "po_received";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  itemId?: number;
  itemName?: string;
  poId?: number;
  poNumber?: string;
  quantityBefore?: number;
  quantityAfter?: number;
  quantityDelta?: number;
  notes?: string | null;
  createdAt: string;
  details?: unknown;
}

const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  adjustment: "Adjustment",
  damaged_lost: "Damaged / Lost",
  item_created: "Item Created",
  item_edited: "Item Edited",
  po_received: "PO Received",
};

export function getActivityEventLabel(type: ActivityEventType): string {
  return ACTIVITY_EVENT_LABELS[type];
}

export function getActivityEventIcon(type: ActivityEventType): string {
  switch (type) {
    case "stock_in":
      return "arrow-down";
    case "stock_out":
      return "arrow-up";
    case "adjustment":
      return "sliders";
    case "damaged_lost":
      return "alert";
    case "item_created":
      return "plus";
    case "item_edited":
      return "edit";
    case "po_received":
      return "check";
    default:
      return "layers";
  }
}

export function getActivityEventTone(
  type: ActivityEventType
): "success" | "accent" | "danger" | "warning" | "neutral" {
  switch (type) {
    case "stock_in":
      return "success";
    case "stock_out":
      return "accent";
    case "adjustment":
      return "neutral";
    case "damaged_lost":
      return "danger";
    case "item_created":
      return "success";
    case "item_edited":
      return "accent";
    case "po_received":
      return "success";
    default:
      return "neutral";
  }
}

export async function getActivityFeed(userId: string, limit = 150) {
  const events: ActivityEvent[] = [];

  /* Stock movements */
  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select(
      "id, item_id, movement_type, quantity_delta, quantity_before, quantity_after, notes, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.floor(limit * 0.6));

  if (!movementsError && movements) {
    const itemIds = [...new Set(movements.map((m) => m.item_id).filter(Boolean))];
    const { data: items } = await supabase
      .from("inventory")
      .select("id, name")
      .in("id", itemIds || []);

    const itemMap = new Map(items?.map((i) => [i.id, i.name]) || []);

    for (const m of movements) {
      events.push({
        id: `sm-${m.id}`,
        type: m.movement_type as ActivityEventType,
        itemId: m.item_id,
        itemName: m.item_id ? itemMap.get(m.item_id) : undefined,
        quantityBefore: m.quantity_before,
        quantityAfter: m.quantity_after,
        quantityDelta: m.quantity_delta,
        notes: m.notes,
        createdAt: m.created_at,
      });
    }
  }

  /* Inventory history */
  const { data: history, error: historyError } = await supabase
    .from("inventory_history")
    .select("id, item_id, action, old_quantity, new_quantity, created_at")
    .eq("user_id", userId)
    .in("action", ["created", "edited"])
    .order("created_at", { ascending: false })
    .limit(Math.floor(limit * 0.2));

  if (!historyError && history) {
    const itemIds = [...new Set(history.map((h) => h.item_id).filter(Boolean))];
    const { data: items } = await supabase
      .from("inventory")
      .select("id, name")
      .in("id", itemIds || []);

    const itemMap = new Map(items?.map((i) => [i.id, i.name]) || []);

    for (const h of history) {
      const typeMap: Record<string, ActivityEventType> = {
        created: "item_created",
        edited: "item_edited",
        deleted: "item_edited",
      };

      events.push({
        id: `ih-${h.id}`,
        type: typeMap[h.action] || "item_edited",
        itemId: h.item_id,
        itemName: h.item_id ? itemMap.get(h.item_id) : undefined,
        quantityBefore: h.old_quantity,
        quantityAfter: h.new_quantity,
        createdAt: h.created_at,
      });
    }
  }

  /* Purchase orders marked received (just the status change event) */
  const { data: pos, error: posError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, received_at")
    .eq("user_id", userId)
    .eq("status", "received")
    .order("received_at", { ascending: false })
    .limit(Math.floor(limit * 0.2));

  if (!posError && pos) {
    for (const po of pos) {
      events.push({
        id: `po-${po.id}`,
        type: "po_received",
        poId: po.id,
        poNumber: po.po_number,
        createdAt: po.received_at || po.id,
      });
    }
  }

  return events
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
}
