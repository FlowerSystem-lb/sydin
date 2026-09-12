import { supabase } from "@/app/lib/supabase";

/**
 * Every invoice and purchase order that carries a given item -- the lifecycle
 * the item page shows under "Bought and sold" (brief points 26 and 40).
 * Amounts stay in the document's own currency; the row says which.
 */
export interface ItemDocument {
  kind: "invoice" | "order";
  id: number;
  number: string;
  date: string | null;
  party: string | null;
  status: string;
  quantity: number;
  /** Received so far, orders only. */
  received: number | null;
  unitAmount: number | null;
  currency: string | null;
  href: string;
}

interface SalesLineRow {
  quantity: number | string;
  unit_price: number | string | null;
  sales_orders: {
    id: number;
    invoice_number: string;
    status: string;
    issue_date: string | null;
    created_at: string;
    currency_code: string | null;
    customer_name_snapshot: string | null;
  } | null;
}

interface PurchaseLineRow {
  quantity: number | string;
  received_quantity: number | string | null;
  unit_cost: number | string | null;
  purchase_orders: {
    id: number;
    po_number: string;
    status: string;
    purchase_date: string | null;
    created_at: string;
    currency_code: string | null;
    supplier_name_snapshot: string | null;
  } | null;
}

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function getDocumentsForItem(userId: string, itemId: number) {
  const [sales, purchases] = await Promise.all([
    supabase
      .from("sales_order_lines")
      .select(
        "quantity, unit_price, sales_orders!inner(id, invoice_number, status, issue_date, created_at, currency_code, customer_name_snapshot, user_id)"
      )
      .eq("inventory_item_id", itemId)
      .eq("sales_orders.user_id", userId),
    supabase
      .from("purchase_order_lines")
      .select(
        "quantity, received_quantity, unit_cost, purchase_orders!inner(id, po_number, status, purchase_date, created_at, currency_code, supplier_name_snapshot, user_id)"
      )
      .eq("inventory_item_id", itemId)
      .eq("purchase_orders.user_id", userId),
  ]);

  const documents: ItemDocument[] = [];

  for (const row of ((sales.data || []) as unknown as SalesLineRow[])) {
    const order = row.sales_orders;
    if (!order) continue;
    documents.push({
      kind: "invoice",
      id: order.id,
      number: order.invoice_number,
      date: order.issue_date || order.created_at,
      party: order.customer_name_snapshot,
      status: order.status,
      quantity: toNumber(row.quantity) ?? 0,
      received: null,
      unitAmount: toNumber(row.unit_price),
      currency: order.currency_code,
      href: `/dashboard/sales/${order.id}`,
    });
  }

  for (const row of ((purchases.data || []) as unknown as PurchaseLineRow[])) {
    const order = row.purchase_orders;
    if (!order) continue;
    documents.push({
      kind: "order",
      id: order.id,
      number: order.po_number,
      date: order.purchase_date || order.created_at,
      party: order.supplier_name_snapshot,
      status: order.status,
      quantity: toNumber(row.quantity) ?? 0,
      received: toNumber(row.received_quantity) ?? 0,
      unitAmount: toNumber(row.unit_cost),
      currency: order.currency_code,
      href: `/dashboard/purchase-orders?open=${order.id}`,
    });
  }

  return documents.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
