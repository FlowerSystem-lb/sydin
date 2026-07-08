import ExcelJS from "exceljs";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { getContainedImageSize, loadExportImage } from "@/app/lib/exportImage";

export interface PurchaseOrderExcelLine {
  type: string;
  name: string;
  category?: string;
  code?: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  lineTotal: number | null;
  affectsStock: boolean;
  note?: string;
}

export interface PurchaseOrderExcelDetails {
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
}

export interface PurchaseOrderExcelBranding {
  businessName: string;
  businessLogoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface ExportPurchaseOrderExcelOptions {
  details: PurchaseOrderExcelDetails;
  lines: PurchaseOrderExcelLine[];
  branding: PurchaseOrderExcelBranding;
  currencyCode?: string;
}

const TABLE_HEADERS = [
  "Type",
  "Name",
  "Category",
  "Code",
  "SKU",
  "Unit",
  "Quantity",
  "Unit Cost",
  "Line Total",
  "Adds to Stock",
  "Notes",
];

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
      .replace(/(^-|-$)/g, "") || "purchase-order"
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

export async function exportPurchaseOrderExcel({
  details,
  lines,
  branding,
  currencyCode,
}: ExportPurchaseOrderExcelOptions) {
  const generatedAt = new Date();
  const businessName = branding.businessName.trim() || "SydIN Account";
  const currency = normalizeCurrencyCode(currencyCode, "USD");
  const currencyFormat = `"${currency}" #,##0.00`;
  const orderTotal = lines.reduce(
    (total, line) => total + Number(line.lineTotal || 0),
    0
  );
  const logo = branding.businessLogoUrl
    ? await loadExportImage(branding.businessLogoUrl)
    : null;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Purchase Order");
  const tableHeaderRow = 11;

  workbook.creator = "SydIN";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  worksheet.columns = [
    { key: "type", width: 22 },
    { key: "name", width: 32 },
    { key: "category", width: 18 },
    { key: "code", width: 16 },
    { key: "sku", width: 16 },
    { key: "unit", width: 12 },
    { key: "quantity", width: 12 },
    { key: "unitCost", width: 18 },
    { key: "lineTotal", width: 18 },
    { key: "addsToStock", width: 16 },
    { key: "notes", width: 34 },
  ];

  // Dark branded banner (rows 1-3), a cyan accent divider (row 4), then a thin
  // white spacer (row 5). Banner cells carry NO borders so it reads as one clean
  // solid block instead of a grid of white lines.
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

  worksheet.mergeCells("B1:G1");
  worksheet.mergeCells("B2:G2");
  worksheet.mergeCells("B3:G3");
  worksheet.getCell("B1").value = `Purchase Order — ${details.poNumber}`;
  worksheet.getCell("B2").value = businessName;
  worksheet.getCell("B3").value = [
    branding.contactEmail,
    branding.contactPhone,
    branding.contactWebsite,
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

  worksheet.mergeCells("H1:K3");
  const generatedCell = worksheet.getCell("H1");
  generatedCell.value = `Generated\n${formatDateForDisplay(generatedAt)}`;
  generatedCell.alignment = {
    horizontal: "right",
    vertical: "middle",
    wrapText: true,
  };
  generatedCell.font = {
    name: "Calibri",
    size: 9,
    color: { argb: "FFC4CCDC" },
  };

  const paymentSummary = [
    details.paymentStatus,
    details.paymentMethod,
    details.paidBy ? `by ${details.paidBy}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const summaryCells: Array<[string, string, string, boolean]> = [
    ["A6:C7", "Supplier", details.supplierName || "Not set", false],
    ["D6:F7", "Depot", details.depotName || "Not set", false],
    ["G6:H7", "Purchase date", formatDateOnly(details.purchaseDate), false],
    ["I6:K7", "Status", details.status, false],
    ["A8:C9", "Payment", paymentSummary || "Not set", false],
    ["D8:F9", "Expected delivery", formatDateOnly(details.expectedDeliveryDate), false],
    ["G8:H9", "Contact", details.supplierContact || "Not set", false],
    ["I8:K9", "Order total", `${currency} ${orderTotal.toFixed(2)}`, true],
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
      line.type,
      line.name,
      line.category || "",
      line.code || "",
      line.sku || "",
      line.unit || "",
      line.quantity,
      line.unitCost ?? "",
      line.lineTotal ?? "",
      line.affectsStock ? "Yes" : "No",
      line.note || "",
    ];
    row.height = 26;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const numericColumn =
        columnNumber === 7 || columnNumber === 8 || columnNumber === 9;
      styleCell(cell, {
        // Tint the Line Total column so the money reads clearly down the table.
        fill:
          columnNumber === 9
            ? "FFF0FDFA"
            : index % 2 === 0
              ? "FFFFFFFF"
              : "FFF8FAFC",
        bold: columnNumber === 9,
        align: {
          horizontal: numericColumn ? "right" : "left",
          vertical: "middle",
          wrapText: true,
        },
      });
    });

    // "General" avoids Excel's trailing-dot quirk (e.g. "1." from "0.##") while
    // still showing decimals when a quantity actually has them.
    row.getCell(7).numFmt = "General";
    row.getCell(8).numFmt = currencyFormat;
    row.getCell(9).numFmt = currencyFormat;
  });

  const totalRowIndex = tableHeaderRow + lines.length + 1;
  const totalRow = worksheet.getRow(totalRowIndex);
  totalRow.height = 26;
  worksheet.mergeCells(`A${totalRowIndex}:H${totalRowIndex}`);
  totalRow.getCell(1).value = "ORDER TOTAL";
  styleCell(totalRow.getCell(1), {
    bold: true,
    color: "FF065F46",
    fill: "FFD1FAE5",
    align: { horizontal: "right", vertical: "middle" },
  });
  totalRow.getCell(9).value = orderTotal;
  totalRow.getCell(9).numFmt = currencyFormat;
  styleCell(totalRow.getCell(9), {
    bold: true,
    size: 12,
    color: "FF047857",
    fill: "FFD1FAE5",
    align: { horizontal: "right", vertical: "middle" },
  });
  for (const columnNumber of [10, 11]) {
    styleCell(totalRow.getCell(columnNumber), { fill: "FFD1FAE5" });
  }

  if (details.notes?.trim()) {
    const notesRowIndex = totalRowIndex + 2;
    worksheet.mergeCells(`A${notesRowIndex}:K${notesRowIndex}`);
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
    details.poNumber
  )}-${formatDateForFilename(generatedAt)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  downloadWorkbook(buffer, filename);
  return filename;
}
