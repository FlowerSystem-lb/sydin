import autoTable from "jspdf-autotable";
import {
  formatInventoryPrice,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";
import {
  DOCUMENT_FILL,
  DOCUMENT_HEADER_HEIGHT,
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
 * The invoice a customer is handed, printed or sent on WhatsApp.
 *
 * WHY THIS IS NOT purchaseOrderPdfExport WITH DIFFERENT LABELS. The two
 * documents look alike and mean opposite things. A purchase order says "please
 * send us these"; an invoice says "you owe us this". The fields differ where it
 * matters -- unit COST against unit PRICE, supplier against customer, expected
 * delivery against amount still owed -- and an adapter passing an invoice
 * number in as `poNumber` and a price in as `unitCost` would read like a bug
 * forever after, and eventually become one.
 *
 * What IS shared is shared, in documentPdf: the header bar, the From block,
 * the footer with the business's own line, page numbers, thumbnails.
 *
 * The balance is the reason this exists at all. A customer disputing what they
 * owe is settled by a piece of paper that says what was bought, what was paid,
 * and what is left -- so those three sit together at the bottom, not scattered.
 */

export interface SalesInvoicePdfLine {
  name: string;
  code?: string;
  unit?: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  isCharge?: boolean;
}

export interface SalesInvoicePdfDetails {
  invoiceNumber: string;
  customerName?: string;
  customerContact?: string;
  customerAddress?: string;
  depotName?: string;
  issueDate?: string;
  dueDate?: string;
  status: string;
  paymentStatus?: string;
  amountPaid?: number | null;
  notes?: string;
}

export type SalesInvoicePdfBranding = DocumentBranding;

function money(value: number | null | undefined, currencyCode: string) {
  if (value === null || value === undefined) return "--";
  return formatInventoryPrice(value, currencyCode) || "--";
}

export async function exportSalesInvoicePdf({
  details,
  lines,
  branding,
  currencyCode = "USD",
}: {
  details: SalesInvoicePdfDetails;
  lines: SalesInvoicePdfLine[];
  branding: SalesInvoicePdfBranding;
  currencyCode?: string;
}) {
  const currency = normalizeCurrencyCode(currencyCode);
  const header = {
    kind: "Invoice",
    number: details.invoiceNumber,
    meta: details.status.toUpperCase(),
  };
  const context = await openDocument(branding, header);
  const { doc, pageWidth, margin } = context;
  const images = await loadLineImages(lines.map((line) => line.imageUrl));

  // ---- who, to whom, and when -----------------------------------------
  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
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
  ]);

  // ---- what was sold ---------------------------------------------------
  autoTable(doc, {
    startY: cursorY,
    margin: {
      left: margin,
      right: margin,
      top: context.contentTop,
      bottom: context.pageHeight - context.contentBottom,
    },
    head: [["Item", "Qty", "Unit price", "Total"]],
    body: lines.map((line) => [
      [line.name, line.code].filter(Boolean).join("\n"),
      `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`,
      money(line.unitPrice, currency),
      money(line.lineTotal, currency),
    ]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      textColor: DOCUMENT_INK,
      lineColor: DOCUMENT_RULE,
      lineWidth: 0.12,
      minCellHeight: THUMB_SIZE + 4,
      valign: "middle",
    },
    headStyles: { fillColor: [238, 242, 248], textColor: [70, 80, 95], fontStyle: "bold" },
    alternateRowStyles: { fillColor: DOCUMENT_FILL },
    columnStyles: {
      0: { cellPadding: { left: THUMB_COLUMN_PADDING, top: 2.5, right: 2.5, bottom: 2.5 } },
      1: { halign: "right", cellWidth: 24 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
    },
    // A charge (delivery, service) has no photo and no placeholder either.
    didDrawCell: thumbnailCellHook(doc, (rowIndex) => {
      const line = lines[rowIndex];
      if (!line || line.isCharge) return undefined;
      return line.imageUrl ? images.get(line.imageUrl) ?? null : null;
    }),
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawDocumentHeader(context, header);
    },
  });

  // ---- the three numbers that settle an argument -----------------------
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const paid = Number(details.amountPaid || 0);
  const balance = Math.max(total - paid, 0);

  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    cursorY;
  let totalsY = ensureRoom(context, header, tableEnd + 10, 30);

  const totalsX = pageWidth - margin;
  const labelX = totalsX - 60;

  const rows: [string, string, boolean][] = [
    ["Total", money(total, currency), false],
    ["Paid", money(paid, currency), false],
    ["Still owed", money(balance, currency), true],
  ];

  rows.forEach(([label, value, emphasise]) => {
    if (emphasise) {
      doc.setDrawColor(...DOCUMENT_RULE);
      doc.line(labelX, totalsY - 4.5, totalsX, totalsY - 4.5);
    }
    doc.setFont("helvetica", emphasise ? "bold" : "normal");
    doc.setFontSize(emphasise ? 12 : 10);
    if (emphasise) doc.setTextColor(...DOCUMENT_INK);
    else doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(label, labelX, totalsY);
    doc.text(value, totalsX, totalsY, { align: "right" });
    totalsY += emphasise ? 8 : 6;
  });

  // ---- notes and terms ---------------------------------------------------
  const notes = [
    details.notes?.trim(),
    branding.paymentTerms ? `Payment terms: ${branding.paymentTerms}` : "",
  ].filter(Boolean) as string[];

  if (notes.length > 0) {
    // Split at the size it will print in; the totals left the font at 12pt.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(notes.join("\n"), pageWidth - margin * 2) as string[];
    let notesY = ensureRoom(context, header, totalsY + 2, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("NOTES", margin, notesY);
    notesY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, notesY);
  }

  finishDocument(context, details.invoiceNumber);
  doc.save(`${slugifyDocumentName(details.invoiceNumber, "invoice")}.pdf`);
}

// Kept for callers that measured against the old constant.
export { DOCUMENT_HEADER_HEIGHT as INVOICE_HEADER_HEIGHT };
