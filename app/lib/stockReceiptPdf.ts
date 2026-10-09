import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getContainedImageSize, loadExportImage } from "@/app/lib/exportImage";
import { formatDocumentDate, loadLineImages, shrinkForThumbnail, slugifyDocumentName, type DocumentBranding } from "@/app/lib/documentPdf";
import {
  GREEN,
  INK,
  MUTED,
  PANEL,
  PRIMARY,
  RED,
  RULE,
  SUBTLE,
  badge,
  drawQr,
  label,
  money,
  t,
  tick,
  units,
} from "@/app/lib/purchaseOrderPdfExport";

/**
 * Goods received note (9 Oct 2026, Sayed's Stock in spec): the paper for one
 * receipt, in the same look as the new purchase order PDF -- white header
 * with the brand bar, a meta strip, from / into boxes, the lines with
 * Expected / Received / Damaged / Into stock, and "Delivered by / Received by"
 * signature lines. Rows never split; the header repeats; the footer and page
 * numbers are on every page.
 */

export interface StockReceiptPdfLine {
  name: string;
  code?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  expected?: number | null;
  received: number;
  damaged: number;
  unitCost?: number | null;
  batch?: string | null;
  expiryDate?: string | null;
}

export interface StockReceiptPdfDetails {
  reference: string;
  poReference?: string | null;
  poNumber?: string | null;
  sourceLabel: string;
  receivedAt: string;
  receivedBy?: string | null;
  supplierName?: string | null;
  supplierPhone?: string | null;
  depotName?: string | null;
  depotAddress?: string | null;
  deliveryNoteNo?: string | null;
  notes?: string | null;
  voided?: boolean;
  qrUrl?: string;
}

const PAGE_MARGIN = 15;
const FOOTER_TOP_OFFSET = 30;
const CONT_TOP = 22;

export async function exportStockReceiptPdf({
  details,
  lines,
  branding,
  currencyCode = "USD",
}: {
  details: StockReceiptPdfDetails;
  lines: StockReceiptPdfLine[];
  branding: DocumentBranding;
  currencyCode?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = PAGE_MARGIN;
  const right = pageWidth - PAGE_MARGIN;
  const contentWidth = right - left;
  const contentBottom = pageHeight - FOOTER_TOP_OFFSET - 4;
  const generatedAt = new Date();

  const [images, logo] = await Promise.all([
    loadLineImages(lines.map((line) => line.imageUrl)),
    branding.businessLogoUrl
      ? loadExportImage(branding.businessLogoUrl).then((image) => (image ? shrinkForThumbnail(image, 512) : null))
      : Promise.resolve(null),
  ]);

  const drawBar = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 1.8, "F");
  };
  const continuationHeader = () => {
    drawBar();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(t(branding.businessName), left, 12);
    doc.setFont("courier", "bold");
    doc.text(`Goods received ${t(details.reference)}`, right, 12, { align: "right" });
  };
  drawBar();

  // Header.
  const headerTop = 13;
  const logoSize = 20;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(left, headerTop, logoSize, logoSize, 3, 3, "FD");
  doc.setLineWidth(0.2);
  if (logo) {
    const size = getContainedImageSize(logo.width, logo.height, logoSize - 4, logoSize - 4);
    doc.addImage(logo.dataUrl, logo.extension === "png" ? "PNG" : "JPEG", left + (logoSize - size.width) / 2, headerTop + (logoSize - size.height) / 2, size.width, size.height);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PRIMARY);
    const initials = t(branding.businessName).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
    doc.text(initials || "S", left + logoSize / 2, headerTop + logoSize / 2 + 2, { align: "center" });
  }
  const nameX = left + logoSize + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(t(branding.businessName), nameX, headerTop + 6, { maxWidth: contentWidth - logoSize - 90 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  [branding.taxId ? `Tax / Reg. ${branding.taxId}` : branding.address?.split(/\r?\n/)[0] || "", [branding.phone, branding.email].filter(Boolean).join("  ·  ")]
    .filter(Boolean)
    .forEach((line, index) => doc.text(t(line), nameX, headerTop + 12 + index * 4.6));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text("Goods received note", right, headerTop + 7, { align: "right" });
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(t(details.reference), right, headerTop + 13.5, { align: "right" });
  if (details.voided) badge(doc, "VOIDED", right, headerTop + 16, "fill", RED);
  else badge(doc, "RECEIVED", right, headerTop + 16, "outline", GREEN);

  // Meta strip.
  let y = headerTop + logoSize + 10;
  const cells = [
    ["Received on", formatDocumentDate(details.receivedAt)],
    ["Source", details.sourceLabel],
    ["Purchase order", details.poReference || details.poNumber || "—"],
    ["Delivery note", details.deliveryNoteNo || "—"],
  ];
  const cellWidth = contentWidth / cells.length;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.roundedRect(left, y, contentWidth, 15, 2.5, 2.5, "S");
  cells.forEach(([name, value], index) => {
    const x = left + index * cellWidth;
    if (index > 0) doc.line(x, y, x, y + 15);
    label(doc, name, x + 4, y + 5.5);
    doc.setFont(index >= 2 ? "courier" : "helvetica", "bold");
    doc.setFontSize(index >= 2 ? (value.length > 16 ? 8 : 9.5) : 10);
    doc.setTextColor(...(value === "—" ? MUTED : INK));
    doc.text(t(value), x + 4, y + 11.2, { maxWidth: cellWidth - 7 });
  });
  doc.setLineWidth(0.2);
  y += 21;

  // From / Into.
  const boxGap = 6;
  const boxWidth = (contentWidth - boxGap) / 2;
  const boxHeight = 30;
  const box = (x: number, heading: string, title: string, rows: string[]) => {
    doc.setFillColor(...PANEL);
    doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3, "F");
    label(doc, heading, x + 6, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(t(title), x + 6, y + 13.5, { maxWidth: boxWidth - 12 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    rows.filter(Boolean).slice(0, 2).forEach((row, index) => doc.text(t(row), x + 6, y + 19.5 + index * 4.6, { maxWidth: boxWidth - 12 }));
  };
  box(left, "Delivered by", details.supplierName || details.sourceLabel, [details.supplierPhone ? `Phone: ${details.supplierPhone}` : ""]);
  box(left + boxWidth + boxGap, "Received into", details.depotName ? `${branding.businessName} — ${details.depotName}` : branding.businessName, [
    details.depotAddress || "",
    details.receivedBy ? `Received by ${details.receivedBy}` : "",
  ]);
  y += boxHeight + 8;

  // Lines.
  const ITEM_PAD = 13;
  autoTable(doc, {
    startY: y,
    margin: { left, right: PAGE_MARGIN, top: CONT_TOP, bottom: pageHeight - contentBottom },
    head: [["#", "Item", "Expected", "Received", "Damaged", "Into stock", "Unit cost"]],
    body: lines.map((line, index) => [
      String(index + 1),
      { content: "", styles: { minCellHeight: line.batch || line.expiryDate ? 16 : 13 } },
      line.expected === null || line.expected === undefined ? "—" : units(line.expected),
      units(line.received),
      line.damaged > 0 ? units(line.damaged) : "—",
      "",
      line.unitCost === null || line.unitCost === undefined ? "—" : money(line.unitCost, currencyCode),
    ]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, textColor: INK, cellPadding: { top: 3.2, bottom: 3.2, left: 1.5, right: 1.5 }, valign: "middle", minCellHeight: 13 },
    headStyles: { fontStyle: "bold", fontSize: 7, textColor: MUTED, minCellHeight: 8, cellPadding: { top: 2, bottom: 2.6, left: 1.5, right: 1.5 } },
    columnStyles: {
      0: { cellWidth: 8, textColor: SUBTLE },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "right", font: "courier" },
      3: { cellWidth: 20, halign: "right", font: "courier" },
      4: { cellWidth: 20, halign: "right", font: "courier", textColor: RED },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 24, halign: "right", font: "courier" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.text = data.cell.text.map((value) => value.toUpperCase());
        if (data.column.index >= 2) data.cell.styles.halign = "right";
      }
    },
    didDrawCell: (data) => {
      const { cell } = data;
      if (data.section === "head") {
        if (data.column.index === 0) {
          doc.setDrawColor(...INK);
          doc.setLineWidth(0.45);
          doc.line(left, cell.y + cell.height, right, cell.y + cell.height);
          doc.setLineWidth(0.2);
        }
        return;
      }
      if (data.section !== "body") return;
      const line = lines[data.row.index];
      if (!line) return;
      if (data.column.index === 0) {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.25);
        doc.line(left, cell.y + cell.height, right, cell.y + cell.height);
        doc.setLineWidth(0.2);
      }
      if (data.column.index === 1) {
        const thumb = 8;
        const tx = cell.x + 1.5;
        const ty = cell.y + (cell.height - thumb) / 2;
        const image = line.imageUrl ? images.get(line.imageUrl) : null;
        if (image) {
          const size = getContainedImageSize(image.width, image.height, thumb, thumb);
          doc.addImage(image.dataUrl, image.extension === "png" ? "PNG" : "JPEG", tx + (thumb - size.width) / 2, ty + (thumb - size.height) / 2, size.width, size.height);
        } else {
          doc.setFillColor(238, 242, 255);
          doc.roundedRect(tx, ty, thumb, thumb, 1.6, 1.6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...PRIMARY);
          doc.text(t(line.name).charAt(0).toUpperCase() || "?", tx + thumb / 2, ty + thumb / 2 + 1.2, { align: "center" });
        }
        const textX = cell.x + ITEM_PAD;
        const extra = [line.code, line.batch ? `Batch ${line.batch}` : "", line.expiryDate ? `Exp. ${line.expiryDate.slice(0, 10)}` : ""].filter(Boolean).join(" · ");
        const nameY = cell.y + cell.height / 2 - (extra ? 1 : -1.2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        doc.text(t(line.name), textX, nameY, { maxWidth: cell.width - ITEM_PAD - 2 });
        if (extra) {
          doc.setFont("courier", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(t(extra), textX, nameY + 4, { maxWidth: cell.width - ITEM_PAD - 2 });
        }
      }
      if (data.column.index === 5) {
        const good = Math.max(0, line.received - line.damaged);
        const complete = line.expected !== null && line.expected !== undefined && good >= line.expected && line.damaged === 0;
        const textY = cell.y + cell.height / 2 + 1.3;
        doc.setFont("courier", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...GREEN);
        const valueRight = cell.x + cell.width - 1.5 - (complete ? 4 : 0);
        doc.text(units(good), valueRight, textY, { align: "right" });
        if (complete) tick(doc, valueRight + 1.2, textY - 0.2, GREEN);
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) continuationHeader();
    },
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 5;
  const expected = lines.reduce((sum, line) => sum + Number(line.expected || 0), 0);
  const received = lines.reduce((sum, line) => sum + line.received, 0);
  const damaged = lines.reduce((sum, line) => sum + line.damaged, 0);
  const good = Math.max(0, received - damaged);
  const short = Math.max(0, expected - received);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    [`${lines.length} ${lines.length === 1 ? "line" : "lines"}`, expected ? `${units(expected)} expected` : "", `${units(received)} counted`, `${units(good)} into stock`, damaged ? `${units(damaged)} damaged` : "", short ? `${units(short)} short` : ""]
      .filter(Boolean)
      .join("  ·  "),
    left,
    y
  );
  y += 10;

  // Notes + signatures, kept together.
  doc.setFontSize(9.5);
  const notes = details.notes?.trim() ? (doc.splitTextToSize(t(details.notes.trim()), contentWidth) as string[]) : [];
  const blockHeight = (notes.length ? 8 + notes.length * 4.8 : 0) + 34;
  if (y + blockHeight > contentBottom) {
    doc.addPage();
    continuationHeader();
    y = CONT_TOP + 4;
  }
  if (notes.length) {
    label(doc, "Notes", left, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(notes, left, y + 5.5);
    y += 8 + notes.length * 4.8;
  }
  const signY = y + 18;
  const signGap = 10;
  const signWidth = (contentWidth - signGap) / 2;
  ["Delivered by", "Received by · date"].forEach((name, index) => {
    const x = left + index * (signWidth + signGap);
    if (index === 1 && details.receivedBy) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(t(details.receivedBy), x, signY - 2);
    }
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.35);
    doc.line(x, signY, x + signWidth, signY);
    doc.setLineWidth(0.2);
    label(doc, name, x, signY + 5);
  });

  // Footer on every page.
  const generated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(generatedAt);
  const pageCount = doc.getNumberOfPages();
  const footerTop = pageHeight - FOOTER_TOP_OFFSET;
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(left, footerTop, right, footerTop);
    doc.setLineWidth(0.2);
    const qrY = footerTop + 4;
    if (details.qrUrl) {
      doc.setDrawColor(...RULE);
      doc.roundedRect(left, qrY, 21, 21, 1.5, 1.5, "S");
      drawQr(doc, details.qrUrl, left + 1.5, qrY + 1.5, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(details.poNumber ? "Scan to open the purchase order in SydIN" : "Scan to open Stock in", left + 26, qrY + 8);
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`${t(details.reference)} · Page ${page} of ${pageCount}`, right, qrY + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${generated} with SydIN`, right, qrY + 13, { align: "right" });
  }

  const date = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, "0")}-${String(generatedAt.getDate()).padStart(2, "0")}`;
  const filename = `${slugifyDocumentName(branding.businessName, "sydin")}-${slugifyDocumentName(details.reference, "receipt")}-${date}.pdf`;
  doc.save(filename);
  return filename;
}
