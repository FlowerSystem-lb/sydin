"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  Button,
  Select,
  UnsavedChangesGuard,
  buttonClassName,
  useToast,
} from "@/components/ui";
import {
  DashboardCard,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  isCompanyProfileSchemaMissing,
  getOrCreateBusinessSettings,
  normalizeAccentColor,
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
  ROLE_LABELS,
  clearBusinessContext,
  getBusinessUser,
} from "@/app/lib/business";
import { useBusiness } from "@/components/dashboard/BusinessContext";
import TeamPanel from "@/components/settings/TeamPanel";
import {
  INVENTORY_SORT_OPTIONS,
  getDefaultInventorySort,
  isInventorySort,
  setDefaultInventorySort,
  type InventorySort,
} from "@/app/lib/preferences";
import {
  FALLBACK_SUBSCRIPTION,
  FREE_LOW_STOCK_THRESHOLD,
  formatPlanName,
  getSubscriptionCapabilities,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  getSubscriptionUsage,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

type SettingsSectionId =
  | "workspace"
  | "documents"
  | "currency"
  | "inventory"
  | "profile"
  | "preferences"
  | "team"
  | "billing";

/**
 * Sections merged during the 2026-07-25 reorganization (10 → 6). Kept so any
 * existing deep link (bookmark, in-app href, docs) still lands on the panel that
 * now contains that content instead of silently falling back to Workspace.
 */
const MERGED_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  branding: "workspace",
  // "Data & reports" held only links to Import & Export and Reports, both of
  // which are in the sidebar now (26 Sep); old links land on the profile.
  data: "workspace",
  reports: "workspace",
  operations: "inventory",
  // Security & Email folded into Account (13 Sep 2026): both only said who
  // is signed in and how to sign out.
  email: "profile",
  security: "profile",
};

interface SettingsSection {
  id: SettingsSectionId;
  group: "Business" | "Workspace" | "Account";
  label: string;
  description: string;
  icon: UiIconName;
}

// Supabase names Microsoft sign-in "azure".
const SIGN_IN_LABELS = {
  email: "Email code",
  google: "Google",
  azure: "Microsoft",
} as const;

/* Rebuilt 26 Sep from Sayed's Figma Make design: grouped the way a business
   owner thinks about it (the business, how the app behaves, their account),
   and the long single Company form split into the three things it actually
   held -- who you are, what prints on documents, and money. */
const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "workspace",
    group: "Business",
    label: "Company profile",
    description: "Business details shown on documents and public pages.",
    icon: "dashboard",
  },
  {
    id: "documents",
    group: "Business",
    label: "Documents",
    description: "Defaults printed on every invoice and purchase order.",
    icon: "file",
  },
  {
    id: "currency",
    group: "Business",
    label: "Currency",
    description: "The currency the app shows, and the rate it converts at.",
    icon: "usage",
  },
  {
    id: "inventory",
    group: "Workspace",
    label: "Inventory",
    description: "When an item counts as low stock.",
    icon: "box",
  },
  {
    id: "profile",
    group: "Account",
    label: "Account & security",
    description: "Who is signed in, and signing out.",
    icon: "settings",
  },
  {
    id: "preferences",
    group: "Account",
    label: "Preferences",
    description: "How SydIN opens for you, on this device.",
    icon: "sliders",
  },
  {
    id: "team",
    group: "Account",
    label: "Team",
    description: "Invite people to this business and choose what they can do.",
    icon: "customers",
  },
  {
    id: "billing",
    group: "Account",
    label: "Plan & billing",
    description: "Your current plan, usage and included features.",
    icon: "receipt",
  },
];

const SECTION_GROUPS: SettingsSection["group"][] = ["Business", "Workspace", "Account"];

const SECTION_IDS = new Set<SettingsSectionId>(
  SETTINGS_SECTIONS.map((section) => section.id)
);

// SydIN's own accent blue -- what documentPdf.ts falls back to when a
// business has not chosen its own. Shown here so the picker starts on the
// colour a document would actually print today, not an arbitrary one.
const DEFAULT_ACCENT_COLOR = "#2563EB";

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

/** One settings row: label (and an optional hint) on the left, the control
    on the right, a hairline between rows -- the Figma Make layout. */
function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  // 28 Sep (Sayed): no grey explanation under each label. The hint stays
  // available as a hover tooltip and for screen readers, not on the page.
  return (
    <div className="st-row">
      <div className="st-row-label" title={hint}>
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {hint && <p className="sr-only">{hint}</p>}
      </div>
      <div className="st-row-control">{children}</div>
    </div>
  );
}

/* Appears only once something has changed, and stays on screen while the
   form scrolls. Was a permanent "Reset / Save settings" pair under every
   form, whether or not there was anything to save. */
function SaveBar({
  saving,
  dirty,
  onCancel,
}: {
  saving: boolean;
  dirty: boolean;
  onCancel: () => void;
}) {
  if (!dirty && !saving) return null;
  return (
    <div className="st-savebar" role="region" aria-label="Unsaved changes">
      <span className="st-savebar-text">You have unsaved changes</span>
      <div className="st-savebar-actions">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Discard
        </Button>
        <Button type="submit" loading={saving} loadingLabel="Saving…">
          Save changes
        </Button>
      </div>
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
  const [signInMethods, setSignInMethods] = useState<string[]>([]);
  const [usedItems, setUsedItems] = useState<number | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [ratesNotice, setRatesNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setSuccess] = useState("");
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

    // Read it on arrival too. The state initialiser above sees the hash only
    // when this component first mounts with it already in the URL; arriving
    // from the account menu's "Workspace style" link landed on Company.
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let isActive = true;

    getBusinessUser()
      .then(({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("Please sign in again to manage settings.");
          setLoading(false);
          return;
        }

        setUserEmail(user.email || "");
        setSignInMethods(
          (user.identities ?? []).map((identity) => identity.provider)
        );

        Promise.all([
          getOrCreateBusinessSettings(user.id),
          getSubscriptionUsage(user.id),
        ])
          .then(([loadedSettings, usage]) => {
            if (!isActive) return;

            setSettings(loadedSettings);
            setSavedSettings(loadedSettings);
            setSubscription(usage.subscription);
            setUsedItems(usage.usedItems);
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
  // Folds the settings menu to icons (Sayed, from Sortly's settings, 28 Sep).
  // Remembered per browser; a desktop-only control -- on phones the menu is
  // already a single row of pills.
  const [navCollapsed, setNavCollapsed] = useState(false);
  // The pinned title bar gets a soft shadow once the page has scrolled under
  // it, like Sortly's settings. The page scrolls inside the shell from 900px.
  const [scrolled, setScrolled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Desktop: only the area under the title scrolls (.st-scroll), Sortly
    // style. Phones: the whole page scrolls as before.
    const area = scrollAreaRef.current;
    const scroller =
      area && getComputedStyle(area).overflowY === "auto"
        ? area
        : document.querySelector<HTMLElement>(".dashboard-shell-content");
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > 8);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  const [inventorySort, setInventorySort] = useState<InventorySort>("newest");
  const [timeZoneLabel, setTimeZoneLabel] = useState("");
  useEffect(() => {
    // One-time read of this browser's stored preferences and time zone after
    // mount; the server render has neither.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setInventorySort(getDefaultInventorySort());
      setTimeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " "));
      if (localStorage.getItem("sydin:settings-nav") === "collapsed") {
        setNavCollapsed(true);
      }
    } catch {
      // Storage blocked: start open.
    }
  }, []);
  const toggleNav = () => {
    setNavCollapsed((current) => {
      try {
        localStorage.setItem("sydin:settings-nav", current ? "open" : "collapsed");
      } catch {
        // Private mode: just don't remember it.
      }
      return !current;
    });
  };
  const business = useBusiness();
  const myRole = business?.role ?? "owner";
  // Staff and view-only members manage only their own account; plan and
  // billing stay with the owner (the database refuses the rest anyway).
  const visibleSections = SETTINGS_SECTIONS.filter((section) =>
    myRole === "owner"
      ? true
      : myRole === "admin"
        ? section.id !== "billing"
        : section.id === "profile" || section.id === "preferences"
  );
  const requestedSection = sectionFromQuery
    ? normalizeSectionId(sectionFromQuery)
    : hashSection || (myRole === "staff" || myRole === "viewer" ? "profile" : "workspace");
  const activeSection = visibleSections.some((section) => section.id === requestedSection)
    ? requestedSection
    : visibleSections[0].id;
  // On a phone the sections are a scrolling row of tabs; the active one
  // can arrive off-screen (e.g. Data & reports from the More sheet).
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    document
      .querySelector(".settings-nav-item[aria-current=\"page\"]")
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeSection]);
  const activeSectionDetails =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection) ||
    SETTINGS_SECTIONS[0];



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
      } = await getBusinessUser();

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
        accent_color: normalizeAccentColor(settings.accent_color),
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
        accent_color: documentFieldsSkipped ? null : normalizeAccentColor(settings.accent_color),
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


  const setField = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  /* ---- Company profile ------------------------------------------------ */
  const renderCompanyPanel = () => (
    <>
      <Row label="Business name" htmlFor="business-name">
        <input
          id="business-name"
          type="text"
          className="st-input"
          value={settings.business_name}
          onChange={(event) => setField("business_name", event.target.value)}
          required
        />
      </Row>

      <Row label="Logo" hint="PNG or JPG, square works best.">
        <div className="st-inline">
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
            <div className="min-w-0">
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
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                className="sr-only"
              />
              {logoFile && (
                <p className="st-hint">Selected: {logoFile.name}. Saved when you save.</p>
              )}
            </div>
          ) : (
            <p className="st-hint">
              A custom logo comes with the Standard plan.{" "}
              <Link href={upgradeHref} className="st-link">
                Compare plans
              </Link>
            </p>
          )}
        </div>
      </Row>

      <Row label="Accent colour" hint="The colour bar on every document you export." htmlFor="accent-color">
        <div className="st-inline">
          <input
            id="accent-color"
            type="color"
            className="settings-accent-swatch"
            value={settings.accent_color || DEFAULT_ACCENT_COLOR}
            onChange={(event) => setField("accent_color", event.target.value)}
          />
          <span className="st-mono">{(settings.accent_color || DEFAULT_ACCENT_COLOR).toUpperCase()}</span>
          {settings.accent_color && (
            <button type="button" className="st-text-button" onClick={() => setField("accent_color", null)}>
              Reset to default
            </button>
          )}
        </div>
      </Row>

      <Row label="Phone" htmlFor="contact-phone">
        <input
          id="contact-phone"
          type="tel"
          className="st-input"
          value={settings.contact_phone}
          onChange={(event) => setField("contact_phone", event.target.value)}
          placeholder="+961 …"
        />
      </Row>
      <Row label="Email" htmlFor="contact-email">
        <input
          id="contact-email"
          type="email"
          className="st-input"
          value={settings.contact_email}
          onChange={(event) => setField("contact_email", event.target.value)}
          placeholder="orders@yourbusiness.com"
        />
      </Row>
      <Row label="Website" htmlFor="contact-website">
        <input
          id="contact-website"
          type="url"
          className="st-input"
          value={settings.contact_website}
          onChange={(event) => setField("contact_website", event.target.value)}
          placeholder="https://"
        />
      </Row>

      <Row
        label="Show contact on public item pages"
        hint="Your phone, email and website on the page a QR label opens. Stock, prices and suppliers stay private."
        htmlFor="show-contact-publicly"
      >
        {canShowPublicContact || savedSettings.show_contact_publicly ? (
          <label className="st-switch">
            <input
              id="show-contact-publicly"
              type="checkbox"
              role="switch"
              checked={settings.show_contact_publicly}
              onChange={(event) => {
                if (!canShowPublicContact && event.target.checked) return;
                setField("show_contact_publicly", event.target.checked);
              }}
            />
            <span aria-hidden="true" />
          </label>
        ) : (
          <p className="st-hint">
            Comes with the Standard plan.{" "}
            <Link href={upgradeHref} className="st-link">
              Compare plans
            </Link>
          </p>
        )}
      </Row>

      <Row label="Address" hint="Printed under your name on invoices and orders." htmlFor="business-address">
        <textarea
          id="business-address"
          className="st-input st-textarea"
          value={settings.business_address}
          onChange={(event) => setField("business_address", event.target.value)}
          placeholder={"Street, building\nCity, country"}
          rows={3}
        />
      </Row>
      <Row label="Tax / registration number" htmlFor="tax-id">
        <input
          id="tax-id"
          type="text"
          className="st-input"
          value={settings.tax_id}
          onChange={(event) => setField("tax_id", event.target.value)}
          placeholder="VAT number or commercial registration"
        />
      </Row>
    </>
  );

  /* ---- Documents ------------------------------------------------------ */
  const renderDocumentsPanel = () => (
    <>
      <Row
        label="Payment terms"
        hint="Printed on every invoice and purchase order."
        htmlFor="payment-terms"
      >
        <input
          id="payment-terms"
          type="text"
          className="st-input"
          value={settings.payment_terms}
          onChange={(event) => setField("payment_terms", event.target.value)}
          placeholder="e.g. Due within 14 days · Cash on delivery"
        />
      </Row>
      <Row
        label="Footer line"
        hint="The last line of every document: a thank-you, or bank details."
        htmlFor="document-footer"
      >
        <input
          id="document-footer"
          type="text"
          className="st-input"
          value={settings.document_footer}
          onChange={(event) => setField("document_footer", event.target.value)}
          placeholder="e.g. Thank you for your business · Bank: … IBAN …"
        />
      </Row>
      <Row label="Logo and colour">
        <p className="st-hint">
          Documents use the logo and accent colour from{" "}
          <button type="button" className="st-link" onClick={() => switchSection("workspace")}>
            Company profile
          </button>
          .
        </p>
      </Row>
    </>
  );

  /* ---- Currency ------------------------------------------------------- */
  const renderCurrencyPanel = () => {
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
      <>
        <Row
          label="Show prices in"
          hint={`Prices are stored in ${settings.base_currency} and converted for display.`}
        >
          <div className="st-select">
            <Select
              ariaLabel="Currency shown across the app"
              value={currencyCode}
              onChange={(value) => setField("currency_code", value)}
              options={currencyChoicesIncluding(currencyCode, settings.base_currency)}
            />
          </div>
        </Row>

        {currencyCode === settings.base_currency ? (
          <Row label="Exchange rate">
            <p className="st-hint">
              No conversion needed. You are showing prices in {settings.base_currency}, the
              currency they are stored in.
            </p>
          </Row>
        ) : (
          <>
            <Row
              label="Current rate"
              hint={
                usingManual
                  ? `Your own rate. The live rate is ${rateText(liveRate)}.`
                  : settings.rates_updated_at
                    ? `Live rate, updated ${new Date(settings.rates_updated_at).toLocaleDateString("en", { dateStyle: "medium" })}.`
                    : "No live rate yet."
              }
            >
              <div className="st-inline">
                <span className="st-strong">{rateText(manualRate)}</span>
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
                      setRatesNotice("Live rates could not be fetched right now. Try again later.");
                      return;
                    }
                    setSettings((current) => ({
                      ...current,
                      exchange_rates: live.rates,
                      rates_updated_at: live.updatedAt,
                    }));
                    setRatesNotice("Live rates updated. Save to keep them.");
                  }}
                >
                  Update live rates
                </Button>
              </div>
              {ratesNotice && <p className="st-hint">{ratesNotice}</p>}
            </Row>
            <Row
              label="Use my own rate"
              hint="Leave empty to follow the live rate. Invoices and orders keep the rate of the day they were made."
              htmlFor="manual-rate"
            >
              <div className="st-inline">
                <span className="st-hint">1 {settings.base_currency} =</span>
                <input
                  id="manual-rate"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className="st-input st-input-narrow"
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
                        // Rates are kept as 1 USD = x. A base other than USD
                        // types "1 base = x", so convert through the base's
                        // own USD rate.
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
                <span className="st-hint">{currencyCode}</span>
              </div>
            </Row>
          </>
        )}
      </>
    );
  };

  /* ---- Inventory ------------------------------------------------------ */
  const renderInventoryPanel = () => (
    <Row
      label="Low-stock threshold"
      hint="An item at or below this number shows as low on Overview, Inventory and Alerts. Each item can set its own number too."
      htmlFor="low-stock-threshold"
    >
      <div className="st-inline">
        <input
          id="low-stock-threshold"
          type="number"
          min="0"
          inputMode="numeric"
          className="st-input st-input-narrow"
          value={canCustomizeThreshold ? settings.low_stock_threshold : FREE_LOW_STOCK_THRESHOLD}
          onChange={(event) => setField("low_stock_threshold", Number(event.target.value))}
          disabled={!canCustomizeThreshold}
          required
        />
        <span className="st-hint">units</span>
      </div>
      {!canCustomizeThreshold && (
        <p className="st-hint">
          The Free plan uses {FREE_LOW_STOCK_THRESHOLD}. Your own number comes with Standard.{" "}
          <Link href={upgradeHref} className="st-link">
            Compare plans
          </Link>
        </p>
      )}
    </Row>
  );

  /* ---- Account & security -------------------------------------------- */
  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const leaveBusiness = async () => {
    const name = business?.businessName || "this business";
    if (!window.confirm(`Leave ${name}? You will lose access straight away.`)) return;
    const { error: leaveError } = await supabase.rpc("leave_business");
    if (leaveError) {
      showToast({ tone: "danger", message: "Couldn't leave the business. Please try again." });
      return;
    }
    clearBusinessContext();
    // Full reload: every page and the shell were scoped to that business.
    window.location.assign("/dashboard");
  };

  /* ---- Preferences (per person, per browser) ---------------------------- */
  const renderPreferencesPanel = () => (
    <>
      <Row
        label="Inventory opens sorted by"
        hint="You can still change the order on the Inventory page any time."
      >
        <div className="st-select">
          <Select
            ariaLabel="Inventory opens sorted by"
            value={inventorySort}
            options={INVENTORY_SORT_OPTIONS}
            onChange={(value) => {
              if (!isInventorySort(value)) return;
              setInventorySort(value);
              setDefaultInventorySort(value);
              showToast({ tone: "success", message: "Saved. Inventory will open this way." });
            }}
          />
        </div>
      </Row>
      <Row
        label="Dates and times"
        hint="Set automatically from this device, so a team in different places each sees their own time."
      >
        <span className="st-strong">{timeZoneLabel || "Your device time zone"}</span>
      </Row>
    </>
  );

  const renderProfilePanel = () => (
    <>
      <Row label="Signed in as">
        <span className="st-strong">{userEmail || "—"}</span>
      </Row>
      {myRole !== "owner" && (
        <Row
          label="Business"
          hint="You work inside this business with the role shown."
        >
          <div className="st-inline">
            <span className="st-strong">
              {business?.businessName || settings.business_name || "This business"}
            </span>
            <span className="st-pill st-pill-grey">{ROLE_LABELS[myRole]}</span>
          </div>
        </Row>
      )}
      {/* A login SydIN made for this business (name.role@business.sydin.site)
          exists only for it; the owner removes it instead. */}
      {myRole !== "owner" && !/@[a-z0-9]+\.sydin\.site$/.test(userEmail) && (
        <Row
          label="Leave business"
          hint="You lose access straight away. The owner can invite you again."
        >
          <Button variant="secondary" size="sm" onClick={() => void leaveBusiness()}>
            Leave this business
          </Button>
        </Row>
      )}
      <Row label="Sign-in methods" hint="The ways you can get into this account.">
        <ul className="st-signins">
          {(["email", "google", "azure"] as const).map((provider) => {
            const linked = signInMethods.includes(provider);
            return (
              <li key={provider}>
                <span>{SIGN_IN_LABELS[provider]}</span>
                <span className={`st-pill ${linked ? "st-pill-green" : "st-pill-grey"}`}>
                  {linked ? "Connected" : "Not connected"}
                </span>
              </li>
            );
          })}
        </ul>
      </Row>
      <Row label="Password" hint="Handled by the way you sign in: email code, Google or Microsoft.">
        <span className="st-hint">Nothing to set here.</span>
      </Row>
      <Row label="Help and support">
        <Link href="/dashboard/help" className={buttonClassName({ variant: "secondary", size: "sm" })}>
          Open Help
        </Link>
      </Row>
      <Row label="Sign out" hint="You can sign back in with the same email.">
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Sign out of SydIN
        </Button>
      </Row>
    </>
  );

  /* ---- Plan & billing ------------------------------------------------- */
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
    const active = !subscription.status || subscription.status === "active";
    const limit = subscription.item_limit;
    const used = usedItems ?? 0;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return (
      <div className="st-plan">
        <div className="st-plan-head">
          <div>
            <p className="st-plan-name">
              {currentPlanName} plan
              <span className={`st-pill ${active ? "st-pill-green" : "st-pill-amber"}`}>
                {active ? "Active" : subscription.status}
              </span>
            </p>
            <p className="st-hint">Payment is arranged with you directly; nothing is charged automatically.</p>
          </div>
          <Link href={upgradeHref} className={buttonClassName({ variant: "secondary", size: "sm" })}>
            {upgradeLabel}
          </Link>
        </div>

        <div className="st-usage">
          <div className="st-usage-line">
            <span>Items used</span>
            <strong>
              {usedItems === null ? "…" : used.toLocaleString()} of {limit.toLocaleString()}
            </strong>
          </div>
          <div
            className="st-usage-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Items used on your plan"
          >
            <div
              className={`st-usage-fill${percent >= 90 ? " st-usage-fill-warn" : ""}`}
              style={{ width: `${Math.max(percent, used > 0 ? 1 : 0)}%` }}
            />
          </div>
          <p className="st-hint">
            {Math.max(0, limit - used).toLocaleString()} items remaining on your plan.
          </p>
        </div>

        <ul className="st-features">
          {included.map(([label, yes]) => (
            <li key={label} className={yes ? undefined : "st-feature-off"}>
              <span className={`st-feature-mark ${yes ? "st-feature-yes" : ""}`} aria-hidden="true">
                {yes ? <UiIcon name="check" className="h-3 w-3" /> : <span className="st-dash" />}
              </span>
              <span className="min-w-0 flex-1">{label}</span>
              {!yes && <span className="st-pill st-pill-grey">Higher plan</span>}
              <span className="sr-only">{yes ? "included" : "not included"}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const EDITABLE: SettingsSectionId[] = ["workspace", "documents", "currency", "inventory"];

  const renderActivePanel = () => {
    if (loading) {
      return <LoadingSkeletonGroup count={3} itemClassName="min-h-16" />;
    }
    switch (activeSection) {
      case "documents":
        return renderDocumentsPanel();
      case "currency":
        return renderCurrencyPanel();
      case "inventory":
        return renderInventoryPanel();
      case "profile":
        return renderProfilePanel();
      case "billing":
        return renderBillingPanel();
      case "preferences":
        return renderPreferencesPanel();
      case "team":
        return (
          <TeamPanel
            myRole={myRole}
            seatLimit={business?.seatLimit ?? 1}
            businessName={settings.business_name?.trim() || business?.businessName || "your business"}
            upgradeHref={upgradeHref}
          />
        );
      case "workspace":
      default:
        return renderCompanyPanel();
    }
  };

  const editable = EDITABLE.includes(activeSection);

  const panel = (
    <DashboardCard aria-labelledby="settings-panel-heading" className="st-panel">
      <div className="st-panel-body">{renderActivePanel()}</div>
      {editable && error && (
        <div role="alert" className="st-error">
          {error}
        </div>
      )}
      {editable && !loading && (
        <SaveBar saving={saving} dirty={hasUnsavedWork} onCancel={resetBusinessFields} />
      )}
    </DashboardCard>
  );

  return (
    <div className="contents">
      <UnsavedChangesGuard when={hasUnsavedWork} what="your settings" />

      {/* Laid out like Sortly's settings (28 Sep, Sayed): a full-height menu
          titled "Settings" that folds to icons, and a pinned header that names
          the section you are in. No descriptions -- the name says it. */}
      <main className="st-page">
          <div className={`st-layout${navCollapsed ? " st-layout-collapsed" : ""}`}>
            <nav aria-label="Settings sections" className="st-nav">
              <div className="st-nav-top">
                <p className="st-nav-title">Settings</p>
                <button
                  type="button"
                  className="st-nav-toggle"
                  onClick={toggleNav}
                  aria-expanded={!navCollapsed}
                  aria-label={navCollapsed ? "Show settings menu" : "Hide settings menu"}
                  title={navCollapsed ? "Show menu" : "Hide menu"}
                >
                  <UiIcon name={navCollapsed ? "chevron-right" : "chevron-left"} className="h-4 w-4" />
                </button>
              </div>
              {SECTION_GROUPS.filter((group) =>
                visibleSections.some((section) => section.group === group)
              ).map((group) => (
                <div key={group} className="st-nav-group">
                  <p className="st-nav-label">{group}</p>
                  {visibleSections.filter((section) => section.group === group).map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => switchSection(section.id)}
                      aria-current={section.id === activeSection ? "page" : undefined}
                      className={`st-nav-item${section.id === activeSection ? " st-nav-item-active" : ""}`}
                      title={navCollapsed ? section.label : undefined}
                    >
                      <UiIcon name={section.icon} className="h-4 w-4 shrink-0" />
                      <span>{section.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className="st-main">
              <header className={`st-head${scrolled ? " st-head-scrolled" : ""}`}>
                <h1 id="settings-panel-heading">{activeSectionDetails.label}</h1>
              </header>
              <div className="st-scroll" ref={scrollAreaRef}>
                {editable ? (
                  <form onSubmit={handleSave} aria-busy={saving} className="min-w-0">
                    {panel}
                  </form>
                ) : (
                  <div className="min-w-0">{panel}</div>
                )}
              </div>
            </div>
          </div>
      </main>
    </div>
  );
}
