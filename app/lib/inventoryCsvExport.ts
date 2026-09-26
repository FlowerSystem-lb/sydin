import { neutralizeSpreadsheetFormula } from "@/app/lib/exportSafety";

/**
 * The inventory CSV, in one place. Inventory's own export and the Import &
 * Export page both write this file; before 26 Sep the headers, the escaping
 * and the download lived inside the Inventory page only, so the second page
 * would have been a copy that drifts.
 *
 * Callers resolve every label (category, depot, supplier) before handing rows
 * over -- this module knows the file format, not the database.
 */

export const INVENTORY_CSV_HEADERS = [
  "Name",
  "SKU",
  "Category",
  "Depot",
  "Quantity",
  "Low Stock",
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
  "Supplier Name",
] as const;

export type InventoryCsvCell = string | number | null | undefined;

export function escapeCsvValue(value: InventoryCsvCell) {
  // Two jobs, both required. neutralizeSpreadsheetFormula stops Excel executing
  // a cell that begins with = + - @; the quoting keeps the file parseable.
  const stringValue = String(neutralizeSpreadsheetFormula(value) ?? "");

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/** One row per item, in INVENTORY_CSV_HEADERS order. */
export function buildInventoryCsv(rows: InventoryCsvCell[][]) {
  return [[...INVENTORY_CSV_HEADERS], ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

export function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sydin"
  );
}

/** Hands the browser a text file. Returns the name it was saved under. */
export function downloadTextFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
  return filename;
}
