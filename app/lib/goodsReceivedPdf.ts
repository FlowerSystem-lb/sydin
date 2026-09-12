import autoTable from "jspdf-autotable";
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
 * The goods-received note: what arrived on ONE delivery against an order.
 * The paper the driver signs and the depot keeps. No prices -- the order and
 * the invoice carry money; this carries counts.
 */

export interface GoodsReceivedLine {
  name: string;
  code?: string;
  unit?: string;
  imageUrl?: string | null;
  ordered: number;
  /** Received on this delivery. */
  receivedNow: number;
  /** Received across all deliveries, including this one. */
  receivedTotal: number;
}

export interface GoodsReceivedDetails {
  receiptNumber: string;
  poNumber: string;
  receivedAt: string;
  supplierName?: string;
  supplierContact?: string;
  depotName?: string;
  notes?: string;
  /** How the order stands after this delivery. */
  orderStatus: string;
}

function formatUnits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export async function exportGoodsReceivedPdf({
  details,
  lines,
  branding,
}: {
  details: GoodsReceivedDetails;
  lines: GoodsReceivedLine[];
  branding: DocumentBranding;
}) {
  const header = {
    kind: "Goods Received",
    number: details.receiptNumber,
    meta: formatDocumentDate(details.receivedAt),
  };
  const context = await openDocument(branding, header);
  const { doc, pageWidth, margin } = context;
  const received = lines.filter((line) => line.receivedNow > 0);
  const images = await loadLineImages(received.map((line) => line.imageUrl));

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: "Supplier",
      rows: [details.supplierName || "Not set", details.supplierContact || ""].filter(Boolean),
    },
    {
      heading: "Delivery",
      rows: [
        `Against order ${details.poNumber}`,
        `Received ${formatDocumentDate(details.receivedAt)}`,
        `Into ${details.depotName || "main depot"}`,
        `Order now: ${details.orderStatus}`,
      ],
    },
  ]);

  autoTable(doc, {
    startY: cursorY,
    margin: {
      left: margin,
      right: margin,
      top: context.contentTop,
      bottom: context.pageHeight - context.contentBottom,
    },
    head: [["Item", "Unit", "Ordered", "This delivery", "Received so far", "Still to come"]],
    body: received.map((line) => [
      [line.name, line.code].filter(Boolean).join("\n"),
      line.unit || "unit",
      formatUnits(line.ordered),
      formatUnits(line.receivedNow),
      formatUnits(line.receivedTotal),
      formatUnits(Math.max(0, line.ordered - line.receivedTotal)),
    ]),
    foot: [
      [
        {
          content: `${formatUnits(received.reduce((sum, line) => sum + line.receivedNow, 0))} units on this delivery`,
          colSpan: 6,
          styles: { halign: "left", fontStyle: "normal", textColor: DOCUMENT_MUTED },
        },
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
    headStyles: { fillColor: [238, 242, 248], textColor: [70, 80, 95], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: DOCUMENT_INK },
    alternateRowStyles: { fillColor: DOCUMENT_FILL },
    columnStyles: {
      0: { cellPadding: { left: THUMB_COLUMN_PADDING, top: 2.4, right: 2.4, bottom: 2.4 } },
      1: { cellWidth: 18 },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 26, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
    didDrawCell: thumbnailCellHook(doc, (rowIndex) => {
      const line = received[rowIndex];
      if (!line) return undefined;
      return line.imageUrl ? images.get(line.imageUrl) ?? null : null;
    }),
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawDocumentHeader(context, header);
    },
  });

  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    cursorY;
  let y = tableEnd + 8;

  if (details.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const text = doc.splitTextToSize(details.notes.trim(), pageWidth - margin * 2) as string[];
    y = ensureRoom(context, header, y, text.length * 4.2 + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("DELIVERY NOTE", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    doc.text(text, margin, y + 5);
    y += text.length * 4.2 + 10;
  }

  // Two signature lines: the one who delivered, the one who counted.
  y = ensureRoom(context, header, y + 6, 22);
  const half = (pageWidth - margin * 2 - 10) / 2;
  doc.setDrawColor(...DOCUMENT_RULE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DOCUMENT_MUTED);
  [["Delivered by", margin], ["Received and counted by", margin + half + 10]].forEach(
    ([label, x]) => {
      doc.line(Number(x), y + 12, Number(x) + half, y + 12);
      doc.text(String(label), Number(x), y + 17);
    }
  );

  finishDocument(context, details.receiptNumber);
  doc.save(`${slugifyDocumentName(details.receiptNumber, "goods-received")}.pdf`);
}
