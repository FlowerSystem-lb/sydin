"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/components/ThemeProvider";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  FREE_LOW_STOCK_THRESHOLD,
  formatPlanName,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import type { ThemePreference } from "@/app/lib/theme";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
}> = [
  {
    value: "dark",
    label: "Dark",
    description: "SydIN's original deep blue workspace.",
  },
  {
    value: "light",
    label: "Light",
    description: "A bright, refined liquid-glass workspace.",
  },
  {
    value: "system",
    label: "System",
    description: "Match this device and update automatically.",
  },
];

function ThemePreview({ theme }: { theme: ThemePreference }) {
  const isLight = theme === "light";

  return (
    <div
      aria-hidden="true"
      className={`relative h-24 overflow-hidden rounded-2xl border ${
        isLight
          ? "border-blue-200 bg-[#edf6ff]"
          : theme === "dark"
            ? "border-sky-300/20 bg-[#030817]"
            : "border-theme bg-[linear-gradient(115deg,#030817_0_49%,#edf6ff_51%_100%)]"
      }`}
    >
      <div
        className={`absolute inset-x-3 top-3 h-3 rounded-full ${
          isLight ? "bg-white/90" : "bg-white/10"
        }`}
      />
      <div
        className={`absolute bottom-3 left-3 top-9 w-1/4 rounded-xl ${
          isLight ? "bg-blue-100" : "bg-sky-400/15"
        }`}
      />
      <div
        className={`absolute bottom-3 left-[34%] right-3 top-9 rounded-xl border ${
          isLight
            ? "border-blue-100 bg-white/80"
            : "border-theme bg-theme-surface"
        }`}
      />
    </div>
  );
}

function getLogoExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension.length > 8) {
    return "png";
  }

  return extension.replace(/[^a-z0-9]/g, "") || "png";
}

export default function SettingsPage() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [settings, setSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("Please sign in again to manage business settings.");
          setLoading(false);
          return;
        }

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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    const businessName = settings.business_name.trim();
    const lowStockThreshold = Number(settings.low_stock_threshold);

    if (!businessName) {
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
        const logoPath = `${user.id}/logo-${Date.now()}.${extension}`;
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
      };

      const { data, error: updateError } = await supabase
        .from("business_settings")
        .upsert(
          {
            user_id: user.id,
            ...updatedSettings,
          },
          {
            onConflict: "user_id",
          }
        )
        .select(
          "business_name, business_logo_url, low_stock_threshold, contact_email, contact_phone, contact_website, show_contact_publicly"
        )
        .single();

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
        contact_email: data?.contact_email || "",
        contact_phone: data?.contact_phone || "",
        contact_website: data?.contact_website || "",
        show_contact_publicly: Boolean(data?.show_contact_publicly),
      };
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setLogoFile(null);
      setSuccess("Business settings saved.");
    } catch {
      setError("Something went wrong while saving business settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="liquid-bg min-h-screen overflow-x-hidden text-theme-primary">
      <Sidebar
        planName={currentPlanName}
        businessName={settings.business_name}
        businessLogoUrl={settings.business_logo_url}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
          <section className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Workspace settings
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-theme-primary sm:text-6xl lg:text-7xl">
                  Business
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-theme-muted sm:text-lg">
                  Tune branding, QR page identity, and the low-stock signal for your inventory.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-center text-base font-bold text-theme-primary transition hover:border-theme-strong hover:bg-theme-hover"
              >
                Back to Dashboard
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="appearance-heading"
            className="glass-panel p-5 sm:p-7 lg:p-8"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">
                  Appearance
                </p>
                <h2
                  id="appearance-heading"
                  className="mt-2 text-3xl font-bold tracking-tight text-theme-primary"
                >
                  Choose your workspace theme
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-secondary">
                  Your choice applies immediately and stays on this device.
                </p>
              </div>
              <p
                className="text-sm font-semibold text-theme-muted"
                aria-live="polite"
              >
                Saved on this device.
              </p>
            </div>

            <fieldset className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <legend className="sr-only">Dashboard appearance</legend>
              {THEME_OPTIONS.map((option) => {
                const selected = preference === option.value;

                return (
                  <label
                    key={option.value}
                    className={`group cursor-pointer rounded-3xl border p-4 transition ${
                      selected
                        ? "border-theme-strong bg-theme-selected shadow-[0_16px_45px_rgba(14,116,229,0.12)]"
                        : "border-theme bg-theme-surface hover:border-theme-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="appearance"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPreference(option.value)}
                      className="peer sr-only"
                    />
                    <ThemePreview theme={option.value} />
                    <span className="mt-4 flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-sky-500 bg-sky-500"
                            : "border-theme-strong bg-theme-inset"
                        }`}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span>
                        <span className="block font-bold text-theme-primary">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-theme-muted">
                          {option.description}
                        </span>
                        {option.value === "system" && (
                          <span className="mt-2 block text-xs font-semibold text-sky-600">
                            Currently using{" "}
                            {resolvedTheme === "light" ? "Light" : "Dark"} from
                            your device.
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </section>

          <form
            onSubmit={handleSave}
            aria-busy={saving}
            className="rounded-[32px] border border-theme bg-theme-surface p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7 lg:p-8"
          >
            {loading ? (
              <div className="grid grid-cols-1 gap-5">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-24 overflow-hidden rounded-3xl border border-theme bg-theme-surface"
                  >
                    <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
                  <div className="rounded-3xl border border-theme bg-theme-inset p-4">
                    <p className="mb-4 text-sm font-semibold text-theme-muted">
                      Logo preview
                    </p>

                    <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-3xl border border-indigo-300/20 bg-indigo-500/10">
                      {settings.business_logo_url ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={settings.business_logo_url}
                            alt={settings.business_name}
                            fill
                            sizes="180px"
                            className="object-contain p-4"
                          />
                        </div>
                      ) : (
                        <BrandMark className="h-16 w-16 rounded-2xl" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-theme-muted">
                        Business name
                      </label>

                      <input
                        type="text"
                        value={settings.business_name}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            business_name: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-theme-muted">
                        Business logo
                      </label>

                      {canUseCustomLogo ? (
                        <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-theme-inset p-5 transition hover:border-indigo-300/45 hover:bg-theme-inset">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setLogoFile(event.target.files?.[0] || null)
                            }
                            className="w-full cursor-pointer text-sm text-theme-secondary file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-theme-accent transition-colors hover:file:bg-indigo-500/30"
                          />

                          {logoFile && (
                            <p className="mt-4 rounded-2xl border border-theme bg-theme-surface px-4 py-3 text-sm text-theme-secondary">
                              Selected: {logoFile.name}
                            </p>
                          )}
                        </div>
                      ) : (
                        <LockedFeaturePanel
                          feature="Custom business logo"
                          benefit={
                            settings.business_logo_url
                              ? "Your existing logo is preserved and remains visible. Upgrade before replacing it with a new file."
                              : "Add your business logo to the workspace, exports, and public inventory identity."
                          }
                          currentPlan={currentPlanName}
                          requiredPlan="Standard"
                          source="business-logo"
                          compact
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-theme-muted">
                      Low-stock threshold
                    </label>

                    <input
                      type="number"
                      min="0"
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
                      className="w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                      required
                    />
                    {!canCustomizeThreshold && (
                      <p className="mt-2 text-xs leading-5 text-theme-subtle">
                        Free uses a fixed threshold of 10. Your saved custom
                        value is preserved for a future upgrade.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-theme-muted">
                      Contact email
                    </label>

                    <input
                      type="email"
                      value={settings.contact_email}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_email: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-theme-muted">
                      Contact phone
                    </label>

                    <input
                      type="tel"
                      value={settings.contact_phone}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-theme-muted">
                      Contact website
                    </label>

                    <input
                      type="url"
                      value={settings.contact_website}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_website: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>
                </div>

                {canShowPublicContact || savedSettings.show_contact_publicly ? (
                  <label className="mt-6 flex cursor-pointer flex-col gap-4 rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold text-theme-primary">
                        Show contact publicly
                      </p>

                      <p className="mt-1 text-sm leading-6 text-theme-muted">
                        Public QR item pages can show contact fields when this
                        is enabled.
                        {!canShowPublicContact &&
                          " You can turn off the existing setting, but Standard is required to enable it again."}
                      </p>
                    </div>

                    <span className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.show_contact_publicly}
                        onChange={(event) =>
                          setSettings((current) => {
                            if (
                              !canShowPublicContact &&
                              event.target.checked
                            ) {
                              return current;
                            }

                            return {
                              ...current,
                              show_contact_publicly: event.target.checked,
                            };
                          })
                        }
                        className="peer sr-only"
                      />
                      <span className="block h-7 w-12 rounded-full border border-theme bg-[var(--sydin-input-bg)] transition peer-checked:border-sky-300/40 peer-checked:bg-sky-400/25 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
                      <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-slate-400 shadow-md transition peer-checked:translate-x-5 peer-checked:bg-cyan-100" />
                    </span>
                  </label>
                ) : (
                  <div className="mt-6">
                    <LockedFeaturePanel
                      feature="Public contact branding"
                      benefit="Show business contact details on public QR item pages with Standard or Pro."
                      currentPlan={currentPlanName}
                      requiredPlan="Standard"
                      source="public-contact-branding"
                      compact
                    />
                  </div>
                )}

                {(error || success) && (
                  <div
                    className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
                      error
                        ? "border-red-500/30 bg-red-500/10 text-theme-danger"
                        : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
                    }`}
                  >
                    {error || success}
                  </div>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-theme bg-theme-surface px-6 py-4 text-center text-base font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-white px-7 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving settings..." : "Save Settings"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
