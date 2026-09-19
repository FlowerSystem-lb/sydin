import autoTable from "jspdf-autotable";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { formatExactPrice } from "@/app/lib/currency";
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

// Amounts on an invoice are already in the invoice's currency: no conversion.
function money(value: number | null | undefined, currencyCode: string) {
  if (value === null || value === undefined) return "--";
  return formatExactPrice(value, currencyCode) || "--";
}

export async function exportSalesInvoicePdf({
  details,
  lines,
  branding,
  currencyCode = "USD",
  asQuote = false,
}: {
  details: SalesInvoicePdfDetails;
  lines: SalesInvoicePdfLine[];
  branding: SalesInvoicePdfBranding;
  currencyCode?: string;
  /** A draft printed for a customer to approve, not a bill. Same document,
   * same lines and total; no paid/balance (nothing has been invoiced yet),
   * "Valid until" instead of "Due", and the header says Quote. Converting a
   * quote into the real invoice later needs no new record -- it already is
   * the draft; issuing it is what makes it one. */
  asQuote?: boolean;
}) {
  const currency = normalizeCurrencyCode(currencyCode);
  const header = {
    kind: asQuote ? "Quote" : "Invoice",
    number: details.invoiceNumber,
    meta: asQuote ? undefined : details.status.toUpperCase(),
  };
  const context = await openDocument(branding, header);
  const { doc, pageWidth, margin } = context;
  const images = await loadLineImages(lines.map((line) => line.imageUrl));

  // ---- who, to whom, and when -----------------------------------------
  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: asQuote ? "Quote for" : "Bill to",
      rows: [
        details.customerName || "Not set",
        ...(details.customerAddress ? details.customerAddress.split(/\r?\n/) : []),
        details.customerContact || "",
      ].filter(Boolean),
    },
    {
      heading: asQuote ? "Quote" : "Invoice",
      rows: [
        details.issueDate
          ? `${asQuote ? "Prepared" : "Issued"} ${formatDocumentDate(details.issueDate)}`
          : "Not issued yet",
        // On an invoice the due date sits under the amount owed instead.
        asQuote && details.dueDate ? `Valid until ${formatDocumentDate(details.dueDate)}` : "",
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
    // Line numbers: with thirty lines, "check line 23" on the phone needs one.
    head: [["#", "Item", "Qty", "Unit price", "Total"]],
    body: lines.map((line, index) => [
      String(index + 1),
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
      0: { halign: "right", cellWidth: 9, textColor: DOCUMENT_MUTED },
      1: { cellPadding: { left: THUMB_COLUMN_PADDING, top: 2.5, right: 2.5, bottom: 2.5 } },
      2: { halign: "right", cellWidth: 24 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 32 },
    },
    // A charge (delivery, service) has no photo and no placeholder either.
    didDrawCell: thumbnailCellHook(doc, (rowIndex) => {
      const line = lines[rowIndex];
      if (!line || line.isCharge) return undefined;
      return line.imageUrl ? images.get(line.imageUrl) ?? null : null;
    }, 1),
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawDocumentHeader(context, header);
    },
  });

  // ---- the numbers ------------------------------------------------------
  // A quote has not been invoiced yet: one figure, not three. Paid and
  // still-owed describe a bill, and printing them on a proposal reads as
  // one -- as if money were already due.
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const paid = Number(details.amountPaid || 0);
  const balance = Math.max(total - paid, 0);

  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    cursorY;

  // Everything after the table -- totals, the due line, payment terms, notes,
  // the two signature lines -- is one closing block, and it moves as one.
  // Measured before anything is drawn: a 39-line invoice used to put the
  // totals at the foot of page 3 and the terms and signatures alone on page
  // 4. If the block does not fit under the table, the whole of it starts the
  // next page, so the amount owed and where to sign are never on different
  // sheets. Each piece still calls ensureRoom on its own as a safety net for
  // a notes field longer than a page.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const bodyWidth = pageWidth - margin * 2;
  const termsLines = !asQuote && branding.paymentTerms
    ? (doc.splitTextToSize(branding.paymentTerms, bodyWidth) as string[]).length
    : 0;
  const noteText = [
    details.notes?.trim(),
    asQuote && branding.paymentTerms ? `Payment terms: ${branding.paymentTerms}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const noteLines = noteText
    ? (doc.splitTextToSize(noteText, bodyWidth) as string[]).length
    : 0;
  const tailHeight =
    (asQuote ? 8 : 6 + 6 + 8 + 4) + // totals rows and the due line
    (termsLines ? 5 + termsLines * 4.2 + 6 : 0) +
    (noteLines ? 5 + noteLines * 4.2 + 6 : 0) +
    6 + 22 + 2; // signatures
  let totalsY = ensureRoom(context, header, tableEnd + 10, tailHeight);

  const totalsX = pageWidth - margin;
  const labelX = totalsX - 60;

  const rows: [string, string, boolean][] = asQuote
    ? [["Total", money(total, currency), true]]
    : [
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

  // The two things a customer reads on a bill are how much and by when. The
  // due date used to sit in the meta column at the top; it now sits under
  // the amount it applies to. A settled bill says so in the same place.
  if (!asQuote && total > 0) {
    const settled = balance <= 0;
    const line = settled
      ? "Paid in full"
      : details.dueDate
        ? `Due by ${formatDocumentDate(details.dueDate)}`
        : "";
    if (line) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DOCUMENT_MUTED);
      doc.text(line, totalsX, totalsY - 2, { align: "right" });
      totalsY += 4;
    }
  }

  // ---- how to pay ----------------------------------------------------------
  // Payment terms used to be a line inside Notes. On an invoice they are the
  // instruction, not a remark, and get their own block -- the same size and
  // weight as the rest of the document, not the 7.5pt footer.
  let sectionY = totalsY + 2;

  if (!asQuote && branding.paymentTerms) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(branding.paymentTerms, pageWidth - margin * 2) as string[];
    let termsY = ensureRoom(context, header, sectionY, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("PAYMENT TERMS", margin, termsY);
    termsY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, termsY);
    sectionY = termsY + text.length * 4.2 + 6;
  }

  // ---- notes ------------------------------------------------------------
  const notes = [
    details.notes?.trim(),
    // A quote keeps its terms with the notes: "valid until" is the only
    // date that matters on a proposal, and it is already in the header.
    asQuote && branding.paymentTerms ? `Payment terms: ${branding.paymentTerms}` : "",
  ].filter(Boolean) as string[];

  let signatureY = sectionY;

  if (notes.length > 0) {
    // Split at the size it will print in; the totals left the font at 12pt.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(notes.join("\n"), pageWidth - margin * 2) as string[];
    let notesY = ensureRoom(context, header, sectionY, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("NOTES", margin, notesY);
    notesY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, notesY);
    signatureY = notesY + text.length * 4.2 + 6;
  }

  // ---- two signature lines: who made it out, who took it -----------------
  signatureY = ensureRoom(context, header, signatureY + 6, 22);
  const signatureWidth = (pageWidth - margin * 2 - 10) / 2;
  doc.setDrawColor(...DOCUMENT_RULE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  [
    ["Authorized by", margin],
    ["Customer signature", margin + signatureWidth + 10],
  ].forEach(([label, x]) => {
    doc.line(Number(x), signatureY + 12, Number(x) + signatureWidth, signatureY + 12);
    doc.text(String(label), Number(x), signatureY + 17);
  });

  finishDocument(context, details.invoiceNumber);
  doc.save(`${slugifyDocumentName(details.invoiceNumber, asQuote ? "quote" : "invoice")}.pdf`);
}

// Kept for callers that measured against the old constant.
export { DOCUMENT_HEADER_HEIGHT as INVOICE_HEADER_HEIGHT };
