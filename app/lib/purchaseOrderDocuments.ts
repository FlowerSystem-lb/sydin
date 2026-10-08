import type { BusinessSettings } from "@/app/lib/businessSettings";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import type { Depot } from "@/app/lib/depots";
import { formatDepotPhone } from "@/app/lib/depots";
import { paymentMethodLabel } from "@/app/lib/paymentMethods";
import type { PurchaseOrderPdfDetails, PurchaseOrderPdfLine } from "@/app/lib/purchaseOrderPdfExport";
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_STATUS_LABELS,
  PURCHASE_ORDER_PAYMENT_TERMS_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
  getPurchaseOrderCurrency,
  getPurchaseOrderLineTotal,
  type PurchaseOrder,
  type PurchaseOrderPayment,
} from "@/app/lib/purchaseOrders";
import type { Supplier } from "@/app/lib/suppliers";

/**
 * One description of a purchase order for paper (9 Oct 2026): the PDF, the
 * Word file and the supplier's link all print from this, so the list page
 * and the details page cannot drift apart.
 */

/** The supplier's read-only link (WhatsApp, the PDF footer QR). */
export function getPurchaseOrderPublicUrl(order: Pick<PurchaseOrder, "public_token" | "po_number">, origin?: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    (origin && !/localhost|127\.0\.0\.1/.test(origin) ? origin : "https://www.sydin.site");
  return order.public_token ? `${base}/po/${order.public_token}` : `${base}/dashboard/purchase-orders`;
}

export function buildPurchaseOrderDocument({
  order,
  settings,
  supplier,
  depot,
  payments,
  lineImages,
  preparedBy,
  origin,
}: {
  order: PurchaseOrder;
  settings: BusinessSettings;
  supplier?: Supplier | null;
  depot?: Depot | null;
  payments?: PurchaseOrderPayment[];
  lineImages?: Record<number, string | null | undefined>;
  preparedBy?: string | null;
  origin?: string;
}) {
  const details: PurchaseOrderPdfDetails = {
    poNumber: order.po_number,
    title: order.title || undefined,
    supplierName: supplier?.name || order.supplier_name_snapshot || "Not set",
    supplierContact: order.supplier_contact_snapshot || undefined,
    supplierContactName: supplier?.contact_name || undefined,
    supplierPhone: supplier?.phone || supplier?.whatsapp || undefined,
    supplierEmail: supplier?.email || undefined,
    supplierAddress: supplier?.address || undefined,
    depotName: depot?.name || order.depot_name_snapshot || undefined,
    depotAddress: depot?.address || undefined,
    depotPhone: depot?.phone ? formatDepotPhone(depot.phone) : undefined,
    purchaseDate: order.purchase_date || order.created_at || undefined,
    expectedDeliveryDate: order.expected_delivery_date || undefined,
    status: PURCHASE_ORDER_STATUS_LABELS[order.status],
    statusKey: order.status,
    paymentMethod: order.payment_method ? paymentMethodLabel(order.payment_method) : undefined,
    paidBy: order.paid_by || undefined,
    paymentStatus: PURCHASE_ORDER_PAYMENT_STATUS_LABELS[order.payment_status],
    paymentStatusKey: order.payment_status,
    paymentTermsLabel: order.payment_terms
      ? PURCHASE_ORDER_PAYMENT_TERMS_LABELS[order.payment_terms]
      : order.payment_method
        ? paymentMethodLabel(order.payment_method)
        : undefined,
    amountPaid: order.amount_paid,
    payments: (payments || []).map((payment) => ({
      amount: Number(payment.amount),
      paidAt: payment.paid_at,
      method: payment.method ? paymentMethodLabel(payment.method) : null,
    })),
    discount: order.discount,
    deliveryFee: order.delivery_fee,
    notes: order.notes || undefined,
    internalReference: order.internal_reference || order.title || undefined,
    preparedBy: preparedBy || undefined,
    qrUrl: getPurchaseOrderPublicUrl(order, origin),
  };

  const lines: PurchaseOrderPdfLine[] = order.lines.map((line) => ({
    name: line.name_snapshot,
    category:
      line.line_type === "expense" && line.expense_category
        ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expense_category]
        : undefined,
    code: line.item_code_snapshot || undefined,
    sku: line.sku_snapshot || undefined,
    unit: line.unit_label_snapshot || "unit",
    imageUrl: line.inventory_item_id !== null ? (lineImages?.[line.inventory_item_id] ?? null) : null,
    orderQuantity: line.quantity,
    receivedQuantity: line.received_quantity,
    unitCost: line.unit_cost,
    lineTotal: getPurchaseOrderLineTotal(line),
    note: line.notes || undefined,
    isGeneral: line.line_type === "expense",
  }));

  return {
    details,
    lines,
    branding: brandingFromSettings(settings),
    currencyCode: getPurchaseOrderCurrency(order),
  };
}

/** The supplier and depot rows behind an order, for paper. Missing tables or
 *  rows just leave the snapshots on the order to print. */
export async function loadPurchaseOrderParties(order: Pick<PurchaseOrder, "supplier_id" | "depot_id">) {
  const { supabase } = await import("@/app/lib/supabase");
  const [supplierResult, depotResult] = await Promise.all([
    order.supplier_id
      ? supabase.from("suppliers").select("*").eq("id", order.supplier_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.depot_id
      ? supabase.from("depots").select("id, name, code, notes, is_active, phone, address, map_url, is_default").eq("id", order.depot_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    supplier: (supplierResult.data as Supplier | null) ?? null,
    depot: (depotResult.data as Depot | null) ?? null,
  };
}
