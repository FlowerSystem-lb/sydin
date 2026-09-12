import autoTable from "jspdf-autotable";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { formatExactPrice } from "@/app/lib/currency";
import {
  DOCUMENT_FILL,
  DOCUMENT_INK,
  DOCUMENT_MUTED,
  DOCUMENT_RULE,
  THUMB_COLUMN_PADDING,
  THUMB_SIZE,
  drawColumns,
  drawDocumentHeader,
  ensureRoom,
  finishDocument,
  formatDocumentDate,
  fromColumn,
  loadLineImages,
  openDocument,
  slugifyDocumentName,
  thumbnailCellHook,
  type DocumentBranding,
} from "@/app/lib/documentPdf";

/**
 * The purchase order a supplier receives: "please send us these".
 *
 * Shares its page furniture with the invoice (documentPdf) and nothing else --
 * see the note at the top of salesInvoicePdf for why the two are not one
 * template. What this one adds is the receiving state: when part of the
 * order has already arrived, the table says so per line, because the copy a
 * supplier is chasing is the one that shows what is still owed to the depot.
 */

export interface PurchaseOrderPdfLine {
  name: string;
  category?: string;
  code?: string;
  sku?: string;
  unit: string;
  imageUrl?: string | null;
  orderQuantity: number;
  receivedQuantity?: number;
  unitCost: number | null;
  lineTotal: number | null;
  note?: string;
}

export interface PurchaseOrderPdfDetails {
  poNumber: string;
  title?: string;
  supplierName: string;
  supplierContact?: string;
  depotName?: string;
  purchaseDate?: string;
  expectedDeliveryDate?: string;
  status: string;
  paymentMethod?: string;
  paidBy?: string;
  paymentStatus?: string;
  amountPaid?: number | null;
  notes?: string;
  internalReference?: string;
}

export type PurchaseOrderPdfBranding = DocumentBranding;

export interface ExportPurchaseOrderPdfOptions {
  details: PurchaseOrderPdfDetails;
  lines: PurchaseOrderPdfLine[];
  branding: PurchaseOrderPdfBranding;
  currencyCode?: string;
}

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Amounts on an order are already in the order's currency: no conversion.
function formatMoney(value: number | null | undefined, currencyCode: string) {
  return value === null || value === undefined
    ? "--"
    : formatExactPrice(value, currencyCode) || "--";
}

function formatUnits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export async function exportPurchaseOrderPdf({
  details,
  lines,
  branding,
  currencyCode,
}: ExportPurchaseOrderPdfOptions) {
  const currency = normalizeCurrencyCode(currencyCode, "USD");
  const header = {
    kind: "Purchase Order",
    number: details.poNumber || "Purchase Order",
    meta: details.status.toUpperCase(),
  };
  const context = await openDocument(branding, header);
  const { doc, pageWidth, margin } = context;

  const orderedLines = lines.filter((line) => line.orderQuantity > 0);
  const images = await loadLineImages(orderedLines.map((line) => line.imageUrl));
  const subtotal = orderedLines.reduce(
    (total, line) => total + Number(line.lineTotal || 0),
    0
  );
  const orderedQuantity = orderedLines.reduce(
    (total, line) => total + Number(line.orderQuantity || 0),
    0
  );
  const receivedQuantity = orderedLines.reduce(
    (total, line) => total + Number(line.receivedQuantity || 0),
    0
  );
  const showReceived = receivedQuantity > 0;

  // ---- from, supplier, order --------------------------------------------
  const paymentLine = [details.paymentStatus, details.paymentMethod]
    .filter(Boolean)
    .join(" · ");

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: "Supplier",
      rows: [details.supplierName || "Not set", details.supplierContact || ""].filter(
        Boolean
      ),
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
        details.paidBy ? `Paid by ${details.paidBy}` : "",
        branding.paymentTerms ? `Terms: ${branding.paymentTerms}` : "",
      ].filter(Boolean),
    },
  ]);

  // ---- the lines ----------------------------------------------------------
  const head = showReceived
    ? [["Item", "Unit", "Ordered", "Received", "Unit cost", "Line total"]]
    : [["Item", "Unit", "Qty", "Unit cost", "Line total"]];

  autoTable(doc, {
    startY: cursorY,
    margin: {
      left: margin,
      right: margin,
      top: context.contentTop,
      bottom: context.pageHeight - context.contentBottom,
    },
    head,
    body: orderedLines.map((line) => {
      const cells: (string | number)[] = [
        [line.name, [line.code, line.sku ? `SKU ${line.sku}` : ""].filter(Boolean).join(" · "), line.note]
          .filter(Boolean)
          .join("\n"),
        line.unit || "Unit",
        formatUnits(line.orderQuantity),
      ];
      if (showReceived) cells.push(formatUnits(line.receivedQuantity || 0));
      cells.push(formatMoney(line.unitCost, currency), formatMoney(line.lineTotal, currency));
      return cells;
    }),
    foot: [
      [
        {
          content: showReceived
            ? `${formatUnits(orderedQuantity)} units ordered · ${formatUnits(
                receivedQuantity
              )} received`
            : `${formatUnits(orderedQuantity)} units`,
          colSpan: showReceived ? 4 : 3,
          styles: { halign: "left", fontStyle: "normal", textColor: DOCUMENT_MUTED },
        },
        { content: "Order total", styles: { halign: "right", fontStyle: "bold" } },
        { content: formatMoney(subtotal, currency), styles: { halign: "right", fontStyle: "bold" } },
      ],
    ],
    showHead: "everyPage",
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.4,
      overflow: "linebreak",
      valign: "middle",
      lineColor: DOCUMENT_RULE,
      lineWidth: 0.12,
      textColor: DOCUMENT_INK,
      minCellHeight: THUMB_SIZE + 4,
    },
    headStyles: {
      fillColor: [238, 242, 248],
      textColor: [70, 80, 95],
      fontStyle: "bold",
    },
    footStyles: { fillColor: [241, 245, 249], textColor: DOCUMENT_INK },
    alternateRowStyles: { fillColor: DOCUMENT_FILL },
    columnStyles: showReceived
      ? {
          0: { cellPadding: { left: THUMB_COLUMN_PADDING, top: 2.4, right: 2.4, bottom: 2.4 } },
          1: { cellWidth: 18 },
          2: { cellWidth: 18, halign: "right" },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 28, halign: "right" },
        }
      : {
          0: { cellPadding: { left: THUMB_COLUMN_PADDING, top: 2.4, right: 2.4, bottom: 2.4 } },
          1: { cellWidth: 20 },
          2: { cellWidth: 18, halign: "right" },
          3: { cellWidth: 28, halign: "right" },
          4: { cellWidth: 30, halign: "right" },
        },
    didDrawCell: thumbnailCellHook(doc, (rowIndex) => {
      const line = orderedLines[rowIndex];
      if (!line) return undefined;
      return line.imageUrl ? images.get(line.imageUrl) ?? null : null;
    }),
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawDocumentHeader(context, header);
    },
  });

  // ---- notes ----------------------------------------------------------------
  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    cursorY;
  let y = tableEnd + 8;

  if (details.amountPaid !== null && details.amountPaid !== undefined && details.amountPaid > 0) {
    y = ensureRoom(context, header, y, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("Paid so far", pageWidth - margin - 60, y);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(formatMoney(details.amountPaid, currency), pageWidth - margin, y, {
      align: "right",
    });
    y += 8;
  }

  if (details.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(details.notes.trim(), pageWidth - margin * 2) as string[];
    y = ensureRoom(context, header, y, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("NOTES", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, y + 5);
  }

  finishDocument(context, details.poNumber || "Purchase order");

  const filename = `${slugifyDocumentName(branding.businessName, "sydin")}-${slugifyDocumentName(
    details.poNumber || "purchase-order",
    "purchase-order"
  )}-${formatDateForFilename(context.generatedAt)}.pdf`;

  doc.save(filename);
  return filename;
}
