import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfInventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  sku?: string;
  notes?: string;
  depotLabel: string;
}

export interface PdfBusinessBranding {
  businessName: string;
  businessLogoUrl: string;
}

export interface ExportInventoryPdfOptions {
  items: PdfInventoryItem[];
  branding: PdfBusinessBranding;
  lowStockThreshold: number;
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
  const source = `${contentType || ""} ${url}`.toLowerCase();

  if (source.includes("png")) return "PNG";
  if (source.includes("webp")) return "WEBP";

  return "JPEG";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getLogoData(logoUrl: string) {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);

    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    return {
      dataUrl,
      format: getImageFormat(logoUrl, response.headers.get("content-type")),
    };
  } catch {
    return null;
  }
}

export async function exportInventoryPdf({
  items,
  branding,
  lowStockThreshold,
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
  const lowStockCount = items.filter((item) => item.quantity <= threshold).length;
  const logo = await getLogoData(branding.businessLogoUrl);
  const headerStartX = logo ? 38 : margin;

  document.setFillColor(8, 11, 24);
  document.rect(0, 0, pageWidth, 34, "F");

  if (logo) {
    try {
      document.addImage(logo.dataUrl, logo.format, margin, 9, 18, 18);
    } catch {
      // Keep export resilient if a browser/PDF image decoder rejects the logo.
    }
  }

  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(15);
  document.text(businessName, headerStartX, 15);

  document.setFontSize(22);
  document.text("Inventory Report", headerStartX, 25);

  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(196, 204, 220);
  document.text(`Generated ${formatDateForDisplay(generatedAt)}`, pageWidth - margin, 15, {
    align: "right",
  });
  document.text(
    `${items.length} ${items.length === 1 ? "item" : "items"} | ${lowStockCount} low stock`,
    pageWidth - margin,
    23,
    {
      align: "right",
    }
  );

  autoTable(document, {
    startY: 42,
    head: [["Name", "SKU", "Category", "Depot", "Quantity", "Low Stock", "Notes"]],
    body: items.map((item) => [
      item.name,
      item.sku || "N/A",
      item.category,
      item.depotLabel,
      String(item.quantity),
      item.quantity <= threshold ? "Yes" : "No",
      item.notes || "",
    ]),
    margin: {
      left: margin,
      right: margin,
      bottom: 18,
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.4,
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
      0: { cellWidth: 46 },
      1: { cellWidth: 28 },
      2: { cellWidth: 32 },
      3: { cellWidth: 38 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 24 },
      6: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5 && data.cell.raw === "Yes") {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
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
    document.text("Generated by SydIn", margin, pageHeight - 7);
    document.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  const filename = `${slugifyFilename(businessName)}-inventory-report-${formatDateForFilename(
    generatedAt
  )}.pdf`;

  document.save(filename);

  return filename;
}
