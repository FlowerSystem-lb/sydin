/**
 * Read/write access to the Stock Counts draft that the Scanner Workspace's
 * Count mode feeds.
 *
 * The draft is owned by app/dashboard/stock-counts/page.tsx and lives in
 * sessionStorage (same-tab only). This helper is deliberately defensive: it
 * validates the payload shape before touching it and refuses to write rather
 * than risk corrupting an in-progress count if that page's format ever changes.
 */

export const STOCK_COUNT_DRAFT_STORAGE_KEY = "sydin:stock-counts-draft";

export interface StockCountDraftRow {
  itemId: number;
  expectedQuantity: number;
  countedQuantity: string;
  note: string;
}

export interface StockCountDraft {
  step: "setup" | "count" | "review" | "finalized";
  countName: string;
  countNotes: string;
  scope: string;
  categoryId: string;
  depotId: string;
  showExpected: boolean;
  rows: StockCountDraftRow[];
  savedAt?: string;
}

export type StockCountScanOutcome =
  | { ok: true; row: StockCountDraftRow; added: boolean; countedQuantity: number }
  | { ok: false; reason: "no-draft" | "finalized" | "unreadable" };

function isDraftRow(value: unknown): value is StockCountDraftRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.itemId === "number" &&
    typeof row.expectedQuantity === "number" &&
    typeof row.countedQuantity === "string" &&
    typeof row.note === "string"
  );
}

function isDraft(value: unknown): value is StockCountDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.step === "string" &&
    ["setup", "count", "review", "finalized"].includes(draft.step) &&
    Array.isArray(draft.rows) &&
    draft.rows.every(isDraftRow)
  );
}

export function readStockCountDraft(): StockCountDraft | null {
  try {
    const stored = window.sessionStorage.getItem(STOCK_COUNT_DRAFT_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Records one scan against the active count: increments the item's counted
 * quantity by `increment`, adding the row if the count doesn't include the item
 * yet. Returns why it could not be recorded instead of throwing.
 */
export function applyScanToStockCountDraft({
  itemId,
  expectedQuantity,
  increment = 1,
}: {
  itemId: number;
  expectedQuantity: number;
  increment?: number;
}): StockCountScanOutcome {
  const draft = readStockCountDraft();

  if (!draft) return { ok: false, reason: "no-draft" };
  if (draft.step === "finalized") return { ok: false, reason: "finalized" };

  const existing = draft.rows.find((row) => row.itemId === itemId);
  const currentCount = existing ? Number(existing.countedQuantity) : 0;
  const baseCount = Number.isFinite(currentCount) && currentCount >= 0 ? currentCount : 0;
  const nextCount = baseCount + increment;

  const nextRow: StockCountDraftRow = existing
    ? { ...existing, countedQuantity: String(nextCount) }
    : {
        itemId,
        expectedQuantity,
        countedQuantity: String(nextCount),
        note: "",
      };

  const nextDraft: StockCountDraft = {
    ...draft,
    // A scan means counting is under way; never regress a review back to setup.
    step: draft.step === "setup" ? "count" : draft.step,
    rows: existing
      ? draft.rows.map((row) => (row.itemId === itemId ? nextRow : row))
      : [...draft.rows, nextRow],
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(
      STOCK_COUNT_DRAFT_STORAGE_KEY,
      JSON.stringify(nextDraft)
    );
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  return {
    ok: true,
    row: nextRow,
    added: !existing,
    countedQuantity: nextCount,
  };
}
