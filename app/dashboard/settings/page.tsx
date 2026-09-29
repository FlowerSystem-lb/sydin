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
  BUSINESS_SETTINGS_SAVED_EVENT,
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
import { INVENTORY_UNIT_LABELS, INVENTORY_UNIT_TYPES } from "@/app/lib/inventoryItemModel";
import {
  BUILT_IN_PAYMENT_METHODS,
  paymentMethodKey,
  paymentMethodLabel,
} from "@/app/lib/paymentMethods";
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
  PLAN_DEFINITIONS,
  type UserSubscription,
} from "@/app/lib/subscription";

type SettingsSectionId =
  | "workspace"
  | "documents"
  | "currency"
  | "inventory"
  | "lists"
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
    label: "Invoices & tax",
    description: "Numbering, tax, and what prints on every invoice and order.",
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
    id: "lists",
    group: "Workspace",
    label: "Lists",
    description: "Units and payment methods you pick from.",
    icon: "layers",
  },
  {
    id: "profile",
    group: "Account",
    label: "My profile",
    description: "Your name, job title, sign-in and password.",
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

/* What someone does in the business -- shown next to their name, and a hint
   for SydIN about who uses it. Not a permission: the Team role is that. */
const JOB_TITLES = ["Owner", "Manager", "Sales", "Warehouse / stock", "Accountant", "Purchasing", "Other"];

interface PersonalProfile {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
}

const EMPTY_PROFILE: PersonalProfile = { firstName: "", lastName: "", phone: "", jobTitle: "" };

function profileFromMetadata(meta: Record<string, unknown> | undefined): PersonalProfile {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  let firstName = text(meta?.first_name);
  let lastName = text(meta?.last_name);
  if (!firstName && !lastName) {
    // Google and Microsoft give one full name; split it once.
    const full = text(meta?.full_name) || text(meta?.name);
    const [first, ...rest] = full.split(/s+/).filter(Boolean);
    firstName = first || "";
    lastName = rest.join(" ");
  }
  return { firstName, lastName, phone: text(meta?.phone), jobTitle: text(meta?.job_title) };
}

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [profile, setProfile] = useState<PersonalProfile>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<PersonalProfile>(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  /* Plan & billing usage beyond items: counted only when that section opens. */
  const [usageCounts, setUsageCounts] = useState<{
    depots: number;
    suppliers: number;
    customers: number;
    members: number;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Show the picked logo straight away, before it is saved.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!logoFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the preview when the pick is discarded or saved
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [ratesNotice, setRatesNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setSuccess] = useState("");
  // The database's own answer for "next invoice number" (auto mode), so the
  // preview matches what the next invoice will really get.
  const [nextInvoiceFromDb, setNextInvoiceFromDb] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    let active = true;
    void supabase.rpc("next_invoice_number", { p_reserve: false }).then(({ data }) => {
      if (active && typeof data === "string") setNextInvoiceFromDb(data);
    });
    return () => {
      active = false;
    };
  }, [loading, savedSettings.invoice_prefix, savedSettings.invoice_next_number]);
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
        const loadedProfile = profileFromMetadata(user.user_metadata);
        setProfile(loadedProfile);
        setSavedProfile(loadedProfile);
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

  const businessIdForUsage = business?.businessId;
  useEffect(() => {
    if (activeSection !== "billing" || !businessIdForUsage) return;
    let live = true;
    const count = async (table: string) => {
      const { count: rows } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", businessIdForUsage);
      return rows ?? 0;
    };
    Promise.all([
      count("depots"),
      count("suppliers"),
      count("customers"),
      supabase.rpc("list_team").then(({ data }) =>
        ((data ?? []) as { is_owner?: boolean }[]).filter((row) => !row.is_owner).length
      ),
    ]).then(([depots, suppliers, customers, members]) => {
      if (live) setUsageCounts({ depots, suppliers, customers, members });
    });
    return () => {
      live = false;
    };
  }, [activeSection, businessIdForUsage]);
  // On a phone the sections are a scrolling row of tabs; the active one
  // can arrive off-screen (e.g. Data & reports from the More sheet).
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    document
      .querySelector(".st-nav-item[aria-current=\"page\"]")
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
        // "flowerplus.com" is what people type; store a working link.
        contact_website: settings.contact_website.trim()
          ? /^https?:\/\//i.test(settings.contact_website.trim())
            ? settings.contact_website.trim()
            : `https://${settings.contact_website.trim()}`
          : null,
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
        // Phase 30: invoice numbering and tax.
        invoice_prefix: settings.invoice_prefix.trim().slice(0, 12),
        invoice_next_number: settings.invoice_next_number,
        invoice_number_digits: settings.invoice_number_digits,
        po_prefix: settings.po_prefix.trim().slice(0, 12) || null,
        tax_enabled: settings.tax_enabled,
        tax_name: settings.tax_name.trim().slice(0, 20) || "VAT",
        tax_rate: settings.tax_rate,
        prices_include_tax: settings.prices_include_tax,
        // Phase 31: the business's own lists.
        custom_units: settings.custom_units,
        payment_methods: settings.payment_methods,
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
        invoice_prefix: settings.invoice_prefix.trim().slice(0, 12),
        invoice_next_number: settings.invoice_next_number,
        invoice_number_digits: settings.invoice_number_digits,
        po_prefix: settings.po_prefix.trim().slice(0, 12),
        tax_enabled: settings.tax_enabled,
        tax_name: settings.tax_name.trim().slice(0, 20) || "VAT",
        tax_rate: settings.tax_rate,
        prices_include_tax: settings.prices_include_tax,
        custom_units: documentFieldsSkipped ? [] : settings.custom_units,
        payment_methods: settings.payment_methods,
      };
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      window.dispatchEvent(
        new CustomEvent(BUSINESS_SETTINGS_SAVED_EVENT, { detail: normalizedSettings })
      );
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
  /* 29 Sep (Sayed, after Sortly's Company Details): the logo gets its own
     big card beside the details instead of a 40px thumbnail in a row. Until
     a business adds one, the SydIN mark stands in -- the same fallback the
     header and documents use. */
  const renderLogoCard = () => {
    const hasLogo = Boolean(logoPreview || settings.business_logo_url);
    return (
      <aside className="st-logo-card" aria-label="Company logo">
        <p className="st-logo-title">Company logo</p>
        <div className={`st-logo-stage${hasLogo ? "" : " st-logo-stage-empty"}`}>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview of the file just picked
            <img src={logoPreview} alt="New logo preview" className="st-logo-img" />
          ) : settings.business_logo_url ? (
            <Image
              src={settings.business_logo_url}
              alt={`Logo for ${settings.business_name}`}
              fill
              sizes="240px"
              className="object-contain p-4"
            />
          ) : (
            <div className="st-logo-placeholder">
              <BrandMark className="h-14 w-14 rounded-2xl" />
              <span>SydIN logo shows until you add yours</span>
            </div>
          )}
        </div>

        {canUseCustomLogo ? (
          <div className="st-logo-actions">
            <label htmlFor="business-logo-upload" className={buttonClassName({ variant: "secondary", size: "sm" })}>
              {hasLogo ? "Change logo" : "Upload logo"}
            </label>
            {hasLogo && (
              <button
                type="button"
                className="st-text-button"
                onClick={() => {
                  setLogoFile(null);
                  setField("business_logo_url", "");
                }}
              >
                Remove
              </button>
            )}
            <input
              id="business-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = "";
                if (!file) return;
                // iPhone HEIC and SVG don't display everywhere documents
                // and emails go; a 10 MB photo makes every PDF slow.
                if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                  showToast({ tone: "danger", message: "Use a PNG, JPG or WebP image for the logo." });
                  return;
                }
                if (file.size > 2 * 1024 * 1024) {
                  showToast({ tone: "danger", message: "That image is over 2 MB. Use a smaller logo file." });
                  return;
                }
                setLogoFile(file);
              }}
              className="sr-only"
            />
          </div>
        ) : (
          <p className="st-logo-note">
            Your own logo comes with the Standard plan.{" "}
            <Link href={upgradeHref} className="st-link">
              Compare plans
            </Link>
          </p>
        )}
        <p className="st-logo-note">
          {logoFile ? "New logo picked. Press Save changes to keep it." : "PNG, JPG or WebP, up to 2 MB. Square works best."}
        </p>

        <div className="st-logo-colour">
          <label htmlFor="accent-color">Brand colour</label>
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
                Reset
              </button>
            )}
          </div>
          <p className="st-logo-note">The colour bar on your invoices and orders.</p>
        </div>
      </aside>
    );
  };

  const renderCompanyPanel = () => (
    <div className="st-company">
      <div className="st-company-main">
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
          type="text"
          inputMode="url"
          autoComplete="url"
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
      </div>
      {renderLogoCard()}
    </div>
  );

  /* ---- Documents ------------------------------------------------------ */
  const pad = (value: number) => String(value).padStart(settings.invoice_number_digits || 4, "0");
  const invoicePrefix = settings.invoice_prefix;
  const nextInvoiceLabel =
    settings.invoice_next_number !== null
      ? `${invoicePrefix}${pad(settings.invoice_next_number)}`
      : invoicePrefix === savedSettings.invoice_prefix && nextInvoiceFromDb
        ? nextInvoiceFromDb
        : `${invoicePrefix}${pad(1)} (or after your last ${invoicePrefix} invoice)`;
  const taxExample = (() => {
    const rate = Number(settings.tax_rate) || 0;
    if (!settings.tax_enabled || rate <= 0) return null;
    const price = 100;
    return settings.prices_include_tax
      ? `An item at 100 stays 100 on the invoice, of which ${(price - price / (1 + rate / 100)).toFixed(2)} is ${settings.tax_name || "VAT"}.`
      : `An item at 100 becomes ${(price + (price * rate) / 100).toFixed(2)} on the invoice: 100 + ${((price * rate) / 100).toFixed(2)} ${settings.tax_name || "VAT"}.`;
  })();

  const renderDocumentsPanel = () => (
    <>
      <Row label="Invoice numbers" htmlFor="invoice-prefix">
        <div className="st-inline">
          <input
            id="invoice-prefix"
            type="text"
            className="st-input st-input-narrow"
            value={settings.invoice_prefix}
            maxLength={12}
            onChange={(event) => setField("invoice_prefix", event.target.value.replace(/s/g, ""))}
            aria-label="Invoice prefix"
            placeholder="INV-"
          />
          <input
            id="invoice-next-number"
            type="number"
            min={1}
            className="st-input st-input-narrow"
            value={settings.invoice_next_number ?? ""}
            onChange={(event) => {
              const typed = Math.round(Number(event.target.value));
              setField("invoice_next_number", event.target.value && typed > 0 ? typed : null);
            }}
            aria-label="Next invoice number"
            placeholder="Auto"
          />
        </div>
        <p className="st-hint">
          Next invoice: <strong className="st-strong">{nextInvoiceLabel}</strong>. Leave the number on Auto
          to carry on from your last invoice.
        </p>
      </Row>

      <Row label="Purchase order prefix" htmlFor="po-prefix">
        <input
          id="po-prefix"
          type="text"
          className="st-input st-input-narrow"
          value={settings.po_prefix}
          maxLength={12}
          onChange={(event) => setField("po_prefix", event.target.value.replace(/s/g, ""))}
          placeholder="Auto"
        />
        <p className="st-hint">
          {settings.po_prefix.trim()
            ? `Next orders look like ${settings.po_prefix.trim()}0001.`
            : "Auto: named after the location, e.g. MAIN-PO-0001."}
        </p>
      </Row>

      <Row label="Charge tax" htmlFor="tax-enabled">
        <label className="st-switch">
          <input
            id="tax-enabled"
            type="checkbox"
            role="switch"
            checked={settings.tax_enabled}
            onChange={(event) => setField("tax_enabled", event.target.checked)}
          />
          <span aria-hidden="true" />
        </label>
        <p className="st-hint">
          {settings.tax_enabled
            ? "New invoices add this tax. Each invoice keeps the rate it was made with."
            : "Off: invoices show no tax line."}
        </p>
      </Row>

      {settings.tax_enabled && (
        <>
          <Row label="Tax name and rate" htmlFor="tax-name">
            <div className="st-inline">
              <input
                id="tax-name"
                type="text"
                className="st-input st-input-narrow"
                value={settings.tax_name}
                maxLength={20}
                onChange={(event) => setField("tax_name", event.target.value)}
                aria-label="Tax name"
                placeholder="VAT"
              />
              <input
                id="tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                className="st-input st-input-narrow"
                value={settings.tax_rate || ""}
                onChange={(event) =>
                  setField("tax_rate", Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                }
                aria-label="Tax rate percent"
                placeholder="11"
              />
              <span className="st-hint">%</span>
            </div>
          </Row>
          <Row label="Your prices">
            <div className="st-choice">
              <label>
                <input
                  type="radio"
                  name="prices-include-tax"
                  checked={!settings.prices_include_tax}
                  onChange={() => setField("prices_include_tax", false)}
                />
                <span>Don&apos;t include tax, add it on top</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="prices-include-tax"
                  checked={settings.prices_include_tax}
                  onChange={() => setField("prices_include_tax", true)}
                />
                <span>Already include tax</span>
              </label>
            </div>
            {taxExample && <p className="st-hint">{taxExample}</p>}
          </Row>
          {/* The same field as Company profile > Tax / registration number:
              a VAT invoice should print it, so it is asked for here too. */}
          <Row label={`${settings.tax_name || "VAT"} number`} htmlFor="tax-id-invoices">
            <input
              id="tax-id-invoices"
              type="text"
              className="st-input"
              value={settings.tax_id}
              onChange={(event) => setField("tax_id", event.target.value)}
              placeholder="Your registration number"
            />
            <p className="st-hint">
              {settings.tax_id.trim()
                ? "Printed under your business name on every invoice."
                : "Add it so invoices that charge tax show your number."}
            </p>
          </Row>
        </>
      )}
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
        <Row label="Show prices in">
          <div className="st-select">
            <Select
              ariaLabel="Currency shown across the app"
              value={currencyCode}
              onChange={(value) => setField("currency_code", value)}
              options={currencyChoicesIncluding(currencyCode, settings.base_currency)}
            />
          </div>
          {/* Live status, not an explanation -- stays on the page. */}
          <p className="st-hint">
            Prices are stored in {settings.base_currency} and converted for display.
          </p>
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
            <Row label="Current rate">
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
              {/* Which rate is in use and how fresh it is: status, shown. */}
              <p className="st-hint">
                {usingManual
                  ? `Your own rate. The live rate is ${rateText(liveRate)}.`
                  : settings.rates_updated_at
                    ? `Live rate, updated ${new Date(settings.rates_updated_at).toLocaleDateString("en", { dateStyle: "medium" })}.`
                    : "No live rate yet."}
              </p>
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
  /* ---- Lists (phase 31) ------------------------------------------------ */
  const addUnit = () => {
    const label = newUnit.trim().slice(0, 40);
    if (!label) return;
    const builtIn = INVENTORY_UNIT_TYPES.some(
      (unit) => unit !== "custom" && INVENTORY_UNIT_LABELS[unit].toLowerCase() === label.toLowerCase()
    );
    if (builtIn || settings.custom_units.some((unit) => unit.toLowerCase() === label.toLowerCase())) {
      showToast({ tone: "danger", message: `"${label}" is already in your units.` });
      return;
    }
    if (settings.custom_units.length >= 30) {
      showToast({ tone: "danger", message: "You can keep up to 30 of your own units." });
      return;
    }
    setField("custom_units", [...settings.custom_units, label]);
    setNewUnit("");
  };

  const addMethod = (value: string) => {
    const key = paymentMethodKey(value.slice(0, 40));
    if (!key) return;
    if (settings.payment_methods.some((method) => method.toLowerCase() === key.toLowerCase())) {
      showToast({ tone: "danger", message: `"${paymentMethodLabel(key)}" is already in your list.` });
      return;
    }
    if (settings.payment_methods.length >= 20) {
      showToast({ tone: "danger", message: "You can keep up to 20 payment methods." });
      return;
    }
    setField("payment_methods", [...settings.payment_methods, key]);
    setNewMethod("");
  };

  const moveMethod = (index: number, step: -1 | 1) => {
    const next = [...settings.payment_methods];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setField("payment_methods", next);
  };

  const suggestedMethods = Object.keys(BUILT_IN_PAYMENT_METHODS).filter(
    (key) => !settings.payment_methods.includes(key)
  );

  const renderListsPanel = () => (
    <>
      <Row label="Units" hint="Offered when you add or edit an item. Built-in units are always there.">
        <div className="st-list-block">
          <div className="st-chips" aria-label="Built-in units">
            {INVENTORY_UNIT_TYPES.filter((unit) => unit !== "custom").map((unit) => (
              <span key={unit} className="st-chip st-chip-fixed">
                {INVENTORY_UNIT_LABELS[unit]}
              </span>
            ))}
            {settings.custom_units.map((unit) => (
              <span key={unit} className="st-chip">
                {unit}
                <button
                  type="button"
                  className="st-chip-x"
                  aria-label={`Remove ${unit}`}
                  onClick={() =>
                    setField("custom_units", settings.custom_units.filter((entry) => entry !== unit))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="st-list-add">
            <input
              className="st-input"
              value={newUnit}
              onChange={(event) => setNewUnit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addUnit();
                }
              }}
              placeholder="Add a unit, e.g. Carton, Roll, Bag"
              aria-label="New unit"
              maxLength={40}
            />
            <Button variant="secondary" size="sm" onClick={addUnit} disabled={!newUnit.trim()}>
              Add
            </Button>
          </div>
          <p className="st-hint">Removing a unit here doesn&apos;t change items that already use it.</p>
        </div>
      </Row>

      <Row label="Payment methods" hint="Offered when you record a payment on an invoice or a purchase order, in this order.">
        <div className="st-list-block">
          <ol className="st-method-list">
            {settings.payment_methods.map((method, index) => (
              <li key={method}>
                <span className="st-method-name">{paymentMethodLabel(method)}</span>
                <span className="st-method-actions">
                  <button
                    type="button"
                    className="st-icon-btn"
                    aria-label={`Move ${paymentMethodLabel(method)} up`}
                    disabled={index === 0}
                    onClick={() => moveMethod(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="st-icon-btn"
                    aria-label={`Move ${paymentMethodLabel(method)} down`}
                    disabled={index === settings.payment_methods.length - 1}
                    onClick={() => moveMethod(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="st-icon-btn st-icon-btn-danger"
                    aria-label={`Remove ${paymentMethodLabel(method)}`}
                    disabled={settings.payment_methods.length <= 1}
                    onClick={() =>
                      setField("payment_methods", settings.payment_methods.filter((entry) => entry !== method))
                    }
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {suggestedMethods.length > 0 && (
            <div className="st-chips" aria-label="Quick add">
              {suggestedMethods.map((key) => (
                <button key={key} type="button" className="st-chip st-chip-add" onClick={() => addMethod(key)}>
                  + {BUILT_IN_PAYMENT_METHODS[key]}
                </button>
              ))}
            </div>
          )}
          <div className="st-list-add">
            <input
              className="st-input"
              value={newMethod}
              onChange={(event) => setNewMethod(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMethod(newMethod);
                }
              }}
              placeholder="Your own, e.g. Wish Money, USDT"
              aria-label="New payment method"
              maxLength={40}
            />
            <Button variant="secondary" size="sm" onClick={() => addMethod(newMethod)} disabled={!newMethod.trim()}>
              Add
            </Button>
          </div>
          <p className="st-hint">Payments already recorded keep the method they were saved with.</p>
        </div>
      </Row>
    </>
  );

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

  const profileDirty =
    profile.firstName !== savedProfile.firstName ||
    profile.lastName !== savedProfile.lastName ||
    profile.phone !== savedProfile.phone ||
    profile.jobTitle !== savedProfile.jobTitle;
  const displayName =
    [savedProfile.firstName, savedProfile.lastName].filter(Boolean).join(" ") || userEmail.split("@")[0] || "You";
  const initials =
    ((savedProfile.firstName[0] || "") + (savedProfile.lastName[0] || "")).toUpperCase() ||
    (userEmail[0] || "?").toUpperCase();

  const saveProfile = async () => {
    const next = {
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      phone: profile.phone.trim(),
      jobTitle: profile.jobTitle,
    };
    if (!next.firstName) {
      showToast({ tone: "danger", message: "Add your first name." });
      return;
    }
    setSavingProfile(true);
    // full_name is what "Done by" shows across the app (sql/phase-29).
    const { error: profileError } = await supabase.auth.updateUser({
      data: {
        first_name: next.firstName,
        last_name: next.lastName,
        full_name: [next.firstName, next.lastName].filter(Boolean).join(" "),
        phone: next.phone,
        job_title: next.jobTitle,
      },
    });
    setSavingProfile(false);
    if (profileError) {
      showToast({ tone: "danger", message: "Couldn't save your profile. Please try again." });
      return;
    }
    setProfile(next);
    setSavedProfile(next);
    showToast({ tone: "success", message: "Profile saved. Your name now shows on what you do." });
  };

  const renderProfilePanel = () => (
    <>
      <div className="st-me-card">
        <span className="st-me-avatar" aria-hidden="true">{initials}</span>
        <div className="min-w-0">
          <p className="st-me-name">{displayName}</p>
          <p className="st-me-sub">
            {savedProfile.jobTitle ? `${savedProfile.jobTitle} · ` : ""}
            {userEmail || "—"}
          </p>
        </div>
        {savedProfile.jobTitle !== ROLE_LABELS[myRole] && (
          <span className="st-pill st-pill-grey st-me-role">{ROLE_LABELS[myRole]}</span>
        )}
      </div>

      <h2 className="st-subhead">Personal information</h2>
      <Row label="Name" htmlFor="me-first-name">
        <div className="st-pair">
          <input
            id="me-first-name"
            className="st-input"
            placeholder="First name"
            autoComplete="given-name"
            value={profile.firstName}
            onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
          />
          <input
            className="st-input"
            placeholder="Last name"
            aria-label="Last name"
            autoComplete="family-name"
            value={profile.lastName}
            onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
          />
        </div>
      </Row>
      <Row label="Phone" htmlFor="me-phone">
        <input
          id="me-phone"
          type="tel"
          className="st-input"
          placeholder="+961 …"
          autoComplete="tel"
          value={profile.phone}
          onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
        />
      </Row>
      <Row label="Job title" htmlFor="me-job" hint="What you do in the business. Your Team role decides what you can change.">
        <select
          id="me-job"
          className="st-input"
          value={profile.jobTitle}
          onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value })}
        >
          <option value="">Choose…</option>
          {JOB_TITLES.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
      </Row>
      <div className="st-inline-save">
        {profileDirty && (
          <Button variant="ghost" size="sm" disabled={savingProfile} onClick={() => setProfile(savedProfile)}>
            Discard
          </Button>
        )}
        <Button size="sm" disabled={!profileDirty} loading={savingProfile} loadingLabel="Saving…" onClick={() => void saveProfile()}>
          Save profile
        </Button>
      </div>

      <h2 className="st-subhead">Sign-in and security</h2>
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
      {(myRole === "owner" || myRole === "admin") && (
        <Row
          label="Your data"
          hint="One Excel file with every item, movement, invoice, customer, supplier and order."
        >
            <Button
              variant="secondary"
              size="sm"
              disabled={exportingAll}
              onClick={async () => {
                const businessId = business?.businessId;
                if (!businessId) return;
                setExportingAll(true);
                try {
                  const { exportAllBusinessData } = await import("@/app/lib/fullDataExport");
                  await exportAllBusinessData(
                    businessId,
                    business?.businessName || settings.business_name || "SydIN"
                  );
                  showToast({ tone: "success", message: "Downloaded. Everything is in one Excel file." });
                } catch {
                  showToast({ tone: "danger", message: "Couldn't build the file. Please try again." });
                } finally {
                  setExportingAll(false);
                }
              }}
            >
              {exportingAll ? "Preparing file..." : "Download all my data"}
            </Button>
        </Row>
      )}
      <Row label="Password" hint="Used with your email on the sign-in page. Google and Microsoft sign-in keep working either way.">
        {/* A separate small form: Account is not part of the business form. */}
        <form
          className="st-password-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (newPassword.length < 8) {
              showToast({ tone: "danger", message: "Use at least 8 characters." });
              return;
            }
            if (newPassword !== confirmPassword) {
              showToast({ tone: "danger", message: "The two passwords don't match." });
              return;
            }
            setChangingPassword(true);
            const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
            setChangingPassword(false);
            if (passwordError) {
              showToast({
                tone: "danger",
                message: /same|different/i.test(passwordError.message)
                  ? "Choose a password you haven't used for SydIN before."
                  : "Couldn't change the password. Please try again.",
              });
              return;
            }
            setNewPassword("");
            setConfirmPassword("");
            showToast({ tone: "success", message: "Password changed. We emailed you a security note." });
          }}
        >
          <input
            type="password"
            className="st-input"
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-label="New password"
          />
          <input
            type="password"
            className="st-input"
            placeholder="Type it again"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-label="Confirm new password"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={changingPassword}
            loadingLabel="Saving…"
            disabled={!newPassword || !confirmPassword}
          >
            Change password
          </Button>
        </form>
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
      {myRole === "owner" && (
        <Row
          label="Delete account"
          hint="Deletes this business and everything in it, for you and your team. It cannot be undone."
        >
          {!deleteOpen ? (
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete my account
            </Button>
          ) : (
            <div className="st-delete-box">
              <p>
                This permanently deletes <strong>{settings.business_name || "this business"}</strong>:
                every item, photo, invoice, customer, supplier, order and report, plus the logins
                SydIN made for your team. It cannot be undone.
              </p>
              <p>Download your data first if you may need it. Type <strong>DELETE</strong> to confirm.</p>
              <input
                className="st-input"
                value={deleteWord}
                onChange={(event) => setDeleteWord(event.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
                autoComplete="off"
              />
              <div className="st-inline">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteWord !== "DELETE" || deletingAccount}
                  onClick={async () => {
                    setDeletingAccount(true);
                    const { data } = await supabase.auth.getSession();
                    const response = await fetch("/api/account/delete", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
                      },
                      body: JSON.stringify({ confirm: deleteWord }),
                    }).catch(() => null);
                    if (!response || !response.ok) {
                      const answer = response ? await response.json().catch(() => ({})) : {};
                      setDeletingAccount(false);
                      showToast({
                        tone: "danger",
                        message: (answer as { message?: string }).message || "Couldn't delete. Please try again.",
                      });
                      return;
                    }
                    await supabase.auth.signOut().catch(() => undefined);
                    window.location.href = "/?account=deleted";
                  }}
                >
                  {deletingAccount ? "Deleting..." : "Delete everything"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={deletingAccount}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteWord("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Row>
      )}
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
      ["Invoices, purchase orders and receiving", planCapabilities.sales],
      ["Advanced reports", planCapabilities.advancedReports],
      ["Priority support", planCapabilities.priorityManualSupport],
    ];
    const active = !subscription.status || subscription.status === "active";
    const planDefinition =
      PLAN_DEFINITIONS[subscription.plan as keyof typeof PLAN_DEFINITIONS] ?? PLAN_DEFINITIONS.free;
    const usage: { label: string; used: number | null; limit: number | null }[] = [
      { label: "Items", used: usedItems, limit: subscription.item_limit },
      { label: "Locations", used: usageCounts?.depots ?? null, limit: planCapabilities.depotLimit },
      { label: "Suppliers", used: usageCounts?.suppliers ?? null, limit: planCapabilities.supplierLimit },
      { label: "Customers", used: usageCounts?.customers ?? null, limit: planCapabilities.customerLimit },
      { label: "Team seats", used: usageCounts?.members ?? null, limit: business?.seatLimit ?? 1 },
    ];
    const full = usage.filter((row) => row.used !== null && row.limit !== null && row.limit > 0 && row.used >= row.limit);

    return (
      <div className="st-billing">
        <div className="st-billing-top">
          <section className="st-billing-plan" aria-label="Current plan">
            <p className="st-billing-label">Current plan</p>
            <div className="st-billing-planrow">
              <div>
                <p className="st-billing-name">
                  {currentPlanName}
                  <span className={`st-pill ${active ? "st-pill-green" : "st-pill-amber"}`}>
                    {active ? "Active" : subscription.status}
                  </span>
                </p>
                <p className="st-billing-price">
                  <strong>${planDefinition.priceMonthly}</strong> per month
                </p>
              </div>
              <span className="st-billing-art" aria-hidden="true">
                <UiIcon name="box" className="h-7 w-7" />
              </span>
            </div>
            <p className="st-hint">{planDefinition.description}</p>
            <p className="st-hint">Payment is arranged with you directly; nothing is charged automatically.</p>
          </section>

          <section className="st-billing-usage" aria-label="Usage">
            <p className="st-billing-label">Usage</p>
            {usage.map((row) => {
              const percent =
                row.used === null || !row.limit ? 0 : Math.min(100, Math.round((row.used / row.limit) * 100));
              const tone = percent >= 100 ? " st-usage-fill-full" : percent >= 80 ? " st-usage-fill-warn" : "";
              return (
                <div key={row.label} className="st-usage-item">
                  <div className="st-usage-line">
                    <span>{row.label}</span>
                    <strong>
                      {row.used === null ? "…" : row.used.toLocaleString()} / {row.limit === null ? "Unlimited" : row.limit.toLocaleString()}
                    </strong>
                  </div>
                  <div
                    className="st-usage-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label={`${row.label} used on your plan`}
                  >
                    <div
                      className={`st-usage-fill${tone}`}
                      style={{ width: `${Math.max(percent, row.used ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {full.length > 0 && (
              <p className="st-billing-alert" role="status">
                <UiIcon name="alert" className="h-4 w-4 shrink-0" />
                <span>
                  You&apos;ve reached your plan limit for {full.map((row) => row.label.toLowerCase()).join(", ")}.
                  Your business is growing: upgrade to keep adding.
                </span>
              </p>
            )}
            <div className="st-billing-actions">
              <Link href={upgradeHref} className={buttonClassName({ variant: "primary", size: "sm" })}>
                {upgradeLabel}
              </Link>
              <Link href="/pricing" className={buttonClassName({ variant: "secondary", size: "sm" })}>
                Compare plans
              </Link>
            </div>
          </section>
        </div>

        <section className="st-billing-features" aria-label="What your plan includes">
          <p className="st-billing-label">What your plan includes</p>
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
        </section>
      </div>
    );
  };

  const EDITABLE: SettingsSectionId[] = ["workspace", "documents", "currency", "inventory", "lists"];

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
      case "lists":
        return renderListsPanel();
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
