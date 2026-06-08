import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calculateInventoryValue,
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

export interface PdfInventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  sku?: string;
  notes?: string;
  image?: string;
  depotLabel: string;
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
}

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

function getImageFormat(url: string, contentType: string | null) {
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

async function getImageData(imageUrl: string, maxBytes = 1_500_000) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) return null;

    const blob = await response.blob();

    if (blob.size > maxBytes) return null;

    const format = getImageFormat(imageUrl, response.headers.get("content-type"));

    if (!format) return null;

    const dataUrl = await blobToDataUrl(blob);
    const dimensions = await getImageDimensions(dataUrl);

    return {
      dataUrl,
      format,
      ...dimensions,
    };
  } catch {
    return null;
  }
}

async function getLogoData(logoUrl: string) {
  return getImageData(logoUrl);
}

async function getItemThumbnailData(items: PdfInventoryItem[]) {
  const thumbnailItems = items
    .filter((item) => item.image)
    .slice(0, 50);
  const thumbnailEntries = await Promise.all(
    thumbnailItems.map(async (item) => {
      const imageData = await getImageData(item.image || "", 900_000);

      return [item.id, imageData] as const;
    })
  );

  return new Map(
    thumbnailEntries.filter((entry): entry is readonly [
      number,
      NonNullable<Awaited<ReturnType<typeof getImageData>>>
    ] => Boolean(entry[1]))
  );
}

export async function exportInventoryPdf({
  items,
  branding,
  lowStockThreshold,
  currencyCode,
}: ExportInventoryPdfOptions) {
  const generatedAt = new Date();
  const document = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 14;
  const businessName = branding.businessName.trim() || "SydIn Account";
  const threshold = Number.isFinite(lowStockThreshold)
    ? lowStockThreshold
    : 10;
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, "USD");
  const isLowStock = (item: PdfInventoryItem) =>
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
  const logo = await getLogoData(branding.businessLogoUrl);
  const itemThumbnails = await getItemThumbnailData(items);
  const thumbnailCandidateIds = new Set(
    items
      .filter((item) => item.image)
      .slice(0, 50)
      .map((item) => item.id)
  );
  const headerStartX = logo ? 40 : margin;
  const contactLines = [
    branding.contactEmail,
    branding.contactPhone,
    branding.contactWebsite,
  ].filter(Boolean) as string[];

  document.setFillColor(8, 11, 24);
  document.rect(0, 0, pageWidth, 42, "F");

  if (logo) {
    try {
      document.addImage(logo.dataUrl, logo.format, margin, 9, 20, 20);
    } catch {
      // Keep export resilient if a browser/PDF image decoder rejects the logo.
    }
  }

  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.text(businessName, headerStartX, 14);

  document.setFontSize(22);
  document.text("Inventory Report", headerStartX, 25);

  if (contactLines.length > 0) {
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(196, 204, 220);
    document.text(contactLines.join("  |  "), headerStartX, 34);
  }

  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(196, 204, 220);
  const wordmarkX = pageWidth - margin - 43;
  document.setFont("helvetica", "bold");
  document.setFontSize(15);
  document.setTextColor(255, 255, 255);
  document.text("Syd", wordmarkX, 14);
  document.setFillColor(79, 70, 229);
  document.roundedRect(wordmarkX + 16, 7.5, 14, 8.5, 1.8, 1.8, "F");
  document.setFontSize(9);
  document.text("IN", wordmarkX + 19, 13.2);

  document.setFont("helvetica", "normal");
  document.setFontSize(8.5);
  document.setTextColor(196, 204, 220);
  document.text(`Generated ${formatDateForDisplay(generatedAt)}`, pageWidth - margin, 24, {
    align: "right",
  });
  document.text(
    `${items.length} ${items.length === 1 ? "item" : "items"} | ${lowStockCount} low stock`,
    pageWidth - margin,
    32,
    {
      align: "right",
    }
  );

  const summaryTop = 50;
  const summaryCards = [
    ["Total items", String(items.length)],
    ["Total quantity", String(totalQuantity)],
    ["Low stock", String(lowStockCount)],
    ["Assigned depots", String(assignedDepotCount)],
    ["Unassigned", String(unassignedItemCount)],
  ];
  const cardGap = 3;
  const cardWidth =
    (pageWidth - margin * 2 - cardGap * (summaryCards.length - 1)) /
    summaryCards.length;

  summaryCards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);

    document.setFillColor(248, 250, 252);
    document.setDrawColor(226, 232, 240);
    document.roundedRect(x, summaryTop, cardWidth, 18, 2.5, 2.5, "FD");
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(100, 116, 139);
    document.text(label.toUpperCase(), x + 4, summaryTop + 6);
    document.setFont("helvetica", "bold");
    document.setFontSize(13);
    document.setTextColor(15, 23, 42);
    document.text(value, x + 4, summaryTop + 14);
  });

  autoTable(document, {
    startY: summaryTop + 26,
    head: [
      [
        "Image",
        "Item",
        "Tracking",
        "Category / Depot",
        "Stock",
        "Pricing / Value",
        "Status",
        "Notes",
      ],
    ],
    body: items.map((item) => {
      const costValue = calculateInventoryValue(
        item.quantity,
        item.costPrice
      );
      const retailValue = calculateInventoryValue(
        item.quantity,
        item.sellingPrice
      );
      const trackingLines = [
        item.sku ? `SKU: ${item.sku}` : "",
        item.barcode ? `Barcode: ${item.barcode}` : "",
      ].filter(Boolean);
      const pricingLines = [
        item.costPrice != null && item.costPrice !== ""
          ? `Cost: ${formatInventoryPrice(item.costPrice, normalizedCurrency)}`
          : "",
        costValue != null
          ? `Cost value: ${formatInventoryPrice(costValue, normalizedCurrency)}`
          : "",
        item.sellingPrice != null && item.sellingPrice !== ""
          ? `Sell: ${formatInventoryPrice(item.sellingPrice, normalizedCurrency)}`
          : "",
        retailValue != null
          ? `Retail value: ${formatInventoryPrice(retailValue, normalizedCurrency)}`
          : "",
      ].filter(Boolean);
      const stockLines = [
        getInventoryQuantityLabel(
          item.quantity,
          item.unitType,
          item.customUnitLabel
        ),
        item.minStockLevel != null ? `Min: ${item.minStockLevel}` : "",
      ].filter(Boolean);

      return [
        itemThumbnails.has(item.id)
          ? ""
          : item.image && !thumbnailCandidateIds.has(item.id)
            ? "Image available"
            : "No image",
        [item.name, item.itemCode ? `Code: ${item.itemCode}` : ""]
          .filter(Boolean)
          .join("\n"),
        trackingLines.join("\n"),
        [item.category, item.depotLabel].filter(Boolean).join("\n"),
        stockLines.join("\n"),
        pricingLines.join("\n"),
        isLowStock(item) ? "Low Stock" : "In Stock",
        item.notes || "",
      ];
    }),
    margin: {
      left: margin,
      right: margin,
      bottom: 18,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "top",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: "center", minCellHeight: 14 },
      1: { cellWidth: 35 },
      2: { cellWidth: 38 },
      3: { cellWidth: 34 },
      4: { cellWidth: 24 },
      5: { cellWidth: 46 },
      6: { cellWidth: 24 },
      7: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6 && data.cell.raw === "Low Stock") {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
      }

      if (data.section === "body" && data.column.index === 6 && data.cell.raw === "In Stock") {
        data.cell.styles.textColor = [22, 101, 52];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;

      const item = items[data.row.index];
      const thumbnail = item ? itemThumbnails.get(item.id) : null;

      if (!thumbnail) return;

      try {
        const size = getContainedImageSize(
          thumbnail.width,
          thumbnail.height,
          13,
          10
        );

        document.addImage(
          thumbnail.dataUrl,
          thumbnail.format,
          data.cell.x + (data.cell.width - size.width) / 2,
          data.cell.y + (data.cell.height - size.height) / 2,
          size.width,
          size.height
        );
      } catch {
        // Keep the table exportable even if a thumbnail decoder rejects a file.
      }
    },
  });

  const pageCount = document.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    document.setDrawColor(226, 232, 240);
    document.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(100, 116, 139);
    document.text("Generated by SydIN", margin, pageHeight - 7);
    document.text(`Page ${pageNumber} of ${pageCount} | ${formatDateForDisplay(generatedAt)}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  const filename = `${slugifyFilename(businessName)}-inventory-report-${formatDateForFilename(
    generatedAt
  )}.pdf`;

  document.save(filename);

  return filename;
}
