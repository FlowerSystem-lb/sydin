import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCodeImpl from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { formatExactPrice } from "@/app/lib/currency";
import { getContainedImageSize, loadExportImage } from "@/app/lib/exportImage";
import {
  formatDocumentDate,
  loadLineImages,
  shrinkForThumbnail,
  slugifyDocumentName,
  type DocumentBranding,
} from "@/app/lib/documentPdf";

/**
 * The purchase order a supplier receives (layout of 9 Oct 2026, Sayed's
 * PO-PDF sample). White header with a thin brand bar instead of the old dark
 * band, which wasted printer ink; a meta strip; supplier and deliver-to
 * boxes; the lines with what has arrived; notes and terms beside the totals
 * and the balance due; three signature lines; and on every page a footer
 * with a QR to the order. Rows never split across pages, the table header
 * repeats, and the totals + signatures move to the next page together when
 * they do not fit.
 *
 * Word shares the same `details` / `lines` description (documentDocxExports).
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
  /** A general purchase (not stock): prints "—" for the unit. */
  isGeneral?: boolean;
}

export interface PurchaseOrderPdfPayment {
  amount: number;
  paidAt?: string | null;
  method?: string | null;
}

export interface PurchaseOrderPdfDetails {
  poNumber: string;
  title?: string;
  supplierName: string;
  /** Older single line ("ali | 76075247"); used when the parts below are missing. */
  supplierContact?: string;
  supplierContactName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  depotName?: string;
  depotAddress?: string;
  depotPhone?: string;
  purchaseDate?: string;
  expectedDeliveryDate?: string;
  /** Label, e.g. "Received". */
  status: string;
  /** draft | ordered | partially_received | received | cancelled */
  statusKey?: string;
  paymentMethod?: string;
  paidBy?: string;
  /** Label, e.g. "Paid". */
  paymentStatus?: string;
  /** unpaid | partial | paid */
  paymentStatusKey?: string;
  paymentTermsLabel?: string;
  amountPaid?: number | null;
  payments?: PurchaseOrderPdfPayment[];
  discount?: number;
  deliveryFee?: number;
  notes?: string;
  internalReference?: string;
  /** Printed under Notes; a sensible default when not set. */
  terms?: string;
  preparedBy?: string;
  /** Where the footer QR points. */
  qrUrl?: string;
}

export type PurchaseOrderPdfBranding = DocumentBranding;

export interface ExportPurchaseOrderPdfOptions {
  details: PurchaseOrderPdfDetails;
  lines: PurchaseOrderPdfLine[];
  branding: PurchaseOrderPdfBranding;
  currencyCode?: string;
}

const DEFAULT_TERMS =
  "Please quote the PO number on your delivery note and invoice. Goods are checked on arrival; quantities that don't match will be noted on receipt.";

type RGB = [number, number, number];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [100, 112, 133];
const SUBTLE: RGB = [148, 158, 176];
const RULE: RGB = [226, 231, 239];
const PANEL: RGB = [244, 246, 250];
const PRIMARY: RGB = [36, 71, 214];
const GREEN: RGB = [15, 122, 79];
const GREEN_FILL: RGB = [22, 163, 74];
const GREEN_TINT: RGB = [236, 253, 243];
const RED: RGB = [196, 43, 28];
const RED_TINT: RGB = [254, 242, 240];

const PAGE_MARGIN = 15;
const FOOTER_TOP_OFFSET = 30; // footer block starts this far from the bottom edge
const CONT_TOP = 22; // first y on continuation pages

/** WinAnsi only: the standard PDF fonts cannot draw these characters. */
function t(value: string | null | undefined) {
  return (value || "")
    .replace(/−/g, "-")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[  ]/g, " ");
}

function money(value: number | null | undefined, currency: string) {
  return value === null || value === undefined ? "--" : t(formatExactPrice(value, currency) || "--");
}

function units(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDateForFilename(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

/** Letter-spaced small caps label, the way the sample prints them. */
function label(doc: jsPDF, text: string, x: number, y: number, options: { align?: "right" } = {}) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setCharSpace(0.35);
  doc.text(text.toUpperCase(), x, y, options);
  doc.setCharSpace(0);
}

function drawQr(doc: jsPDF, value: string, x: number, y: number, size: number) {
  try {
    const qr = new QRCodeImpl(-1, ErrorCorrectLevel.M);
    qr.addData(value);
    qr.make();
    const count: number = qr.getModuleCount();
    const cell = size / count;
    doc.setFillColor(...INK);
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) doc.rect(x + col * cell, y + row * cell, cell + 0.01, cell + 0.01, "F");
      }
    }
  } catch {
    // A link too long for a QR: the footer still prints the text.
  }
}

/** A drawn tick, since the standard fonts have no ✓. */
function tick(doc: jsPDF, x: number, y: number, color: RGB) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.45);
  doc.line(x, y - 1, x + 0.9, y);
  doc.line(x + 0.9, y, x + 2.6, y - 2.2);
  doc.setLineWidth(0.2);
}

function badge(doc: jsPDF, text: string, rightX: number, y: number, style: "outline" | "fill", color: RGB, fill?: RGB) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setCharSpace(0.3);
  const width = doc.getTextWidth(text) + 7;
  const x = rightX - width;
  if (style === "fill") {
    doc.setFillColor(...(fill || color));
    doc.roundedRect(x, y, width, 6, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, 6, 3, 3, "FD");
    doc.setLineWidth(0.2);
    doc.setTextColor(...color);
  }
  doc.text(text, x + 3.5, y + 4.15);
  doc.setCharSpace(0);
  return x;
}

export async function exportPurchaseOrderPdf({
  details,
  lines,
  branding,
  currencyCode,
}: ExportPurchaseOrderPdfOptions) {
  const currency = normalizeCurrencyCode(currencyCode, "USD");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = PAGE_MARGIN;
  const right = pageWidth - PAGE_MARGIN;
  const contentWidth = right - left;
  const contentBottom = pageHeight - FOOTER_TOP_OFFSET - 4;
  const generatedAt = new Date();

  const orderedLines = lines.filter((line) => line.orderQuantity > 0);
  const [images, logo] = await Promise.all([
    loadLineImages(orderedLines.map((line) => line.imageUrl)),
    branding.businessLogoUrl
      ? loadExportImage(branding.businessLogoUrl).then((image) => (image ? shrinkForThumbnail(image, 512) : null))
      : Promise.resolve(null),
  ]);

  const subtotal = orderedLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  const discount = Number(details.discount || 0);
  const delivery = Number(details.deliveryFee || 0);
  const total = Math.max(0, subtotal - discount + delivery);
  const payments = (details.payments || []).filter((payment) => Number(payment.amount) > 0);
  const paid = payments.length
    ? payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    : Number(details.amountPaid || 0);
  const balance = Math.max(0, total - paid);
  const orderedQty = orderedLines.reduce((sum, line) => sum + line.orderQuantity, 0);
  const receivedQty = orderedLines.reduce((sum, line) => sum + Math.min(line.receivedQuantity || 0, line.orderQuantity), 0);

  // ---- brand bar (every page, drawn again for continuation pages) ----------
  const drawBar = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 1.8, "F");
  };
  drawBar();

  // ---- header ----------------------------------------------------------------
  const headerTop = 13;
  const logoSize = 20;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(left, headerTop, logoSize, logoSize, 3, 3, "FD");
  doc.setLineWidth(0.2);
  if (logo) {
    const size = getContainedImageSize(logo.width, logo.height, logoSize - 4, logoSize - 4);
    doc.addImage(
      logo.dataUrl,
      logo.extension === "png" ? "PNG" : "JPEG",
      left + (logoSize - size.width) / 2,
      headerTop + (logoSize - size.height) / 2,
      size.width,
      size.height
    );
  } else {
    const initials = t(branding.businessName)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PRIMARY);
    doc.text(initials || "S", left + logoSize / 2, headerTop + logoSize / 2 + 2, { align: "center" });
  }

  const nameX = left + logoSize + 6;
  const nameRoom = contentWidth - logoSize - 6 - 75;
  doc.setFont("helvetica", "bold");
  let nameSize = 16;
  doc.setFontSize(nameSize);
  doc.setTextColor(...INK);
  while (doc.getTextWidth(t(branding.businessName)) > nameRoom && nameSize > 11) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  doc.text(t(branding.businessName), nameX, headerTop + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const contactLines = [
    branding.taxId ? `Tax / Reg. ${branding.taxId}` : branding.address?.split(/\r?\n/)[0] || "",
    [branding.phone, branding.email].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
  contactLines.forEach((line, index) => {
    doc.text(t(line), nameX, headerTop + 12 + index * 4.6, { maxWidth: nameRoom });
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...INK);
  doc.text("Purchase order", right, headerTop + 7, { align: "right" });
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(t(details.poNumber), right, headerTop + 13.5, { align: "right" });

  // Status badges: stage outlined, payment filled.
  const stageKey = details.statusKey || "";
  const payKey = details.paymentStatusKey || "";
  let badgeRight = right;
  if (stageKey === "cancelled") {
    badge(doc, "CANCELLED", badgeRight, headerTop + 16, "fill", RED);
  } else {
    const payBadge =
      payKey === "paid"
        ? { text: "PAID", color: GREEN_FILL }
        : payKey === "partial"
          ? { text: "PART PAID", color: [181, 71, 8] as RGB }
          : stageKey === "draft"
            ? null
            : { text: "UNPAID", color: RED };
    if (payBadge) badgeRight = badge(doc, payBadge.text, badgeRight, headerTop + 16, "fill", payBadge.color) - 2;
    const stage =
      stageKey === "received"
        ? { text: "RECEIVED", color: GREEN }
        : stageKey === "partially_received"
          ? { text: "PART RECEIVED", color: [181, 71, 8] as RGB }
          : stageKey === "ordered"
            ? { text: "ORDERED", color: PRIMARY }
            : { text: "DRAFT", color: MUTED };
    badge(doc, stage.text, badgeRight, headerTop + 16, "outline", stage.color);
  }

  // ---- meta strip ----------------------------------------------------------
  let y = headerTop + logoSize + 10;
  const stripHeight = 15;
  const cells = [
    ["Order date", formatDocumentDate(details.purchaseDate)],
    ["Expected", details.expectedDeliveryDate ? formatDocumentDate(details.expectedDeliveryDate) : "Not set"],
    ["Payment terms", details.paymentTermsLabel || details.paymentMethod || "Not set"],
    ["Reference", details.internalReference || details.title || "—"],
  ];
  const cellWidth = contentWidth / cells.length;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.roundedRect(left, y, contentWidth, stripHeight, 2.5, 2.5, "S");
  cells.forEach(([name, value], index) => {
    const x = left + index * cellWidth;
    if (index > 0) doc.line(x, y, x, y + stripHeight);
    label(doc, name, x + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const muted = value === "Not set" || value === "—";
    doc.setTextColor(...(muted ? MUTED : INK));
    doc.text(t(value), x + 4, y + 11.2, { maxWidth: cellWidth - 7 });
  });
  doc.setLineWidth(0.2);

  // ---- supplier + deliver to ------------------------------------------------
  y += stripHeight + 6;
  const boxGap = 6;
  const boxWidth = (contentWidth - boxGap) / 2;
  const legacyContact = (details.supplierContact || "").split("|").map((part) => part.trim()).filter(Boolean);
  const supplierRows = [
    details.supplierContactName ? `Contact: ${details.supplierContactName}` : "",
    details.supplierPhone ? `Phone: ${details.supplierPhone}` : "",
    details.supplierEmail || "",
    details.supplierAddress || "",
  ].filter(Boolean);
  if (supplierRows.length === 0) supplierRows.push(...legacyContact);
  const depotRows = [details.depotAddress || "", details.depotPhone ? `Phone: ${details.depotPhone}` : ""].filter(Boolean);
  const boxBody = (rows: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    return rows.reduce((sum, row) => sum + (doc.splitTextToSize(t(row), boxWidth - 12) as string[]).length * 4.6, 0);
  };
  const boxHeight = Math.max(30, 19 + Math.max(boxBody(supplierRows), boxBody(depotRows)) + 4);
  const drawBox = (x: number, heading: string, title: string, rows: string[]) => {
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
    let rowY = y + 19.5;
    rows.forEach((row) => {
      const wrapped = doc.splitTextToSize(t(row), boxWidth - 12) as string[];
      doc.text(wrapped, x + 6, rowY);
      rowY += wrapped.length * 4.6;
    });
  };
  drawBox(left, "Supplier", details.supplierName || "Not set", supplierRows);
  drawBox(
    left + boxWidth + boxGap,
    "Deliver to",
    details.depotName ? `${branding.businessName} — ${details.depotName}` : branding.businessName,
    depotRows
  );
  y += boxHeight + 8;

  // ---- items table -----------------------------------------------------------
  const ITEM_PAD = 13; // room for the thumb in the item cell
  // The item column is what is left after the fixed columns (see columnStyles).
  const itemTextWidth = contentWidth - (8 + 20 + 20 + 22 + 25 + 26) - ITEM_PAD - 1.5;
  const itemRowHeight = (line: PurchaseOrderPdfLine) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const nameLines = (doc.splitTextToSize(t(line.name), itemTextWidth) as string[]).length;
    const hasCode = Boolean(line.code || line.sku || line.isGeneral);
    return Math.max(13, nameLines * 4 + (hasCode ? 4 : 0) + 6.4);
  };
  autoTable(doc, {
    startY: y,
    margin: { left, right: PAGE_MARGIN, top: CONT_TOP, bottom: pageHeight - contentBottom },
    head: [["#", "Item", "Unit", "Ordered", "Received", "Unit cost", "Amount"]],
    body: orderedLines.map((line, index) => [
      String(index + 1),
      // Drawn in didDrawCell (thumb, name, code); the row is sized here.
      { content: "", styles: { minCellHeight: itemRowHeight(line) } },
      line.isGeneral ? "—" : t(line.unit || "Unit"),
      units(line.orderQuantity),
      "", // drawn: green with a tick when complete
      money(line.unitCost, currency),
      money(line.lineTotal, currency),
    ]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3.2, bottom: 3.2, left: 1.5, right: 1.5 },
      valign: "middle",
      minCellHeight: 13,
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 7,
      textColor: MUTED,
      minCellHeight: 8,
      cellPadding: { top: 2, bottom: 2.6, left: 1.5, right: 1.5 },
    },
    columnStyles: {
      0: { cellWidth: 8, textColor: SUBTLE },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20 },
      3: { cellWidth: 20, halign: "right", font: "courier" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 25, halign: "right", font: "courier" },
      6: { cellWidth: 26, halign: "right", font: "courier", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.text = data.cell.text.map((value) => value.toUpperCase());
        if (data.column.index >= 3) data.cell.styles.halign = "right";
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
      const line = orderedLines[data.row.index];
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
        const room = cell.width - ITEM_PAD - 1.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        const name = doc.splitTextToSize(t(line.name), room) as string[];
        const code = line.code || line.sku || (line.isGeneral ? line.category || "General purchase" : "");
        const blockHeight = name.length * 4 + (code ? 4 : 0);
        const nameY = cell.y + (cell.height - blockHeight) / 2 + 3.1;
        doc.text(name, textX, nameY);
        if (code) {
          doc.setFont(line.isGeneral ? "helvetica" : "courier", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(t(code), textX, nameY + name.length * 4);
        }
      }
      if (data.column.index === 4) {
        const received = Math.min(line.receivedQuantity || 0, line.orderQuantity);
        const complete = received >= line.orderQuantity && line.orderQuantity > 0;
        const textY = cell.y + cell.height / 2 + 1.3;
        doc.setFont("courier", complete ? "bold" : "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...(complete ? GREEN : received > 0 ? INK : SUBTLE));
        const valueRight = cell.x + cell.width - 1.5 - (complete ? 4 : 0);
        doc.text(units(received), valueRight, textY, { align: "right" });
        if (complete) tick(doc, valueRight + 1.2, textY - 0.2, GREEN);
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawBar();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(t(branding.businessName), left, 12);
        doc.setFont("courier", "bold");
        doc.text(`Purchase order ${t(details.poNumber)}`, right, 12, { align: "right" });
      }
    },
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `${orderedLines.length} ${orderedLines.length === 1 ? "line" : "lines"}  ·  ${units(orderedQty)} units ordered  ·  ${units(receivedQty)} received`,
    left,
    y
  );
  y += 9;

  // ---- notes / terms + totals, then signatures: kept together -------------
  const notesWidth = contentWidth * 0.52;
  const totalsX = left + contentWidth * 0.6;
  const totalsWidth = right - totalsX;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const notesText = details.notes?.trim() ? (doc.splitTextToSize(t(details.notes.trim()), notesWidth) as string[]) : [];
  const termsText = doc.splitTextToSize(t(details.terms?.trim() || DEFAULT_TERMS), notesWidth) as string[];
  const notesHeight = (notesText.length ? 6 + notesText.length * 4.8 + 6 : 0) + 6 + termsText.length * 4.8;
  const totalsHeight = 3 * 5.8 + 4 + 8 + payments.length * 6 + 4 + 13;
  const signaturesHeight = 30;
  const blockHeight = Math.max(notesHeight, totalsHeight) + signaturesHeight + 6;
  if (y + blockHeight > contentBottom) {
    doc.addPage();
    y = CONT_TOP + 4;
    drawBar();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(t(branding.businessName), left, 12);
    doc.setFont("courier", "bold");
    doc.text(`Purchase order ${t(details.poNumber)}`, right, 12, { align: "right" });
  }

  // Left: notes and terms.
  let noteY = y;
  if (notesText.length) {
    label(doc, "Notes", left, noteY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(notesText, left, noteY + 5.5);
    noteY += 6 + notesText.length * 4.8 + 6;
  }
  label(doc, "Terms", left, noteY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(termsText, left, noteY + 5.5, { lineHeightFactor: 1.45 });

  // Right: totals.
  let totalY = y;
  const totalRow = (name: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(name, totalsX, totalY);
    doc.setFont("courier", "normal");
    doc.setTextColor(...INK);
    doc.text(value, right, totalY, { align: "right" });
    totalY += 5.8;
  };
  totalRow("Subtotal", money(subtotal, currency));
  totalRow("Discount", discount > 0 ? `-${money(discount, currency)}` : money(0, currency));
  totalRow("Delivery", money(delivery, currency));
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(totalsX, totalY - 2.2, right, totalY - 2.2);
  doc.setLineWidth(0.2);
  totalY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Total", totalsX, totalY);
  doc.setFont("courier", "bold");
  doc.text(money(total, currency), right, totalY, { align: "right" });
  totalY += 6.5;
  payments.forEach((payment) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GREEN);
    doc.text(t(["Paid", shortDate(payment.paidAt), payment.method || ""].filter(Boolean).join(" · ")), totalsX, totalY);
    doc.setFont("courier", "normal");
    doc.text(`-${money(Number(payment.amount), currency)}`, right, totalY, { align: "right" });
    totalY += 6;
  });
  if (!payments.length && paid > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GREEN);
    doc.text("Paid", totalsX, totalY);
    doc.setFont("courier", "normal");
    doc.text(`-${money(paid, currency)}`, right, totalY, { align: "right" });
    totalY += 6;
  }
  totalY += 1;
  const settled = balance <= 0.004;
  doc.setFillColor(...(settled ? GREEN_TINT : RED_TINT));
  doc.roundedRect(totalsX, totalY, totalsWidth, 11, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(settled ? GREEN : RED));
  doc.text("Balance due", totalsX + 4.5, totalY + 7.1);
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(money(balance, currency), right - 4.5, totalY + 7.3, { align: "right" });
  totalY += 11;

  // Signatures.
  const signY = Math.max(noteY + 5.5 + termsText.length * 4.8, totalY) + 18;
  const signGap = 8;
  const signWidth = (contentWidth - signGap * 2) / 3;
  ["Prepared by", "Approved by", "Received by · date"].forEach((name, index) => {
    const x = left + index * (signWidth + signGap);
    if (index === 0 && details.preparedBy) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(t(details.preparedBy), x, signY - 2);
    }
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.35);
    doc.line(x, signY, x + signWidth, signY);
    doc.setLineWidth(0.2);
    label(doc, name, x, signY + 5);
  });

  // ---- footer on every page ----------------------------------------------
  const generated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(generatedAt);
  const pageCount = doc.getNumberOfPages();
  const footerTop = pageHeight - FOOTER_TOP_OFFSET;
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(left, footerTop, right, footerTop);
    doc.setLineWidth(0.2);
    const qrSize = 18;
    const qrY = footerTop + 4;
    let textX = left;
    if (details.qrUrl) {
      doc.setDrawColor(...RULE);
      doc.roundedRect(left, qrY, qrSize + 3, qrSize + 3, 1.5, 1.5, "S");
      drawQr(doc, details.qrUrl, left + 1.5, qrY + 1.5, qrSize);
      textX = left + qrSize + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Scan to open this order in SydIN", textX, qrY + 8);
      doc.setFont("courier", "normal");
      doc.text(t(details.qrUrl.replace(/^https?:\/\/(www\.)?/, "")), textX, qrY + 13, { maxWidth: contentWidth * 0.5 });
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`${t(details.poNumber)} · Page ${page} of ${pageCount}`, right, qrY + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${generated} with SydIN`, right, qrY + 13, { align: "right" });
  }

  const filename = `${slugifyDocumentName(branding.businessName, "sydin")}-${slugifyDocumentName(
    details.poNumber || "purchase-order",
    "purchase-order"
  )}-${formatDateForFilename(generatedAt)}.pdf`;
  doc.save(filename);
  return filename;
}
