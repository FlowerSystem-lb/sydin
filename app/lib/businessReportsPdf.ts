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
