import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { formatExactPrice } from "@/app/lib/currency";
import {
  docxFromColumn,
  saveDocx,
  type DocxLineTable,
} from "@/app/lib/documentDocx";
import {
  formatDocumentDate,
  loadLineImages,
  slugifyDocumentName,
  type DocumentBranding,
} from "@/app/lib/documentPdf";
import type { SalesInvoicePdfDetails, SalesInvoicePdfLine } from "@/app/lib/salesInvoicePdf";
import type {
  PurchaseOrderPdfDetails,
  PurchaseOrderPdfLine,
} from "@/app/lib/purchaseOrderPdfExport";

/**
 * Word versions of the invoice and the purchase order. They take the same
 * details and lines as the PDF exporters, so a page that can print one can
 * print the other with the same call -- and the two files say the same thing.
 */

function money(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined) return "--";
  // Document amounts are already in the document's currency: no conversion.
  return formatExactPrice(value, currency) || "--";
}

function units(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export async function exportSalesInvoiceDocx({
  details,
  lines,
  branding,
  currencyCode = "USD",
}: {
  details: SalesInvoicePdfDetails;
  lines: SalesInvoicePdfLine[];
  branding: DocumentBranding;
  currencyCode?: string;
}) {
  const currency = normalizeCurrencyCode(currencyCode);
  const images = await loadLineImages(lines.map((line) => line.imageUrl));
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const paid = Number(details.amountPaid || 0);

  const table: DocxLineTable = {
    head: ["Item", "Qty", "Unit price", "Total"],
    widthsMm: [null, 22, 30, 30],
    rightAligned: [1, 2, 3],
    rows: lines.map((line) => ({
      cells: [
        [line.name, line.code].filter(Boolean).join("\n"),
        `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`,
        money(line.unitPrice, currency),
        money(line.lineTotal, currency),
      ],
      hasImageSlot: !line.isCharge,
      image: line.imageUrl ? images.get(line.imageUrl) ?? null : null,
    })),
  };

  return saveDocx({
    branding,
    kind: "Invoice",
    number: details.invoiceNumber,
    meta: details.status.toUpperCase(),
    columns: [
      docxFromColumn(branding),
      {
        heading: "Bill to",
        rows: [
          details.customerName || "Not set",
          ...(details.customerAddress ? details.customerAddress.split(/\r?\n/) : []),
          details.customerContact || "",
        ].filter(Boolean),
      },
      {
        heading: "Invoice",
        rows: [
          details.issueDate ? `Issued ${formatDocumentDate(details.issueDate)}` : "Not issued yet",
          details.dueDate ? `Due ${formatDocumentDate(details.dueDate)}` : "",
          details.depotName ? `From depot ${details.depotName}` : "",
        ].filter(Boolean),
      },
    ],
    table,
    totals: [
      ["Total", money(total, currency)],
      ["Paid", money(paid, currency)],
      ["Still owed", money(Math.max(total - paid, 0), currency)],
    ],
    notes: [
      details.notes?.trim() || "",
      branding.paymentTerms ? `Payment terms: ${branding.paymentTerms}` : "",
    ].filter(Boolean),
    filename: `${slugifyDocumentName(details.invoiceNumber, "invoice")}.docx`,
  });
}

export async function exportPurchaseOrderDocx({
  details,
  lines,
  branding,
  currencyCode,
}: {
  details: PurchaseOrderPdfDetails;
  lines: PurchaseOrderPdfLine[];
  branding: DocumentBranding;
  currencyCode?: string;
}) {
  const currency = normalizeCurrencyCode(currencyCode, "USD");
  const ordered = lines.filter((line) => line.orderQuantity > 0);
  const images = await loadLineImages(ordered.map((line) => line.imageUrl));
  const received = ordered.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0);
  const showReceived = received > 0;
  const subtotal = ordered.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  const orderedUnits = ordered.reduce((sum, line) => sum + line.orderQuantity, 0);
  const paymentLine = [details.paymentStatus, details.paymentMethod].filter(Boolean).join(" · ");

  const table: DocxLineTable = showReceived
    ? {
        head: ["Item", "Unit", "Ordered", "Received", "Unit cost", "Line total"],
        widthsMm: [null, 18, 18, 20, 26, 28],
        rightAligned: [2, 3, 4, 5],
        rows: ordered.map((line) => ({
          cells: [
            [line.name, [line.code, line.sku ? `SKU ${line.sku}` : ""].filter(Boolean).join(" · "), line.note]
              .filter(Boolean)
              .join("\n"),
            line.unit || "Unit",
            units(line.orderQuantity),
            units(line.receivedQuantity || 0),
            money(line.unitCost, currency),
            money(line.lineTotal, currency),
          ],
          hasImageSlot: true,
          image: line.imageUrl ? images.get(line.imageUrl) ?? null : null,
        })),
        foot: [`${units(orderedUnits)} units ordered · ${units(received)} received`, "", "", "", "Order total", money(subtotal, currency)],
      }
    : {
        head: ["Item", "Unit", "Qty", "Unit cost", "Line total"],
        widthsMm: [null, 20, 18, 28, 30],
        rightAligned: [2, 3, 4],
        rows: ordered.map((line) => ({
          cells: [
            [line.name, [line.code, line.sku ? `SKU ${line.sku}` : ""].filter(Boolean).join(" · "), line.note]
              .filter(Boolean)
              .join("\n"),
            line.unit || "Unit",
            units(line.orderQuantity),
            money(line.unitCost, currency),
            money(line.lineTotal, currency),
          ],
          hasImageSlot: true,
          image: line.imageUrl ? images.get(line.imageUrl) ?? null : null,
        })),
        foot: [`${units(orderedUnits)} units`, "", "", "Order total", money(subtotal, currency)],
      };

  return saveDocx({
    branding,
    kind: "Purchase Order",
    number: details.poNumber || "Purchase Order",
    meta: details.status.toUpperCase(),
    columns: [
      docxFromColumn(branding),
      {
        heading: "Supplier",
        rows: [details.supplierName || "Not set", details.supplierContact || ""].filter(Boolean),
      },
      {
        heading: "Order",
        rows: [
          details.title || "",
          `Ordered ${formatDocumentDate(details.purchaseDate)}`,
          `Expected ${formatDocumentDate(details.expectedDeliveryDate)}`,
          `Deliver to ${details.depotName || "main depot"}`,
          details.internalReference ? `Ref. ${details.internalReference}` : "",
          paymentLine ? `Payment: ${paymentLine}` : "",
          branding.paymentTerms ? `Terms: ${branding.paymentTerms}` : "",
        ].filter(Boolean),
      },
    ],
    table,
    totals:
      details.amountPaid && details.amountPaid > 0
        ? [["Paid so far", money(details.amountPaid, currency)]]
        : undefined,
    notes: [details.notes?.trim() || ""].filter(Boolean),
    filename: `${slugifyDocumentName(branding.businessName, "sydin")}-${slugifyDocumentName(
      details.poNumber || "purchase-order",
      "purchase-order"
    )}.docx`,
  });
}
