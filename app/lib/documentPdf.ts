import { jsPDF } from "jspdf";
import type { CellHookData, UserOptions } from "jspdf-autotable";
import type { BusinessSettings } from "@/app/lib/businessSettings";
import {
  getContainedImageSize,
  loadExportImage,
  type LoadedExportImage,
} from "@/app/lib/exportImage";

/**
 * The page furniture every SydIN document shares.
 *
 * An invoice, a purchase order and a goods-received note say different things
 * and must not be one template with the labels swapped -- but they leave the
 * same business and should look like it. So the header bar, the "From" block,
 * the footer with the business's own line and the page numbers live here,
 * once, and each document draws its own body in between.
 *
 * What the business prints comes from Settings > Company: name, logo, address,
 * tax number, contact, payment terms and a footer line. Nothing here reads
 * the database; the caller passes a `DocumentBranding` built from the
 * settings it already has.
 */

export interface DocumentBranding {
  businessName: string;
  businessLogoUrl?: string;
  address?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
  paymentTerms?: string;
  footerLine?: string;
}

/** Everything a document needs from Settings. `canUseLogo` is the plan gate. */
export function brandingFromSettings(
  settings: BusinessSettings,
  canUseLogo = true
): DocumentBranding {
  return {
    businessName: settings.business_name?.trim() || "SydIN Account",
    businessLogoUrl: canUseLogo ? settings.business_logo_url || undefined : undefined,
    address: settings.business_address?.trim() || undefined,
    taxId: settings.tax_id?.trim() || undefined,
    phone: settings.contact_phone?.trim() || undefined,
    email: settings.contact_email?.trim() || undefined,
    website: settings.contact_website?.trim() || undefined,
    paymentTerms: settings.payment_terms?.trim() || undefined,
    footerLine: settings.document_footer?.trim() || undefined,
  };
}

export const DOCUMENT_MARGIN = 14;
export const DOCUMENT_HEADER_HEIGHT = 36;
/** Space the footer needs at the bottom of every page. */
export const DOCUMENT_FOOTER_HEIGHT = 20;

export const DOCUMENT_INK: [number, number, number] = [15, 23, 42];
export const DOCUMENT_MUTED: [number, number, number] = [100, 116, 139];
export const DOCUMENT_RULE: [number, number, number] = [226, 232, 240];
export const DOCUMENT_FILL: [number, number, number] = [248, 250, 252];

export interface DocumentContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  branding: DocumentBranding;
  logo: LoadedExportImage | null;
  /** First free y below the header on a fresh page. */
  contentTop: number;
  /** Last usable y before the footer. */
  contentBottom: number;
  generatedAt: Date;
}

export interface DocumentHeaderSpec {
  /** "Invoice", "Purchase Order", "Goods Received" -- the document's name. */
  kind: string;
  /** The number the customer or supplier quotes back: INV-2026-0042. */
  number: string;
  /** Right-hand second line: status, or a date. */
  meta?: string;
}

export function formatDocumentDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export function slugifyDocumentName(value: string, fallback = "document") {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

/** Opens an A4 portrait document and draws the header on page one. */
export async function openDocument(
  branding: DocumentBranding,
  header: DocumentHeaderSpec
): Promise<DocumentContext> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const loadedLogo = branding.businessLogoUrl
    ? await loadExportImage(branding.businessLogoUrl)
    : null;
  const logo = loadedLogo ? await shrinkForThumbnail(loadedLogo, 512) : null;
  const context: DocumentContext = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: DOCUMENT_MARGIN,
    branding,
    logo,
    contentTop: DOCUMENT_HEADER_HEIGHT + 12,
    contentBottom: doc.internal.pageSize.getHeight() - DOCUMENT_FOOTER_HEIGHT,
    generatedAt: new Date(),
  };
  drawDocumentHeader(context, header);
  return context;
}

/** The dark bar: logo plate, business name, document kind; number on the right. */
export function drawDocumentHeader(
  { doc, pageWidth, margin, branding, logo }: DocumentContext,
  header: DocumentHeaderSpec
) {
  doc.setFillColor(...DOCUMENT_INK);
  doc.rect(0, 0, pageWidth, DOCUMENT_HEADER_HEIGHT, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, DOCUMENT_HEADER_HEIGHT, pageWidth, 1.2, "F");

  let textX = margin;
  if (logo) {
    const size = getContainedImageSize(logo.width, logo.height, 22, 22);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 7, 24, 24, 3, 3, "F");
    doc.addImage(
      logo.dataUrl,
      logo.extension === "png" ? "PNG" : "JPEG",
      margin + (24 - size.width) / 2,
      7 + (24 - size.height) / 2,
      size.width,
      size.height
    );
    textX = margin + 30;
  }

  // The name gets one line. A long registered name shrinks first, then is
  // cut with an ellipsis; wrapping it would land on the document kind below.
  const nameRoom = pageWidth - textX - margin - 58;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  let nameSize = 14;
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(branding.businessName) > nameRoom && nameSize > 9.5) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  let name = branding.businessName;
  while (doc.getTextWidth(name) > nameRoom && name.length > 4) {
    name = `${name.slice(0, -2).trimEnd()}...`;
  }
  doc.text(name, textX, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(header.kind, textX, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(header.number, pageWidth - margin, 16, { align: "right" });
  if (header.meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(header.meta, pageWidth - margin, 23, { align: "right" });
  }
}

export interface DocumentColumn {
  heading: string;
  rows: string[];
}

/** The business's own block: name, address lines, tax number, contact. */
export function fromColumn(branding: DocumentBranding): DocumentColumn {
  return {
    heading: "From",
    rows: [
      branding.businessName,
      ...(branding.address ? branding.address.split(/\r?\n/) : []),
      branding.taxId ? `Tax / Reg. ${branding.taxId}` : "",
      branding.phone || "",
      branding.email || "",
      branding.website || "",
    ].filter(Boolean),
  };
}

/**
 * Two or three columns of small text under the header -- From / Bill to /
 * Details. Returns the y where the body can start.
 */
export function drawColumns(
  { doc, pageWidth, margin }: DocumentContext,
  startY: number,
  columns: DocumentColumn[]
) {
  const gap = 6;
  const width = (pageWidth - margin * 2 - gap * (columns.length - 1)) / columns.length;
  let deepest = startY;

  columns.forEach((column, index) => {
    const x = margin + index * (width + gap);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(column.heading.toUpperCase(), x, startY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_INK);
    let y = startY + 5.5;
    for (const row of column.rows) {
      const lines = doc.splitTextToSize(row, width) as string[];
      doc.text(lines, x, y);
      y += lines.length * 4.4;
    }
    deepest = Math.max(deepest, y);
  });

  return deepest + 4;
}

/** Adds a page and redraws the header so tables can continue under it. */
export function continueOnNewPage(context: DocumentContext, header: DocumentHeaderSpec) {
  context.doc.addPage();
  drawDocumentHeader(context, header);
  return context.contentTop;
}

/** Makes sure `needed` mm fit above the footer, else starts a new page. */
export function ensureRoom(
  context: DocumentContext,
  header: DocumentHeaderSpec,
  y: number,
  needed: number
) {
  return y + needed > context.contentBottom ? continueOnNewPage(context, header) : y;
}

/**
 * Footer on every page: the business's footer line (or its contact) on the
 * left, "reference · Page n of N" on the right. Called last, once.
 */
export function finishDocument(
  { doc, pageWidth, pageHeight, margin, branding, generatedAt }: DocumentContext,
  reference: string
) {
  const left =
    branding.footerLine ||
    [branding.phone, branding.email, branding.website].filter(Boolean).join("  ·  ") ||
    branding.businessName;
  const generated = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(generatedAt);
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...DOCUMENT_RULE);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(left, margin, pageHeight - 8, { maxWidth: pageWidth * 0.6 });
    doc.text(
      `${reference}  ·  Page ${page} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${generated} with SydIN`, pageWidth - margin, pageHeight - 4, {
      align: "right",
    });
  }
}

/* ---- line thumbnails ------------------------------------------------------ */

export const THUMB_SIZE = 9;
/** Left padding that leaves room for the thumbnail in the first column. */
export const THUMB_COLUMN_PADDING = THUMB_SIZE + 4;

/**
 * A product photo is a phone upload -- often 3000px and 2MB -- and a
 * thumbnail on paper is 9mm. Embedding the original would put every one of
 * those megabytes into the PDF or Word file. In the browser the image is
 * redrawn at thumbnail size first; where there is no canvas (tests) it is
 * used as it is.
 */
export async function shrinkForThumbnail(
  image: LoadedExportImage,
  maxPx = 240
): Promise<LoadedExportImage> {
  if (typeof document === "undefined" || Math.max(image.width, image.height) <= maxPx) {
    return image;
  }
  try {
    const scale = maxPx / Math.max(image.width, image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode failed"));
      element.src = image.dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return image;
    // White behind transparent PNGs: JPEG has no alpha, and a black square
    // where the background was is worse than no photo.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.82),
      extension: "jpeg",
      width,
      height,
    };
  } catch {
    return image;
  }
}

/**
 * Loads up to `limit` line images in parallel batches, shrunk to thumbnail
 * size. Anything missing or failing is simply absent from the map; the row
 * prints without a photo.
 */
export async function loadLineImages(
  urls: Array<string | null | undefined>,
  limit = 60
) {
  const unique = Array.from(new Set(urls.filter((url): url is string => Boolean(url)))).slice(
    0,
    limit
  );
  const images = new Map<string, LoadedExportImage>();
  const batch = 6;
  for (let index = 0; index < unique.length; index += batch) {
    const slice = unique.slice(index, index + batch);
    const loaded = await Promise.all(
      slice.map(async (url) => {
        const image = await loadExportImage(url, 6_000_000);
        return image ? shrinkForThumbnail(image) : null;
      })
    );
    loaded.forEach((image, offset) => {
      if (image) images.set(slice[offset], image);
    });
  }
  return images;
}

/**
 * autoTable hook that draws the row's thumbnail inside the first body cell.
 * `imageForRow(index)` returns the loaded image for a body row, or null; a
 * null draws a faint placeholder square so the column stays aligned.
 */
export function thumbnailCellHook(
  doc: jsPDF,
  imageForRow: (rowIndex: number) => LoadedExportImage | null | undefined
): NonNullable<UserOptions["didDrawCell"]> {
  return (data: CellHookData) => {
    if (data.section !== "body" || data.column.index !== 0) return;
    const image = imageForRow(data.row.index);
    // undefined: this row has no photo slot at all (a delivery charge).
    if (image === undefined) return;
    const x = data.cell.x + 2;
    const y = data.cell.y + 2;
    if (image) {
      const size = getContainedImageSize(image.width, image.height, THUMB_SIZE, THUMB_SIZE);
      doc.addImage(
        image.dataUrl,
        image.extension === "png" ? "PNG" : "JPEG",
        x + (THUMB_SIZE - size.width) / 2,
        y + (THUMB_SIZE - size.height) / 2,
        size.width,
        size.height
      );
    } else {
      doc.setDrawColor(...DOCUMENT_RULE);
      doc.setFillColor(...DOCUMENT_FILL);
      doc.roundedRect(x, y, THUMB_SIZE, THUMB_SIZE, 1.5, 1.5, "FD");
    }
  };
}
