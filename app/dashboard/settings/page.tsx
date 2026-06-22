"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { useTheme } from "@/components/ThemeProvider";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  Badge,
  Button,
  FormField,
  Input,
  SectionCard,
  SectionHeader,
  buttonClassName,
} from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
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
import type { ThemePreference } from "@/app/lib/theme";

type SettingsSectionId =
  | "workspace"
  | "profile"
  | "branding"
  | "reports"
  | "inventory"
  | "operations"
  | "billing"
  | "email"
  | "security"
  | "data";

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: UiIconName;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Business profile and public contact details",
    icon: "dashboard",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Signed-in account and appearance",
    icon: "settings",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logo and report identity",
    icon: "qr",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Report defaults and future scheduling",
    icon: "reports",
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Item defaults and organization links",
    icon: "box",
  },
  {
    id: "operations",
    label: "Operations",
    description: "Workflow modules and v1 persistence notes",
    icon: "movement",
  },
  {
    id: "billing",
    label: "Billing & Plan",
    description: "Current plan and workspace limits",
    icon: "file",
  },
  {
    id: "email",
    label: "Email & Notifications",
    description: "Sender identity and notification roadmap",
    icon: "help",
  },
  {
    id: "security",
    label: "Security",
    description: "Authentication summary",
    icon: "check",
  },
  {
    id: "data",
    label: "Data",
    description: "Import, export, and data tools",
    icon: "upload",
  },
];

const SECTION_IDS = new Set<SettingsSectionId>(
  SETTINGS_SECTIONS.map((section) => section.id)
);

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

const inputClassName =
  "w-full min-h-11 rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3.5 py-2.5 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] disabled:cursor-not-allowed disabled:opacity-60";

function ThemePreview({ theme }: { theme: ThemePreference }) {
  const isLight = theme === "light";

  return (
    <div
      aria-hidden="true"
      className={`relative h-20 overflow-hidden rounded-xl border ${
        isLight
          ? "border-blue-200 bg-[#edf6ff]"
          : theme === "dark"
            ? "border-sky-300/20 bg-[#030817]"
            : "border-theme bg-[linear-gradient(115deg,#030817_0_49%,#edf6ff_51%_100%)]"
      }`}
    >
      <div
        className={`absolute inset-x-2.5 top-2.5 h-2.5 rounded-full ${
          isLight ? "bg-white/90" : "bg-white/10"
        }`}
      />
      <div
        className={`absolute bottom-2.5 left-2.5 top-7 w-1/4 rounded-lg ${
          isLight ? "bg-blue-100" : "bg-sky-400/15"
        }`}
      />
      <div
        className={`absolute bottom-2.5 left-[34%] right-2.5 top-7 rounded-lg border ${
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

function normalizeSectionId(value: string | null | undefined) {
  return SECTION_IDS.has(value as SettingsSectionId)
    ? (value as SettingsSectionId)
    : "workspace";
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/25 bg-emerald-500/10 text-theme-success"
      : tone === "warning"
        ? "border-amber-300/25 bg-amber-500/10 text-theme-warning"
        : tone === "info"
          ? "border-cyan-300/25 bg-cyan-500/10 text-theme-accent"
          : "border-theme bg-theme-inset text-theme-secondary";

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function SettingCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-theme bg-theme-inset p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-black text-theme-primary">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-theme-muted">
            {description}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </article>
  );
}

function ModuleLink({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: UiIconName;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-left transition hover:border-theme-strong hover:bg-theme-hover"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-theme bg-theme-inset text-theme-accent">
        <UiIcon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-theme-primary">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-theme-muted">
          {description}
        </span>
      </span>
    </Link>
  );
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
  const { preference, resolvedTheme, setPreference } = useTheme();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const workspaceStatus = settings.business_name.trim()
    ? "Business name configured"
    : "Missing business name";
  const logoStatus = settings.business_logo_url
    ? "Logo configured"
    : "No logo";
  const contactCount = [
    settings.contact_email,
    settings.contact_phone,
    settings.contact_website,
  ].filter((value) => value.trim()).length;
  const contactStatus =
    contactCount === 0
      ? "Contact details missing"
      : contactCount === 3
        ? "Contact details configured"
        : "Contact details partial";
  const contactTone =
    contactCount === 0 ? "neutral" : contactCount === 3 ? "success" : "info";
  const publicContactStatus = canShowPublicContact
    ? settings.show_contact_publicly
      ? "Public contact enabled"
      : "Public contact off"
    : savedSettings.show_contact_publicly
      ? "Public contact preserved"
      : "Public contact locked";
  const reportBrandingStatus =
    canUseCustomLogo && settings.business_logo_url
      ? "Business logo ready"
      : "SydIN fallback active";
  const effectiveLowStockThreshold = canCustomizeThreshold
    ? settings.low_stock_threshold
    : FREE_LOW_STOCK_THRESHOLD;

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
        currency_code: currencyCode,
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

  const renderWorkspacePanel = () => (
    <form onSubmit={handleSave} aria-busy={saving} className="grid gap-4">
      <SettingCard
        title="Workspace profile"
        description="Manage the business details used across the dashboard, public QR pages, reports, and exports."
        action={
          <StatusChip tone={settings.business_name.trim() ? "success" : "warning"}>
            {workspaceStatus}
          </StatusChip>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Business name" htmlFor="business-name">
            <Input
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
          </FormField>
          <div>
            <p className="text-sm font-bold text-theme-primary">Currency</p>
            <div className="mt-2 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-sm font-black text-theme-primary">
                {currencyCode}
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-subtle">
                Currency is read from existing workspace settings. Changing
                currency is not exposed in Settings v1.
              </p>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard
        title="Contact details"
        description="These fields are saved today and can be shown on public QR item pages when your plan supports public contact branding."
        action={<StatusChip>{contactCount} of 3 filled</StatusChip>}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-theme-primary">
            Contact email
            <input
              type="email"
              value={settings.contact_email}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  contact_email: event.target.value,
                }))
              }
              className={inputClassName}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-theme-primary">
            Contact phone
            <input
              type="tel"
              value={settings.contact_phone}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  contact_phone: event.target.value,
                }))
              }
              className={inputClassName}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-theme-primary">
            Contact website
            <input
              type="url"
              value={settings.contact_website}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  contact_website: event.target.value,
                }))
              }
              className={inputClassName}
            />
          </label>
        </div>

        {canShowPublicContact || savedSettings.show_contact_publicly ? (
          <label className="mt-4 flex cursor-pointer flex-col gap-3 rounded-xl border border-theme bg-theme-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="block text-sm font-black text-theme-primary">
                Show contact publicly
              </span>
              <span className="mt-1 block text-xs leading-5 text-theme-muted">
                Public QR item pages can show these contact fields. Private
                inventory, supplier, pricing, and Pick List data stay private.
                {!canShowPublicContact &&
                  " You can turn off the existing setting, but Standard is required to enable it again."}
              </span>
            </span>
            <span className="relative shrink-0">
              <input
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
                className="peer sr-only"
              />
              <span className="block h-7 w-12 rounded-full border border-theme bg-[var(--sydin-input-bg)] transition peer-checked:border-sky-300/40 peer-checked:bg-sky-400/25 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
              <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-slate-400 shadow-md transition peer-checked:translate-x-5 peer-checked:bg-cyan-100" />
            </span>
          </label>
        ) : (
          <div className="mt-4">
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
      </SettingCard>

      {renderNotice()}
      <SaveBar saving={saving} onCancel={resetBusinessFields} />
    </form>
  );

  const renderProfilePanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Signed-in user"
        description="Account identity comes from the current Supabase Auth session. Settings does not change authentication logic."
        action={<StatusChip tone={userEmail ? "success" : "warning"}>Session</StatusChip>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Email
            </p>
            <p className="mt-1 break-words text-sm font-black text-theme-primary">
              {userEmail || "Email unavailable"}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Account actions
            </p>
            <p className="mt-1 text-sm text-theme-muted">
              Sign out and account menu actions remain in DashboardShell.
            </p>
          </div>
        </div>
      </SettingCard>

      <SectionCard aria-labelledby="appearance-heading" className="p-4">
        <SectionHeader
          id="appearance-heading"
          eyebrow="Appearance"
          title="Workspace theme"
          description="Your choice applies immediately and stays on this device."
          action={
            <p className="supporting-body font-semibold text-theme-muted">
              Saved locally
            </p>
          }
        />

        <fieldset className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <legend className="sr-only">Dashboard appearance</legend>
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;

            return (
              <label
                key={option.value}
                className={`group cursor-pointer rounded-xl border p-3 transition ${
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
                <span className="mt-3 flex items-start gap-3">
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
      </SectionCard>
    </div>
  );

  const renderBrandingPanel = () => (
    <form onSubmit={handleSave} aria-busy={saving} className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-4">
          <SettingCard
            title="Brand identity"
            description="Used on reports, exports, QR labels, and public item pages where your plan supports business branding."
            action={<Badge tone="accent">{currentPlanName} plan</Badge>}
          >
            <div className="flex flex-wrap gap-2">
              <StatusChip
                tone={settings.business_name.trim() ? "success" : "warning"}
              >
                {workspaceStatus}
              </StatusChip>
              <StatusChip
                tone={settings.business_logo_url ? "success" : "neutral"}
              >
                {logoStatus}
              </StatusChip>
              <StatusChip tone={contactTone}>{contactStatus}</StatusChip>
              <StatusChip tone={canUseCustomLogo ? "success" : "neutral"}>
                {canUseCustomLogo
                  ? "Logo available on plan"
                  : "Logo locked on plan"}
              </StatusChip>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-theme-primary">
                  {settings.business_name || DEFAULT_BUSINESS_SETTINGS.business_name}
                </p>
                <p className="mt-1 text-xs leading-5 text-theme-muted">
                  Business name and contact fields are edited in Workspace.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => switchSection("workspace")}
              >
                Edit in Workspace
              </Button>
            </div>
          </SettingCard>

          <SettingCard
            title="Logo"
            description="Upload or change the company logo using the existing business logo storage flow and plan rules."
            action={
              <StatusChip
                tone={settings.business_logo_url ? "success" : "neutral"}
              >
                {logoStatus}
              </StatusChip>
            }
          >
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="rounded-xl border border-theme bg-theme-surface p-3">
                <p className="mb-3 text-sm font-semibold text-theme-muted">
                  Current logo
                </p>
                <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-indigo-300/20 bg-indigo-500/10">
                  {settings.business_logo_url ? (
                    <div className="relative h-full w-full">
                      <Image
                        src={settings.business_logo_url}
                        alt={`Business logo for ${settings.business_name}`}
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

              <div>
                {canUseCustomLogo ? (
                  <div className="rounded-xl border border-dashed border-indigo-300/25 bg-theme-surface p-4 transition hover:border-indigo-300/45 hover:bg-theme-hover">
                    <label
                      htmlFor="business-logo-upload"
                      className="grid gap-2 text-sm font-bold text-theme-primary"
                    >
                      Upload business logo
                      <input
                        id="business-logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setLogoFile(event.target.files?.[0] || null)
                        }
                        className="w-full cursor-pointer text-sm text-theme-secondary file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-theme-accent transition-colors hover:file:bg-indigo-500/30"
                      />
                    </label>
                    <p className="mt-3 text-xs leading-5 text-theme-subtle">
                      Choose a replacement logo, then save settings. Existing
                      logo removal is not exposed in v1.
                    </p>

                    {logoFile && (
                      <p className="mt-3 rounded-xl border border-theme bg-theme-inset px-3 py-2 text-sm text-theme-secondary">
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
          </SettingCard>

          <SettingCard
            title="Public contact branding"
            description="Public contact details are shown only when enabled and supported by the current plan."
            action={
              <StatusChip
                tone={
                  canShowPublicContact && settings.show_contact_publicly
                    ? "success"
                    : canShowPublicContact
                      ? "info"
                      : "neutral"
                }
              >
                {publicContactStatus}
              </StatusChip>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Email", settings.contact_email],
                ["Phone", settings.contact_phone],
                ["Website", settings.contact_website],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-sm font-black text-theme-primary">
                    {value || "Not set"}
                  </p>
                </div>
              ))}
            </div>

            {canShowPublicContact || savedSettings.show_contact_publicly ? (
              <label className="mt-4 flex cursor-pointer flex-col gap-3 rounded-xl border border-theme bg-theme-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-sm font-black text-theme-primary">
                    Show contact on public item pages
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-theme-muted">
                    Applies to public QR/item pages. Private workspace data
                    stays private.
                    {!canShowPublicContact &&
                      " You can turn off the existing setting, but Standard is required to enable it again."}
                  </span>
                </span>
                <span className="relative shrink-0">
                  <input
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
                    className="peer sr-only"
                  />
                  <span className="block h-7 w-12 rounded-full border border-theme bg-[var(--sydin-input-bg)] transition peer-checked:border-sky-300/40 peer-checked:bg-sky-400/25 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-slate-400 shadow-md transition peer-checked:translate-x-5 peer-checked:bg-cyan-100" />
                </span>
              </label>
            ) : (
              <div className="mt-4">
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
          </SettingCard>
        </div>

        <div className="grid gap-4">
          <SettingCard
            title="Brand preview"
            description="Static preview of the identity customers may see in report headers and public item pages."
          >
            <div className="overflow-hidden rounded-xl border border-theme bg-theme-surface">
              <div className="flex items-center gap-3 border-b border-theme px-4 py-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-theme bg-theme-inset">
                  {settings.business_logo_url ? (
                    <Image
                      src={settings.business_logo_url}
                      alt={`Business logo for ${settings.business_name}`}
                      fill
                      sizes="48px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <BrandMark compact className="border-0 shadow-none" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-theme-primary">
                    {settings.business_name ||
                      DEFAULT_BUSINESS_SETTINGS.business_name}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Report header preview
                  </p>
                </div>
              </div>
              <div className="grid gap-2 px-4 py-3 text-xs leading-5 text-theme-muted">
                {settings.contact_email && (
                  <p className="break-words">Email: {settings.contact_email}</p>
                )}
                {settings.contact_phone && (
                  <p className="break-words">Phone: {settings.contact_phone}</p>
                )}
                {settings.contact_website && (
                  <p className="break-words">
                    Website: {settings.contact_website}
                  </p>
                )}
                {contactCount === 0 && (
                  <p>No public contact details configured yet.</p>
                )}
              </div>
            </div>
          </SettingCard>

          <SettingCard
            title="Report branding"
            description="PDF report dialogs can use Business logo, SydIN logo, or No logo. Business logo falls back safely when unavailable."
            action={<StatusChip tone="info">{reportBrandingStatus}</StatusChip>}
          >
            <div className="grid gap-2">
              <Link
                href="/dashboard/reports"
                className={buttonClassName({ size: "sm" })}
              >
                Open Reports Hub
              </Link>
              <p className="text-xs leading-5 text-theme-subtle">
                Report contact details appear only when public contact branding
                is enabled and supported by your plan.
              </p>
            </div>
          </SettingCard>

          <SettingCard
            title="Public item identity"
            description="QR Center and public item pages use the saved business name, logo, and enabled contact details."
            action={
              <Link
                href="/dashboard/qr-center"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Open QR Center
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusChip>{contactStatus}</StatusChip>
              <StatusChip
                tone={
                  settings.show_contact_publicly && canShowPublicContact
                    ? "success"
                    : "neutral"
                }
              >
                {publicContactStatus}
              </StatusChip>
            </div>
          </SettingCard>

          <section
            aria-label="Future brand controls"
            className="rounded-xl border border-theme bg-theme-inset p-3"
          >
            <p className="text-sm font-black text-theme-primary">
              Future brand controls
            </p>
            <div className="mt-3 grid gap-2">
              {[
                "Report template colors",
                "Custom email sender",
                "Branded customer portal",
              ].map((item) => (
                <div
                  key={item}
                  className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-2"
                >
                  <span className="text-sm font-bold text-theme-primary">
                    {item}
                  </span>
                  <StatusChip>Future</StatusChip>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {renderNotice()}
      <SaveBar saving={saving} onCancel={resetBusinessFields} />
    </form>
  );

  const renderReportsPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Reports Hub"
        description="Generate inventory and activity reports from live workspace data."
        action={
          <Link href="/dashboard/reports" className={buttonClassName({ size: "sm" })}>
            Open Reports
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusChip tone="success">PDF inventory reports</StatusChip>
          <StatusChip tone="success">CSV movement export</StatusChip>
          <StatusChip>Saved reports future</StatusChip>
        </div>
      </SettingCard>
      <SettingCard
        title="Report defaults"
        description="Branding follows the existing business settings and plan capabilities. Saved report definitions and scheduled reports need future persistence."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-sm font-black text-theme-primary">
              Branding source
            </p>
            <p className="mt-1 text-xs leading-5 text-theme-muted">
              Business logo when available; SydIN logo otherwise.
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-sm font-black text-theme-primary">
              Scheduling
            </p>
            <p className="mt-1 text-xs leading-5 text-theme-muted">
              Future. No email or delivery jobs are configured in Settings v1.
            </p>
          </div>
        </div>
      </SettingCard>
    </div>
  );

  const renderInventoryPanel = () => (
    <form onSubmit={handleSave} aria-busy={saving} className="grid gap-4">
      <SettingCard
        title="Low-stock behavior"
        description="The dashboard and reports use the existing plan-aware low-stock threshold behavior."
        action={<StatusChip>{effectiveLowStockThreshold} units</StatusChip>}
      >
        <label className="grid gap-2 text-sm font-bold text-theme-primary sm:max-w-xs">
          Low-stock threshold
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
            className={inputClassName}
            required
          />
        </label>
        {!canCustomizeThreshold && (
          <p className="mt-2 text-xs leading-5 text-theme-subtle">
            Free uses a fixed threshold of 10. Your saved custom value is
            preserved for a future upgrade.
          </p>
        )}
      </SettingCard>

      <SettingCard
        title="Organization"
        description="Use existing modules to manage categories, depots, suppliers, QR labels, imports, and item defaults."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ModuleLink
            href="/dashboard/categories"
            label="Categories"
            description="Organize item groups"
            icon="categories"
          />
          <ModuleLink
            href="/dashboard/depots"
            label="Depots"
            description="Manage locations"
            icon="depots"
          />
          <ModuleLink
            href="/dashboard/suppliers"
            label="Suppliers"
            description="Manage supplier records"
            icon="suppliers"
          />
          <ModuleLink
            href="/dashboard/qr-center"
            label="QR Center"
            description="Print labels and public item links"
            icon="qr"
          />
        </div>
      </SettingCard>

      {renderNotice()}
      <SaveBar saving={saving} onCancel={resetBusinessFields} />
    </form>
  );

  const renderOperationsPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Operations workflows"
        description="Operational modules keep their existing v1 behavior. This section gives a compact control-center map without changing persistence."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ModuleLink
            href="/dashboard/stock-movements"
            label="Stock Movements"
            description="Audit stock in, out, adjustments, receiving, and counts"
            icon="movement"
          />
          <ModuleLink
            href="/dashboard/stock-counts"
            label="Stock Counts"
            description="Browser-local count workflow in v1"
            icon="check"
          />
          <ModuleLink
            href="/dashboard/pick-lists"
            label="Pick Lists"
            description="Saved pick lists and pick sheets"
            icon="picklists"
          />
          <ModuleLink
            href="/dashboard/purchase-orders"
            label="Purchase Orders"
            description="Browser-local PO drafts in v1"
            icon="file"
          />
          <ModuleLink
            href="/dashboard/receiving"
            label="Receiving"
            description="Receive stock and create stock-in movement records"
            icon="upload"
          />
        </div>
      </SettingCard>
      <SettingCard
        title="v1 persistence notes"
        description="Stock movement records are persisted. Stock count sessions and purchase order history remain workflow-local until a future persistence phase."
        action={<StatusChip>v1 workflow</StatusChip>}
      />
    </div>
  );

  const renderBillingPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Current plan"
        description="Plan status and limits are read from existing subscription logic."
        action={<Badge tone="accent">{currentPlanName} plan</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Status
            </p>
            <p className="mt-1 text-sm font-black text-theme-primary">
              {subscription.status || "active"}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Item limit
            </p>
            <p className="mt-1 text-sm font-black text-theme-primary">
              {subscription.item_limit.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Billing
            </p>
            <p className="mt-1 text-sm text-theme-muted">
              Manual plan activation. No Stripe settings in v1.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link href={upgradeHref} className={buttonClassName({ size: "sm" })}>
            {upgradeLabel}
          </Link>
        </div>
      </SettingCard>
      <SettingCard
        title="Plan capabilities"
        description="Feature availability follows the existing subscription plan definitions."
      >
        <div className="flex flex-wrap gap-2">
          <StatusChip tone={planCapabilities.customBusinessLogo ? "success" : "neutral"}>
            Logo branding {planCapabilities.customBusinessLogo ? "available" : "upgrade"}
          </StatusChip>
          <StatusChip tone={planCapabilities.csvExcelImport ? "success" : "neutral"}>
            Import {planCapabilities.csvExcelImport ? "available" : "upgrade"}
          </StatusChip>
          <StatusChip tone={planCapabilities.advancedReports ? "success" : "neutral"}>
            Advanced reports {planCapabilities.advancedReports ? "available" : "upgrade"}
          </StatusChip>
        </div>
      </SettingCard>
    </div>
  );

  const renderEmailPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Email identity"
        description="Authentication email is handled by the existing Supabase Auth setup. Custom senders and notification templates are not implemented in Settings v1."
        action={<StatusChip>Future</StatusChip>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Account email
            </p>
            <p className="mt-1 break-words text-sm font-black text-theme-primary">
              {userEmail || "Email unavailable"}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Custom sender
            </p>
            <p className="mt-1 text-sm text-theme-muted">
              Future. No SMTP, domain, or delivery settings were added.
            </p>
          </div>
        </div>
      </SettingCard>
    </div>
  );

  const renderSecurityPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Authentication"
        description="SydIN uses the existing Supabase Auth session. This page does not alter providers, policies, or account security flows."
        action={<StatusChip tone="success">Active session</StatusChip>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Signed in as
            </p>
            <p className="mt-1 break-words text-sm font-black text-theme-primary">
              {userEmail || "Current user"}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Password and providers
            </p>
            <p className="mt-1 text-sm text-theme-muted">
              Managed by the existing auth flow. No provider changes in this
              phase.
            </p>
          </div>
        </div>
      </SettingCard>
    </div>
  );

  const renderDataPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Data movement"
        description="Use existing import and export surfaces. Settings v1 does not add backup jobs, destructive tools, or schema changes."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ModuleLink
            href="/dashboard/inventory/import"
            label="Inventory import"
            description="Import inventory with the existing route"
            icon="upload"
          />
          <ModuleLink
            href="/dashboard/inventory"
            label="Inventory exports"
            description="Use Inventory for selected item exports"
            icon="download"
          />
          <ModuleLink
            href="/dashboard/reports"
            label="Report exports"
            description="Generate PDF and CSV reports"
            icon="reports"
          />
        </div>
      </SettingCard>
      <SettingCard
        title="Backups"
        description="Workspace backups, audit snapshots, and destructive data tools need a later dedicated design."
        action={<StatusChip>Future</StatusChip>}
      />
    </div>
  );

  const renderActivePanel = () => {
    if (loading) {
      return (
        <section className="grid gap-3" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 overflow-hidden rounded-xl border border-theme bg-theme-surface"
            >
              <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
            </div>
          ))}
        </section>
      );
    }

    switch (activeSection) {
      case "profile":
        return renderProfilePanel();
      case "branding":
        return renderBrandingPanel();
      case "reports":
        return renderReportsPanel();
      case "inventory":
        return renderInventoryPanel();
      case "operations":
        return renderOperationsPanel();
      case "billing":
        return renderBillingPanel();
      case "email":
        return renderEmailPanel();
      case "security":
        return renderSecurityPanel();
      case "data":
        return renderDataPanel();
      case "workspace":
      default:
        return renderWorkspacePanel();
    }
  };

  return (
    <div className="contents">
      <main>
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
          <section className="rounded-[18px] border border-theme bg-theme-surface p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-theme-accent">
                  Control center
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
                  Settings
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-theme-muted">
                  Manage the workspace details SydIN already supports, with
                  clear placeholders for future branding, billing, email, team,
                  security, and data controls.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusChip tone={settings.business_name.trim() ? "success" : "warning"}>
                  {workspaceStatus}
                </StatusChip>
                <StatusChip tone={settings.business_logo_url ? "success" : "neutral"}>
                  {logoStatus}
                </StatusChip>
                <Badge tone="accent">{currentPlanName} plan</Badge>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
            <aside className="rounded-[18px] border border-theme bg-theme-surface p-3 lg:sticky lg:top-4">
              <nav aria-label="Settings sections" className="grid gap-1.5">
                {navigationSummary.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => switchSection(section.id)}
                    aria-current={section.active ? "page" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/15 ${
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

            <section
              aria-labelledby="settings-panel-heading"
              className="min-w-0 rounded-[18px] border border-theme bg-theme-surface p-4 sm:p-5"
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
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
