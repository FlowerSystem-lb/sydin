"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  Badge,
  Button,
  FieldGroup,
  FieldRow,
  Select,
  UnsavedChangesGuard,
  buttonClassName,
  useToast,
} from "@/components/ui";
import {
  DashboardCard,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  isCompanyProfileSchemaMissing,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import {
  currencyChoicesIncluding,
  fetchLiveRates,
  formatExactPrice,
  getExchangeRate,
  mergeRates,
  setCurrencyContext,
} from "@/app/lib/currency";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  FREE_LOW_STOCK_THRESHOLD,
  formatPlanName,
  getSubscriptionCapabilities,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

type SettingsSectionId =
  | "workspace"
  | "profile"
  | "inventory"
  | "billing"
  | "data";

/**
 * Sections merged during the 2026-07-25 reorganization (10 → 6). Kept so any
 * existing deep link (bookmark, in-app href, docs) still lands on the panel that
 * now contains that content instead of silently falling back to Workspace.
 */
const MERGED_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  branding: "workspace",
  reports: "data",
  operations: "inventory",
  // Security & Email folded into Account (13 Sep 2026): both only said who
  // is signed in and how to sign out.
  email: "profile",
  security: "profile",
};

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: UiIconName;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "workspace",
    label: "Company",
    description: "Name, logo, contact, address and what prints on documents",
    icon: "dashboard",
  },
  {
    id: "profile",
    label: "Account",
    description: "Who is signed in, sign out, appearance",
    icon: "settings",
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "When an item counts as low stock",
    icon: "box",
  },
  {
    id: "billing",
    label: "Plan & billing",
    description: "Your plan, what it includes, how to change it",
    icon: "file",
  },
  {
    id: "data",
    label: "Data & reports",
    description: "Import, export and reports",
    icon: "upload",
  },
];

const SECTION_IDS = new Set<SettingsSectionId>(
  SETTINGS_SECTIONS.map((section) => section.id)
);


function getLogoExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension.length > 8) {
    return "png";
  }

  return extension.replace(/[^a-z0-9]/g, "") || "png";
}

function normalizeSectionId(value: string | null | undefined) {
  if (SECTION_IDS.has(value as SettingsSectionId)) {
    return value as SettingsSectionId;
  }

  // Resolve links that still point at a pre-merge section id.
  return MERGED_SECTION_ALIASES[value ?? ""] ?? "workspace";
}

function SaveBar({
  saving,
  onCancel,
}: {
  saving: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      {onCancel ? (
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Reset
        </Button>
      ) : (
        <Link
          href="/dashboard"
          className={buttonClassName({ variant: "secondary" })}
        >
          Back to Dashboard
        </Link>
      )}
      <Button type="submit" loading={saving} loadingLabel="Saving settings...">
        Save settings
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hashSection, setHashSection] = useState<SettingsSectionId | null>(
    () =>
      typeof window !== "undefined" &&
      window.location.hash === "#appearance-heading"
        ? "profile"
        : null
  );
  const [settings, setSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [userEmail, setUserEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [ratesNotice, setRatesNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { showToast } = useToast();

  /* The page already keeps the last-saved copy so Cancel can restore it --
     which makes it exactly the right thing to compare against. Off while
     saving so the success path is never challenged. */
  const hasUnsavedWork =
    !saving &&
    (Boolean(logoFile) ||
      JSON.stringify(settings) !== JSON.stringify(savedSettings));

  useEffect(() => {
    const handleHashChange = () => {
      setHashSection(
        window.location.hash === "#appearance-heading" ? "profile" : null
      );
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("Please sign in again to manage settings.");
          setLoading(false);
          return;
        }

        setUserEmail(user.email || "");

        Promise.all([
          getOrCreateBusinessSettings(user.id),
          getUserSubscription(user.id),
        ])
          .then(([loadedSettings, loadedSubscription]) => {
            if (!isActive) return;

            setSettings(loadedSettings);
            setSavedSettings(loadedSettings);
            setSubscription(loadedSubscription);
            setLoading(false);
          })
          .catch(() => {
            if (!isActive) return;

            setError("We could not load your business settings.");
            setLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;

        setError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const currentPlanName = formatPlanName(subscription.plan);
  const planCapabilities = getSubscriptionCapabilities(subscription);
  const canUseCustomLogo = planCapabilities.customBusinessLogo;
  const canCustomizeThreshold = planCapabilities.customLowStockThreshold;
  const canShowPublicContact = planCapabilities.publicContactBranding;
  const upgradeHref = getUpgradeRequestHref(subscription.plan, "settings");
  const upgradeLabel = getUpgradeActionLabel(subscription.plan);
  const currencyCode = normalizeCurrencyCode(settings.currency_code, "USD");
  const sectionFromQuery = searchParams.get("section");
  const activeSection = sectionFromQuery
    ? normalizeSectionId(sectionFromQuery)
    : hashSection || "workspace";
  const activeSectionDetails =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection) ||
    SETTINGS_SECTIONS[0];


  const navigationSummary = useMemo(
    () =>
      SETTINGS_SECTIONS.map((section) => ({
        ...section,
        active: section.id === activeSection,
      })),
    [activeSection]
  );

  const switchSection = (sectionId: SettingsSectionId) => {
    setError("");
    setSuccess("");
    router.push(`/dashboard/settings?section=${sectionId}`, {
      scroll: false,
    });
  };

  const resetBusinessFields = () => {
    setSettings(savedSettings);
    setLogoFile(null);
    setError("");
    setSuccess("");
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    // `settings` is shared across every tab's form, not scoped per panel. The
    // business name field only exists on Workspace -- if it was cleared there
    // and never saved, then Save was pressed from a different tab, this must
    // not (a) block an unrelated save with a field the user can't see, or
    // (b) silently blank out the name that's still saved in the database.
    const businessNameDraft = settings.business_name.trim();
    const businessName = businessNameDraft || savedSettings.business_name;
    const lowStockThreshold = Number(settings.low_stock_threshold);

    if (activeSection === "workspace" && !businessNameDraft) {
      setError("Add a business name before saving.");
      setSuccess("");
      return;
    }

    if (
      canCustomizeThreshold &&
      (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      setError("Low-stock threshold must be 0 or more.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in again before saving settings.");
        return;
      }

      const freshSubscription = await getUserSubscription(user.id);
      const freshCapabilities =
        getSubscriptionCapabilities(freshSubscription);
      setSubscription(freshSubscription);

      if (logoFile && !freshCapabilities.customBusinessLogo) {
        setError(
          "Custom business logos require an active Standard or Pro plan."
        );
        return;
      }

      if (
        !freshCapabilities.publicContactBranding &&
        !savedSettings.show_contact_publicly &&
        settings.show_contact_publicly
      ) {
        setError(
          "Public contact branding requires an active Standard or Pro plan."
        );
        return;
      }

      let businessLogoUrl = settings.business_logo_url;

      if (logoFile) {
        const extension = getLogoExtension(logoFile.name);
        // The file's own timestamp keeps the path unique per upload without
        // reading the clock inside the component.
        const logoPath = `${user.id}/logo-${logoFile.lastModified}-${logoFile.size}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("business-logos")
          .upload(logoPath, logoFile, {
            upsert: true,
          });

        if (uploadError) {
          setError(
            "Logo upload failed. Try a smaller image or a different file."
          );
          return;
        }

        const { data } = supabase.storage
          .from("business-logos")
          .getPublicUrl(logoPath);

        businessLogoUrl = data.publicUrl;
      }

      const updatedSettings = {
        business_name: businessName,
        business_logo_url: businessLogoUrl || null,
        low_stock_threshold: freshCapabilities.customLowStockThreshold
          ? Math.round(lowStockThreshold)
          : savedSettings.low_stock_threshold,
        contact_email: settings.contact_email.trim() || null,
        contact_phone: settings.contact_phone.trim() || null,
        contact_website: settings.contact_website.trim() || null,
        show_contact_publicly: freshCapabilities.publicContactBranding
          ? settings.show_contact_publicly
          : savedSettings.show_contact_publicly
            ? settings.show_contact_publicly
            : false,
        currency_code: currencyCode,
      };

      const documentFields = {
        business_address: settings.business_address.trim() || null,
        tax_id: settings.tax_id.trim() || null,
        payment_terms: settings.payment_terms.trim() || null,
        document_footer: settings.document_footer.trim() || null,
        manual_rates: settings.manual_rates,
      };

      const upsert = (fields: Record<string, unknown>) =>
        supabase
          .from("business_settings")
          .upsert({ user_id: user.id, ...fields }, { onConflict: "user_id" })
          .select("business_name, business_logo_url, low_stock_threshold, currency_code, contact_email, contact_phone, contact_website, show_contact_publicly")
          .single();

      let { data, error: updateError } = await upsert({
        ...updatedSettings,
        ...documentFields,
      });

      // The document columns arrive with sql/phase-24-company-profile.sql.
      // Until it is run, everything else still saves, and the user is told
      // exactly what is missing rather than shown a generic failure.
      let documentFieldsSkipped = false;
      if (updateError && isCompanyProfileSchemaMissing(updateError)) {
        documentFieldsSkipped = Object.values(documentFields).some(Boolean);
        ({ data, error: updateError } = await upsert(updatedSettings));
      }

      if (updateError) {
        setError("We could not save your business settings. Please try again.");
        return;
      }

      const savedThreshold = Number(data?.low_stock_threshold);
      const normalizedSettings = {
        business_name: data?.business_name || businessName,
        business_logo_url: data?.business_logo_url || businessLogoUrl || "",
        low_stock_threshold: Number.isFinite(savedThreshold)
          ? savedThreshold
          : updatedSettings.low_stock_threshold,
        currency_code: normalizeCurrencyCode(data?.currency_code, currencyCode),
        contact_email: data?.contact_email || "",
        contact_phone: data?.contact_phone || "",
        contact_website: data?.contact_website || "",
        show_contact_publicly: Boolean(data?.show_contact_publicly),
        business_address: documentFieldsSkipped ? "" : settings.business_address.trim(),
        tax_id: documentFieldsSkipped ? "" : settings.tax_id.trim(),
        payment_terms: documentFieldsSkipped ? "" : settings.payment_terms.trim(),
        document_footer: documentFieldsSkipped ? "" : settings.document_footer.trim(),
        base_currency: settings.base_currency,
        exchange_rates: settings.exchange_rates,
        manual_rates: documentFieldsSkipped ? {} : settings.manual_rates,
        rates_updated_at: settings.rates_updated_at,
      };
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      // The rest of the app converts through this; make the new choice count
      // immediately, not on the next full load.
      setCurrencyContext({
        base: normalizedSettings.base_currency,
        display: normalizedSettings.currency_code,
        rates: mergeRates(normalizedSettings.exchange_rates, normalizedSettings.manual_rates),
      });
      setLogoFile(null);
      if (documentFieldsSkipped) {
        setError(
          "Saved, except the address, tax ID, payment terms and footer: those need a one-time database update. Open Supabase → SQL Editor, run sql/phase-24-company-profile.sql from the project, then save again."
        );
      } else {
        setSuccess("Company settings saved.");
      }
      showToast({ tone: "success", message: "Company settings saved." });
    } catch {
      setError("Something went wrong while saving business settings.");
      showToast({
        tone: "danger",
        message: "Could not save your settings. Nothing was changed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderNotice = () =>
    (error || success) && (
      <div
        role={error ? "alert" : "status"}
        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
          error
            ? "border-red-500/30 bg-red-500/10 text-theme-danger"
            : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
        }`}
      >
        {error || success}
      </div>
    );

  const renderCompanyPanel = () => (
    <div className="item-form -mx-1">
      {/* One form, the same label-left rows as every record in the app.
          Was two panels of status chips, boxed inputs and copy written for
          the developer ("Settings v1", "storage flow"). */}
      <FieldGroup
        label="Company"
        description="Shown across the app and printed on every document you export."
      >
        <FieldRow label="Name" htmlFor="business-name" required>
          <input
            id="business-name"
            type="text"
            value={settings.business_name}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                business_name: event.target.value,
              }))
            }
            required
          />
        </FieldRow>

        <FieldRow label="Logo">
          <div className="flex flex-wrap items-center gap-3">
            <span className="settings-logo-preview">
              {settings.business_logo_url ? (
                <Image
                  src={settings.business_logo_url}
                  alt={`Logo for ${settings.business_name}`}
                  fill
                  sizes="72px"
                  className="object-contain p-1.5"
                />
              ) : (
                <BrandMark className="h-9 w-9 rounded-xl" />
              )}
            </span>
            {canUseCustomLogo ? (
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="business-logo-upload"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  {settings.business_logo_url ? "Change logo" : "Upload logo"}
                </label>
                <input
                  id="business-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setLogoFile(event.target.files?.[0] || null)
                  }
                  className="sr-only"
                />
                <p className="mt-1.5 text-xs text-theme-muted">
                  {logoFile
                    ? `Selected: ${logoFile.name} — saved when you press Save.`
                    : "PNG or JPG, square works best. Prints on invoices, orders and labels."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-theme-muted">
                A custom logo comes with the Standard plan.{" "}
                <Link
                  href={upgradeHref}
                  className="font-semibold text-theme-accent underline-offset-2 hover:underline"
                >
                  Compare plans
                </Link>
              </p>
            )}
          </div>
        </FieldRow>

      </FieldGroup>

      <FieldGroup
        label="Money"
        description={`Your prices are stored in ${settings.base_currency}. Choose what the app shows; every amount is converted at the rate below.`}
      >
        <FieldRow label="Show prices in">
          <Select
            ariaLabel="Currency shown across the app"
            value={currencyCode}
            onChange={(value) =>
              setSettings((current) => ({ ...current, currency_code: value }))
            }
            options={currencyChoicesIncluding(currencyCode, settings.base_currency)}
          />
        </FieldRow>

        {currencyCode !== settings.base_currency && (
          <FieldRow label="Exchange rate" htmlFor="manual-rate">
            {(() => {
              const liveRate = getExchangeRate(
                settings.base_currency,
                currencyCode,
                mergeRates(settings.exchange_rates, {})
              );
              const manualRate = getExchangeRate(
                settings.base_currency,
                currencyCode,
                mergeRates(settings.exchange_rates, settings.manual_rates)
              );
              const usingManual = Object.keys(settings.manual_rates).includes(currencyCode);
              const rateText = (rate: number | null) =>
                rate === null
                  ? "not available"
                  : `1 ${settings.base_currency} = ${formatExactPrice(rate, currencyCode)}`;
              return (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-theme-primary">
                      {rateText(manualRate)}
                    </span>
                    <span className="text-xs text-theme-muted">
                      {usingManual
                        ? `your rate · live is ${rateText(liveRate)}`
                        : settings.rates_updated_at
                          ? `live rate, updated ${new Date(settings.rates_updated_at).toLocaleDateString("en", { dateStyle: "medium" })}`
                          : "no live rate yet"}
                    </span>
                  </div>
                  <label htmlFor="manual-rate" className="text-xs font-semibold text-theme-secondary">
                    Use my own rate instead — 1 {settings.base_currency} =
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="manual-rate"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className="settings-rate-input"
                      placeholder={liveRate === null ? "e.g. 89500" : String(liveRate)}
                      value={
                        settings.manual_rates[currencyCode] !== undefined
                          ? String(
                              settings.base_currency === "USD"
                                ? settings.manual_rates[currencyCode]
                                : (manualRate ?? "")
                            )
                          : ""
                      }
                      onChange={(event) => {
                        const typed = Number(event.target.value);
                        setSettings((current) => {
                          const manual = { ...current.manual_rates };
                          if (!event.target.value.trim() || !Number.isFinite(typed) || typed <= 0) {
                            delete manual[currencyCode];
                          } else {
                            // Rates are kept as 1 USD = x. A base other than
                            // USD types "1 base = x", so convert through the
                            // base's own USD rate.
                            const baseUsd = mergeRates(current.exchange_rates, current.manual_rates)[
                              current.base_currency
                            ];
                            manual[currencyCode] =
                              current.base_currency === "USD" || !baseUsd ? typed : typed * baseUsd;
                          }
                          return { ...current, manual_rates: manual };
                        });
                      }}
                    />
                    <span className="text-xs text-theme-muted">{currencyCode}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={refreshingRates}
                      loadingLabel="Updating…"
                      onClick={async () => {
                        setRefreshingRates(true);
                        setRatesNotice("");
                        const live = await fetchLiveRates();
                        setRefreshingRates(false);
                        if (!live) {
                          setRatesNotice("Live rates could not be fetched right now. Type your own rate, or try again later.");
                          return;
                        }
                        setSettings((current) => ({
                          ...current,
                          exchange_rates: live.rates,
                          rates_updated_at: live.updatedAt,
                        }));
                        setRatesNotice("Live rates updated. Press Save settings to keep them.");
                      }}
                    >
                      Update live rates
                    </Button>
                  </div>
                  {ratesNotice && (
                    <p className="text-xs text-theme-muted">{ratesNotice}</p>
                  )}
                  <p className="text-xs text-theme-muted">
                    Leave the box empty to follow the live rate. Invoices and orders keep the rate of the day they were made.
                  </p>
                </div>
              );
            })()}
          </FieldRow>
        )}
      </FieldGroup>

      <FieldGroup
        label="Contact"
        description="Printed in the document footer, and on public item pages when you allow it."
      >
        <FieldRow label="Phone" htmlFor="contact-phone">
          <input
            id="contact-phone"
            type="tel"
            value={settings.contact_phone}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                contact_phone: event.target.value,
              }))
            }
            placeholder="+961 …"
          />
        </FieldRow>
        <FieldRow label="Email" htmlFor="contact-email">
          <input
            id="contact-email"
            type="email"
            value={settings.contact_email}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                contact_email: event.target.value,
              }))
            }
            placeholder="orders@yourbusiness.com"
          />
        </FieldRow>
        <FieldRow label="Website" htmlFor="contact-website">
          <input
            id="contact-website"
            type="url"
            value={settings.contact_website}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                contact_website: event.target.value,
              }))
            }
            placeholder="https://"
          />
        </FieldRow>
        <FieldRow label="Public pages" htmlFor="show-contact-publicly">
          {canShowPublicContact || savedSettings.show_contact_publicly ? (
            <label
              htmlFor="show-contact-publicly"
              className="flex items-start gap-2 text-sm text-theme-primary"
            >
              <input
                id="show-contact-publicly"
                type="checkbox"
                checked={settings.show_contact_publicly}
                onChange={(event) =>
                  setSettings((current) => {
                    if (!canShowPublicContact && event.target.checked) {
                      return current;
                    }
                    return {
                      ...current,
                      show_contact_publicly: event.target.checked,
                    };
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sydin-blue focus:ring-sydin-blue/50"
              />
              <span>
                Show these contact details on public QR item pages
                <span className="block text-xs text-theme-muted">
                  Stock, prices, suppliers and pick lists stay private.
                  {!canShowPublicContact &&
                    " Turning it back on needs the Standard plan."}
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-theme-muted">
              Showing contact details on public item pages comes with the
              Standard plan.{" "}
              <Link
                href={upgradeHref}
                className="font-semibold text-theme-accent underline-offset-2 hover:underline"
              >
                Compare plans
              </Link>
            </p>
          )}
        </FieldRow>
      </FieldGroup>

      <FieldGroup
        label="Address & registration"
        description="Printed under your name on invoices and purchase orders."
      >
        <FieldRow label="Address" htmlFor="business-address">
          <textarea
            id="business-address"
            value={settings.business_address}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                business_address: event.target.value,
              }))
            }
            placeholder={"Street, building\nCity, country"}
            rows={3}
            className="item-panel-textarea"
          />
        </FieldRow>
        <FieldRow label="Tax / reg. no." htmlFor="tax-id">
          <input
            id="tax-id"
            type="text"
            value={settings.tax_id}
            onChange={(event) =>
              setSettings((current) => ({ ...current, tax_id: event.target.value }))
            }
            placeholder="VAT number or commercial registration"
          />
        </FieldRow>
      </FieldGroup>

      <FieldGroup
        label="Documents"
        description="Defaults for every invoice and purchase order you export. Each document can still say its own thing in its notes."
      >
        <FieldRow label="Payment terms" htmlFor="payment-terms">
          <input
            id="payment-terms"
            type="text"
            value={settings.payment_terms}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                payment_terms: event.target.value,
              }))
            }
            placeholder="e.g. Due within 14 days · Cash on delivery"
          />
        </FieldRow>
        <FieldRow label="Footer line" htmlFor="document-footer">
          <input
            id="document-footer"
            type="text"
            value={settings.document_footer}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                document_footer: event.target.value,
              }))
            }
            placeholder="e.g. Thank you for your business · Bank: … IBAN …"
          />
        </FieldRow>
      </FieldGroup>
    </div>
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  /* Every section is the same shape as Company: label-left rows, business
     words, no status chips. What used to be five cards of "this is read from
     the existing session" is three rows. */
  const renderProfilePanel = () => (
    <div className="item-form -mx-1">
      <FieldGroup label="Signed in">
        <FieldRow label="Email">
          <span className="text-sm text-theme-primary">{userEmail || "—"}</span>
        </FieldRow>
        <FieldRow label="Password">
          <span className="text-sm text-theme-muted">
            Managed by the way you sign in — email link, Google or Microsoft.
          </span>
        </FieldRow>
        <FieldRow label="Sign out">
          <div>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out of SydIN
            </Button>
            <p className="mt-1 text-xs text-theme-muted">
              You can sign back in with the same email.
            </p>
          </div>
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Appearance">
        <FieldRow label="Theme">
          <span className="text-sm text-theme-primary" id="appearance-heading">
            Light
            <span className="block text-xs text-theme-muted">
              One light look everywhere for now; a dark theme is on the list.
            </span>
          </span>
        </FieldRow>
      </FieldGroup>
    </div>
  );

  const renderInventoryPanel = () => (
    <div className="item-form -mx-1">
      <FieldGroup
        label="Low stock"
        description="An item at or below this number shows as low on Overview, Inventory and Alerts. An item can set its own number too."
      >
        <FieldRow label="Threshold" htmlFor="low-stock-threshold">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="low-stock-threshold"
              type="number"
              min="0"
              inputMode="numeric"
              className="settings-rate-input"
              value={
                canCustomizeThreshold
                  ? settings.low_stock_threshold
                  : FREE_LOW_STOCK_THRESHOLD
              }
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  low_stock_threshold: Number(event.target.value),
                }))
              }
              disabled={!canCustomizeThreshold}
              required
            />
            <span className="text-xs text-theme-muted">units</span>
          </div>
          {!canCustomizeThreshold && (
            <p className="mt-1 text-xs text-theme-muted">
              The Free plan uses 10. Your own number comes with Standard;{" "}
              <Link
                href={upgradeHref}
                className="font-semibold text-theme-accent underline-offset-2 hover:underline"
              >
                compare plans
              </Link>
              .
            </p>
          )}
        </FieldRow>
      </FieldGroup>
    </div>
  );

  const renderBillingPanel = () => {
    const included: [string, boolean][] = [
      ["Your logo on documents and labels", planCapabilities.customBusinessLogo],
      ["Contact details on public item pages", planCapabilities.publicContactBranding],
      ["Your own low-stock threshold", planCapabilities.customLowStockThreshold],
      ["PDF and Word exports", planCapabilities.pdfExport === "basic"],
      ["Import from CSV or Excel", planCapabilities.csvExcelImport],
      ["Barcode scanner", planCapabilities.scanner],
      ["Advanced reports", planCapabilities.advancedReports],
      ["Priority support", planCapabilities.priorityManualSupport],
    ];
    return (
      <div className="item-form -mx-1">
        <FieldGroup label="Your plan">
          <FieldRow label="Plan">
            <span className="text-sm font-semibold text-theme-primary">
              {currentPlanName}
              <span className="ml-2 text-xs font-normal text-theme-muted">
                {subscription.status && subscription.status !== "active"
                  ? subscription.status
                  : "active"}
              </span>
            </span>
          </FieldRow>
          <FieldRow label="Items">
            <span className="text-sm text-theme-primary">
              Up to {subscription.item_limit.toLocaleString()} items
            </span>
          </FieldRow>
          <FieldRow label="Included">
            <ul className="grid gap-1 text-sm">
              {included.map(([label, yes]) => (
                <li key={label} className="flex items-start gap-2">
                  <span
                    className={yes ? "text-theme-success" : "text-theme-subtle"}
                    aria-hidden="true"
                  >
                    {yes ? "✓" : "—"}
                  </span>
                  <span className={yes ? "text-theme-primary" : "text-theme-muted"}>
                    {label}
                    {!yes && " (higher plan)"}
                  </span>
                </li>
              ))}
            </ul>
          </FieldRow>
          <FieldRow label="Change plan">
            <div>
              <Link href={upgradeHref} className={buttonClassName({ size: "sm" })}>
                {upgradeLabel}
              </Link>
              <p className="mt-1 text-xs text-theme-muted">
                Send a request and we reply by email or WhatsApp to set it up.
                Payment is arranged with you directly; nothing is charged
                automatically.
              </p>
            </div>
          </FieldRow>
        </FieldGroup>
      </div>
    );
  };

  const renderDataPanel = () => (
    <div className="item-form -mx-1">
      <FieldGroup
        label="Move your data"
        description="Everything you export carries your company name and logo."
      >
        <FieldRow label="Import">
          <div>
            <Link
              href="/dashboard/inventory/import"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Import items
            </Link>
            <p className="mt-1 text-xs text-theme-muted">
              From a CSV or Excel file, or by scanning a batch of barcodes.
            </p>
          </div>
        </FieldRow>
        <FieldRow label="Export">
          <div>
            <Link
              href="/dashboard/import-export"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Export and history
            </Link>
            <p className="mt-1 text-xs text-theme-muted">
              Your whole inventory as Excel or PDF, and every past import and export.
            </p>
          </div>
        </FieldRow>
        <FieldRow label="Reports">
          <div>
            <Link
              href="/dashboard/reports"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open Reports
            </Link>
            <p className="mt-1 text-xs text-theme-muted">
              Sales by month, outstanding invoices, purchases, stock value.
            </p>
          </div>
        </FieldRow>
      </FieldGroup>
    </div>
  );

  const renderActivePanel = () => {
    if (loading) {
      return <LoadingSkeletonGroup count={3} itemClassName="min-h-28" />;
    }

    // Sections that contain editable fields are wrapped in exactly one form
    // with one notice and one save bar, here. Previously each panel carried its
    // own <form> + SaveBar, so a tab composed from two editable panels rendered
    // two of each -- the Workspace tab showed two "Save settings" and two
    // "Reset" buttons for the same handleSave and the same state, which is
    // what made Settings feel broken rather than merely busy.
    switch (activeSection) {
      case "profile":
        return renderProfilePanel();
      case "inventory":
        return (
          <form onSubmit={handleSave} aria-busy={saving} className="grid gap-4">
            {renderInventoryPanel()}
            {renderNotice()}
            <SaveBar saving={saving} onCancel={resetBusinessFields} />
          </form>
        );
      case "billing":
        return renderBillingPanel();
      case "data":
        return renderDataPanel();
      case "workspace":
      default:
        return (
          <form onSubmit={handleSave} aria-busy={saving} className="grid gap-4">
            {renderCompanyPanel()}
            {renderNotice()}
            <SaveBar saving={saving} onCancel={resetBusinessFields} />
          </form>
        );
    }
  };

  return (
    <div className="contents">
      <UnsavedChangesGuard when={hasUnsavedWork} what="your settings" />

      <main className="settings-workspace">
        <DashboardPageShell className="settings-shell" width="compact">
          <DashboardPageHeader
            eyebrow="Control center"
            title="Settings"
            description="Your company, account, inventory defaults, plan and data."
            className="settings-hero"
            actions={<Badge tone="accent">{currentPlanName} plan</Badge>}
          />

          <div className="settings-layout grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
            <aside className="settings-sidebar dashboard-card p-3 lg:sticky lg:top-4">
              <nav aria-label="Settings sections" className="grid gap-1.5">
                {navigationSummary.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => switchSection(section.id)}
                    aria-current={section.active ? "page" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sydin-blue/15 ${
                      section.active
                        ? "border-cyan-300/30 bg-cyan-500/10 text-theme-accent"
                        : "border-transparent text-theme-secondary hover:border-theme hover:bg-theme-inset"
                    }`}
                  >
                    <UiIcon name={section.icon} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-black">
                        {section.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-theme-subtle">
                        {section.description}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            </aside>

            <DashboardCard
              aria-labelledby="settings-panel-heading"
              className="settings-panel min-w-0"
            >
              <div className="mb-4 flex flex-col gap-3 border-b border-theme pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                    {activeSectionDetails.label}
                  </p>
                  <h2
                    id="settings-panel-heading"
                    className="mt-1 text-2xl font-black text-theme-primary"
                  >
                    {activeSectionDetails.label} settings
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-theme-muted">
                    {activeSectionDetails.description}
                  </p>
                </div>
                <Link
                  href="/dashboard"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  Back to Dashboard
                </Link>
              </div>
              {renderActivePanel()}
            </DashboardCard>
          </div>
        </DashboardPageShell>
      </main>
    </div>
  );
}
