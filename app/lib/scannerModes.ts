/** The eight Scanner modes, shared by the laptop page and the phone (/pair). */
export type ScannerMode =
  | "lookup"
  | "add"
  | "receive"
  | "issue"
  | "count"
  | "transfer"
  | "assign"
  | "repair"
  | "return";

export interface ScannerModeInfo {
  id: ScannerMode;
  label: string;
  /** One line: what a scan does in this mode (the banner under the mode bar). */
  description: string;
  /** Dot colour in the mode bar. */
  dot: string;
}

export const SCANNER_MODES: ScannerModeInfo[] = [
  { id: "lookup", label: "Lookup", description: "Scan to open an item. SydIN QR links open the item page directly.", dot: "#2447d6" },
  { id: "add", label: "Add items", description: "Scan new barcodes to build a list, name them, then create them all at once.", dot: "#111318" },
  { id: "receive", label: "Receive", description: "Each scan adds the item to a receive list. Scan twice for 2. Then receive them all at once.", dot: "#0f7a4f" },
  { id: "issue", label: "Issue", description: "Each scan adds the item to an issue list. Scan twice for 2. Then issue them all at once.", dot: "#c42b1c" },
  { id: "count", label: "Count", description: "Each scan adds one to the stock count open in this browser.", dot: "#6d4ad6" },
  { id: "transfer", label: "Transfer", description: "Scan an item, then move it to another depot.", dot: "#0b6e85" },
  { id: "assign", label: "Assign", description: "Scan a tracked unit, then assign it to a person.", dot: "#a8560a" },
  { id: "repair", label: "Repair", description: "Scan a tracked unit to send it for repair.", dot: "#b4232c" },
  { id: "return", label: "Return", description: "Scan a tracked unit to return it to stock.", dot: "#147a3d" },
];

export function isScannerMode(value: string | null | undefined): value is ScannerMode {
  return Boolean(value) && SCANNER_MODES.some((mode) => mode.id === value);
}

export function getScannerMode(id: string | null | undefined) {
  return SCANNER_MODES.find((mode) => mode.id === id) || SCANNER_MODES[0];
}

/** "barcode" -> "barcode", "public_id" -> "SydIN QR link", for people. */
export function describeMatch(matchedBy?: string | null) {
  switch (matchedBy) {
    case "public_id":
      return "SydIN QR link";
    case "sku":
      return "SKU";
    case "barcode":
      return "barcode";
    case "item_code":
      return "item code";
    default:
      return "code";
  }
}
