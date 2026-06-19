import { jsPDF } from "jspdf";
import autoTable, {
  type CellHookData,
  type HookData,
  type RowInput,
  type Styles,
} from "jspdf-autotable";
import {
  calculateInventoryValue,
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

export type InventoryPdfReportType =
  | "summary"
  | "detailed"
  | "low-stock"
  | "valuation";
export type InventoryPdfScope = "all" | "filtered" | "selected";
export type InventoryPdfGroupBy = "none" | "category" | "depot";
export type InventoryPdfBrandingMode = "business" | "sydin" | "none";

export interface InventoryPdfIncludeSettings {
  images: boolean;
  sku: boolean;
  barcode: boolean;
  category: boolean;
  depot: boolean;
  supplier: boolean;
  minStock: boolean;
  pricing: boolean;
  notes: boolean;
}

export interface PdfInventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  sku?: string;
  notes?: string;
  image?: string;
  depotLabel: string;
  supplierLabel?: string;
  itemCode?: string | null;
  unitType?: InventoryUnitType | null;
  customUnitLabel?: string | null;
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  minStockLevel?: number | null;
  barcode?: string | null;
}

export interface PdfBusinessBranding {
  businessName: string;
  businessLogoUrl: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface ExportInventoryPdfOptions {
  items: PdfInventoryItem[];
  branding: PdfBusinessBranding;
  lowStockThreshold: number;
  currencyCode?: string;
  reportType?: InventoryPdfReportType;
  scope?: InventoryPdfScope;
  scopeLabel?: string;
  groupBy?: InventoryPdfGroupBy;
  include?: InventoryPdfIncludeSettings;
  brandingMode?: InventoryPdfBrandingMode;
  allowBusinessLogo?: boolean;
  onProgress?: (message: string) => void;
}

type ImageFormat = "PNG" | "JPEG";

interface PdfImageData {
  dataUrl: string;
  format: ImageFormat;
  width: number;
  height: number;
}

interface PreparedItem extends PdfInventoryItem {
  effectiveMinStock: number;
  shortage: number | null;
  status: "Out of stock" | "Low stock" | "In stock";
  costValue: number | null;
  retailValue: number | null;
}

interface ReportGroup {
  key: string;
  label: string;
  items: PreparedItem[];
}

const DEFAULT_INCLUDE: InventoryPdfIncludeSettings = {
  images: true,
  sku: true,
  barcode: false,
  category: true,
  depot: true,
  supplier: true,
  minStock: true,
  pricing: true,
  notes: true,
};

const REPORT_TITLES: Record<InventoryPdfReportType, string> = {
  summary: "Inventory Summary",
  detailed: "Detailed Inventory",
  "low-stock": "Low Stock Report",
  valuation: "Inventory Valuation",
};

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
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "") || "SydIN"
  );
}

function getImageFormat(url: string, contentType: string | null): ImageFormat | null {
  const normalizedContentType = (contentType || "").toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (normalizedContentType.includes("png")) return "PNG";
  if (
    normalizedContentType.includes("jpeg") ||
    normalizedContentType.includes("jpg")
  ) {
    return "JPEG";
  }

  if (normalizedUrl.endsWith(".png")) return "PNG";
  if (normalizedUrl.endsWith(".jpg") || normalizedUrl.endsWith(".jpeg")) {
    return "JPEG";
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

async function convertImageToPdfData(
  dataUrl: string,
  sourceWidth: number,
  sourceHeight: number,
  maxPixels: number
): Promise<PdfImageData> {
  const scale = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return {
      dataUrl,
      format: dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  canvas.width = width;
  canvas.height = height;

  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image could not be compressed."));
  });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.78),
    format: "JPEG",
    width,
    height,
  };
}

async function getImageData(
  imageUrl: string,
  options: { maxBytes: number; maxPixels: number }
): Promise<PdfImageData | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) return null;

    const blob = await response.blob();

    if (blob.size > options.maxBytes) return null;

    const sourceFormat = getImageFormat(
      imageUrl,
      response.headers.get("content-type")
    );
    const dataUrl = await blobToDataUrl(blob);
    const dimensions = await getImageDimensions(dataUrl);

    if (!sourceFormat && !dataUrl.startsWith("data:image/webp")) return null;

    return await convertImageToPdfData(
      dataUrl,
      dimensions.width,
      dimensions.height,
      options.maxPixels
    );
  } catch {
    return null;
  }
}

async function getItemThumbnailData(
  items: PdfInventoryItem[],
  onProgress?: (message: string) => void
) {
  const imageItems = items.filter((item) => item.image);
  const thumbnailMap = new Map<number, PdfImageData>();
  const cache = new Map<string, PdfImageData | null>();
  const concurrency = 4;
  let cursor = 0;

  if (imageItems.length === 0) return thumbnailMap;

  onProgress?.(`Preparing ${imageItems.length} product image${imageItems.length === 1 ? "" : "s"}...`);

  async function worker() {
    while (cursor < imageItems.length) {
      const item = imageItems[cursor];
      cursor += 1;

      if (!item.image) continue;

      if (!cache.has(item.image)) {
        cache.set(
          item.image,
          await getImageData(item.image, {
            maxBytes: 2_500_000,
            maxPixels: 90_000,
          })
        );
      }

      const imageData = cache.get(item.image);
      if (imageData) thumbnailMap.set(item.id, imageData);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, imageItems.length) }, () =>
      worker()
    )
  );

  return thumbnailMap;
}

async function getLogoData(logoUrl: string) {
  return getImageData(logoUrl, {
    maxBytes: 2_000_000,
    maxPixels: 160_000,
  });
}

function mergeIncludeSettings(
  reportType: InventoryPdfReportType,
  include?: Partial<InventoryPdfIncludeSettings>
) {
  const merged = {
    ...DEFAULT_INCLUDE,
    ...include,
  };

  if (reportType === "valuation") {
    merged.pricing = true;
    merged.notes = false;
  }

  if (reportType === "low-stock") {
    merged.minStock = true;
  }

  if (reportType === "summary") {
    merged.notes = false;
    merged.barcode = false;
  }

  return merged;
}

function prepareItem(
  item: PdfInventoryItem,
  threshold: number
): PreparedItem {
  const effectiveMinStock = getEffectiveItemLowStockThreshold(
    item.minStockLevel,
    threshold
  );
  const shortage =
    item.quantity <= effectiveMinStock
      ? Math.max(0, effectiveMinStock - item.quantity)
      : null;
  const status =
    item.quantity <= 0
      ? "Out of stock"
      : item.quantity <= effectiveMinStock
        ? "Low stock"
        : "In stock";

  return {
    ...item,
    effectiveMinStock,
    shortage,
    status,
    costValue: calculateInventoryValue(item.quantity, item.costPrice),
    retailValue: calculateInventoryValue(item.quantity, item.sellingPrice),
  };
}

function getTotals(items: PreparedItem[]) {
  return {
    itemCount: items.length,
    quantity: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
    lowStockCount: items.filter((item) => item.status !== "In stock").length,
    shortage: items.reduce((total, item) => total + Number(item.shortage || 0), 0),
    costValue: items.reduce(
      (total, item) => total + Number(item.costValue || 0),
      0
    ),
    retailValue: items.reduce(
      (total, item) => total + Number(item.retailValue || 0),
      0
    ),
    assignedDepots: new Set(
      items
        .map((item) => item.depotLabel)
        .filter((label) => label && label !== "Unassigned")
    ).size,
    unassignedCount: items.filter((item) => item.depotLabel === "Unassigned")
      .length,
    categories: new Set(
      items
        .map((item) => item.category)
        .filter((label) => label && label !== "Uncategorized")
    ).size,
  };
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  return formatInventoryPrice(value, currency) || "Not set";
}

function getStatusColor(status: PreparedItem["status"]): [number, number, number] {
  if (status === "Out of stock") return [185, 28, 28];
  if (status === "Low stock") return [180, 83, 9];
  return [22, 101, 52];
}

function getScopeLabel(scope: InventoryPdfScope, scopeLabel: string | undefined) {
  if (scopeLabel?.trim()) return scopeLabel.trim();
  if (scope === "selected") return "Selected items";
  if (scope === "filtered") return "Current inventory filters";
  return "All inventory";
}

function getGroupLabel(groupBy: InventoryPdfGroupBy, item: PreparedItem) {
  if (groupBy === "category") return item.category || "Uncategorized";
  if (groupBy === "depot") return item.depotLabel || "Unassigned";
  return "Inventory";
}

function groupItems(items: PreparedItem[], groupBy: InventoryPdfGroupBy) {
  if (groupBy === "none") {
    return [{ key: "inventory", label: "Inventory", items }];
  }

  const groups = new Map<string, PreparedItem[]>();

  items.forEach((item) => {
    const label = getGroupLabel(groupBy, item);
    const key = label.toLowerCase();
    groups.set(key, [...(groups.get(key) || []), item]);
  });

  return [...groups.entries()]
    .map(([key, groupedItems]) => ({
      key,
      label: getGroupLabel(groupBy, groupedItems[0]),
      items: groupedItems,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));
}

function getReportFilename(
  businessName: string,
  reportType: InventoryPdfReportType,
  generatedAt: Date
) {
  const reportName: Record<InventoryPdfReportType, string> = {
    summary: "Inventory-Summary",
    detailed: "Detailed-Inventory",
    "low-stock": "Low-Stock",
    valuation: "Inventory-Valuation",
  };

  return `${slugifyFilename(businessName)}-${reportName[reportType]}-${formatDateForFilename(
    generatedAt
  )}.pdf`;
}

function drawSydinMark(document: jsPDF, x: number, y: number, size: number) {
  document.setDrawColor(57, 119, 255);
  document.setLineWidth(size * 0.16);
  document.setLineCap("round");
  document.setLineJoin("round");
  document.lines(
    [
      [-size * 0.3, size * 0.14],
      [size * 0.24, size * 0.22],
      [-size * 0.28, size * 0.2],
    ],
    x + size * 0.62,
    y + size * 0.12
  );
  document.setDrawColor(20, 217, 255);
  document.line(x + size * 0.82, y + size * 0.2, x + size * 0.82, y + size * 0.78);
  document.setFillColor(99, 102, 241);
  document.roundedRect(
    x + size * 0.38,
    y + size * 0.42,
    size * 0.24,
    size * 0.24,
    1,
    1,
    "F"
  );
}

function drawSydinWordmark(
  document: jsPDF,
  x: number,
  y: number,
  options: { dark?: boolean; size?: number } = {}
) {
  const size = options.size || 11;

  drawSydinMark(document, x, y - size * 0.7, size * 0.9);
  document.setFont("helvetica", "bold");
  document.setFontSize(size);
  document.setTextColor(options.dark ? 255 : 15, options.dark ? 255 : 23, options.dark ? 255 : 42);
  document.text("SydIN", x + size * 1.08, y);
}

function drawHeader({
  document,
  pageWidth,
  margin,
  businessName,
  reportTitle,
  scopeLabel,
  generatedAt,
  brandingMode,
  logo,
  contactLine,
  pageNumber,
}: {
  document: jsPDF;
  pageWidth: number;
  margin: number;
  businessName: string;
  reportTitle: string;
  scopeLabel: string;
  generatedAt: Date;
  brandingMode: InventoryPdfBrandingMode;
  logo: PdfImageData | null;
  contactLine: string;
  pageNumber: number;
}) {
  const compact = pageNumber > 1;
  const headerHeight = compact ? 22 : 34;

  document.setFillColor(15, 23, 42);
  document.rect(0, 0, pageWidth, headerHeight, "F");

  let textX = margin;

  if (brandingMode === "business" && logo) {
    try {
      const logoSize = getContainedImageSize(logo.width, logo.height, 20, 14);
      document.addImage(
        logo.dataUrl,
        logo.format,
        margin,
        compact ? 4 : 8,
        logoSize.width,
        logoSize.height
      );
      textX = margin + 26;
    } catch {
      textX = margin;
    }
  } else if (brandingMode === "sydin") {
    drawSydinWordmark(document, margin, compact ? 14 : 18, {
      dark: true,
      size: compact ? 8.5 : 10,
    });
    textX = margin + (compact ? 30 : 36);
  }

  document.setFont("helvetica", "bold");
  document.setFontSize(compact ? 10 : 12);
  document.setTextColor(255, 255, 255);
  document.text(businessName, textX, compact ? 9 : 12);

  document.setFontSize(compact ? 12 : 17);
  document.text(reportTitle, textX, compact ? 17 : 23);

  if (!compact && contactLine) {
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(203, 213, 225);
    document.text(contactLine, textX, 30);
  }

  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.setTextColor(226, 232, 240);
  document.text(scopeLabel, pageWidth - margin, compact ? 10 : 13, {
    align: "right",
  });

  document.setFont("helvetica", "normal");
  document.setFontSize(7);
  document.setTextColor(203, 213, 225);
  document.text(`Generated ${formatDateForDisplay(generatedAt)}`, pageWidth - margin, compact ? 17 : 22, {
    align: "right",
  });

  if (!compact) {
    document.text("Generated by SydIN", pageWidth - margin, 30, {
      align: "right",
    });
  }
}

function drawFooter({
  document,
  pageWidth,
  pageHeight,
  margin,
  pageNumber,
  pageCount,
  generatedAt,
}: {
  document: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  pageNumber: number;
  pageCount: number;
  generatedAt: Date;
}) {
  document.setDrawColor(226, 232, 240);
  document.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  document.setFont("helvetica", "normal");
  document.setFontSize(7.5);
  document.setTextColor(100, 116, 139);
  document.text("Generated by SydIN", margin, pageHeight - 7);
  document.text(
    `Page ${pageNumber} of ${pageCount} | ${formatDateForDisplay(generatedAt)}`,
    pageWidth - margin,
    pageHeight - 7,
    { align: "right" }
  );
}

function metricCardsForReport(
  reportType: InventoryPdfReportType,
  totals: ReturnType<typeof getTotals>,
  currency: string
) {
  if (reportType === "low-stock") {
    return [
      ["Low-stock items", totals.lowStockCount.toLocaleString()],
      ["Total shortage", totals.shortage.toLocaleString()],
      ["Affected categories", totals.categories.toLocaleString()],
      ["Affected depots", totals.assignedDepots.toLocaleString()],
    ];
  }

  const cards = [
    ["Total items", totals.itemCount.toLocaleString()],
    ["Total quantity", totals.quantity.toLocaleString()],
    ["Low stock", totals.lowStockCount.toLocaleString()],
    ["Locations", totals.assignedDepots.toLocaleString()],
  ];

  if (reportType === "valuation") {
    cards.splice(2, 0, ["Cost value", formatMoney(totals.costValue, currency)]);
    cards.splice(3, 0, ["Retail value", formatMoney(totals.retailValue, currency)]);
  }

  return cards.slice(0, 6);
}

function drawMetricCards({
  document,
  cards,
  x,
  y,
  width,
}: {
  document: jsPDF;
  cards: string[][];
  x: number;
  y: number;
  width: number;
}) {
  const gap = 3;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;

  cards.forEach(([label, value], index) => {
    const cardX = x + index * (cardWidth + gap);

    document.setFillColor(248, 250, 252);
    document.setDrawColor(226, 232, 240);
    document.roundedRect(cardX, y, cardWidth, 16, 2.5, 2.5, "FD");
    document.setFont("helvetica", "bold");
    document.setFontSize(6.8);
    document.setTextColor(100, 116, 139);
    document.text(label.toUpperCase(), cardX + 3, y + 5.3, {
      maxWidth: cardWidth - 6,
    });
    document.setFontSize(10.5);
    document.setTextColor(15, 23, 42);
    document.text(String(value), cardX + 3, y + 12.3, {
      maxWidth: cardWidth - 6,
    });
  });
}

function drawAttentionBanner({
  document,
  x,
  y,
  width,
  text,
}: {
  document: jsPDF;
  x: number;
  y: number;
  width: number;
  text: string;
}) {
  document.setFillColor(255, 247, 237);
  document.setDrawColor(253, 186, 116);
  document.roundedRect(x, y, width, 10, 2.5, 2.5, "FD");
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.setTextColor(154, 52, 18);
  document.text(text, x + 4, y + 6.4);
}

function buildItemText(
  item: PreparedItem,
  include: InventoryPdfIncludeSettings,
  reportType: InventoryPdfReportType
) {
  const lines = [item.name];
  const tracking = [
    item.itemCode ? `Code: ${item.itemCode}` : "",
    include.sku && item.sku ? `SKU: ${item.sku}` : "",
    include.barcode && item.barcode ? `Barcode: ${item.barcode}` : "",
  ].filter(Boolean);

  if (tracking.length > 0) lines.push(tracking.join("  |  "));

  if (include.notes && item.notes?.trim() && reportType !== "valuation") {
    lines.push(`Notes: ${item.notes.trim()}`);
  }

  return lines.join("\n");
}

function buildLocationText(item: PreparedItem, include: InventoryPdfIncludeSettings) {
  const lines = [
    include.category ? item.category || "Uncategorized" : "",
    include.depot ? item.depotLabel || "Unassigned" : "",
    include.supplier && item.supplierLabel ? `Supplier: ${item.supplierLabel}` : "",
  ].filter(Boolean);

  return lines.join("\n") || "Not assigned";
}

function buildStockText(
  item: PreparedItem,
  include: InventoryPdfIncludeSettings,
  reportType: InventoryPdfReportType
) {
  const lines = [
    getInventoryQuantityLabel(item.quantity, item.unitType, item.customUnitLabel),
  ];

  if (include.minStock) lines.push(`Minimum: ${item.effectiveMinStock}`);
  if (reportType === "low-stock" && item.shortage != null) {
    lines.push(`Shortage: ${item.shortage}`);
  }

  return lines.join("\n");
}

function buildPricingText(
  item: PreparedItem,
  include: InventoryPdfIncludeSettings,
  currency: string
) {
  if (!include.pricing) return "Not included";

  return [
    `Cost/unit: ${formatMoney(item.costPrice, currency)}`,
    `Total cost: ${formatMoney(item.costValue, currency)}`,
    `Sell/unit: ${formatMoney(item.sellingPrice, currency)}`,
    `Retail value: ${formatMoney(item.retailValue, currency)}`,
  ].join("\n");
}

function tableColumns(
  include: InventoryPdfIncludeSettings,
  reportType: InventoryPdfReportType
) {
  const columns = [
    { header: "Item", dataKey: "item" },
    { header: "Category / Location", dataKey: "location" },
    { header: "Stock", dataKey: "stock" },
  ];

  if (include.pricing || reportType === "valuation") {
    columns.push({ header: "Pricing / Value", dataKey: "pricing" });
  }

  columns.push({ header: "Status", dataKey: "status" });

  return columns;
}

function columnStyles(
  include: InventoryPdfIncludeSettings,
  reportType: InventoryPdfReportType,
  orientation: "portrait" | "landscape"
): Record<string, Partial<Styles>> {
  const landscape = orientation === "landscape";
  const itemWidth = include.images ? (landscape ? 68 : 46) : landscape ? 76 : 56;

  return {
    item: { cellWidth: itemWidth, minCellHeight: include.images ? 18 : 10 },
    location: { cellWidth: landscape ? 44 : 30 },
    stock: { cellWidth: landscape ? 29 : 23, halign: "right" },
    pricing: { cellWidth: landscape ? 48 : 33, halign: "right" },
    status: { cellWidth: reportType === "low-stock" ? 31 : 24 },
  };
}

function shouldUseLandscape(
  reportType: InventoryPdfReportType,
  include: InventoryPdfIncludeSettings,
  groupBy: InventoryPdfGroupBy
) {
  if (reportType === "detailed" || reportType === "valuation") return true;

  const enabledWideFields = [
    include.images,
    include.supplier,
    include.pricing,
    include.notes,
    include.barcode,
    groupBy !== "none",
  ].filter(Boolean).length;

  return enabledWideFields >= 4;
}

function buildBodyRows(
  group: ReportGroup,
  include: InventoryPdfIncludeSettings,
  reportType: InventoryPdfReportType,
  currency: string
): RowInput[] {
  return group.items.map((item) => ({
    item: buildItemText(item, include, reportType),
    location: buildLocationText(item, include),
    stock: buildStockText(item, include, reportType),
    pricing: buildPricingText(item, include, currency),
    status:
      item.status === "Low stock" && item.shortage != null
        ? `${item.status}\nShort ${item.shortage}`
        : item.status,
  }));
}

function drawGroupHeading({
  document,
  group,
  x,
  y,
  width,
  currency,
  includePricing,
}: {
  document: jsPDF;
  group: ReportGroup;
  x: number;
  y: number;
  width: number;
  currency: string;
  includePricing: boolean;
}) {
  const totals = getTotals(group.items);
  const summary = [
    `${totals.itemCount} item${totals.itemCount === 1 ? "" : "s"}`,
    `${totals.quantity} total qty`,
    includePricing ? `${formatMoney(totals.costValue, currency)} cost` : "",
    includePricing ? `${formatMoney(totals.retailValue, currency)} retail` : "",
  ].filter(Boolean);

  document.setFillColor(241, 245, 249);
  document.setDrawColor(203, 213, 225);
  document.roundedRect(x, y, width, 11, 2, 2, "FD");
  document.setFont("helvetica", "bold");
  document.setFontSize(9.5);
  document.setTextColor(15, 23, 42);
  document.text(group.label, x + 4, y + 7);
  document.setFont("helvetica", "normal");
  document.setFontSize(7.2);
  document.setTextColor(71, 85, 105);
  document.text(summary.join("  |  "), x + width - 4, y + 7, {
    align: "right",
  });
}

function drawTotalsBlock({
  document,
  totals,
  x,
  y,
  width,
  currency,
}: {
  document: jsPDF;
  totals: ReturnType<typeof getTotals>;
  x: number;
  y: number;
  width: number;
  currency: string;
}) {
  const leftLines = [
    `Items: ${totals.itemCount.toLocaleString()}`,
    `Quantity: ${totals.quantity.toLocaleString()}`,
    `Low stock: ${totals.lowStockCount.toLocaleString()}`,
    `Unassigned: ${totals.unassignedCount.toLocaleString()}`,
  ];
  const rightLines = [
    `Total cost value: ${formatMoney(totals.costValue, currency)}`,
    `Total retail value: ${formatMoney(totals.retailValue, currency)}`,
  ];

  document.setFillColor(248, 250, 252);
  document.setDrawColor(203, 213, 225);
  document.roundedRect(x, y, width, 25, 3, 3, "FD");
  document.setFont("helvetica", "bold");
  document.setFontSize(9);
  document.setTextColor(15, 23, 42);
  document.text("Grand total", x + 4, y + 7);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.setTextColor(51, 65, 85);
  document.text(leftLines.join("  |  "), x + 4, y + 15, {
    maxWidth: width * 0.52,
  });
  document.setFont("helvetica", "bold");
  document.text(rightLines.join("\n"), x + width - 4, y + 13, {
    align: "right",
  });
}

export async function exportInventoryPdf({
  items,
  branding,
  lowStockThreshold,
  currencyCode,
  reportType = "summary",
  scope = "all",
  scopeLabel,
  groupBy = "none",
  include,
  brandingMode = "sydin",
  allowBusinessLogo = false,
  onProgress,
}: ExportInventoryPdfOptions) {
  const generatedAt = new Date();
  const businessName = branding.businessName.trim() || "SydIN Account";
  const threshold = Number.isFinite(lowStockThreshold)
    ? lowStockThreshold
    : 10;
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");
  const resolvedInclude = mergeIncludeSettings(reportType, include);
  const preparedItems = items
    .map((item) => prepareItem(item, threshold))
    .filter((item) => reportType !== "low-stock" || item.status !== "In stock");
  const orientation = shouldUseLandscape(reportType, resolvedInclude, groupBy)
    ? "landscape"
    : "portrait";
  const document = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = orientation === "landscape" ? 12 : 14;
  const reportTitle = REPORT_TITLES[reportType];
  const resolvedScopeLabel = getScopeLabel(scope, scopeLabel);
  const canUseBusinessLogo =
    brandingMode === "business" && allowBusinessLogo && Boolean(branding.businessLogoUrl);
  const resolvedBrandingMode: InventoryPdfBrandingMode = canUseBusinessLogo
    ? "business"
    : brandingMode === "business"
      ? "sydin"
      : brandingMode;
  const contactLine = [
    branding.contactEmail,
    branding.contactPhone,
    branding.contactWebsite,
  ]
    .filter(Boolean)
    .join("  |  ");
  const logo = canUseBusinessLogo
    ? await getLogoData(branding.businessLogoUrl)
    : null;

  onProgress?.("Preparing report data...");

  const itemThumbnails = resolvedInclude.images
    ? await getItemThumbnailData(preparedItems, onProgress)
    : new Map<number, PdfImageData>();
  const totals = getTotals(preparedItems);
  const groups = groupItems(preparedItems, groupBy);
  const tableStartY = totals.lowStockCount > 0 ? 74 : 61;

  drawHeader({
    document,
    pageWidth,
    margin,
    businessName,
    reportTitle,
    scopeLabel: resolvedScopeLabel,
    generatedAt,
    brandingMode: resolvedBrandingMode,
    logo,
    contactLine,
    pageNumber: 1,
  });

  drawMetricCards({
    document,
    cards: metricCardsForReport(reportType, totals, normalizedCurrency),
    x: margin,
    y: 41,
    width: pageWidth - margin * 2,
  });

  if (totals.lowStockCount > 0) {
    const bannerText =
      reportType === "low-stock"
        ? `${totals.lowStockCount} item${totals.lowStockCount === 1 ? "" : "s"} require attention`
        : `${totals.lowStockCount} low-stock item${totals.lowStockCount === 1 ? "" : "s"} in this report`;

    drawAttentionBanner({
      document,
      x: margin,
      y: 61,
      width: pageWidth - margin * 2,
      text: bannerText,
    });
  }

  let nextY = tableStartY;

  if (preparedItems.length === 0) {
    document.setFillColor(248, 250, 252);
    document.setDrawColor(226, 232, 240);
    document.roundedRect(margin, nextY, pageWidth - margin * 2, 28, 3, 3, "FD");
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.setTextColor(15, 23, 42);
    document.text("No inventory items match this report.", margin + 5, nextY + 12);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.setTextColor(100, 116, 139);
    document.text(
      "Adjust the export scope or filters, then generate the report again.",
      margin + 5,
      nextY + 20
    );
    nextY += 36;
  } else {
    for (const group of groups) {
      const remainingSpace = pageHeight - nextY - 38;
      if (groupBy !== "none" && remainingSpace < 34) {
        document.addPage();
        nextY = 30;
      }

      if (groupBy !== "none") {
        drawGroupHeading({
          document,
          group,
          x: margin,
          y: nextY,
          width: pageWidth - margin * 2,
          currency: normalizedCurrency,
          includePricing: resolvedInclude.pricing,
        });
        nextY += 14;
      }

      autoTable(document, {
        startY: nextY,
        columns: tableColumns(resolvedInclude, reportType),
        body: buildBodyRows(group, resolvedInclude, reportType, normalizedCurrency),
        margin: {
          left: margin,
          right: margin,
          top: 28,
          bottom: 18,
        },
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          font: "helvetica",
          fontSize: orientation === "landscape" ? 7.8 : 7.2,
          cellPadding: 2.4,
          overflow: "linebreak",
          valign: "top",
          lineColor: [226, 232, 240],
          lineWidth: 0.12,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: 2.2,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: columnStyles(resolvedInclude, reportType, orientation),
        willDrawPage: (data: HookData) => {
          const pageNumber = document.getCurrentPageInfo().pageNumber;
          if (pageNumber > 1) {
            drawHeader({
              document,
              pageWidth,
              margin,
              businessName,
              reportTitle,
              scopeLabel: resolvedScopeLabel,
              generatedAt,
              brandingMode: resolvedBrandingMode,
              logo,
              contactLine,
              pageNumber,
            });
            if (data.settings?.margin) data.settings.margin.top = 28;
          }
        },
        didParseCell: (data: CellHookData) => {
          if (data.section !== "body") return;

          const item = group.items[data.row.index];

          if (item?.status !== "In stock") {
            data.cell.styles.fillColor =
              item.status === "Out of stock" ? [254, 242, 242] : [255, 247, 237];
          }

          if (data.column.dataKey === "item") {
            data.cell.styles.fontStyle = "bold";
            if (resolvedInclude.images) {
            data.cell.styles.cellPadding = {
              top: 2.4,
              right: 2.4,
              bottom: 2.4,
              left: item && itemThumbnails.has(item.id) ? 18 : 2.4,
            };
          }
          }

          if (data.column.dataKey === "status" && item) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = getStatusColor(item.status);
          }

          if (data.column.dataKey === "stock" || data.column.dataKey === "pricing") {
            data.cell.styles.halign = "right";
          }
        },
        didDrawCell: (data: CellHookData) => {
          if (
            data.section !== "body" ||
            data.column.dataKey !== "item" ||
            !resolvedInclude.images
          ) {
            return;
          }

          const item = group.items[data.row.index];
          const thumbnail = item ? itemThumbnails.get(item.id) : null;

          if (!thumbnail) return;

          try {
            const size = getContainedImageSize(
              thumbnail.width,
              thumbnail.height,
              12,
              12
            );

            document.addImage(
              thumbnail.dataUrl,
              thumbnail.format,
              data.cell.x + 3,
              data.cell.y + Math.max(2, (data.cell.height - size.height) / 2),
              size.width,
              size.height
            );
          } catch {
            // A rejected thumbnail should not block the business report.
          }
        },
      });

      const finalY =
        (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY || nextY;
      nextY = finalY + 8;
    }
  }

  if (nextY > pageHeight - 48) {
    document.addPage();
    nextY = 32;
  }

  drawTotalsBlock({
    document,
    totals,
    x: margin,
    y: nextY,
    width: pageWidth - margin * 2,
    currency: normalizedCurrency,
  });

  const pageCount = document.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    drawFooter({
      document,
      pageWidth,
      pageHeight,
      margin,
      pageNumber,
      pageCount,
      generatedAt,
    });
  }

  const filename = getReportFilename(businessName, reportType, generatedAt);

  onProgress?.("Downloading PDF...");
  document.save(filename);

  return filename;
}
