"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
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
    description: "Signed-in account and workspace style",
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
    description: "Report defaults and scheduling roadmap",
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
    description: "Workflow modules and draft history notes",
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

const inputClassName =
  "w-full min-h-11 rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3.5 py-2.5 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] disabled:cursor-not-allowed disabled:opacity-60";
const valueTextClassName =
  "min-w-0 truncate text-sm font-black text-theme-primary";
const mutedTextClassName = "min-w-0 text-xs leading-5 text-theme-muted";

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
      className={`inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 text-xs font-bold whitespace-normal ${toneClass}`}
    >
      {children}
    </span>
  );
}

function LongSettingValue({
  value,
  fallback = "Not set",
  prefix = "",
  className = valueTextClassName,
}: {
  value: string | null | undefined;
  fallback?: string;
  prefix?: string;
  className?: string;
}) {
  const displayValue = value || fallback;
  const accessibleValue = `${prefix}${displayValue}`;

  return (
    <p className={className} title={accessibleValue} aria-label={accessibleValue}>
      {accessibleValue}
    </p>
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
    <article className="min-w-0 rounded-xl border border-theme bg-theme-inset p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-black text-theme-primary">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-theme-muted">
            {description}
          </p>
        </div>
        {action && <div className="min-w-0 sm:shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-4 min-w-0">{children}</div>}
    </article>
  );
}

function RoadmapCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <SettingCard
      title={title}
      description={description}
      action={<StatusChip tone="info">Roadmap</StatusChip>}
    >
      <div className="flex min-w-0 flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex min-h-8 max-w-full items-center rounded-full border border-theme bg-theme-surface px-2.5 py-1 text-xs font-bold text-theme-secondary"
          >
            {item}
          </span>
        ))}
      </div>
    </SettingCard>
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
          <label className="grid min-w-0 gap-2 text-sm font-bold text-theme-primary">
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
          <label className="grid min-w-0 gap-2 text-sm font-bold text-theme-primary">
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
          <label className="grid min-w-0 gap-2 text-sm font-bold text-theme-primary">
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
            <span className="min-w-0">
              <span className={`block ${valueTextClassName}`}>
                Show contact publicly
              </span>
              <span className={`mt-1 block ${mutedTextClassName}`}>
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
          <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Email
            </p>
            <LongSettingValue
              value={userEmail}
              fallback="Email unavailable"
              className={`mt-1 ${valueTextClassName}`}
            />
          </div>
          <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
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
          title="Light Liquid Glass workspace"
          description="SydIN now uses one consistent light workspace across web, tablet, and mobile."
          action={
            <StatusChip tone="success">Active</StatusChip>
          }
        />

        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-32 overflow-hidden rounded-xl border border-theme bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(235,247,255,0.76)_52%,rgba(245,241,255,0.72))] p-4 shadow-[0_18px_48px_rgba(30,64,175,0.1)]">
            <div className="relative grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="h-2.5 w-28 rounded-full bg-white/80 shadow-inner" />
                <span className="rounded-full border border-cyan-200 bg-white/70 px-2.5 py-1 text-xs font-black text-theme-accent">
                  Light only
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <span className="h-16 rounded-xl border border-white/80 bg-white/70 shadow-sm" />
                <span className="h-16 rounded-xl border border-white/80 bg-white/60 shadow-sm" />
                <span className="h-16 rounded-xl border border-white/80 bg-white/70 shadow-sm" />
              </div>
              <span className="h-12 rounded-xl border border-white/80 bg-white/72 shadow-sm" />
            </div>
          </div>
          <div className="grid content-center gap-3 rounded-xl border border-theme bg-theme-inset p-4">
            <p className="text-sm font-black text-theme-primary">
              Dark and system switching are paused for this redesign pass.
            </p>
            <p className="text-sm leading-6 text-theme-muted">
              Keeping one light visual system improves consistency for the
              app shell, forms, tables, sheets, and mobile bottom navigation.
            </p>
          </div>
        </div>
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
            <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={valueTextClassName}>
                  {settings.business_name ||
                    DEFAULT_BUSINESS_SETTINGS.business_name}
                </p>
                <p className={`mt-1 ${mutedTextClassName}`}>
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
                      <p
                        className="mt-3 min-w-0 truncate rounded-xl border border-theme bg-theme-inset px-3 py-2 text-sm text-theme-secondary"
                        title={`Selected: ${logoFile.name}`}
                        aria-label={`Selected: ${logoFile.name}`}
                      >
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
                  className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    {label}
                  </p>
                  <LongSettingValue
                    value={value}
                    className={`mt-1 ${valueTextClassName}`}
                  />
                </div>
              ))}
            </div>

            {canShowPublicContact || savedSettings.show_contact_publicly ? (
              <label className="mt-4 flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-theme bg-theme-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className={`block ${valueTextClassName}`}>
                    Show contact on public item pages
                  </span>
                  <span className={`mt-1 block ${mutedTextClassName}`}>
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
                  <LongSettingValue
                    value={settings.contact_email}
                    prefix="Email: "
                    className="min-w-0 truncate text-xs leading-5 text-theme-muted"
                  />
                )}
                {settings.contact_phone && (
                  <LongSettingValue
                    value={settings.contact_phone}
                    prefix="Phone: "
                    className="min-w-0 truncate text-xs leading-5 text-theme-muted"
                  />
                )}
                {settings.contact_website && (
                  <LongSettingValue
                    value={settings.contact_website}
                    prefix="Website: "
                    className="min-w-0 truncate text-xs leading-5 text-theme-muted"
                  />
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

          <RoadmapCard
            title="Branding roadmap"
            description="Later branding controls are grouped here so the active logo, contact, and report identity settings stay easy to scan."
            items={[
              "Report template colors",
              "Custom email sender",
              "Branded customer portal",
            ]}
          />
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
          <StatusChip tone="info">Saved reports roadmap</StatusChip>
        </div>
      </SettingCard>
      <SettingCard
        title="Report defaults"
        description="Branding follows the existing business settings and plan capabilities. Scheduling and saved templates are grouped as roadmap items below."
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
              Current workflow
            </p>
            <p className="mt-1 text-xs leading-5 text-theme-muted">
              Generate reports manually from Reports Hub. No delivery jobs are
              configured in Settings v1.
            </p>
          </div>
        </div>
      </SettingCard>
      <RoadmapCard
        title="Reports roadmap"
        description="Planned report automation is summarized here without adding inactive controls to the current Settings surface."
        items={[
          "Saved report templates",
          "Scheduled email delivery",
          "Delivery preferences",
        ]}
      />
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
        description="Operational modules keep their existing v1 behavior. This section gives a compact control-center map without changing workflow storage."
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
            description="Device draft count workflow in v1"
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
            description="Device draft PO workflow in v1"
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
        title="Workflow notes"
        description="Stock movement records are saved. Stock count sessions and purchase order history stay on this device in the current workflow."
        action={<StatusChip>Current workflow</StatusChip>}
      />
    </div>
  );

  const renderBillingPanel = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
      <div className="grid gap-4">
        <SettingCard
          title="Current plan"
          description="Your plan controls access to branding, reporting, imports, scanner tools, and workspace limits."
          action={<Badge tone="accent">{currentPlanName} plan</Badge>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Plan
              </p>
              <p className="mt-1 text-sm font-black text-theme-primary">
                {currentPlanName}
              </p>
              <div className="mt-2">
                <StatusChip>Current plan</StatusChip>
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Status
              </p>
              <p className="mt-1 text-sm font-black text-theme-primary">
                {subscription.status || "active"}
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                Read from existing subscription data.
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Item limit
              </p>
              <p className="mt-1 text-sm font-black text-theme-primary">
                {subscription.item_limit.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                Usage count remains in the dashboard account area.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-theme-primary">
                Manual early-access plan changes
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                SydIN currently uses plan requests and manual activation. No
                checkout or billing portal is exposed in Settings v1.
              </p>
            </div>
            <Link
              href={upgradeHref}
              className={buttonClassName({ size: "sm" })}
            >
              {upgradeLabel}
            </Link>
          </div>
        </SettingCard>

        <SettingCard
          title="Included capabilities"
          description="Feature availability is based on the current workspace plan and the existing entitlement checks."
        >
          <div className="grid gap-2 md:grid-cols-2">
            {[
              [
                "Business logo",
                "Used in branding and exports",
                planCapabilities.customBusinessLogo,
                "Logo included",
                "Logo locked",
              ],
              [
                "Public contact branding",
                "Contact details on public item pages",
                planCapabilities.publicContactBranding,
                "Public branding included",
                "Public branding locked",
              ],
              [
                "Custom low-stock threshold",
                "Workspace low-stock rule",
                planCapabilities.customLowStockThreshold,
                "Low-stock threshold included",
                "Low-stock threshold locked",
              ],
              [
                "PDF and report exports",
                "Inventory reports and export branding",
                planCapabilities.pdfExport === "basic",
                "PDF export included",
                "PDF export locked",
              ],
              [
                "Inventory import",
                "CSV/Excel import workflow",
                planCapabilities.csvExcelImport,
                "Import included",
                "Import locked",
              ],
              [
                "Scanner",
                "Barcode scanner workflow",
                planCapabilities.scanner,
                "Scanner included",
                "Scanner locked",
              ],
            ].map(([title, description, included, includedLabel, lockedLabel]) => (
              <div
                key={String(title)}
                className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-theme-primary">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-theme-muted">
                      {description}
                    </p>
                  </div>
                  <StatusChip tone={included ? "success" : "neutral"}>
                    {included ? includedLabel : lockedLabel}
                  </StatusChip>
                </div>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard
          title="Plan-related settings"
          description="Jump to the existing settings and modules affected by your current plan."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("branding")}
            >
              Review Branding
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("inventory")}
            >
              Review Inventory
            </Button>
            <Link
              href="/dashboard/reports"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open Reports Hub
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("workspace")}
            >
              Review Workspace
            </Button>
          </div>
        </SettingCard>
      </div>

      <div className="grid gap-4">
        <SettingCard
          title="Plan-gated features"
          description="Locked items are available on higher plans through the existing manual request flow."
          action={<StatusChip>Based on plan</StatusChip>}
        >
          <div className="grid gap-2">
            {[
              [
                "Branding",
                planCapabilities.customBusinessLogo &&
                  planCapabilities.publicContactBranding,
              ],
              ["Import and scanner", planCapabilities.csvExcelImport && planCapabilities.scanner],
              ["Advanced reports", planCapabilities.advancedReports],
              ["Dashboard value analytics", planCapabilities.dashboardAnalytics],
              ["Priority manual support", planCapabilities.priorityManualSupport],
            ].map(([label, available]) => (
              <div
                key={String(label)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-2"
              >
                <span className="text-sm font-bold text-theme-primary">
                  {label}
                </span>
                <StatusChip tone={available ? "success" : "neutral"}>
                  {available ? "Included" : "Higher plan"}
                </StatusChip>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard
          title="Usage and limits"
          description="Item limit is available today. Detailed billing management is grouped in the roadmap summary below."
          action={<StatusChip tone="success">Limit visible</StatusChip>}
        >
          <div className="grid gap-3">
            <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Current item limit
              </p>
              <p className="mt-1 text-sm font-black text-theme-primary">
                {subscription.item_limit.toLocaleString()} items
              </p>
            </div>
          </div>
        </SettingCard>

        <RoadmapCard
          title="Billing management roadmap"
          description="Invoices, payment methods, checkout, and billing history remain planned billing-system work, separate from the current manual plan request flow."
          items={[
            "Invoices",
            "Payment methods",
            "Checkout and upgrades",
            "Billing history",
            "Seat and team billing",
            "Usage metering",
          ]}
        />
      </div>
    </div>
  );

  const renderEmailPanel = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="grid gap-4">
        <SettingCard
          title="Current email setup"
          description="Account verification and password-related emails are handled by SydIN's authentication provider. Custom sender controls are not active in Settings v1."
          action={<StatusChip tone="success">Auth email active</StatusChip>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Account email
              </p>
              <LongSettingValue
                value={userEmail}
                fallback="Email unavailable"
                className={`mt-1 ${valueTextClassName}`}
              />
              <p
                className={`mt-1 ${mutedTextClassName}`}
              >
                Used for sign-in, verification, and account access emails.
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Custom sender
              </p>
              <LongSettingValue
                value="Not configured"
                className={`mt-1 ${valueTextClassName}`}
              />
              <div className="mt-2">
                <StatusChip tone="info">Roadmap item</StatusChip>
              </div>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Business contact email"
          description="The saved business contact email is used for public contact branding when enabled and allowed by your plan."
          action={
            <StatusChip tone={settings.contact_email ? "success" : "neutral"}>
              {settings.contact_email
                ? "Business email configured"
                : "Business email missing"}
            </StatusChip>
          }
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Public contact email
              </p>
              <LongSettingValue
                value={settings.contact_email}
                className={`mt-1 ${valueTextClassName}`}
              />
              <p
                className={`mt-1 ${mutedTextClassName}`}
              >
                Public contact display is controlled in Branding and Workspace.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-40">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => switchSection("workspace")}
              >
                Edit Workspace
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => switchSection("branding")}
              >
                Review Branding
              </Button>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Report emails"
          description="Manual PDF and CSV exports are available today from Reports. Scheduled email reports need notification preferences and delivery controls in a later phase."
          action={<StatusChip tone="info">Manual reports</StatusChip>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-sm font-black text-theme-primary">
                Available today
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                Generate inventory PDFs and stock movement CSV files manually.
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-sm font-black text-theme-primary">
                Scheduled delivery
              </p>
              <p className="mt-1 text-xs leading-5 text-theme-muted">
                Summarized in the notification roadmap below.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Link
              href="/dashboard/reports"
              className={buttonClassName({ size: "sm" })}
            >
              Open Reports Hub
            </Link>
          </div>
        </SettingCard>
      </div>

      <div className="grid gap-4">
        <RoadmapCard
          title="Notification roadmap"
          description="Automated alerts and sender customization are planned as a later email-provider phase, not inactive Settings toggles."
          items={[
            "Low-stock alerts",
            "Stock movement alerts",
            "Receiving confirmations",
            "Pick list updates",
            "Scheduled report emails",
            "Branded sender",
            "Reply-to controls",
            "Domain verification",
          ]}
        />

        <SettingCard
          title="Operational context"
          description="Stock movement history is available today. Email alerts for operational events are intentionally not enabled in this phase."
          action={
            <Link
              href="/dashboard/stock-movements"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open Movements
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="success">Stock history available</StatusChip>
            <StatusChip tone="info">Workflow email roadmap</StatusChip>
          </div>
        </SettingCard>
      </div>
    </div>
  );

  const renderSecurityPanel = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="grid gap-4">
        <SettingCard
          title="Account access"
          description="Your dashboard session is managed by SydIN authentication. This page displays the current account state without changing auth settings."
          action={<StatusChip tone="success">Signed in</StatusChip>}
        >
          <div className="grid gap-3">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Signed in as
              </p>
              <LongSettingValue
                value={userEmail}
                fallback="Current user"
                className={`mt-1 ${valueTextClassName}`}
              />
              <p
                className={`mt-1 ${mutedTextClassName}`}
              >
                Account email comes from the current authenticated session.
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                Sign out
              </p>
              <p
                className="mt-1 min-w-0 text-sm text-theme-muted"
              >
                Sign-out remains in the dashboard account menu and mobile More
                sheet.
              </p>
              <div className="mt-2">
                <StatusChip>Account menu action</StatusChip>
              </div>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Sign-in methods"
          description="These are the sign-in methods exposed by the existing login and signup screens. Settings does not connect or unlink providers."
          action={<StatusChip>OAuth available</StatusChip>}
        >
          <div className="grid gap-2">
            {[
              ["Email and password", "Available sign-in method"],
              ["Google", "Available OAuth sign-in method"],
              ["Microsoft", "Available OAuth sign-in method"],
            ].map(([method, status]) => (
              <div
                key={method}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-2"
              >
                <span className="min-w-0">
                  <span className={`block ${valueTextClassName}`}>
                    {method}
                  </span>
                  <span
                    className={`mt-0.5 block ${mutedTextClassName}`}
                  >
                    {status}
                  </span>
                </span>
                <StatusChip>Available</StatusChip>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard
          title="Password and recovery"
          description="Password recovery emails are handled by the authentication provider through the existing sign-in support flow."
          action={<StatusChip tone="success">Auth email active</StatusChip>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className={valueTextClassName}>
                Email verification
              </p>
              <p
                className={`mt-1 ${mutedTextClassName}`}
              >
                Signup verification uses the current auth email flow.
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-theme bg-theme-surface px-3 py-2.5">
              <p className={valueTextClassName}>
                Password help
              </p>
              <p
                className={`mt-1 ${mutedTextClassName}`}
              >
                Managed during sign-in and support. No new password reset
                controls were added here.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("email")}
            >
              Review Email Settings
            </Button>
          </div>
        </SettingCard>

        <SettingCard
          title="Workspace security"
          description="Dashboard access is protected by the existing authenticated session and workspace data rules. Advanced team security belongs in a later phase."
          action={<StatusChip tone="success">Authenticated dashboard</StatusChip>}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("profile")}
            >
              Review Profile
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("data")}
            >
              Review Data Settings
            </Button>
          </div>
        </SettingCard>
      </div>

      <div className="grid gap-4">
        <RoadmapCard
          title="Advanced security roadmap"
          description="Advanced security controls are grouped here so the current account, sign-in, and data protection summaries stay focused."
          items={[
            "Multi-factor authentication",
            "Active sessions",
            "Trusted devices",
            "Sign out of all devices",
            "Security notifications",
            "Team roles",
            "Audit log",
            "Approval flows",
            "Provider management",
          ]}
        />

        <SettingCard
          title="Data protection"
          description="Inventory and business settings are available inside the authenticated dashboard. Public item pages expose only their limited public item view."
          action={<StatusChip>Dashboard data private</StatusChip>}
        >
          <div className="grid gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => switchSection("data")}
            >
              Open Data Settings
            </Button>
            <p className="min-w-0 text-xs leading-5 text-theme-subtle">
              This section avoids exposing internal account IDs or security
              implementation details.
            </p>
          </div>
        </SettingCard>
      </div>
    </div>
  );

  const renderDataPanel = () => (
    <div className="grid gap-4">
      <SettingCard
        title="Data movement"
        description="Use existing import and export surfaces. Settings v1 does not add backup jobs or destructive data tools."
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
      <RoadmapCard
        title="Advanced data tools roadmap"
        description="Backup, restore, and audit snapshot concepts are grouped here without adding destructive tools to Settings."
        items={[
          "Workspace backups",
          "Restore points",
          "Audit snapshots",
          "Advanced exports",
        ]}
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
      <main className="settings-workspace">
        <div className="settings-shell mx-auto flex w-full max-w-[1180px] flex-col gap-5">
          <section className="settings-hero rounded-[18px] border border-theme bg-theme-surface p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] sm:p-5">
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
                  compact roadmap summaries for later branding, billing,
                  email, team, security, and data controls.
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

          <div className="settings-layout grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
            <aside className="settings-sidebar rounded-[18px] border border-theme bg-theme-surface p-3 lg:sticky lg:top-4">
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
              className="settings-panel min-w-0 rounded-[18px] border border-theme bg-theme-surface p-4 sm:p-5"
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
