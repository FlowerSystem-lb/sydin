import ExcelJS from "exceljs";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { getContainedImageSize, loadExportImage } from "@/app/lib/exportImage";

/**
 * The invoice's Excel twin of `salesInvoicePdf.ts` -- same branded banner
 * and line table shape as `purchaseOrderExcelExport.ts`, narrower (an
 * invoice line is name/code/unit/qty/price/total, no category or
 * stock-affecting flag) and closes the "PDF + Word + Excel for invoice/PO"
 * gap the redesign brief asked for -- PO already had all three, the
 * invoice only had PDF and Word.
 */
export interface SalesInvoiceExcelLine {
  name: string;
  code?: string;
  unit?: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  isCharge?: boolean;
}

export interface SalesInvoiceExcelDetails {
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

export interface SalesInvoiceExcelBranding {
  businessName: string;
  businessLogoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface ExportSalesInvoiceExcelOptions {
  details: SalesInvoiceExcelDetails;
  lines: SalesInvoiceExcelLine[];
  branding: SalesInvoiceExcelBranding;
  currencyCode?: string;
}

const TABLE_HEADERS = ["Item", "Code", "Unit", "Quantity", "Unit Price", "Line Total"];

function formatDateForDisplay(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "invoice"
  );
}

function styleCell(
  cell: ExcelJS.Cell,
  options: {
    bold?: boolean;
    color?: string;
    fill?: string;
    size?: number;
    align?: Partial<ExcelJS.Alignment>;
    noBorder?: boolean;
  } = {}
) {
  cell.font = {
    name: "Calibri",
    size: options.size || 11,
    bold: options.bold,
    color: { argb: options.color || "FF0F172A" },
  };
  cell.alignment = { vertical: "middle", wrapText: true, ...options.align };

  if (options.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options.fill },
    };
  }

  // The dark banner must stay a clean solid block, so it opts out of borders.
  if (!options.noBorder) {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  }
}

function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function exportSalesInvoiceExcel({
  details,
  lines,
  branding,
  currencyCode,
}: ExportSalesInvoiceExcelOptions) {
  const generatedAt = new Date();
  const businessName = branding.businessName.trim() || "SydIN Account";
  const currency = normalizeCurrencyCode(currencyCode, "USD");
  const currencyFormat = `"${currency}" #,##0.00`;
  const invoiceTotal = lines.reduce((total, line) => total + Number(line.lineTotal || 0), 0);
  const logo = branding.businessLogoUrl ? await loadExportImage(branding.businessLogoUrl) : null;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Invoice");
  const tableHeaderRow = 11;

  workbook.creator = "SydIN";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  worksheet.columns = [
    { key: "name", width: 34 },
    { key: "code", width: 16 },
    { key: "unit", width: 12 },
    { key: "quantity", width: 12 },
    { key: "unitPrice", width: 18 },
    { key: "lineTotal", width: 18 },
  ];

  // Dark branded banner (rows 1-3), a cyan accent divider (row 4), then a thin
  // white spacer (row 5). Banner cells carry NO borders so it reads as one
  // clean solid block instead of a grid of white lines.
  worksheet.getRow(1).height = 38;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 5;
  worksheet.getRow(5).height = 6;
  for (let rowIndex = 1; rowIndex <= 3; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let columnIndex = 1; columnIndex <= TABLE_HEADERS.length; columnIndex += 1) {
      row.getCell(columnIndex).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF080B18" },
      };
    }
  }
  for (let columnIndex = 1; columnIndex <= TABLE_HEADERS.length; columnIndex += 1) {
    worksheet.getRow(4).getCell(columnIndex).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF12B8D6" },
    };
  }

  worksheet.mergeCells("B1:F1");
  worksheet.mergeCells("B2:F2");
  worksheet.mergeCells("B3:F3");
  worksheet.getCell("B1").value = `Invoice — ${details.invoiceNumber}`;
  worksheet.getCell("B2").value = businessName;
  worksheet.getCell("B3").value = [
    branding.contactEmail,
    branding.contactPhone,
    branding.contactWebsite,
    `Generated ${formatDateForDisplay(generatedAt)}`,
  ]
    .filter(Boolean)
    .join("  |  ");

  styleCell(worksheet.getCell("B1"), {
    bold: true,
    color: "FFFFFFFF",
    fill: "FF080B18",
    size: 20,
    align: { vertical: "middle" },
    noBorder: true,
  });
  styleCell(worksheet.getCell("B2"), {
    bold: true,
    color: "FFE0E7FF",
    fill: "FF080B18",
    size: 13,
    align: { vertical: "middle" },
    noBorder: true,
  });
  styleCell(worksheet.getCell("B3"), {
    color: "FFC4CCDC",
    fill: "FF080B18",
    size: 10,
    align: { vertical: "middle" },
    noBorder: true,
  });

  // Logo sits on a clean white plate spanning the banner's left column.
  worksheet.mergeCells("A1:A3");
  if (logo) {
    worksheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
    const logoSize = getContainedImageSize(logo.width, logo.height, 120, 74);
    const logoId = workbook.addImage({
      base64: logo.dataUrl,
      extension: logo.extension,
    });
    worksheet.addImage(logoId, {
      tl: { col: 0.12, row: 0.12 },
      ext: logoSize,
      editAs: "oneCell",
    });
  } else {
    const wordmarkCell = worksheet.getCell("A1");
    wordmarkCell.value = "SydIN";
    styleCell(wordmarkCell, {
      bold: true,
      color: "FFFFFFFF",
      fill: "FF080B18",
      size: 18,
      align: { horizontal: "center", vertical: "middle" },
      noBorder: true,
    });
  }

  const summaryCells: Array<[string, string, string, boolean]> = [
    ["A6:B7", "Customer", details.customerName || "Not set", false],
    ["C6:D7", "Depot", details.depotName || "Not set", false],
    ["E6:F7", "Status", details.status, false],
    ["A8:B9", "Issue date", formatDateOnly(details.issueDate), false],
    ["C8:D9", "Due date", formatDateOnly(details.dueDate), false],
    ["E8:F9", "Invoice total", `${currency} ${invoiceTotal.toFixed(2)}`, true],
  ];

  worksheet.getRow(6).height = 16;
  worksheet.getRow(7).height = 16;
  worksheet.getRow(8).height = 16;
  worksheet.getRow(9).height = 16;

  summaryCells.forEach(([range, label, value, highlight]) => {
    worksheet.mergeCells(range);
    const cell = worksheet.getCell(range.split(":")[0]);
    cell.value = {
      richText: [
        {
          text: `${label.toUpperCase()}\n`,
          font: {
            name: "Calibri",
            size: 8,
            bold: true,
            color: { argb: "FF64748B" },
          },
        },
        {
          text: value,
          font: {
            name: "Calibri",
            size: highlight ? 13 : 11,
            bold: true,
            color: { argb: highlight ? "FF047857" : "FF0F172A" },
          },
        },
      ],
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: highlight ? "FFECFDF5" : "FFF8FAFC" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });

  const headerRow = worksheet.getRow(tableHeaderRow);
  headerRow.values = TABLE_HEADERS;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    styleCell(cell, {
      bold: true,
      color: "FFFFFFFF",
      fill: "FF0F172A",
      align: { horizontal: "center", vertical: "middle" },
    });
  });

  lines.forEach((line, index) => {
    const rowIndex = tableHeaderRow + index + 1;
    const row = worksheet.getRow(rowIndex);

    row.values = [
      line.name,
      line.code || "",
      line.unit || "",
      line.quantity,
      line.unitPrice ?? "",
      line.lineTotal,
    ];
    row.height = 26;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const numericColumn = columnNumber === 4 || columnNumber === 5 || columnNumber === 6;
      styleCell(cell, {
        // Tint the Line Total column so the money reads clearly down the table.
        fill:
          columnNumber === 6
            ? "FFF0FDFA"
            : index % 2 === 0
              ? "FFFFFFFF"
              : "FFF8FAFC",
        bold: columnNumber === 6,
        align: {
          horizontal: numericColumn ? "right" : "left",
          vertical: "middle",
          wrapText: true,
        },
      });
    });

    // "General" avoids Excel's trailing-dot quirk (e.g. "1." from "0.##") while
    // still showing decimals when a quantity actually has them.
    row.getCell(4).numFmt = "General";
    row.getCell(5).numFmt = currencyFormat;
    row.getCell(6).numFmt = currencyFormat;
  });

  const totalRowIndex = tableHeaderRow + lines.length + 1;
  const totalRow = worksheet.getRow(totalRowIndex);
  totalRow.height = 26;
  worksheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
  totalRow.getCell(1).value = "INVOICE TOTAL";
  styleCell(totalRow.getCell(1), {
    bold: true,
    color: "FF065F46",
    fill: "FFD1FAE5",
    align: { horizontal: "right", vertical: "middle" },
  });
  totalRow.getCell(5).value = "";
  styleCell(totalRow.getCell(5), { fill: "FFD1FAE5" });
  totalRow.getCell(6).value = invoiceTotal;
  totalRow.getCell(6).numFmt = currencyFormat;
  styleCell(totalRow.getCell(6), {
    bold: true,
    size: 12,
    color: "FF047857",
    fill: "FFD1FAE5",
    align: { horizontal: "right", vertical: "middle" },
  });

  if (details.notes?.trim()) {
    const notesRowIndex = totalRowIndex + 2;
    worksheet.mergeCells(`A${notesRowIndex}:F${notesRowIndex}`);
    const notesCell = worksheet.getCell(`A${notesRowIndex}`);
    notesCell.value = `Notes: ${details.notes.trim()}`;
    styleCell(notesCell, {
      fill: "FFF8FAFC",
      align: { vertical: "middle", wrapText: true },
    });
    worksheet.getRow(notesRowIndex).height = 34;
  }

  worksheet.views = [{ state: "frozen", ySplit: tableHeaderRow }];
  worksheet.autoFilter = {
    from: { row: tableHeaderRow, column: 1 },
    to: { row: tableHeaderRow, column: TABLE_HEADERS.length },
  };

  const filename = `${slugifyFilename(businessName)}-${slugifyFilename(
    details.invoiceNumber
  )}-${formatDateForFilename(generatedAt)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  downloadWorkbook(buffer, filename);
  return filename;
}
