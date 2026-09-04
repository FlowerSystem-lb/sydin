import { supabase } from "@/app/lib/supabase";

/**
 * Invoices: what the depot sold, to whom, for how much.
 *
 * A deliberate mirror of `app/lib/purchaseOrders.ts`. Same status vocabulary,
 * same money helpers, same schema-missing guard, same shape of insert. The buy
 * side has been in production for months; the sell side copies it rather than
 * inventing a second way to hold a document.
 *
 * The one word that changes is `unit_cost` becoming `unit_price`. It is not
 * cosmetic: cost is what the depot paid, price is what the customer pays, and
 * an invoice that reads a cost by mistake would undercharge silently. Keeping
 * the two names apart makes that mistake impossible to make quietly.
 */

export type SalesOrderStatus = "draft" | "issued" | "paid" | "cancelled";
export type SalesOrderPaymentStatus = "unpaid" | "partial" | "paid";
export type SalesOrderLineType = "inventory" | "charge";

export interface SalesOrderLine {
  id: number;
  sales_order_id: number;
  line_type: SalesOrderLineType;
  inventory_item_id: number | null;
  affects_stock: boolean;
  name_snapshot: string;
  sku_snapshot: string | null;
  item_code_snapshot: string | null;
  unit_label_snapshot: string | null;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
}

export interface SalesOrder {
  id: number;
  user_id: string;
  invoice_number: string;
  title: string | null;
  customer_id: number | null;
  customer_name_snapshot: string | null;
  customer_contact_snapshot: string | null;
  depot_id: number | null;
  depot_name_snapshot: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: SalesOrderStatus;
  payment_status: SalesOrderPaymentStatus;
  amount_paid: number | null;
  currency_code: string | null;
  notes: string | null;
  internal_reference: string | null;
  created_at: string;
  updated_at: string;
  issued_at: string | null;
  cancelled_at: string | null;
  lines?: SalesOrderLine[];
}

export interface SalesOrderLineInput {
  line_type: SalesOrderLineType;
  inventory_item_id?: number | null;
  affects_stock?: boolean;
  name_snapshot: string;
  sku_snapshot?: string | null;
  item_code_snapshot?: string | null;
  unit_label_snapshot?: string | null;
  quantity: number;
  unit_price?: number | null;
  notes?: string | null;
}

export interface SalesOrderInput {
  invoice_number: string;
  title?: string | null;
  customer_id?: number | null;
  customer_name_snapshot?: string | null;
  customer_contact_snapshot?: string | null;
  depot_id?: number | null;
  depot_name_snapshot?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  currency_code?: string | null;
  notes?: string | null;
  internal_reference?: string | null;
  lines: SalesOrderLineInput[];
}

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const SALES_ORDER_PAYMENT_STATUS_LABELS: Record<
  SalesOrderPaymentStatus,
  string
> = {
  unpaid: "Unpaid",
  partial: "Part paid",
  paid: "Paid",
};

const ORDER_SELECT =
  "id, user_id, invoice_number, title, customer_id, customer_name_snapshot, customer_contact_snapshot, depot_id, depot_name_snapshot, issue_date, due_date, status, payment_status, amount_paid, currency_code, notes, internal_reference, created_at, updated_at, issued_at, cancelled_at";

const LINE_SELECT =
  "id, sales_order_id, line_type, inventory_item_id, affects_stock, name_snapshot, sku_snapshot, item_code_snapshot, unit_label_snapshot, quantity, unit_price, notes";

/**
 * The tables are added by a migration that is run by hand, so a workspace can
 * exist without them. Same guard purchase orders carries, for the same reason:
 * "the table is missing" and "something went wrong" need different words.
 */
export function isSalesSchemaMissing(error: unknown) {
  const salesError = error as { code?: string; message?: string };
  const text = `${salesError?.message || ""}`.toLowerCase();

  return (
    salesError?.code === "42P01" ||
    salesError?.code === "PGRST205" ||
    text.includes("sales_orders") ||
    text.includes("sales_order_lines")
  );
}

export function getSalesOrderLineTotal(line: SalesOrderLine) {
  return Number(line.quantity || 0) * Number(line.unit_price || 0);
}

export function getSalesOrderTotal(order: SalesOrder) {
  return (order.lines || []).reduce(
    (sum, line) => sum + getSalesOrderLineTotal(line),
    0
  );
}

export function getSalesOrderBalance(order: SalesOrder) {
  return Math.max(getSalesOrderTotal(order) - Number(order.amount_paid || 0), 0);
}

/**
 * Only inventory lines that are marked as moving stock. A delivery charge on an
 * invoice is money, not goods, and must never reach the stock ledger.
 */
export function getStockAffectingLines(order: SalesOrder) {
  return (order.lines || []).filter(
    (line) => line.affects_stock && line.inventory_item_id
  );
}

export async function getSalesOrdersForUser(userId: string) {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(`${ORDER_SELECT}, lines:sales_order_lines(${LINE_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as SalesOrder[]) || [];
}

export async function getSalesOrder(userId: string, orderId: number) {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(`${ORDER_SELECT}, lines:sales_order_lines(${LINE_SELECT})`)
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  return data as SalesOrder;
}

/**
 * Suggests the next number in whatever pattern the account is already using, so
 * INV-0007 follows INV-0006 without anyone counting. Falls back to INV-0001 on
 * an empty account or a numbering scheme this cannot read -- a suggestion, never
 * a rule, because the field stays editable.
 */
export async function suggestNextInvoiceNumber(userId: string) {
  const { data } = await supabase
    .from("sales_orders")
    .select("invoice_number")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = data?.[0]?.invoice_number as string | undefined;
  if (!latest) return "INV-0001";

  const match = latest.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return `${latest}-2`;

  const [, prefix, digits, suffix] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");

  return `${prefix}${next}${suffix}`;
}

export async function createSalesOrder(userId: string, input: SalesOrderInput) {
  const { lines, ...order } = input;

  const { data, error } = await supabase
    .from("sales_orders")
    .insert({
      user_id: userId,
      ...order,
      invoice_number: order.invoice_number.trim(),
      status: "draft",
    })
    .select(ORDER_SELECT)
    .single();

  if (error) throw error;

  const created = data as SalesOrder;

  if (lines.length > 0) {
    const { error: lineError } = await supabase.from("sales_order_lines").insert(
      lines.map((line) => ({
        sales_order_id: created.id,
        line_type: line.line_type,
        inventory_item_id: line.inventory_item_id ?? null,
        affects_stock: line.affects_stock ?? false,
        name_snapshot: line.name_snapshot.trim(),
        sku_snapshot: line.sku_snapshot ?? null,
        item_code_snapshot: line.item_code_snapshot ?? null,
        unit_label_snapshot: line.unit_label_snapshot ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price ?? null,
        notes: line.notes ?? null,
      }))
    );

    if (lineError) {
      /* An invoice with no lines is worse than no invoice: it looks real, it
         occupies its number, and its total is silently zero. Roll the header
         back so the failure is visible and the number stays free. */
      await supabase.from("sales_orders").delete().eq("id", created.id);
      throw lineError;
    }
  }

  return created;
}

export async function updateSalesOrder(
  userId: string,
  orderId: number,
  patch: Partial<
    Pick<
      SalesOrder,
      | "title"
      | "customer_id"
      | "customer_name_snapshot"
      | "customer_contact_snapshot"
      | "depot_id"
      | "depot_name_snapshot"
      | "issue_date"
      | "due_date"
      | "notes"
      | "internal_reference"
      | "currency_code"
    >
  >
) {
  const { error } = await supabase
    .from("sales_orders")
    .update(patch)
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Issue an invoice: take the goods out of stock and mark it issued.
 *
 * One database function, not a loop here. A five-line invoice is five stock
 * movements plus a status change; run from the browser that is six round trips
 * with no transaction around them, and losing the connection halfway leaves
 * some products gone, some still counted, and the invoice never marked. Inside
 * the function it is one transaction: all of it happens, or none of it does.
 *
 * Every rule lives there too -- draft only, ownership, enough stock, whole
 * quantities, and never twice for the same line -- so they hold no matter which
 * screen calls this.
 */
export async function issueSalesOrder(orderId: number) {
  const { data, error } = await supabase.rpc("issue_sales_order", {
    p_sales_order_id: orderId,
  });

  if (error) throw error;

  return data as SalesOrder;
}

/**
 * The function raises plain sentences, so they are shown as-is rather than
 * replaced with something vaguer. "Only 2 of Nivea blue in stock, but the
 * invoice sells 3" is the whole answer; "could not issue" is not.
 */
export function getIssueErrorMessage(error: unknown) {
  const issueError = error as { message?: string };
  const message = (issueError?.message || "").trim();

  if (!message || /jwt|network|fetch/i.test(message)) {
    return "We could not issue this invoice. Please try again.";
  }

  return message;
}

export type SalesOrderPaymentMethod = "cash" | "card" | "transfer" | "other";

export const SALES_ORDER_PAYMENT_METHOD_LABELS: Record<
  SalesOrderPaymentMethod,
  string
> = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
};

export interface SalesOrderPayment {
  id: number;
  sales_order_id: number;
  amount: number;
  method: SalesOrderPaymentMethod | null;
  received_by: string | null;
  note: string | null;
  paid_at: string;
  created_at: string;
}

export interface SalesOrderPaymentInput {
  amount: number;
  method?: SalesOrderPaymentMethod | null;
  received_by?: string | null;
  note?: string | null;
  paid_at?: string | null;
}

export async function getSalesOrderPayments(orderId: number) {
  const { data, error } = await supabase
    .from("sales_order_payments")
    .select("id, sales_order_id, amount, method, received_by, note, paid_at, created_at")
    .eq("sales_order_id", orderId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;

  return (data as SalesOrderPayment[]) || [];
}

/**
 * The invoice's amount_paid and payment_status are NOT written here. A database
 * trigger recomputes them from the whole log after every change, so a deleted
 * payment corrects the balance as reliably as an added one, and two payments
 * arriving at once cannot race each other into a wrong total.
 */
export async function addSalesOrderPayment(
  orderId: number,
  input: SalesOrderPaymentInput
) {
  const { data, error } = await supabase
    .from("sales_order_payments")
    .insert({
      sales_order_id: orderId,
      amount: input.amount,
      method: input.method ?? null,
      received_by: input.received_by ?? null,
      note: input.note ?? null,
      paid_at: input.paid_at || new Date().toISOString().slice(0, 10),
    })
    .select("id, sales_order_id, amount, method, received_by, note, paid_at, created_at")
    .single();

  if (error) throw error;

  return data as SalesOrderPayment;
}

export async function deleteSalesOrderPayment(paymentId: number) {
  const { error } = await supabase
    .from("sales_order_payments")
    .delete()
    .eq("id", paymentId);

  if (error) throw error;
}

export function getPaymentErrorMessage(error: unknown) {
  const paymentError = error as { code?: string; message?: string };
  const message = (paymentError?.message || "").trim();

  if (/amount_positive/.test(message)) {
    return "A payment has to be more than zero.";
  }

  if (/method_valid/.test(message)) {
    return "Choose cash, card, transfer or other.";
  }

  if (!message || /jwt|network|fetch/i.test(message)) {
    return "We could not record this payment. Please try again.";
  }

  /* The database raises plain sentences for the two rules that matter here --
     paying a draft, and paying a cancelled invoice -- so they are shown as
     written rather than flattened into something vaguer. */
  return message;
}

export async function cancelSalesOrder(userId: string, orderId: number) {
  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteSalesOrder(userId: string, orderId: number) {
  const { error } = await supabase
    .from("sales_orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function getSalesOrderErrorMessage(error: unknown) {
  const salesError = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text =
    `${salesError?.message || ""} ${salesError?.details || ""}`.toLowerCase();

  if (isSalesSchemaMissing(error)) {
    return "Invoices are not available in this workspace yet. Contact support if this keeps happening.";
  }

  if (salesError?.code === "23505" || text.includes("unique")) {
    return "An invoice with this number already exists.";
  }

  if (text.includes("quantity_positive")) {
    return "Every line needs a quantity above zero.";
  }

  if (text.includes("unit_price_valid")) {
    return "A price cannot be negative.";
  }

  return "We could not save this invoice. Please try again.";
}
