/**
 * One place that knows what money is worth.
 *
 * Every amount SydIN stores -- an item's price, a stock value, an order line
 * -- is a plain number in the account's BASE currency. The account also has
 * a DISPLAY currency, which is what people see. Until phase 25 those were the
 * same field, so switching Settings from USD to LBP relabelled every USD price
 * as LBP without touching the number. Now the switch converts.
 *
 * Rates are kept the way every free rate feed publishes them: 1 USD = x.
 * Converting from any currency A to any currency B is then
 * amount / rate[A] * rate[B]. A rate the business types in Settings
 * (`manual_rates`) wins over the live one, because the number a Lebanese
 * depot actually trades at is not always the number a feed reports.
 *
 * Module-level context: `formatInventoryPrice` is called in sixty places with
 * the display currency, and each of those passes a base-currency number. The
 * shell sets the context once from Settings and the formatter converts on
 * the way out; nothing at the call sites changes. Amounts that are already in
 * a specific currency (an invoice issued in LBP) use `formatExactPrice`.
 */

export type RateTable = Record<string, number>;

export interface CurrencyContext {
  /** The currency stored amounts are in. */
  base: string;
  /** The currency the app shows. */
  display: string;
  /** 1 USD = x, live and manual merged (manual wins). */
  rates: RateTable;
}

let context: CurrencyContext = { base: "USD", display: "USD", rates: { USD: 1 } };

const listeners = new Set<() => void>();

export function setCurrencyContext(next: Partial<CurrencyContext>) {
  context = {
    base: normalize(next.base ?? context.base),
    display: normalize(next.display ?? context.display),
    rates: { USD: 1, ...(next.rates ?? context.rates) },
  };
  listeners.forEach((listener) => listener());
}

export function getCurrencyContext(): CurrencyContext {
  return context;
}

/** For hooks that want to re-render when the context changes. */
export function subscribeCurrencyContext(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalize(code: string | null | undefined, fallback = "USD") {
  const upper = code?.trim().toUpperCase();
  return upper && /^[A-Z]{3}$/.test(upper) ? upper : fallback;
}

/** Live rates merged with the business's own; the business wins. */
export function mergeRates(live: RateTable | null | undefined, manual: RateTable | null | undefined): RateTable {
  const merged: RateTable = { USD: 1 };
  for (const [code, rate] of Object.entries(live ?? {})) {
    if (Number.isFinite(rate) && rate > 0) merged[normalize(code)] = rate;
  }
  for (const [code, rate] of Object.entries(manual ?? {})) {
    if (Number.isFinite(rate) && rate > 0) merged[normalize(code)] = rate;
  }
  return merged;
}

/** Units of `to` per one unit of `from`, or null when a rate is missing. */
export function getExchangeRate(from: string, to: string, rates: RateTable = context.rates) {
  const a = normalize(from);
  const b = normalize(to);
  if (a === b) return 1;
  const rateA = rates[a];
  const rateB = rates[b];
  if (!rateA || !rateB) return null;
  return rateB / rateA;
}

/** Converts an amount, or returns it unchanged when no rate is known. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: RateTable = context.rates
) {
  const rate = getExchangeRate(from, to, rates);
  return rate === null ? amount : amount * rate;
}

/** A base-currency amount as the display currency would show it. */
export function toDisplayCurrency(amountInBase: number) {
  return convertAmount(amountInBase, context.base, context.display);
}

/**
 * A base-currency amount converted into `currencyCode` -- what every private
 * "formatCurrency" helper in the pages should do first, so a chip that
 * rounds or abbreviates still starts from the converted number.
 */
export function convertFromBase(amountInBase: number, currencyCode: string) {
  return convertAmount(amountInBase, context.base, currencyCode);
}

/** Rates that are known for the display currency; false means labels only. */
export function canConvertToDisplay() {
  return getExchangeRate(context.base, context.display) !== null;
}

/**
 * Currencies whose smallest everyday unit is the whole number: LBP prices
 * are never quoted with piastres. Everything else gets two decimals.
 */
const ZERO_DECIMAL = new Set(["LBP", "JPY", "KRW", "IQD", "SYP", "IRR", "VND", "CLP", "ISK"]);

export function currencyFractionDigits(code: string) {
  return ZERO_DECIMAL.has(normalize(code)) ? 0 : 2;
}

/**
 * Formats an amount that is ALREADY in `currencyCode`. No conversion.
 */
export function formatExactPrice(
  value: number | null | undefined,
  currencyCode: string,
  locale = "en-US"
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const code = normalize(currencyCode);
  const digits = currencyFractionDigits(code);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(digits)}`;
  }
}

/* ---- live rates ------------------------------------------------------- */

export const RATE_FEED_URL = "https://open.er-api.com/v6/latest/USD";
export const RATES_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches today's rates (1 USD = x). Returns null on any failure -- the app
 * keeps whatever it last saved, and Settings says when that was.
 */
export async function fetchLiveRates(): Promise<{ rates: RateTable; updatedAt: string } | null> {
  try {
    const response = await fetch(RATE_FEED_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (payload.result !== "success" || !payload.rates) return null;
    const rates: RateTable = {};
    for (const [code, rate] of Object.entries(payload.rates)) {
      if (Number.isFinite(rate) && rate > 0) rates[code.toUpperCase()] = rate;
    }
    return { rates, updatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

export function ratesAreStale(updatedAt: string | null | undefined) {
  if (!updatedAt) return true;
  const then = new Date(updatedAt).getTime();
  return !Number.isFinite(then) || Date.now() - then > RATES_STALE_AFTER_MS;
}

/** The currencies offered in Settings and on documents. */
export const CURRENCY_CHOICES: { value: string; label: string }[] = [
  { value: "USD", label: "USD — US dollar" },
  { value: "LBP", label: "LBP — Lebanese pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British pound" },
  { value: "AED", label: "AED — UAE dirham" },
  { value: "SAR", label: "SAR — Saudi riyal" },
  { value: "QAR", label: "QAR — Qatari riyal" },
  { value: "KWD", label: "KWD — Kuwaiti dinar" },
  { value: "JOD", label: "JOD — Jordanian dinar" },
  { value: "EGP", label: "EGP — Egyptian pound" },
  { value: "TRY", label: "TRY — Turkish lira" },
  { value: "CAD", label: "CAD — Canadian dollar" },
  { value: "AUD", label: "AUD — Australian dollar" },
];

export function currencyChoicesIncluding(...codes: (string | null | undefined)[]) {
  const extra = codes
    .map((code) => normalize(code ?? ""))
    .filter((code) => code && !CURRENCY_CHOICES.some((choice) => choice.value === code));
  return [...new Set(extra)].map((value) => ({ value, label: value })).concat(CURRENCY_CHOICES);
}
