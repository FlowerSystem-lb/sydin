import { jsPDF } from "jspdf";

export type QrLabelLayout = "single" | "2x2" | "3x3" | "a4-grid";
export type QrLabelBranding = "sydin" | "business" | "none";
export type QrLabelSize = "small" | "medium" | "large";

export interface QrLabelSettings {
  layout: QrLabelLayout;
  branding: QrLabelBranding;
  showName: boolean;
  showIdentifier: boolean;
  showUrl: boolean;
  qrSize: QrLabelSize;
}

export interface QrLabelPdfItem {
  id: number;
  name: string;
  identifier: string;
  publicUrl: string;
  qrSvg: string;
}

const layoutGrid: Record<
  QrLabelLayout,
  { columns: number; rows: number }
> = {
  single: { columns: 1, rows: 1 },
  "2x2": { columns: 2, rows: 2 },
  "3x3": { columns: 3, rows: 3 },
  "a4-grid": { columns: 3, rows: 5 },
};

const qrScale: Record<QrLabelSize, number> = {
  small: 0.48,
  medium: 0.6,
  large: 0.72,
};

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = source;
  });
}

async function svgToPng(svg: string, size = 900) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");

    if (!context) throw new Error("QR image could not be prepared.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function getLogoData(logoUrl: string) {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const image = await loadImage(dataUrl);

    return {
      dataUrl,
      format: blob.type.includes("jpeg") ? "JPEG" : "PNG",
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } catch {
    return null;
  }
}

function getContainedSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height);

  return {
    width: width * ratio,
    height: height * ratio,
  };
}

export async function exportQrLabelsPdf({
  items,
  settings,
  logoUrl,
}: {
  items: QrLabelPdfItem[];
  settings: QrLabelSettings;
  logoUrl?: string;
}) {
  if (items.length === 0) {
    throw new Error("Select at least one item before creating labels.");
  }

  const document = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 8;
  const gap = 4;
  const grid = layoutGrid[settings.layout];
  const labelWidth =
    (pageWidth - margin * 2 - gap * (grid.columns - 1)) / grid.columns;
  const labelHeight =
    (pageHeight - margin * 2 - gap * (grid.rows - 1)) / grid.rows;
  const labelsPerPage = grid.columns * grid.rows;
  const logo = logoUrl ? await getLogoData(logoUrl) : null;
  const qrImages = await Promise.all(
    items.map(async (item) => ({
      item,
      qr: await svgToPng(item.qrSvg),
    }))
  );

  qrImages.forEach(({ item, qr }, index) => {
    if (index > 0 && index % labelsPerPage === 0) {
      document.addPage();
    }

    const pageIndex = index % labelsPerPage;
    const column = pageIndex % grid.columns;
    const row = Math.floor(pageIndex / grid.columns);
    const x = margin + column * (labelWidth + gap);
    const y = margin + row * (labelHeight + gap);
    const padding = Math.max(3, Math.min(7, labelWidth * 0.06));

    document.setFillColor(255, 255, 255);
    document.setDrawColor(215, 222, 234);
    document.roundedRect(x, y, labelWidth, labelHeight, 2.5, 2.5, "FD");

    let contentTop = y + padding;
    if (settings.branding !== "none") {
      if (logo) {
        const logoSize = getContainedSize(
          logo.width,
          logo.height,
          Math.min(34, labelWidth * 0.48),
          Math.min(10, labelHeight * 0.12)
        );
        try {
          document.addImage(
            logo.dataUrl,
            logo.format,
            x + (labelWidth - logoSize.width) / 2,
            contentTop,
            logoSize.width,
            logoSize.height
          );
          contentTop += logoSize.height + 2;
        } catch {
          contentTop += 1;
        }
      } else if (settings.branding === "sydin") {
        document.setFont("helvetica", "bold");
        document.setFontSize(Math.max(8, Math.min(13, labelWidth * 0.14)));
        document.setTextColor(15, 31, 58);
        document.text("SydIN", x + labelWidth / 2, contentTop + 4, {
          align: "center",
        });
        contentTop += 7;
      }
    }

    const textReserve =
      (settings.showName ? 10 : 0) +
      (settings.showIdentifier && item.identifier ? 6 : 0) +
      (settings.showUrl ? 7 : 0);
    const availableQrHeight = Math.max(
      22,
      labelHeight - (contentTop - y) - padding - textReserve
    );
    const qrSize = Math.min(
      labelWidth - padding * 2,
      availableQrHeight,
      Math.min(labelWidth, labelHeight) * qrScale[settings.qrSize]
    );

    document.addImage(
      qr,
      "PNG",
      x + (labelWidth - qrSize) / 2,
      contentTop,
      qrSize,
      qrSize
    );
    let textY = contentTop + qrSize + 4;

    if (settings.showName) {
      document.setFont("helvetica", "bold");
      document.setFontSize(Math.max(7, Math.min(12, labelWidth * 0.1)));
      document.setTextColor(15, 23, 42);
      const nameLines = document.splitTextToSize(
        item.name,
        labelWidth - padding * 2
      );
      document.text(nameLines.slice(0, 2), x + labelWidth / 2, textY, {
        align: "center",
      });
      textY += Math.min(2, nameLines.length) * 4.2;
    }

    if (settings.showIdentifier && item.identifier) {
      document.setFont("helvetica", "normal");
      document.setFontSize(Math.max(6, Math.min(9, labelWidth * 0.075)));
      document.setTextColor(100, 116, 139);
      document.text(item.identifier, x + labelWidth / 2, textY, {
        align: "center",
        maxWidth: labelWidth - padding * 2,
      });
      textY += 4;
    }

    if (settings.showUrl) {
      document.setFont("helvetica", "normal");
      document.setFontSize(Math.max(5.5, Math.min(7.5, labelWidth * 0.06)));
      document.setTextColor(71, 85, 105);
      document.text(
        item.publicUrl.replace(/^https?:\/\//, ""),
        x + labelWidth / 2,
        textY,
        {
          align: "center",
          maxWidth: labelWidth - padding * 2,
        }
      );
    }
  });

  const filename = `SydIN-QR-Labels-${formatDateForFilename(new Date())}.pdf`;
  document.save(filename);
  return filename;
}
