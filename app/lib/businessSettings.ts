import { supabase } from "@/app/lib/supabase";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { DEFAULT_PAYMENT_METHODS, normalizeList, paymentMethodKey } from "@/app/lib/paymentMethods";

export interface BusinessSettings {
  business_name: string;
  business_logo_url: string;
  low_stock_threshold: number;
  currency_code?: string;
  contact_email: string;
  contact_phone: string;
  contact_website: string;
  show_contact_publicly: boolean;
  /* Printed on documents (phase 24). Empty strings until the migration runs. */
  business_address: string;
  tax_id: string;
  payment_terms: string;
  document_footer: string;
  /* Phase 27. The accent bar on printed documents. Null (SydIN's default
     blue) until the business picks its own. */
  accent_color: string | null;
  /* Phase 25. `base_currency` is what stored amounts are in; `currency_code`
     is what the app shows. Rates are 1 USD = x. */
  base_currency: string;
  exchange_rates: Record<string, number>;
  manual_rates: Record<string, number>;
  rates_updated_at: string | null;
  /* Phase 30: invoice numbering and tax. invoice_next_number null = continue
     after the highest number already used with the prefix. */
  invoice_prefix: string;
  invoice_next_number: number | null;
  invoice_number_digits: number;
  po_prefix: string;
  tax_enabled: boolean;
  tax_name: string;
  tax_rate: number;
  prices_include_tax: boolean;
  /* Phase 31: the business's own lists (Settings > Lists). */
  custom_units: string[];
  payment_methods: string[];
}

/** Fired on window with the saved BusinessSettings as detail, so the
 *  dashboard header shows a new name or logo straight away. */
export const BUSINESS_SETTINGS_SAVED_EVENT = "sydin:business-settings-saved";

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  business_name: "SydIn Account",
  business_logo_url: "",
  low_stock_threshold: 10,
  currency_code: "USD",
  contact_email: "",
  contact_phone: "",
  contact_website: "",
  show_contact_publicly: false,
  business_address: "",
  tax_id: "",
  payment_terms: "",
  document_footer: "",
  accent_color: null,
  base_currency: "USD",
  exchange_rates: {},
  manual_rates: {},
  rates_updated_at: null,
  invoice_prefix: "INV-",
  invoice_next_number: null,
  invoice_number_digits: 4,
  po_prefix: "",
  tax_enabled: false,
  tax_name: "VAT",
  tax_rate: 0,
  prices_include_tax: false,
  custom_units: [],
  payment_methods: DEFAULT_PAYMENT_METHODS,
};

function normalizeRateTable(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const table: Record<string, number> = {};
  for (const [code, rate] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(rate);
    if (/^[A-Za-z]{3}$/.test(code) && Number.isFinite(numeric) && numeric > 0) {
      table[code.toUpperCase()] = numeric;
    }
  }
  return table;
}

/** A hex colour or nothing -- never a half-typed value reaching a PDF. */
export function normalizeAccentColor(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : null;
}

function normalizeThreshold(value: unknown) {
  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold < 0) {
    return DEFAULT_BUSINESS_SETTINGS.low_stock_threshold;
  }

  return Math.round(threshold);
}

function normalizeBusinessSettings(data: Partial<BusinessSettings> | null) {
  return {
    business_name:
      data?.business_name?.trim() || DEFAULT_BUSINESS_SETTINGS.business_name,
    business_logo_url: data?.business_logo_url || "",
    low_stock_threshold: normalizeThreshold(data?.low_stock_threshold),
    currency_code: normalizeCurrencyCode(data?.currency_code, "USD"),
    contact_email: data?.contact_email || "",
    contact_phone: data?.contact_phone || "",
    contact_website: data?.contact_website || "",
    show_contact_publicly: Boolean(data?.show_contact_publicly),
    business_address: data?.business_address || "",
    tax_id: data?.tax_id || "",
    payment_terms: data?.payment_terms || "",
    document_footer: data?.document_footer || "",
    accent_color: normalizeAccentColor(data?.accent_color),
    // Before phase 25 there was no base: the display currency was the only
    // currency, so it is also what the amounts are in.
    base_currency: normalizeCurrencyCode(
      data?.base_currency || data?.currency_code,
      "USD"
    ),
    exchange_rates: normalizeRateTable(data?.exchange_rates),
    manual_rates: normalizeRateTable(data?.manual_rates),
    rates_updated_at: data?.rates_updated_at || null,
    invoice_prefix: data?.invoice_prefix ?? DEFAULT_BUSINESS_SETTINGS.invoice_prefix,
    invoice_next_number:
      Number.isFinite(Number(data?.invoice_next_number)) && Number(data?.invoice_next_number) > 0
        ? Math.round(Number(data?.invoice_next_number))
        : null,
    invoice_number_digits: Math.min(8, Math.max(1, Math.round(Number(data?.invoice_number_digits) || 4))),
    po_prefix: data?.po_prefix || "",
    tax_enabled: Boolean(data?.tax_enabled),
    tax_name: data?.tax_name?.trim() || DEFAULT_BUSINESS_SETTINGS.tax_name,
    tax_rate: Math.min(100, Math.max(0, Number(data?.tax_rate) || 0)),
    prices_include_tax: Boolean(data?.prices_include_tax),
    custom_units: normalizeList(data?.custom_units, 30),
    payment_methods: (() => {
      const list = normalizeList(data?.payment_methods, 20, paymentMethodKey);
      return list.length > 0 ? list : DEFAULT_PAYMENT_METHODS;
    })(),
  };
}

const SETTINGS_SELECT =
  "business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly, business_address, tax_id, payment_terms, document_footer, accent_color, base_currency, exchange_rates, manual_rates, rates_updated_at, invoice_prefix, invoice_next_number, invoice_number_digits, po_prefix, tax_enabled, tax_name, tax_rate, prices_include_tax, custom_units, payment_methods";

/* The same row without the phase-24 columns, for a database where that
   migration has not been run yet. */
const SETTINGS_SELECT_LEGACY =
  "business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly";

/** True when the error means sql/phase-24-company-profile.sql has not been run. */
export function isCompanyProfileSchemaMissing(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  return (
    /business_address|tax_id|payment_terms|document_footer|accent_color|base_currency|exchange_rates|manual_rates|rates_updated_at|invoice_prefix|tax_enabled|custom_units|payment_methods/.test(message) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find"))
  );
}

export async function getOrCreateBusinessSettings(userId: string) {
  let { data, error } = await supabase
    .from("business_settings")
    .select(SETTINGS_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isCompanyProfileSchemaMissing(error)) {
    ({ data, error } = await supabase
      .from("business_settings")
      .select(SETTINGS_SELECT_LEGACY)
      .eq("user_id", userId)
      .maybeSingle());
  }

  if (error) {
    console.warn("Business settings fetch failed:", error.message);
    return DEFAULT_BUSINESS_SETTINGS;
  }

  if (data) {
    return normalizeBusinessSettings(data);
  }

  const { data: createdSettings, error: createError } = await supabase
    .from("business_settings")
    .insert([
      {
        user_id: userId,
        business_name: DEFAULT_BUSINESS_SETTINGS.business_name,
        low_stock_threshold: DEFAULT_BUSINESS_SETTINGS.low_stock_threshold,
      },
    ])
    .select(SETTINGS_SELECT_LEGACY)
    .single();

  if (createError) {
    console.warn("Business settings create failed:", createError.message);
    return DEFAULT_BUSINESS_SETTINGS;
  }

  return normalizeBusinessSettings(createdSettings);
}

/**
 * Saves freshly fetched live rates. Best effort: a failure here leaves the
 * last saved rates in place and is not worth interrupting the page for.
 */
export async function saveLiveRates(
  userId: string,
  rates: Record<string, number>,
  updatedAt: string
) {
  const { error } = await supabase
    .from("business_settings")
    .update({ exchange_rates: rates, rates_updated_at: updatedAt })
    .eq("user_id", userId);
  return !error;
}
