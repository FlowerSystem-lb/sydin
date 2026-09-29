/* Phase 30. Tax figures for printed documents (PDF, Word, Excel), kept free
   of any document library so each export only loads what it needs. */

/** Subtotal, tax and total for a printed invoice -- same rule as
 *  getSalesOrderTotals (tax on top rounded once on the subtotal). */
export function getInvoiceDocumentTotals(
  lines: { lineTotal: number }[],
  details: { taxName?: string | null; taxRate?: number | null; pricesIncludeTax?: boolean }
) {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const rate = Number(details.taxRate) || 0;
  const taxName = details.taxName?.trim() || "VAT";
  if (rate <= 0) return { subtotal, tax: 0, total: subtotal, rate: 0, taxName, included: false, hasTax: false };
  const round = (value: number) => Math.round(value * 100) / 100;
  if (details.pricesIncludeTax) {
    return { subtotal, tax: round(subtotal - subtotal / (1 + rate / 100)), total: subtotal, rate, taxName, included: true, hasTax: true };
  }
  const tax = round((subtotal * rate) / 100);
  return { subtotal, tax, total: subtotal + tax, rate, taxName, included: false, hasTax: true };
}

/** "VAT 11%" / "VAT 11% (included)" */
export function invoiceTaxLabel(totals: { taxName: string; rate: number; included: boolean }) {
  return `${totals.taxName} ${totals.rate}%${totals.included ? " (included)" : ""}`;
}
