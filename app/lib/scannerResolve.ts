/**
 * Shared resolution of a scanned code to an inventory item.
 *
 * Used by the Inventory quick-scan modal and the Scanner Workspace so both
 * resolve codes identically. Pure functions over an in-memory item list — no
 * Supabase access, so callers keep control of their own data loading.
 */

export interface ScannableItem {
  id: number;
  sku?: string | null;
  barcode?: string | null;
  public_id?: string | null;
}

export type ScanMatchField = "public_id" | "sku" | "barcode";

export type ScanResolution<T extends ScannableItem> =
  | { kind: "item"; item: T; matchedBy: ScanMatchField }
  | { kind: "ambiguous"; items: T[]; query: string }
  | { kind: "none"; query: string };

/**
 * Pulls a SydIN public item id out of a scanned value. Accepts either a full
 * public item URL (".../item/<publicId>") or a bare UUID.
 */
export function extractScannedPublicId(scannedText: string) {
  const trimmedText = scannedText.trim();
  const itemPathMatch = trimmedText.match(/(?:^|\/)item\/([^/?#\s]+)/i);

  if (itemPathMatch?.[1]) {
    return decodeURIComponent(itemPathMatch[1]);
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(trimmedText) ? trimmedText : "";
}

function normalize(value: string | null | undefined) {
  return (value || "").trim();
}

/**
 * Resolves a scanned code against the supplied items, in priority order:
 * public id (SydIN QR) → exact SKU → barcode → case-insensitive SKU.
 *
 * The barcode step closes a real gap: inventory rows carry a `barcode` column
 * that the original inventory scanner never matched against, so scanning a
 * product's own barcode always fell through to a plain text search.
 */
export function resolveScannedCode<T extends ScannableItem>(
  scannedText: string,
  items: T[]
): ScanResolution<T> {
  const trimmedText = scannedText.trim();

  if (!trimmedText) {
    return { kind: "none", query: "" };
  }

  const scannedPublicId = extractScannedPublicId(trimmedText);

  if (scannedPublicId) {
    const publicMatch = items.find(
      (item) => normalize(item.public_id) === scannedPublicId
    );

    if (publicMatch) {
      return { kind: "item", item: publicMatch, matchedBy: "public_id" };
    }
  }

  const exactSkuMatches = items.filter(
    (item) => normalize(item.sku) === trimmedText
  );

  if (exactSkuMatches.length === 1) {
    return { kind: "item", item: exactSkuMatches[0], matchedBy: "sku" };
  }

  if (exactSkuMatches.length > 1) {
    return { kind: "ambiguous", items: exactSkuMatches, query: trimmedText };
  }

  const barcodeMatches = items.filter(
    (item) => normalize(item.barcode) === trimmedText
  );

  if (barcodeMatches.length === 1) {
    return { kind: "item", item: barcodeMatches[0], matchedBy: "barcode" };
  }

  if (barcodeMatches.length > 1) {
    return { kind: "ambiguous", items: barcodeMatches, query: trimmedText };
  }

  const lowerText = trimmedText.toLowerCase();
  const looseSkuMatches = items.filter(
    (item) => normalize(item.sku).toLowerCase() === lowerText
  );

  if (looseSkuMatches.length === 1) {
    return { kind: "item", item: looseSkuMatches[0], matchedBy: "sku" };
  }

  if (looseSkuMatches.length > 1) {
    return { kind: "ambiguous", items: looseSkuMatches, query: trimmedText };
  }

  return { kind: "none", query: scannedPublicId || trimmedText };
}
