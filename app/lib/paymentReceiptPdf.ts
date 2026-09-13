import {
  DOCUMENT_FILL,
  DOCUMENT_INK,
  DOCUMENT_MUTED,
  DOCUMENT_RULE,
  drawColumns,
  ensureRoom,
  finishDocument,
  formatDocumentDate,
  fromColumn,
  openDocument,
  slugifyDocumentName,
  type DocumentBranding,
} from "@/app/lib/documentPdf";
import { formatExactPrice } from "@/app/lib/currency";

/**
 * One payment, on paper: what a customer or supplier hands over when they
 * pay in person, and the invoice or order it goes against (brief point 14).
 * Every number is the document's own currency -- a receipt never converts.
 */
export interface PaymentReceiptDetails {
  receiptNumber: string;
  documentKind: "Invoice" | "Purchase order";
  documentNumber: string;
  partyLabel: "Customer" | "Supplier";
  partyName: string;
  partyContact?: string;
  paidAt: string;
  amount: number;
  currency: string;
  method?: string | null;
  note?: string | null;
  documentTotal: number;
  balanceAfter: number;
}

export async function exportPaymentReceiptPdf({
  details,
  branding,
}: {
  details: PaymentReceiptDetails;
  branding: DocumentBranding;
}) {
  const header = {
    kind: "Payment Receipt",
    number: details.receiptNumber,
    meta: formatDocumentDate(details.paidAt),
  };
  const context = await openDocument(branding, header);
  const { doc, pageWidth, margin } = context;

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: details.partyLabel,
      rows: [details.partyName, details.partyContact || ""].filter(Boolean),
    },
    {
      heading: "Against",
      rows: [
        `${details.documentKind} ${details.documentNumber}`,
        `Paid ${formatDocumentDate(details.paidAt)}`,
        details.method ? `By ${details.method}` : "",
      ].filter(Boolean),
    },
  ]);

  // The amount is the point of a receipt, so it gets its own plate, not a
  // table row -- one figure, large, with the document's before/after either
  // side of it for the paper trail.
  let y = ensureRoom(context, header, cursorY + 6, 34);
  const boxHeight = 30;
  doc.setDrawColor(...DOCUMENT_RULE);
  doc.setFillColor(...DOCUMENT_FILL);
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  doc.text("AMOUNT RECEIVED", margin + 8, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DOCUMENT_INK);
  doc.text(formatExactPrice(details.amount, details.currency) || "--", margin + 8, y + 23);

  const rightX = pageWidth - margin - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  doc.text(`${details.documentKind} total`, rightX, y + 10, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DOCUMENT_INK);
  doc.text(formatExactPrice(details.documentTotal, details.currency) || "--", rightX, y + 15.5, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  doc.text("Balance after this payment", rightX, y + 23, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(
    details.balanceAfter > 0 ? DOCUMENT_INK[0] : 22,
    details.balanceAfter > 0 ? DOCUMENT_INK[1] : 163,
    details.balanceAfter > 0 ? DOCUMENT_INK[2] : 74
  );
  doc.text(
    details.balanceAfter > 0
      ? formatExactPrice(details.balanceAfter, details.currency) || "--"
      : "Settled in full",
    rightX,
    y + 28.5,
    { align: "right" }
  );

  y += boxHeight + 10;

  if (details.note?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(details.note.trim(), pageWidth - margin * 2) as string[];
    y = ensureRoom(context, header, y, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("NOTE", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, y + 5);
    y += text.length * 4.2 + 10;
  }

  // One signature line: whoever took the payment, on the depot's copy.
  y = ensureRoom(context, header, y + 6, 20);
  doc.setDrawColor(...DOCUMENT_RULE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  const lineWidth = (pageWidth - margin * 2) / 2 - 5;
  doc.line(margin, y + 12, margin + lineWidth, y + 12);
  doc.text("Received by", margin, y + 17);

  finishDocument(context, details.receiptNumber);
  doc.save(`${slugifyDocumentName(details.receiptNumber, "payment-receipt")}.pdf`);
}
