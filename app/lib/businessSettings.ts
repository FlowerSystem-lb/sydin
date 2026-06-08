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
};

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
  };
}

export async function getOrCreateBusinessSettings(userId: string) {
  const { data, error } = await supabase
    .from("business_settings")
    .select(
      "business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly"
    )
    .eq("user_id", userId)
    .maybeSingle();

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
    .select(
      "business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly"
    )
    .single();

  if (createError) {
    console.warn("Business settings create failed:", createError.message);
    return DEFAULT_BUSINESS_SETTINGS;
  }

  return normalizeBusinessSettings(createdSettings);
}
