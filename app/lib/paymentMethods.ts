/* Phase 31: payment methods are the business's own list
   (Settings > Lists), stored in business_settings.payment_methods. A value is
   either a built-in key below or the business's own words ("Wish Money") --
   what gets saved on a payment is that same value, so an old payment keeps
   reading right even after the list changes. */

export const BUILT_IN_PAYMENT_METHODS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Bank transfer",
  whish: "Whish",
  omt: "OMT",
  cheque: "Cheque",
  other: "Other",
};

export const DEFAULT_PAYMENT_METHODS = ["cash", "card", "transfer", "whish", "omt", "cheque"];

export function paymentMethodLabel(method: string | null | undefined) {
  if (!method) return "";
  return BUILT_IN_PAYMENT_METHODS[method] ?? method;
}

/** Options for a payment method picker: the business's list, plus the value
 *  already chosen if it has since been removed from the list. */
export function paymentMethodOptions(list: string[] | null | undefined, current?: string | null) {
  const methods = list && list.length > 0 ? [...list] : [...DEFAULT_PAYMENT_METHODS];
  if (current && !methods.includes(current)) methods.push(current);
  return methods.map((value) => ({ value, label: paymentMethodLabel(value) }));
}

/** Clean a list typed in Settings: trimmed, no blanks, no repeats (a built-in
 *  typed by its label becomes its key), at most `max`. */
export function normalizeList(values: unknown, max: number, toKey?: (value: string) => string) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, 40);
    if (!trimmed) continue;
    const value = toKey ? toKey(trimmed) : trimmed;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= max) break;
  }
  return result;
}

/** "Bank transfer" or "transfer" -> "transfer"; anything else stays as typed. */
export function paymentMethodKey(value: string) {
  const lower = value.trim().toLowerCase();
  for (const [key, label] of Object.entries(BUILT_IN_PAYMENT_METHODS)) {
    if (lower === key || lower === label.toLowerCase()) return key;
  }
  return value.trim();
}
