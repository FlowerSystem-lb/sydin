import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatInventoryPrice,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";
import {
  getContainedImageSize,
  loadExportImage,
} from "@/app/lib/exportImage";

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
 * What IS shared is shared: image loading, contained sizing, money formatting
 * and currency normalisation all come from the same helpers the other exports
 * use. The drawing that repeats is the page furniture, which is deliberate --
 * the two documents should look like they came from the same business.
 *
 * The balance is the reason this exists at all. A customer disputing what they
 * owe is settled by a piece of paper that says what was bought, what was paid,
 * and what is left -- so those three sit together at the bottom, not scattered.
 */

export interface SalesInvoicePdfLine {
  name: string;
  code?: string;
  unit?: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  isCharge?: boolean;
}

export interface SalesInvoicePdfDetails {
  invoiceNumber: string;
  customerName?: string;
  customerContact?: string;
  depotName?: string;
  issueDate?: string;
  dueDate?: string;
  status: string;
  paymentStatus?: string;
  amountPaid?: number | null;
  notes?: string;
}

export interface SalesInvoicePdfBranding {
  businessName: string;
  businessLogoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const HEADER_HEIGHT = 36;

function formatDateOnly(value?: string) {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(parsed);
}

function slugifyFilename(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "invoice"
  );
}

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
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 14;

  const logo = branding.businessLogoUrl
    ? await loadExportImage(branding.businessLogoUrl)
    : null;

  // ---- header ----------------------------------------------------------
  document.setFillColor(11, 18, 32);
  document.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");

  let textX = margin;

  if (logo) {
    const size = getContainedImageSize(logo.width, logo.height, 22, 22);
    // A white plate behind it, so a dark or transparent logo stays legible on
    // the dark bar rather than disappearing into it.
    document.setFillColor(255, 255, 255);
    document.roundedRect(margin, 7, 24, 24, 4, 4, "F");
    document.addImage(
      logo.dataUrl,
      logo.extension === "png" ? "PNG" : "JPEG",
      margin + (24 - size.width) / 2,
      7 + (24 - size.height) / 2,
      size.width,
      size.height
    );
    textX = margin + 30;
  }

  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(15);
  document.text(branding.businessName || "SydIN", textX, 15);

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text("Invoice", textX, 22);

  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  document.text(details.invoiceNumber, pageWidth - margin, 15, { align: "right" });

  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(
    details.status.toUpperCase(),
    pageWidth - margin,
    22,
    { align: "right" }
  );

  // ---- who and when ----------------------------------------------------
  let cursorY = HEADER_HEIGHT + 12;
  const columnWidth = (pageWidth - margin * 2 - 8) / 2;

  const columns: { heading: string; rows: string[] }[] = [
    {
      heading: "Billed to",
      rows: [
        details.customerName || "Not set",
        details.customerContact || "",
      ].filter(Boolean),
    },
    {
      heading: "Invoice",
      rows: [
        `Issued: ${formatDateOnly(details.issueDate)}`,
        details.dueDate ? `Due: ${formatDateOnly(details.dueDate)}` : "",
        details.depotName ? `Depot: ${details.depotName}` : "",
      ].filter(Boolean),
    },
  ];

  columns.forEach((column, index) => {
    const x = margin + index * (columnWidth + 8);

    document.setTextColor(120, 130, 145);
    document.setFont("helvetica", "bold");
    document.setFontSize(8);
    document.text(column.heading.toUpperCase(), x, cursorY);

    document.setTextColor(20, 28, 42);
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    column.rows.forEach((row, rowIndex) => {
      document.text(row, x, cursorY + 6 + rowIndex * 5, {
        maxWidth: columnWidth,
      });
    });
  });

  cursorY += 12 + Math.max(...columns.map((c) => c.rows.length)) * 5;

  // ---- what was sold ---------------------------------------------------
  autoTable(document, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [["Item", "Qty", "Unit price", "Total"]],
    body: lines.map((line) => [
      [line.name, line.code].filter(Boolean).join("\n"),
      `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`,
      money(line.unitPrice, currency),
      money(line.lineTotal, currency),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: [20, 28, 42] },
    headStyles: { fillColor: [238, 242, 248], textColor: [70, 80, 95] },
    columnStyles: {
      1: { halign: "right", cellWidth: 24 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
    },
  });

  // ---- the three numbers that settle an argument -----------------------
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const paid = Number(details.amountPaid || 0);
  const balance = Math.max(total - paid, 0);

  const tableEnd =
    (document as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY ?? cursorY;
  let totalsY = tableEnd + 10;

  const totalsX = pageWidth - margin;
  const labelX = totalsX - 55;

  const rows: [string, string, boolean][] = [
    ["Total", money(total, currency), false],
    ["Paid", money(paid, currency), false],
    ["Still owed", money(balance, currency), true],
  ];

  rows.forEach(([label, value, emphasise]) => {
    document.setFont("helvetica", emphasise ? "bold" : "normal");
    document.setFontSize(emphasise ? 12 : 10);
    document.setTextColor(emphasise ? 11 : 90, emphasise ? 18 : 100, emphasise ? 32 : 115);
    document.text(label, labelX, totalsY);
    document.text(value, totalsX, totalsY, { align: "right" });
    totalsY += emphasise ? 8 : 6;
  });

  if (details.notes) {
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.setTextColor(90, 100, 115);
    document.text(details.notes, margin, totalsY + 4, {
      maxWidth: pageWidth - margin * 2,
    });
  }

  // ---- footer ----------------------------------------------------------
  const pageHeight = document.internal.pageSize.getHeight();
  const contact = [branding.contactPhone, branding.contactEmail]
    .filter(Boolean)
    .join("  ·  ");

  document.setDrawColor(220, 226, 236);
  document.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.setTextColor(130, 140, 155);
  if (contact) document.text(contact, margin, pageHeight - 10);
  document.text(
    `${branding.businessName || "SydIN"} · ${details.invoiceNumber}`,
    pageWidth - margin,
    pageHeight - 10,
    { align: "right" }
  );

  document.save(`${slugifyFilename(details.invoiceNumber)}.pdf`);
}
