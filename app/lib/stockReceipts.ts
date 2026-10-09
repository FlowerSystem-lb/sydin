import { supabase } from "@/app/lib/supabase";

/**
 * One receiving engine (phase 41, 9 Oct 2026): every stock that comes in from
 * outside -- a purchase order, no order, a customer return, a Scanner receive
 * session -- is a receipt (goods received note). confirm_stock_receipt does
 * the receipt, its lines, the stock_in movements, the PO's received
 * quantities and status, and the PO activity in one database transaction.
 */

export type ReceiptSource = "po" | "no_order" | "return" | "scanner";
export type NoOrderReason = "walk_in_supplier" | "gift" | "found" | "opening_balance" | "other";
export type ShortAction = "backorder" | "close_short";

export const NO_ORDER_REASONS: Array<{ value: NoOrderReason; label: string }> = [
  { value: "walk_in_supplier", label: "Walk-in supplier" },
  { value: "gift", label: "Gift or sample" },
  { value: "found", label: "Found stock" },
  { value: "opening_balance", label: "Opening balance" },
  { value: "other", label: "Other" },
];

export function reasonLabel(reason?: string | null) {
  return NO_ORDER_REASONS.find((entry) => entry.value === reason)?.label || (reason ? reason.replace(/_/g, " ") : "");
}

export interface ConfirmReceiptInput {
  source: ReceiptSource;
  poId?: number | null;
  reason?: string | null;
  depotId?: number | null;
  supplierId?: number | null;
  supplierName?: string | null;
  deliveryNoteNo?: string | null;
  deliveryNotePhoto?: string | null;
  receivedAt?: string | null;
  receivedBy?: string | null;
  shortAction?: ShortAction | null;
  notes?: string | null;
}

export interface ConfirmReceiptLine {
  poLineId?: number | null;
  itemId?: number | null;
  expected?: number | null;
  received: number;
  damaged?: number;
  unitCost?: number | null;
  batch?: string | null;
  expiryDate?: string | null;
  note?: string | null;
}

export interface ConfirmReceiptResult {
  receipt_id: number | null;
  reference: string;
  po_reference: string | null;
  po_status: string | null;
  outstanding: number;
  good: number;
  received: number;
  damaged: number;
}

/** The person's own day, e.g. 20261009 (not the server's UTC day). */
export function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export async function confirmStockReceipt(receipt: ConfirmReceiptInput, lines: ConfirmReceiptLine[]) {
  const { data, error } = await supabase.rpc("confirm_stock_receipt", {
    p_receipt: {
      source: receipt.source,
      po_id: receipt.poId ?? null,
      reason: receipt.reason ?? null,
      depot_id: receipt.depotId ?? null,
      supplier_id: receipt.supplierId ?? null,
      supplier_name: receipt.supplierName ?? null,
      delivery_note_no: receipt.deliveryNoteNo ?? null,
      delivery_note_photo: receipt.deliveryNotePhoto ?? null,
      received_at: receipt.receivedAt ?? null,
      received_by: receipt.receivedBy ?? null,
      short_action: receipt.shortAction ?? null,
      notes: receipt.notes ?? null,
      local_date: localDateStamp(receipt.receivedAt ? new Date(receipt.receivedAt) : new Date()),
    },
    p_lines: lines.map((line) => ({
      po_line_id: line.poLineId ?? null,
      item_id: line.itemId ?? null,
      expected: line.expected ?? null,
      received: line.received,
      damaged: line.damaged ?? 0,
      unit_cost: line.unitCost ?? null,
      batch: line.batch ?? null,
      expiry_date: line.expiryDate || null,
      note: line.note ?? null,
    })),
  });
  if (error) throw error;
  return data as ConfirmReceiptResult;
}

export async function voidStockReceipt(receiptId: number, reason?: string) {
  const { error } = await supabase.rpc("void_stock_receipt", { p_receipt_id: receiptId, p_reason: reason || null });
  if (error) throw error;
}

export interface StockReceiptLine {
  id: number;
  purchase_order_line_id: number | null;
  inventory_item_id: number | null;
  quantity: number;
  damaged_quantity: number;
  expected_quantity: number | null;
  unit_cost: number | null;
  po_unit_cost: number | null;
  batch: string | null;
  expiry_date: string | null;
  note: string | null;
  item?: { name: string; item_code: string | null; sku: string | null; image: string | null; unit_type: string | null; custom_unit_label: string | null } | null;
}

export interface StockReceipt {
  id: number;
  purchase_order_id: number | null;
  receipt_number: string;
  reference: string | null;
  po_reference: string | null;
  source: ReceiptSource;
  reason: string | null;
  depot_id: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  delivery_note_no: string | null;
  delivery_note_photo: string | null;
  received_by: string | null;
  received_at: string;
  short_action: ShortAction | null;
  status: "confirmed" | "voided";
  notes: string | null;
  actor_id: string | null;
  lines: StockReceiptLine[];
}

const RECEIPT_SELECT = `id, purchase_order_id, receipt_number, reference, po_reference, source, reason, depot_id, supplier_id,
supplier_name, delivery_note_no, delivery_note_photo, received_by, received_at, short_action, status, notes, actor_id,
purchase_order_receipt_lines (id, purchase_order_line_id, inventory_item_id, quantity, damaged_quantity, expected_quantity,
unit_cost, po_unit_cost, batch, expiry_date, note, inventory (name, item_code, sku, image, unit_type, custom_unit_label))`;

function normalizeReceipt(row: Record<string, unknown>): StockReceipt {
  const rawLines = Array.isArray(row.purchase_order_receipt_lines) ? (row.purchase_order_receipt_lines as Record<string, unknown>[]) : [];
  return {
    id: Number(row.id),
    purchase_order_id: row.purchase_order_id === null ? null : Number(row.purchase_order_id),
    receipt_number: String(row.receipt_number || ""),
    reference: (row.reference as string | null) ?? null,
    po_reference: (row.po_reference as string | null) ?? null,
    source: (row.source as ReceiptSource) || "po",
    reason: (row.reason as string | null) ?? null,
    depot_id: row.depot_id === null || row.depot_id === undefined ? null : Number(row.depot_id),
    supplier_id: row.supplier_id === null || row.supplier_id === undefined ? null : Number(row.supplier_id),
    supplier_name: (row.supplier_name as string | null) ?? null,
    delivery_note_no: (row.delivery_note_no as string | null) ?? null,
    delivery_note_photo: (row.delivery_note_photo as string | null) ?? null,
    received_by: (row.received_by as string | null) ?? null,
    received_at: String(row.received_at || ""),
    short_action: (row.short_action as ShortAction | null) ?? null,
    status: (row.status as "confirmed" | "voided") || "confirmed",
    notes: (row.notes as string | null) ?? null,
    actor_id: (row.actor_id as string | null) ?? null,
    lines: rawLines.map((line) => ({
      id: Number(line.id),
      purchase_order_line_id: line.purchase_order_line_id === null ? null : Number(line.purchase_order_line_id),
      inventory_item_id: line.inventory_item_id === null ? null : Number(line.inventory_item_id),
      quantity: Number(line.quantity || 0),
      damaged_quantity: Number(line.damaged_quantity || 0),
      expected_quantity: line.expected_quantity === null || line.expected_quantity === undefined ? null : Number(line.expected_quantity),
      unit_cost: line.unit_cost === null || line.unit_cost === undefined ? null : Number(line.unit_cost),
      po_unit_cost: line.po_unit_cost === null || line.po_unit_cost === undefined ? null : Number(line.po_unit_cost),
      batch: (line.batch as string | null) ?? null,
      expiry_date: (line.expiry_date as string | null) ?? null,
      note: (line.note as string | null) ?? null,
      item: (line.inventory as StockReceiptLine["item"]) ?? null,
    })),
  };
}

export async function getRecentReceipts(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from("purchase_order_receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeReceipt);
}

export async function getReceipt(userId: string, receiptId: number) {
  const { data, error } = await supabase
    .from("purchase_order_receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .eq("id", receiptId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeReceipt(data as unknown as Record<string, unknown>) : null;
}

/** Stock-in movements made before phase 41 (old Stock in, Scanner, item
 *  page): not tied to a receipt, shown in the feed grouped by their note. */
export async function getLegacyStockIns(userId: string, limit = 40) {
  const { data } = await supabase
    .from("stock_movements")
    .select("id, item_id, quantity_delta, notes, created_at, purchase_order_receipt_id, inventory (name)")
    .eq("user_id", userId)
    .eq("movement_type", "stock_in")
    .is("purchase_order_receipt_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []) as unknown as Array<{
    id: number;
    item_id: number;
    quantity_delta: number;
    notes: string | null;
    created_at: string;
    inventory: { name: string } | null;
  }>;
}

export async function getReceiptsForOrder(userId: string, orderId: number) {
  const { data, error } = await supabase
    .from("purchase_order_receipts")
    .select(RECEIPT_SELECT)
    .eq("user_id", userId)
    .eq("purchase_order_id", orderId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as Record<string, unknown>[]).map(normalizeReceipt);
}
