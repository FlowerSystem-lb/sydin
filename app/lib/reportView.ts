import type { ReportTable } from "@/app/lib/businessReportsPdf";

/**
 * The report builder's layer over a finished ReportTable (brief point 22):
 * which columns show, and which column the rows are sorted by. It never
 * recomputes a figure -- it only hides columns and reorders rows of a table
 * the report functions already built, so every total stays exactly what the
 * report says. The same view is applied to the on-screen preview, the CSV
 * and the PDF, so what you see is what you export.
 *
 * Columns are identified by their heading ("Paid", "Customer"), not by
 * position, so a saved view still fits when a report's data changes.
 */

export type SortDirection = "asc" | "desc";

export interface ReportView {
  hidden: string[];
  sortBy: string | null;
  sortDir: SortDirection;
}

export const EMPTY_REPORT_VIEW: ReportView = { hidden: [], sortBy: null, sortDir: "desc" };

export interface SavedReport {
  id: string;
  name: string;
  reportId: string;
  view: ReportView;
  /** The date range it was saved with; empty means all time. */
  from: string;
  to: string;
  createdAt: string;
}

/** A cell as something sortable: amounts and counts as numbers, dates as time. */
function sortKey(cell: string | number): number | string | null {
  if (typeof cell === "number") return cell;
  const text = String(cell).trim();
  if (!text || text === "--" || text === "—") return null;
  // "$1,200.50", "USD 1,200", "1,200 LBP", "12%", "-40"
  const bare = text.replace(/^[A-Z]{3}\s+|\s+[A-Z]{3}$/g, "");
  if (!/[A-Za-z]/.test(bare)) {
    const numeric = Number(bare.replace(/[^0-9.-]/g, ""));
    if (bare.replace(/[^0-9]/g, "") !== "" && Number.isFinite(numeric) && !/\d-\d/.test(bare)) {
      return numeric;
    }
  }
  // "Sep 13, 2026", "September 2026", "2026-09-13"
  if (/\d{4}/.test(text)) {
    const time = Date.parse(text);
    if (!Number.isNaN(time)) return time;
  }
  return text.toLocaleLowerCase();
}

function compareCells(a: string | number, b: string | number) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  // Blanks always last, whichever way the column is sorted -- handled by caller.
  if (ka === null || kb === null) return 0;
  if (typeof ka === "number" && typeof kb === "number") return ka - kb;
  if (typeof ka === "number") return -1;
  if (typeof kb === "number") return 1;
  return ka.localeCompare(kb);
}

export function applyReportView(table: ReportTable, view: ReportView): ReportTable {
  // The first column names the row (month, customer, item) and always stays.
  const keep = table.head
    .map((label, index) => ({ label, index }))
    .filter(({ label, index }) => index === 0 || !view.hidden.includes(label))
    .map(({ index }) => index);

  let rows = table.rows;
  const sortIndex = view.sortBy === null ? -1 : table.head.indexOf(view.sortBy);
  if (sortIndex >= 0) {
    const direction = view.sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((ra, rb) => {
      const blankA = sortKey(ra[sortIndex]) === null;
      const blankB = sortKey(rb[sortIndex]) === null;
      if (blankA !== blankB) return blankA ? 1 : -1;
      return compareCells(ra[sortIndex], rb[sortIndex]) * direction;
    });
  }

  const pick = <T,>(cells: T[]) => keep.map((index) => cells[index]);
  return {
    ...table,
    head: pick(table.head),
    rows: rows.map((row) => pick(row)),
    foot: table.foot ? pick(table.foot) : undefined,
    rightAligned: keep
      .map((index, position) => (table.rightAligned.includes(index) ? position : -1))
      .filter((position) => position >= 0),
  };
}

// ---- saved reports -----------------------------------------------------------
// Kept in this browser, per account. A table for them would be a schema
// change, which this sprint does not make; the page says "on this device" so
// nobody expects them on their phone.

const storageKey = (userId: string) => `sydin:saved-reports:${userId}`;

export function loadSavedReports(userId: string): SavedReport[] {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedReport =>
        Boolean(entry) &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.reportId === "string" &&
        Boolean(entry.view) &&
        Array.isArray(entry.view.hidden)
    );
  } catch {
    return [];
  }
}

export function storeSavedReports(userId: string, reports: SavedReport[]) {
  if (!userId) return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}
