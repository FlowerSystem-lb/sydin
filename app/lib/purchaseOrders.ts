import { supabase } from "@/app/lib/supabase";

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";
export type PurchaseOrderPaymentMethod = "cash" | "card" | "transfer" | "other";
export type PurchaseOrderPaymentStatus = "unpaid" | "partial" | "paid";
export type PurchaseOrderLineType = "inventory" | "expense";
export type PurchaseOrderExpenseCategory =
  | "equipment"
  | "maintenance"
  | "supplies"
  | "services"
  | "utilities"
  | "other";

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  line_type: PurchaseOrderLineType;
  inventory_item_id: number | null;
  affects_stock: boolean;
  expense_category: PurchaseOrderExpenseCategory | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  item_code_snapshot: string | null;
  unit_label_snapshot: string | null;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
}

export interface PurchaseOrderPayment {
  id: number;
  purchase_order_id: number;
  amount: number;
  method: PurchaseOrderPaymentMethod | null;
  paid_by: string | null;
  note: string | null;
  paid_at: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  title: string | null;
  supplier_id: number | null;
  supplier_name_snapshot: string | null;
  supplier_contact_snapshot: string | null;
  depot_id: number | null;
  depot_name_snapshot: string | null;
  purchase_date: string | null;
  expected_delivery_date: string | null;
  status: PurchaseOrderStatus;
  payment_method: PurchaseOrderPaymentMethod | null;
  paid_by: string | null;
  payment_status: PurchaseOrderPaymentStatus;
  amount_paid: number | null;
  currency_code: string | null;
  notes: string | null;
  internal_reference: string | null;
  attachment_url: string | null;
  attachment_label: string | null;
  created_at: string;
  received_at: string | null;
  cancelled_at: string | null;
  lines: PurchaseOrderLine[];
  payments: PurchaseOrderPayment[];
}

export interface PurchaseOrderLineInput {
  line_type: PurchaseOrderLineType;
  inventory_item_id: number | null;
  affects_stock: boolean;
  expense_category: PurchaseOrderExpenseCategory | null;
  name_snapshot: string;
  sku_snapshot?: string | null;
  item_code_snapshot?: string | null;
  unit_label_snapshot?: string | null;
  quantity: number;
  unit_cost: number | null;
  notes?: string | null;
}

export interface PurchaseOrderInput {
  po_number: string;
  title?: string | null;
  supplier_id?: number | null;
  supplier_name_snapshot?: string | null;
  supplier_contact_snapshot?: string | null;
  depot_id?: number | null;
  depot_name_snapshot?: string | null;
  purchase_date?: string | null;
  expected_delivery_date?: string | null;
  status: "draft" | "ordered";
  payment_method?: PurchaseOrderPaymentMethod | null;
  paid_by?: string | null;
  payment_status?: PurchaseOrderPaymentStatus;
  amount_paid?: number | null;
  currency_code?: string | null;
  notes?: string | null;
  internal_reference?: string | null;
  attachment_url?: string | null;
  attachment_label?: string | null;
}

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
};

export const PURCHASE_ORDER_PAYMENT_METHOD_LABELS: Record<
  PurchaseOrderPaymentMethod,
  string
> = {
  cash: "Cash",
  card: "Card",
  transfer: "Bank transfer",
  other: "Other",
};

export const PURCHASE_ORDER_PAYMENT_STATUS_LABELS: Record<
  PurchaseOrderPaymentStatus,
  string
> = {
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
};

export const PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS: Record<
  PurchaseOrderExpenseCategory,
  string
> = {
  equipment: "Equipment",
  maintenance: "Maintenance",
  supplies: "Supplies",
  services: "Services",
  utilities: "Utilities",
  other: "Other",
};

const PURCHASE_ORDER_SELECT = `id, po_number, title, supplier_id, supplier_name_snapshot,
supplier_contact_snapshot, depot_id, depot_name_snapshot, purchase_date,
expected_delivery_date, status, payment_method, paid_by, payment_status, amount_paid,
currency_code, notes, internal_reference, attachment_url, attachment_label, created_at,
received_at, cancelled_at,
purchase_order_lines (id, purchase_order_id, line_type, inventory_item_id, affects_stock,
expense_category, name_snapshot, sku_snapshot, item_code_snapshot, unit_label_snapshot,
quantity, unit_cost, notes)`;

/** True when the error means the phase-8 SQL migration has not been run yet. */
export function isPurchaseOrdersSchemaMissing(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  return (
    message.includes("purchase_orders") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  );
}

function normalizeLine(data: Record<string, unknown>): PurchaseOrderLine {
  return {
    id: Number(data.id),
    purchase_order_id: Number(data.purchase_order_id),
    line_type: (data.line_type === "expense" ? "expense" : "inventory") as PurchaseOrderLineType,
    inventory_item_id:
      data.inventory_item_id === null || data.inventory_item_id === undefined
        ? null
        : Number(data.inventory_item_id),
    affects_stock: Boolean(data.affects_stock),
    expense_category: (data.expense_category ??
      null) as PurchaseOrderExpenseCategory | null,
    name_snapshot: String(data.name_snapshot || ""),
    sku_snapshot: (data.sku_snapshot as string | null) ?? null,
    item_code_snapshot: (data.item_code_snapshot as string | null) ?? null,
    unit_label_snapshot: (data.unit_label_snapshot as string | null) ?? null,
    quantity: Number(data.quantity || 0),
    unit_cost:
      data.unit_cost === null || data.unit_cost === undefined
        ? null
        : Number(data.unit_cost),
    notes: (data.notes as string | null) ?? null,
  };
}

function normalizeOrder(data: Record<string, unknown>): PurchaseOrder {
  const rawLines = Array.isArray(data.purchase_order_lines)
    ? (data.purchase_order_lines as Record<string, unknown>[])
    : [];

  return {
    id: Number(data.id),
    po_number: String(data.po_number || ""),
    title: (data.title as string | null) ?? null,
    supplier_id:
      data.supplier_id === null || data.supplier_id === undefined
        ? null
        : Number(data.supplier_id),
    supplier_name_snapshot: (data.supplier_name_snapshot as string | null) ?? null,
    supplier_contact_snapshot:
      (data.supplier_contact_snapshot as string | null) ?? null,
    depot_id:
      data.depot_id === null || data.depot_id === undefined
        ? null
        : Number(data.depot_id),
    depot_name_snapshot: (data.depot_name_snapshot as string | null) ?? null,
    purchase_date: (data.purchase_date as string | null) ?? null,
    expected_delivery_date: (data.expected_delivery_date as string | null) ?? null,
    status: (data.status || "draft") as PurchaseOrderStatus,
    payment_method: (data.payment_method ??
      null) as PurchaseOrderPaymentMethod | null,
    paid_by: (data.paid_by as string | null) ?? null,
    payment_status: (data.payment_status || "unpaid") as PurchaseOrderPaymentStatus,
    amount_paid:
      data.amount_paid === null || data.amount_paid === undefined
        ? null
        : Number(data.amount_paid),
    currency_code: (data.currency_code as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    internal_reference: (data.internal_reference as string | null) ?? null,
    attachment_url: (data.attachment_url as string | null) ?? null,
    attachment_label: (data.attachment_label as string | null) ?? null,
    created_at: String(data.created_at || ""),
    received_at: (data.received_at as string | null) ?? null,
    cancelled_at: (data.cancelled_at as string | null) ?? null,
    lines: rawLines
      .map(normalizeLine)
      .sort((first, second) => first.id - second.id),
    // Payments are fetched separately (getPurchaseOrderPayments) so the history
    // page keeps working before the phase-9 migration is run.
    payments: [],
  };
}

function normalizePayment(data: Record<string, unknown>): PurchaseOrderPayment {
  return {
    id: Number(data.id),
    purchase_order_id: Number(data.purchase_order_id),
    amount: Number(data.amount || 0),
    method: (data.method ?? null) as PurchaseOrderPaymentMethod | null,
    paid_by: (data.paid_by as string | null) ?? null,
    note: (data.note as string | null) ?? null,
    paid_at: String(data.paid_at || ""),
    created_at: String(data.created_at || ""),
  };
}

export function getPurchaseOrderLineTotal(line: PurchaseOrderLine) {
  if (line.unit_cost === null) return null;
  return line.quantity * line.unit_cost;
}

export function getPurchaseOrderTotal(order: PurchaseOrder) {
  return order.lines.reduce(
    (total, line) => total + (getPurchaseOrderLineTotal(line) || 0),
    0
  );
}

/** Total / paid / remaining for an order. `remaining` is clamped at 0 (never negative). */
export function getPurchaseOrderBalance(order: PurchaseOrder) {
  const total = getPurchaseOrderTotal(order);
  const paid = order.amount_paid ?? 0;
  const remaining = Math.max(0, total - paid);
  return { total, paid, remaining };
}

/** Splits an order's total into stock purchases vs general expenses for analytics. */
export function getPurchaseOrderSplit(order: PurchaseOrder) {
  let inventoryTotal = 0;
  let expenseTotal = 0;

  for (const line of order.lines) {
    const lineTotal = getPurchaseOrderLineTotal(line) || 0;
    if (line.line_type === "expense") {
      expenseTotal += lineTotal;
    } else {
      inventoryTotal += lineTotal;
    }
  }

  return { inventoryTotal, expenseTotal };
}

export async function getPurchaseOrdersForUser(userId: string) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(PURCHASE_ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return ((data || []) as Record<string, unknown>[]).map(normalizeOrder);
}

export async function createPurchaseOrder(
  userId: string,
  order: PurchaseOrderInput,
  lines: PurchaseOrderLineInput[]
) {
  if (lines.length === 0) {
    throw new Error("Add at least one line to the purchase order.");
  }

  const { data: createdOrder, error: orderError } = await supabase
    .from("purchase_orders")
    .insert([{ user_id: userId, ...order }])
    .select("id")
    .single();

  if (orderError) {
    throw orderError;
  }

  const orderId = Number((createdOrder as { id: number }).id);
  const { error: linesError } = await supabase.from("purchase_order_lines").insert(
    lines.map((line) => ({
      purchase_order_id: orderId,
      line_type: line.line_type,
      inventory_item_id: line.inventory_item_id,
      affects_stock: line.affects_stock,
      expense_category: line.expense_category,
      name_snapshot: line.name_snapshot,
      sku_snapshot: line.sku_snapshot ?? null,
      item_code_snapshot: line.item_code_snapshot ?? null,
      unit_label_snapshot: line.unit_label_snapshot ?? null,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      notes: line.notes ?? null,
    }))
  );

  if (linesError) {
    // Keep history clean: a purchase order without its lines is useless.
    await supabase.from("purchase_orders").delete().eq("id", orderId);
    throw linesError;
  }

  // Seed the payment timeline with the initial deposit, if any. Non-fatal:
  // a missing phase-9 table just leaves amount_paid as set on the order.
  if (order.amount_paid && order.amount_paid > 0) {
    try {
      await addPurchaseOrderPayment(orderId, {
        amount: order.amount_paid,
        method: order.payment_method ?? null,
        paid_by: order.paid_by ?? null,
        paid_at: order.purchase_date ?? null,
      });
    } catch {
      // Phase-9 not run yet — the order still carries its amount_paid snapshot.
    }
  }

  return orderId;
}

export async function cancelPurchaseOrder(userId: string, orderId: number) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function deletePurchaseOrder(userId: string, orderId: number) {
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function receivePurchaseOrder(orderId: number) {
  const { data, error } = await supabase.rpc("receive_purchase_order", {
    p_purchase_order_id: orderId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export interface PurchaseOrderPaymentUpdate {
  payment_status: PurchaseOrderPaymentStatus;
  amount_paid: number | null;
  payment_method: PurchaseOrderPaymentMethod | null;
  paid_by: string | null;
}

/** Updates only the payment fields — allowed at any status (incl. received) by the phase-8 trigger. */
export async function updatePurchaseOrderPayment(
  userId: string,
  orderId: number,
  payment: PurchaseOrderPaymentUpdate
) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      payment_status: payment.payment_status,
      amount_paid: payment.amount_paid,
      payment_method: payment.payment_method,
      paid_by: payment.paid_by,
    })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export interface PurchaseOrderPaymentInput {
  amount: number;
  method?: PurchaseOrderPaymentMethod | null;
  paid_by?: string | null;
  note?: string | null;
  paid_at?: string | null;
}

/** True when the error means the phase-9 payments migration has not been run yet. */
export function isPaymentsSchemaMissing(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  return (
    message.includes("purchase_order_payments") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  );
}

/** Payment timeline for one order, newest first. Returns [] if the phase-9 table is missing. */
export async function getPurchaseOrderPayments(orderId: number) {
  const { data, error } = await supabase
    .from("purchase_order_payments")
    .select("id, purchase_order_id, amount, method, paid_by, note, paid_at, created_at")
    .eq("purchase_order_id", orderId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    if (isPaymentsSchemaMissing(error)) return [];
    throw error;
  }

  return ((data || []) as Record<string, unknown>[]).map(normalizePayment);
}

/** Logs a payment. The phase-9 trigger recomputes the order's amount_paid + status. */
export async function addPurchaseOrderPayment(
  orderId: number,
  payment: PurchaseOrderPaymentInput
) {
  const { error } = await supabase.from("purchase_order_payments").insert([
    {
      purchase_order_id: orderId,
      amount: payment.amount,
      method: payment.method ?? null,
      paid_by: payment.paid_by?.trim() || null,
      note: payment.note?.trim() || null,
      paid_at: payment.paid_at || undefined,
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function deletePurchaseOrderPayment(paymentId: number) {
  const { error } = await supabase
    .from("purchase_order_payments")
    .delete()
    .eq("id", paymentId);

  if (error) {
    throw error;
  }
}

export async function uploadPurchaseOrderAttachment(userId: string, file: File) {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() || "jpg"
    : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("po-attachments")
    .upload(path, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from("po-attachments").getPublicUrl(path);

  return { url: data.publicUrl, label: file.name };
}

/**
 * Next auto number, e.g. MAIN-PO-0007. Prefix priority: depot code → depot name →
 * business name → SYDIN. Count-based, always editable by the user before saving.
 */
export async function getNextPoNumber(
  userId: string,
  prefixSource: { depotCode?: string | null; depotName?: string | null; businessName?: string | null }
) {
  const rawPrefix =
    prefixSource.depotCode?.trim() ||
    prefixSource.depotName?.trim() ||
    prefixSource.businessName?.trim() ||
    "SYDIN";
  const prefix =
    rawPrefix
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "SYDIN";

  const { count, error } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const nextNumber = String((count || 0) + 1).padStart(4, "0");
  return `${prefix}-PO-${nextNumber}`;
}
