import ExcelJS from "exceljs";
import {
  calculateInventoryValue,
  getEffectiveItemLowStockThreshold,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

export interface ExcelInventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  sku?: string;
  notes?: string;
  image?: string;
  publicItemUrl?: string;
  depotLabel: string;
  itemCode?: string | null;
  unitType?: InventoryUnitType | null;
  customUnitLabel?: string | null;
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  minStockLevel?: number | null;
  barcode?: string | null;
}

export interface ExcelBusinessBranding {
  businessName: string;
  businessLogoUrl: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface ExportInventoryExcelOptions {
  items: ExcelInventoryItem[];
  branding: ExcelBusinessBranding;
  lowStockThreshold: number;
  currencyCode?: string;
}

interface WorkbookImageData {
  dataUrl: string;
  extension: "jpeg" | "png";
  width: number;
  height: number;
}

const TABLE_HEADERS = [
  "Image",
  "ID",
  "Name",
  "SKU",
  "Category",
  "Depot",
  "Quantity",
  "Status",
  "Notes",
  "Image URL",
  "Public Item URL",
  "Item Code",
  "Unit Type",
  "Custom Unit Label",
  "Cost Price",
  "Selling Price",
  "Stock Cost Value",
  "Stock Retail Value",
  "Min Stock Level",
  "Barcode",
];

function formatDateForDisplay(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
      .replace(/(^-|-$)/g, "") || "sydin"
  );
}

function getWorkbookImageExtension(url: string, contentType: string | null) {
  const normalizedContentType = (contentType || "").toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (normalizedContentType.includes("png")) return "png";
  if (
    normalizedContentType.includes("jpeg") ||
    normalizedContentType.includes("jpg")
  ) {
    return "jpeg";
  }

  if (normalizedUrl.endsWith(".png")) return "png";
  if (normalizedUrl.endsWith(".jpg") || normalizedUrl.endsWith(".jpeg")) {
    return "jpeg";
  }

  return null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();

    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

function getContainedImageSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      width: maxWidth,
      height: maxHeight,
    };
  }

  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
}

async function getWorkbookImageData(
  imageUrl: string,
  maxBytes = 1_500_000
): Promise<WorkbookImageData | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) return null;

    const blob = await response.blob();

    if (blob.size > maxBytes) return null;

    const extension = getWorkbookImageExtension(
      imageUrl,
      response.headers.get("content-type")
    );

    if (!extension) return null;

    const dataUrl = await blobToDataUrl(blob);
    const dimensions = await getImageDimensions(dataUrl);

    return {
      dataUrl,
      extension,
      ...dimensions,
    };
  } catch {
    return null;
  }
}

async function getItemThumbnailData(items: ExcelInventoryItem[]) {
  const thumbnailItems = items
    .filter((item) => item.image)
    .slice(0, 50);
  const thumbnailEntries = await Promise.all(
    thumbnailItems.map(async (item) => {
      const imageData = await getWorkbookImageData(item.image || "", 900_000);

      return [item.id, imageData] as const;
    })
  );

  return new Map(
    thumbnailEntries.filter((entry): entry is readonly [
      number,
      WorkbookImageData
    ] => Boolean(entry[1]))
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
  } = {}
) {
  cell.font = {
    name: "Calibri",
    size: options.size || 11,
    bold: options.bold,
    color: {
      argb: options.color || "FF0F172A",
    },
  };
  cell.alignment = {
    vertical: "middle",
    wrapText: true,
    ...options.align,
  };

  if (options.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: options.fill,
      },
    };
  }

  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
}

function setHyperlinkCell(cell: ExcelJS.Cell, url: string) {
  if (!url) {
    cell.value = "";
    return;
  }

  cell.value = {
    text: url,
    hyperlink: url,
  };
  cell.font = {
    name: "Calibri",
    size: 10,
    color: {
      argb: "FF2563EB",
    },
    underline: true,
  };
  cell.alignment = {
    vertical: "middle",
    wrapText: true,
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
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

export async function exportInventoryExcel({
  items,
  branding,
  lowStockThreshold,
  currencyCode,
}: ExportInventoryExcelOptions) {
  const generatedAt = new Date();
  const businessName = branding.businessName.trim() || "SydIn Account";
  const threshold = Number.isFinite(lowStockThreshold)
    ? lowStockThreshold
    : 10;
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");
  const isLowStock = (item: ExcelInventoryItem) =>
    item.quantity <=
    getEffectiveItemLowStockThreshold(item.minStockLevel, threshold);
  const lowStockCount = items.filter(isLowStock).length;
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const assignedDepotCount = new Set(
    items
      .map((item) => item.depotLabel)
      .filter((depotLabel) => depotLabel && depotLabel !== "Unassigned")
  ).size;
  const unassignedItemCount = items.filter(
    (item) => item.depotLabel === "Unassigned"
  ).length;
  const logo = await getWorkbookImageData(branding.businessLogoUrl);
  const itemThumbnails = await getItemThumbnailData(items);
  const thumbnailCandidateIds = new Set(
    items
      .filter((item) => item.image)
      .slice(0, 50)
      .map((item) => item.id)
  );
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Inventory");
  const tableHeaderRow = 10;

  workbook.creator = "SydIN";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  worksheet.views = [
    {
      state: "frozen",
      ySplit: tableHeaderRow,
    },
  ];

  worksheet.columns = [
    { key: "image", width: 15 },
    { key: "id", width: 10 },
    { key: "name", width: 28 },
    { key: "sku", width: 20 },
    { key: "category", width: 20 },
    { key: "depot", width: 24 },
    { key: "quantity", width: 12 },
    { key: "status", width: 14 },
    { key: "notes", width: 34 },
    { key: "imageUrl", width: 38 },
    { key: "publicItemUrl", width: 38 },
    { key: "itemCode", width: 18 },
    { key: "unitType", width: 16 },
    { key: "customUnitLabel", width: 22 },
    { key: "costPrice", width: 16 },
    { key: "sellingPrice", width: 16 },
    { key: "stockCostValue", width: 20 },
    { key: "stockRetailValue", width: 20 },
    { key: "minStockLevel", width: 18 },
    { key: "barcode", width: 24 },
  ];

  for (let rowIndex = 1; rowIndex <= 4; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);

    row.height = rowIndex === 1 ? 24 : 18;
    for (let columnIndex = 1; columnIndex <= TABLE_HEADERS.length; columnIndex += 1) {
      const cell = row.getCell(columnIndex);

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF080B18" },
      };
    }
  }

  worksheet.mergeCells("B1:K1");
  worksheet.mergeCells("B2:K2");
  worksheet.mergeCells("B3:K3");
  worksheet.getCell("B1").value = "Inventory Export";
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
    size: 18,
  });
  styleCell(worksheet.getCell("B2"), {
    bold: true,
    color: "FFE0E7FF",
    fill: "FF080B18",
    size: 12,
  });
  styleCell(worksheet.getCell("B3"), {
    color: "FFC4CCDC",
    fill: "FF080B18",
    size: 10,
  });

  if (logo) {
    const logoSize = getContainedImageSize(logo.width, logo.height, 58, 48);
    const logoId = workbook.addImage({
      base64: logo.dataUrl,
      extension: logo.extension,
    });

    worksheet.addImage(logoId, {
      tl: { col: 0.25, row: 0.35 },
      ext: logoSize,
      editAs: "oneCell",
    });
  } else {
    worksheet.mergeCells("A1:A3");
    const wordmarkCell = worksheet.getCell("A1");

    wordmarkCell.value = "SydIN";
    styleCell(wordmarkCell, {
      bold: true,
      color: "FFFFFFFF",
      fill: "FF080B18",
      size: 16,
      align: {
        horizontal: "center",
        vertical: "middle",
      },
    });
  }

  worksheet.getCell("J4").value = `Generated ${formatDateForDisplay(generatedAt)}`;
  worksheet.getCell("J4").alignment = {
    horizontal: "right",
    vertical: "middle",
  };
  worksheet.getCell("J4").font = {
    name: "Calibri",
    size: 9,
    color: { argb: "FFC4CCDC" },
  };

  const summaryCells = [
    ["A6:B7", "Total items", String(items.length)],
    ["C6:D7", "Total quantity", String(totalQuantity)],
    ["E6:F7", "Low stock", String(lowStockCount)],
    ["G6:H7", "Assigned depots", String(assignedDepotCount)],
    ["I6:K7", "Unassigned", String(unassignedItemCount)],
  ];

  summaryCells.forEach(([range, label, value]) => {
    worksheet.mergeCells(range);
    const cell = worksheet.getCell(range.split(":")[0]);

    cell.value = `${label}\n${value}`;
    styleCell(cell, {
      bold: true,
      fill: "FFF8FAFC",
      size: 11,
      align: {
        vertical: "middle",
        wrapText: true,
      },
    });
  });

  const headerRow = worksheet.getRow(tableHeaderRow);

  headerRow.values = TABLE_HEADERS;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    styleCell(cell, {
      bold: true,
      color: "FFFFFFFF",
      fill: "FF0F172A",
      align: {
        horizontal: "center",
        vertical: "middle",
      },
    });
  });

  items.forEach((item, index) => {
    const rowIndex = tableHeaderRow + index + 1;
    const row = worksheet.getRow(rowIndex);
    const itemIsLowStock = isLowStock(item);
    const thumbnail = itemThumbnails.get(item.id);
    const imageLabel = thumbnail
      ? ""
      : item.image && !thumbnailCandidateIds.has(item.id)
        ? "Image available"
        : "No image";

    row.values = [
      imageLabel,
      item.id,
      item.name,
      item.sku || "N/A",
      item.category,
      item.depotLabel,
      item.quantity,
      itemIsLowStock ? "Low Stock" : "In Stock",
      item.notes || "",
      "",
      "",
      item.itemCode || "",
      item.unitType || "piece",
      item.unitType === "custom" ? item.customUnitLabel || "" : "",
      item.costPrice ?? "",
      item.sellingPrice ?? "",
      calculateInventoryValue(item.quantity, item.costPrice) ?? "",
      calculateInventoryValue(item.quantity, item.sellingPrice) ?? "",
      item.minStockLevel ?? "",
      item.barcode || "",
    ];
    row.height = thumbnail ? 42 : 28;

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, {
        fill: itemIsLowStock ? "FFFFF1F2" : "FFFFFFFF",
        align: {
          horizontal: columnNumber === 7 ? "right" : "left",
          vertical: "middle",
          wrapText: true,
        },
      });
    });

    row.getCell(7).numFmt = "0";
    row.getCell(8).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: {
        argb: itemIsLowStock ? "FFB91C1C" : "FF166534",
      },
    };
    setHyperlinkCell(row.getCell(10), item.image || "");
    setHyperlinkCell(row.getCell(11), item.publicItemUrl || "");
    [15, 16, 17, 18].forEach((columnNumber) => {
      row.getCell(columnNumber).numFmt = `"${normalizedCurrency}" #,##0.00`;
    });
    row.getCell(19).numFmt = "0";
    row.getCell(20).numFmt = "@";

    if (thumbnail) {
      const imageSize = getContainedImageSize(
        thumbnail.width,
        thumbnail.height,
        58,
        38
      );
      const imageId = workbook.addImage({
        base64: thumbnail.dataUrl,
        extension: thumbnail.extension,
      });

      worksheet.addImage(imageId, {
        tl: { col: 0.22, row: rowIndex - 0.82 },
        ext: imageSize,
        editAs: "oneCell",
      });
    }
  });

  worksheet.columns.forEach((column, index) => {
    const maxWidthByColumn = [
      16, 12, 34, 24, 24, 28, 12, 16, 42, 46, 46, 22, 18, 24, 18, 18, 22,
      22, 18, 28,
    ][index];
    const minWidthByColumn = [
      14, 10, 18, 14, 14, 16, 12, 14, 18, 28, 28, 14, 12, 14, 14, 14, 16,
      16, 14, 18,
    ][index];
    let longestValue = minWidthByColumn;

    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      const text =
        typeof value === "object" && value && "text" in value
          ? String(value.text)
          : String(value ?? "");

      longestValue = Math.max(longestValue, Math.min(text.length + 2, maxWidthByColumn));
    });

    column.width = Math.min(Math.max(longestValue, minWidthByColumn), maxWidthByColumn);
  });

  worksheet.getColumn(7).alignment = {
    horizontal: "right",
    vertical: "middle",
  };
  worksheet.autoFilter = {
    from: {
      row: tableHeaderRow,
      column: 1,
    },
    to: {
      row: tableHeaderRow,
      column: TABLE_HEADERS.length,
    },
  };

  const filename = `${slugifyFilename(businessName)}-inventory-export-${formatDateForFilename(
    generatedAt
  )}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  downloadWorkbook(buffer, filename);

  return filename;
}
