import autoTable from "jspdf-autotable";
import { formatInventoryPrice, normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import {
  DOCUMENT_FILL,
  DOCUMENT_INK,
  DOCUMENT_MUTED,
  DOCUMENT_RULE,
  drawDocumentHeader,
  finishDocument,
  formatDocumentDate,
  openDocument,
  slugifyDocumentName,
  type DocumentBranding,
} from "@/app/lib/documentPdf";
import { getPurchaseOrderBalanceInBase, type PurchaseOrder } from "@/app/lib/purchaseOrders";
import {
  getSalesOrderBalanceInBase,
  getSalesOrderPaidInBase,
  getSalesOrderTotalInBase,
  toSalesOrderBase,
  type SalesOrder,
} from "@/app/lib/salesOrders";

/**
 * The money reports: what was sold, who still owes, what was bought from
 * whom and what is still owed to them. Each is a branded PDF on the shared
 * document furniture (logo, header, footer, page numbers) plus a CSV of the
 * same rows for a spreadsheet.
 *
 * Drafts and cancelled documents are excluded everywhere: they are not
 * money. A report that counted a cancelled invoice would be wrong in the
 * only way that matters.
 */

export interface ReportTable {
  title: string;
  subtitle: string;
  head: string[];
  rows: (string | number)[][];
  foot?: string[];
  rightAligned: number[];
  filename: string;
}

function money(value: number, currency: string) {
  return formatInventoryPrice(value, currency) || "--";
}

function monthKey(source: string | null | undefined) {
  if (!source) return "";
  return source.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key || "Undated";
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

const isSale = (order: SalesOrder) => order.status !== "draft" && order.status !== "cancelled";
const isPurchase = (order: PurchaseOrder) =>
  order.status !== "draft" && order.status !== "cancelled";

/* ---- the four tables ------------------------------------------------------ */

export function salesByMonth(orders: SalesOrder[], currency: string): ReportTable {
  const buckets = new Map<string, { count: number; total: number; paid: number }>();
  for (const order of orders.filter(isSale)) {
    const key = monthKey(order.issue_date || order.created_at);
    const bucket = buckets.get(key) || { count: 0, total: 0, paid: 0 };
    const total = getSalesOrderTotalInBase(order);
    bucket.count += 1;
    bucket.total += total;
    bucket.paid += Math.min(total, getSalesOrderPaidInBase(order));
    buckets.set(key, bucket);
  }
  const keys = Array.from(buckets.keys()).sort().reverse();
  const totals = keys.reduce(
    (sum, key) => {
      const bucket = buckets.get(key)!;
      return {
        count: sum.count + bucket.count,
        total: sum.total + bucket.total,
        paid: sum.paid + bucket.paid,
      };
    },
    { count: 0, total: 0, paid: 0 }
  );
  return {
    title: "Sales by month",
    subtitle: `${totals.count} invoice${totals.count === 1 ? "" : "s"} · issued and paid, drafts and cancelled excluded`,
    head: ["Month", "Invoices", "Invoiced", "Paid", "Still owed"],
    rows: keys.map((key) => {
      const bucket = buckets.get(key)!;
      return [
        monthLabel(key),
        bucket.count,
        money(bucket.total, currency),
        money(bucket.paid, currency),
        money(Math.max(0, bucket.total - bucket.paid), currency),
      ];
    }),
    foot: [
      "Total",
      String(totals.count),
      money(totals.total, currency),
      money(totals.paid, currency),
      money(Math.max(0, totals.total - totals.paid), currency),
    ],
    rightAligned: [1, 2, 3, 4],
    filename: "sales-by-month",
  };
}

export function outstandingInvoices(orders: SalesOrder[], currency: string): ReportTable {
  const today = new Date().toISOString().slice(0, 10);
  const open = orders
    .filter((order) => isSale(order) && getSalesOrderBalanceInBase(order) > 0)
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const owed = open.reduce((sum, order) => sum + getSalesOrderBalanceInBase(order), 0);
  const overdue = open.filter((order) => order.due_date && order.due_date < today).length;
  return {
    title: "Outstanding invoices",
    subtitle: `${open.length} open invoice${open.length === 1 ? "" : "s"}${
      overdue > 0 ? ` · ${overdue} overdue` : ""
    }`,
    head: ["Customer", "Invoice", "Issued", "Due", "Total", "Paid", "Still owed"],
    rows: open.map((order) => [
      order.customer_name_snapshot || "No customer",
      order.invoice_number,
      formatDocumentDate(order.issue_date),
      order.due_date
        ? `${formatDocumentDate(order.due_date)}${order.due_date < today ? " (overdue)" : ""}`
        : "--",
      money(getSalesOrderTotalInBase(order), currency),
      money(getSalesOrderPaidInBase(order), currency),
      money(getSalesOrderBalanceInBase(order), currency),
    ]),
    foot: ["Total", "", "", "", "", "", money(owed, currency)],
    rightAligned: [4, 5, 6],
    filename: "outstanding-invoices",
  };
}

/** Best sellers: units and money per product across every issued invoice. */
export function topSellingItems(orders: SalesOrder[], currency: string): ReportTable {
  const buckets = new Map<
    string,
    { name: string; code: string; units: number; revenue: number; invoices: Set<number> }
  >();
  for (const order of orders.filter(isSale)) {
    for (const line of order.lines || []) {
      if (line.line_type === "charge") continue;
      const key = line.inventory_item_id ? `item-${line.inventory_item_id}` : `name-${line.name_snapshot}`;
      const bucket = buckets.get(key) || {
        name: line.name_snapshot,
        code: line.item_code_snapshot || line.sku_snapshot || "",
        units: 0,
        revenue: 0,
        invoices: new Set<number>(),
      };
      bucket.units += Number(line.quantity || 0);
      bucket.revenue += toSalesOrderBase(
        order,
        Number(line.quantity || 0) * Number(line.unit_price || 0)
      );
      bucket.invoices.add(order.id);
      buckets.set(key, bucket);
    }
  }
  const rows = Array.from(buckets.values()).sort((a, b) => b.revenue - a.revenue);
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return {
    title: "Top-selling items",
    subtitle: `${rows.length} product${rows.length === 1 ? "" : "s"} sold · by revenue`,
    head: ["Item", "Code", "Invoices", "Units sold", "Revenue"],
    rows: rows.map((row) => [
      row.name,
      row.code || "--",
      row.invoices.size,
      Number.isInteger(row.units) ? row.units : row.units.toFixed(2),
      money(row.revenue, currency),
    ]),
    foot: ["Total", "", "", String(Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2)), money(totalRevenue, currency)],
    rightAligned: [2, 3, 4],
    filename: "top-selling-items",
  };
}

/** Who buys the most, and who still owes: one row per customer. */
export function salesByCustomer(orders: SalesOrder[], currency: string): ReportTable {
  const buckets = new Map<string, { count: number; total: number; paid: number; open: number }>();
  for (const order of orders.filter(isSale)) {
    const key = order.customer_name_snapshot || "No customer";
    const bucket = buckets.get(key) || { count: 0, total: 0, paid: 0, open: 0 };
    bucket.count += 1;
    bucket.total += getSalesOrderTotalInBase(order);
    bucket.paid += getSalesOrderPaidInBase(order);
    if (getSalesOrderBalanceInBase(order) > 0) bucket.open += 1;
    buckets.set(key, bucket);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => buckets.get(b)!.total - buckets.get(a)!.total);
  const totals = keys.reduce(
    (sum, key) => {
      const bucket = buckets.get(key)!;
      return { count: sum.count + bucket.count, total: sum.total + bucket.total, paid: sum.paid + bucket.paid };
    },
    { count: 0, total: 0, paid: 0 }
  );
  return {
    title: "Sales by customer",
    subtitle: `${totals.count} invoice${totals.count === 1 ? "" : "s"} · drafts and cancelled excluded`,
    head: ["Customer", "Invoices", "Still open", "Invoiced", "Paid", "Still owed"],
    rows: keys.map((key) => {
      const bucket = buckets.get(key)!;
      return [
        key,
        bucket.count,
        bucket.open,
        money(bucket.total, currency),
        money(bucket.paid, currency),
        money(Math.max(0, bucket.total - bucket.paid), currency),
      ];
    }),
    foot: [
      "Total",
      String(totals.count),
      "",
      money(totals.total, currency),
      money(totals.paid, currency),
      money(Math.max(0, totals.total - totals.paid), currency),
    ],
    rightAligned: [1, 2, 3, 4, 5],
    filename: "sales-by-customer",
  };
}

/** Which product categories bring in the money -- units and revenue per
 * category. `categoryLabel` resolves an item's CURRENT category (not a
 * snapshot; a product renamed into a different category later shows there
 * now), the same trade-off `topSellingItems` makes for names. */
export function salesByCategory(
  orders: SalesOrder[],
  currency: string,
  categoryLabel: (inventoryItemId: number | null) => string
): ReportTable {
  const buckets = new Map<string, { units: number; revenue: number }>();
  for (const order of orders.filter(isSale)) {
    for (const line of order.lines || []) {
      if (line.line_type === "charge") continue;
      const key = categoryLabel(line.inventory_item_id) || "Uncategorized";
      const bucket = buckets.get(key) || { units: 0, revenue: 0 };
      bucket.units += Number(line.quantity || 0);
      bucket.revenue += toSalesOrderBase(
        order,
        Number(line.quantity || 0) * Number(line.unit_price || 0)
      );
      buckets.set(key, bucket);
    }
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => buckets.get(b)!.revenue - buckets.get(a)!.revenue);
  const totalUnits = keys.reduce((sum, key) => sum + buckets.get(key)!.units, 0);
  const totalRevenue = keys.reduce((sum, key) => sum + buckets.get(key)!.revenue, 0);
  return {
    title: "Sales by category",
    subtitle: `${keys.length} categor${keys.length === 1 ? "y" : "ies"} · by revenue`,
    head: ["Category", "Units sold", "Revenue"],
    rows: keys.map((key) => {
      const bucket = buckets.get(key)!;
      return [
        key,
        Number.isInteger(bucket.units) ? bucket.units : bucket.units.toFixed(2),
        money(bucket.revenue, currency),
      ];
    }),
    foot: [
      "Total",
      String(Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2)),
      money(totalRevenue, currency),
    ],
    rightAligned: [1, 2],
    filename: "sales-by-category",
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
};

export interface ReportPayment {
  amount: number;
  method: string | null;
  exchangeRate: number;
}

/** Cash in from customers and cash out to suppliers, side by side, by how it
 * moved. The one report that answers "am I mostly a cash business or a bank
 * transfer business" -- and the two directions net against each other, so a
 * depot that pays suppliers in cash from the same drawer it collects in sees
 * that immediately instead of reading two separate reports. */
export function paymentsByMethod(
  received: ReportPayment[],
  paid: ReportPayment[],
  currency: string
): ReportTable {
  const methods = ["cash", "card", "transfer", "other"];
  const toBase = (payment: ReportPayment) =>
    payment.amount / (payment.exchangeRate > 0 ? payment.exchangeRate : 1);

  const receivedByMethod = new Map<string, number>();
  for (const payment of received) {
    const key = payment.method || "other";
    receivedByMethod.set(key, (receivedByMethod.get(key) || 0) + toBase(payment));
  }
  const paidByMethod = new Map<string, number>();
  for (const payment of paid) {
    const key = payment.method || "other";
    paidByMethod.set(key, (paidByMethod.get(key) || 0) + toBase(payment));
  }

  const totalReceived = Array.from(receivedByMethod.values()).reduce((sum, v) => sum + v, 0);
  const totalPaid = Array.from(paidByMethod.values()).reduce((sum, v) => sum + v, 0);

  return {
    title: "Payments by method",
    subtitle: `${received.length + paid.length} payment${received.length + paid.length === 1 ? "" : "s"} · how customers paid you, and how you paid suppliers`,
    head: ["Method", "Received from customers", "Paid to suppliers", "Net"],
    rows: methods.map((method) => {
      const inflow = receivedByMethod.get(method) || 0;
      const outflow = paidByMethod.get(method) || 0;
      return [
        PAYMENT_METHOD_LABELS[method] || method,
        money(inflow, currency),
        money(outflow, currency),
        money(inflow - outflow, currency),
      ];
    }),
    foot: [
      "Total",
      money(totalReceived, currency),
      money(totalPaid, currency),
      money(totalReceived - totalPaid, currency),
    ],
    rightAligned: [1, 2, 3],
    filename: "payments-by-method",
  };
}

export interface StockAgingItem {
  id: number;
  name: string;
  sku?: string | null;
  quantity: number;
}

/** Every item by how long it has sat without a stock movement, oldest
 * first -- the report that answers "what's just sitting there". An item
 * that has never moved (added, never sold, never adjusted) is not the same
 * as one moved a year ago and is shown as its own case rather than guessed
 * at from when the item record was created. */
export function stockAging(
  items: StockAgingItem[],
  lastMovedByItemId: Map<number, string>,
  categoryLabel: (itemId: number) => string
): ReportTable {
  const now = Date.now();
  const rows = items.map((item) => {
    const lastMoved = lastMovedByItemId.get(item.id) || null;
    const daysIdle = lastMoved
      ? Math.floor((now - new Date(lastMoved).getTime()) / 86_400_000)
      : null;
    return { item, lastMoved, daysIdle };
  });
  // Oldest known movement first; "never moved" is a different kind of flag
  // (often a new arrival, not necessarily dead stock) so it sorts after
  // every item with a real date, not ahead of all of them.
  rows.sort((a, b) => {
    if (a.daysIdle === null && b.daysIdle === null) return 0;
    if (a.daysIdle === null) return 1;
    if (b.daysIdle === null) return -1;
    return b.daysIdle - a.daysIdle;
  });
  const neverMoved = rows.filter((row) => row.daysIdle === null).length;
  const idleOver90 = rows.filter((row) => (row.daysIdle ?? 0) > 90).length;
  return {
    title: "Stock Aging",
    subtitle: `${items.length} item${items.length === 1 ? "" : "s"} · ${idleOver90} idle over 90 days${
      neverMoved > 0 ? ` · ${neverMoved} never moved` : ""
    }`,
    head: ["Item", "Code", "Category", "Quantity", "Last moved", "Days idle"],
    rows: rows.map(({ item, lastMoved, daysIdle }) => [
      item.name,
      item.sku || "--",
      categoryLabel(item.id) || "--",
      item.quantity,
      lastMoved ? formatDocumentDate(lastMoved) : "Never",
      daysIdle === null ? "--" : String(daysIdle),
    ]),
    rightAligned: [3, 5],
    filename: "stock-aging",
  };
}

export function purchasesBySupplier(orders: PurchaseOrder[], currency: string): ReportTable {
  const buckets = new Map<string, { count: number; total: number; paid: number; open: number }>();
  for (const order of orders.filter(isPurchase)) {
    const key = order.supplier_name_snapshot || "No supplier";
    const bucket = buckets.get(key) || { count: 0, total: 0, paid: 0, open: 0 };
    const balance = getPurchaseOrderBalanceInBase(order);
    bucket.count += 1;
    bucket.total += balance.total;
    bucket.paid += balance.paid;
    if (order.status !== "received") bucket.open += 1;
    buckets.set(key, bucket);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => buckets.get(b)!.total - buckets.get(a)!.total);
  const totals = keys.reduce(
    (sum, key) => {
      const bucket = buckets.get(key)!;
      return {
        count: sum.count + bucket.count,
        total: sum.total + bucket.total,
        paid: sum.paid + bucket.paid,
      };
    },
    { count: 0, total: 0, paid: 0 }
  );
  return {
    title: "Purchases by supplier",
    subtitle: `${totals.count} order${totals.count === 1 ? "" : "s"} · drafts and cancelled excluded`,
    head: ["Supplier", "Orders", "Still open", "Ordered", "Paid", "You still owe"],
    rows: keys.map((key) => {
      const bucket = buckets.get(key)!;
      return [
        key,
        bucket.count,
        bucket.open,
        money(bucket.total, currency),
        money(bucket.paid, currency),
        money(Math.max(0, bucket.total - bucket.paid), currency),
      ];
    }),
    foot: [
      "Total",
      String(totals.count),
      "",
      money(totals.total, currency),
      money(totals.paid, currency),
      money(Math.max(0, totals.total - totals.paid), currency),
    ],
    rightAligned: [1, 2, 3, 4, 5],
    filename: "purchases-by-supplier",
  };
}

export function purchasesByMonth(orders: PurchaseOrder[], currency: string): ReportTable {
  const buckets = new Map<string, { count: number; stock: number; general: number }>();
  for (const order of orders.filter(isPurchase)) {
    const key = monthKey(order.purchase_date || order.created_at);
    const bucket = buckets.get(key) || { count: 0, stock: 0, general: 0 };
    bucket.count += 1;
    for (const line of order.lines) {
      const value = (line.unit_cost ?? 0) * line.quantity;
      if (line.line_type === "expense") bucket.general += value;
      else bucket.stock += value;
    }
    buckets.set(key, bucket);
  }
  const keys = Array.from(buckets.keys()).sort().reverse();
  const totals = keys.reduce(
    (sum, key) => {
      const bucket = buckets.get(key)!;
      return {
        count: sum.count + bucket.count,
        stock: sum.stock + bucket.stock,
        general: sum.general + bucket.general,
      };
    },
    { count: 0, stock: 0, general: 0 }
  );
  return {
    title: "Purchases by month",
    subtitle: `${totals.count} order${totals.count === 1 ? "" : "s"} · stock purchases and general spending`,
    head: ["Month", "Orders", "Stock purchases", "General purchases", "Total"],
    rows: keys.map((key) => {
      const bucket = buckets.get(key)!;
      return [
        monthLabel(key),
        bucket.count,
        money(bucket.stock, currency),
        money(bucket.general, currency),
        money(bucket.stock + bucket.general, currency),
      ];
    }),
    foot: [
      "Total",
      String(totals.count),
      money(totals.stock, currency),
      money(totals.general, currency),
      money(totals.stock + totals.general, currency),
    ],
    rightAligned: [1, 2, 3, 4],
    filename: "purchases-by-month",
  };
}

/* ---- output ----------------------------------------------------------------- */

export async function exportReportPdf(table: ReportTable, branding: DocumentBranding) {
  const header = {
    kind: "Report",
    number: table.title,
    meta: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date()),
  };
  const context = await openDocument(branding, header);
  const { doc, margin } = context;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DOCUMENT_INK);
  doc.text(table.title, margin, context.contentTop);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DOCUMENT_MUTED);
  doc.text(table.subtitle, margin, context.contentTop + 6);

  const columnStyles: Record<number, { halign: "right" }> = {};
  for (const index of table.rightAligned) columnStyles[index] = { halign: "right" };

  autoTable(doc, {
    startY: context.contentTop + 12,
    margin: {
      left: margin,
      right: margin,
      top: context.contentTop,
      bottom: context.pageHeight - context.contentBottom,
    },
    head: [table.head],
    body: table.rows.length > 0 ? table.rows : [["Nothing to report yet", ...table.head.slice(1).map(() => "")]],
    foot: table.foot ? [table.foot] : undefined,
    showHead: "everyPage",
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: DOCUMENT_INK,
      lineColor: DOCUMENT_RULE,
      lineWidth: 0.12,
    },
    headStyles: { fillColor: [238, 242, 248], textColor: [70, 80, 95], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: DOCUMENT_INK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: DOCUMENT_FILL },
    columnStyles,
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawDocumentHeader(context, header);
    },
  });

  finishDocument(context, table.title);
  const filename = `${slugifyDocumentName(branding.businessName, "sydin")}-${table.filename}.pdf`;
  doc.save(filename);
  return filename;
}

export function reportCsvRows(table: ReportTable) {
  const rows: (string | number)[][] = [table.head, ...table.rows];
  if (table.foot) rows.push(table.foot);
  return rows;
}

export function normalizeReportCurrency(code: string | undefined) {
  return normalizeCurrencyCode(code, "USD");
}
