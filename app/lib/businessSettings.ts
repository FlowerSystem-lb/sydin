import { supabase } from "@/app/lib/supabase";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";

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
  /* Phase 25. `base_currency` is what stored amounts are in; `currency_code`
     is what the app shows. Rates are 1 USD = x. */
  base_currency: string;
  exchange_rates: Record<string, number>;
  manual_rates: Record<string, number>;
  rates_updated_at: string | null;
}

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
  base_currency: "USD",
  exchange_rates: {},
  manual_rates: {},
  rates_updated_at: null,
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
    // Before phase 25 there was no base: the display currency was the only
    // currency, so it is also what the amounts are in.
    base_currency: normalizeCurrencyCode(
      data?.base_currency || data?.currency_code,
      "USD"
    ),
    exchange_rates: normalizeRateTable(data?.exchange_rates),
    manual_rates: normalizeRateTable(data?.manual_rates),
    rates_updated_at: data?.rates_updated_at || null,
  };
}

const SETTINGS_SELECT =
  "business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly, business_address, tax_id, payment_terms, document_footer, base_currency, exchange_rates, manual_rates, rates_updated_at";

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
    /business_address|tax_id|payment_terms|document_footer|base_currency|exchange_rates|manual_rates|rates_updated_at/.test(message) &&
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
