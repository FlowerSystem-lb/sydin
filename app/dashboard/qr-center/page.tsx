"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardCard,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import ItemDetailsSlideOver, {
  type SlideOverInventoryItem,
} from "@/components/inventory/ItemDetailsSlideOver";
import SydINMark from "@/components/brand/SydINMark";
import SydINWordmark from "@/components/brand/SydINWordmark";
import { DialogShell, Select } from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  exportQrLabelsPdf,
  type QrLabelBranding,
  type QrLabelLayout,
  type QrLabelSettings,
  type QrLabelSize,
} from "@/app/lib/qrLabelPdf";
import { SCANNER_REQUEST_STORAGE_KEY } from "@/app/lib/scannerNavigation";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface QrInventoryItem {
  id: number;
  name: string;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  public_id?: string | null;
}

const LABEL_SETTINGS_KEY = "sydin:qr-label-settings";
const DEFAULT_LABEL_SETTINGS: QrLabelSettings = {
  layout: "2x2",
  branding: "sydin",
  showName: true,
  showIdentifier: true,
  showUrl: false,
  qrSize: "medium",
};

const layoutOptions: { value: QrLabelLayout; label: string }[] = [
  { value: "single", label: "Single label" },
  { value: "2x2", label: "2 × 2" },
  { value: "3x3", label: "3 × 3" },
  { value: "a4-grid", label: "A4 grid" },
];

const qrSizeOptions: { value: QrLabelSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "item"
  );
}

function readStoredSettings() {
  try {
    const stored = window.localStorage.getItem(LABEL_SETTINGS_KEY);
    if (!stored) return DEFAULT_LABEL_SETTINGS;

    return {
      ...DEFAULT_LABEL_SETTINGS,
      ...(JSON.parse(stored) as Partial<QrLabelSettings>),
    };
  } catch {
    return DEFAULT_LABEL_SETTINGS;
  }
}

function getLayoutGrid(layout: QrLabelLayout) {
  if (layout === "single") return "qr-print-grid-single";
  if (layout === "2x2") return "qr-print-grid-2x2";
  if (layout === "3x3") return "qr-print-grid-3x3";
  return "qr-print-grid-a4";
}

function LabelBrand({
  branding,
  businessSettings,
  businessLogoError,
  onBusinessLogoError,
}: {
  branding: QrLabelBranding;
  businessSettings: BusinessSettings;
  businessLogoError: boolean;
  onBusinessLogoError: () => void;
}) {
  if (branding === "none") return null;

  if (
    branding === "business" &&
    businessSettings.business_logo_url &&
    !businessLogoError
  ) {
    return (
      <span className="relative block h-8 w-28">
        <Image
          src={businessSettings.business_logo_url}
          alt={businessSettings.business_name}
          fill
          unoptimized
          sizes="112px"
          className="object-contain"
          onError={onBusinessLogoError}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <SydINMark size="sm" />
      <SydINWordmark size="sm" variant="light-background" />
    </span>
  );
}

export default function QrCenterPage() {
  const router = useRouter();
  const qrRefs = useRef(new Map<number, HTMLDivElement>());
  const [items, setItems] = useState<QrInventoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_LABEL_SETTINGS);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [businessLogoError, setBusinessLogoError] = useState(false);
  const [businessSettings, setBusinessSettings] = useState(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) throw new Error("Please sign in again to use QR Center.");

        const [{ data, error: itemError }, loadedSettings, loadedSubscription] =
          await Promise.all([
            supabase
              .from("inventory")
              .select("id, name, image, sku, item_code, public_id")
              .eq("user_id", user.id)
              .order("name", { ascending: true }),
            getOrCreateBusinessSettings(user.id),
            getUserSubscription(user.id),
          ]);

        if (itemError) throw itemError;
        if (!active) return;

        const query = new URLSearchParams(window.location.search);
        const requestedIds = (query.get("items") || "")
          .split(",")
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0);
        const loadedItems = (data || []) as QrInventoryItem[];
        const loadedItemIds = new Set(loadedItems.map((item) => item.id));

        setOrigin(window.location.origin);
        setSettings(readStoredSettings());
        setItems(loadedItems);
        setSearch(query.get("search") || "");
        if (requestedIds.length > 0) {
          setSelectedIds(
            new Set(requestedIds.filter((id) => loadedItemIds.has(id)))
          );
        }
        setBusinessSettings(loadedSettings);
        setSubscription(loadedSubscription);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load QR Center."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const capabilities = getSubscriptionCapabilities(subscription);
  const canUseBusinessLogo =
    capabilities.customBusinessLogo &&
    Boolean(businessSettings.business_logo_url);
  const effectiveBranding: QrLabelBranding =
    settings.branding === "business" &&
    (!canUseBusinessLogo || businessLogoError)
      ? "sydin"
      : settings.branding;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = items.filter((item) =>
    [item.name, item.sku, item.item_code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
  const printableItems = useMemo(
    () =>
      items.filter(
        (item) => selectedIds.has(item.id) && Boolean(item.public_id)
      ),
    [items, selectedIds]
  );
  const selectedItem = printableItems[0] || null;
  const selectedCount = printableItems.length;
  const currentContext = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString();
    return `/dashboard/qr-center${query ? `?${query}` : ""}`;
  }, [search]);

  const handleSlideOverItemUpdated = (updatedItem: SlideOverInventoryItem) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === updatedItem.id
          ? {
              ...item,
              name: updatedItem.name,
              image: updatedItem.image,
              sku: updatedItem.sku || null,
              item_code: updatedItem.item_code || null,
              public_id: updatedItem.public_id || null,
            }
          : item
      )
    );
    setNotice("Stock movement recorded successfully.");
  };

  const updateSettings = (next: Partial<QrLabelSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...next };
      try {
        window.localStorage.setItem(
          LABEL_SETTINGS_KEY,
          JSON.stringify(updated)
        );
      } catch {
        // Label settings still apply for this session.
      }
      return updated;
    });
  };

  const toggleItem = (itemId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const selectable = visibleItems.filter((item) => item.public_id);
      const allSelected = selectable.every((item) => next.has(item.id));

      selectable.forEach((item) => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  };

  const getQrUrl = (item: QrInventoryItem) =>
    item.public_id ? `${origin}/item/${item.public_id}` : "";

  const getQrSvg = (itemId: number) =>
    qrRefs.current.get(itemId)?.querySelector("svg")?.outerHTML || "";

  const downloadQr = (item: QrInventoryItem) => {
    const svg = getQrSvg(item.id);
    if (!svg) return;

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(item.name)}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getBrandLogoUrl = () => {
    if (effectiveBranding === "sydin") {
      return `${origin}/email/sydin-logo.png`;
    }
    if (
      effectiveBranding === "business" &&
      canUseBusinessLogo &&
      !businessLogoError
    ) {
      return businessSettings.business_logo_url;
    }
    return "";
  };

  const downloadPdf = async () => {
    if (selectedCount === 0 || exportingPdf) return;

    try {
      setExportingPdf(true);
      setError("");
      const pdfItems = printableItems.map((item) => ({
        id: item.id,
        name: item.name,
        identifier: item.sku || item.item_code || "",
        publicUrl: getQrUrl(item),
        qrSvg: getQrSvg(item.id),
      }));

      if (pdfItems.some((item) => !item.qrSvg)) {
        throw new Error("QR labels are still preparing. Try again.");
      }

      await exportQrLabelsPdf({
        items: pdfItems,
        settings: { ...settings, branding: effectiveBranding },
        logoUrl: getBrandLogoUrl(),
      });
      setNotice("QR label PDF downloaded.");
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "We could not create the QR label PDF."
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const printLabels = () => {
    if (selectedCount === 0) return;

    document.body.classList.add("qr-label-printing");
    const cleanup = () => {
      document.body.classList.remove("qr-label-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        window.setTimeout(cleanup, 0);
      }
    });
  };

  const openExistingScanner = () => {
    try {
      window.sessionStorage.setItem(SCANNER_REQUEST_STORAGE_KEY, "true");
    } catch {
      // The inventory route can still open without storage access.
    }
    router.push("/dashboard/inventory");
  };

  const renderLabel = (item: QrInventoryItem, print = false) => (
    <article
      key={item.id}
      className={`qr-label-card qr-label-size-${settings.qrSize} ${
        print ? "qr-label-card-print" : ""
      }`}
    >
      <LabelBrand
        branding={effectiveBranding}
        businessSettings={businessSettings}
        businessLogoError={businessLogoError}
        onBusinessLogoError={() => setBusinessLogoError(true)}
      />
      <div
        ref={(node) => {
          if (node) qrRefs.current.set(item.id, node);
        }}
        className="qr-label-code"
      >
        <QRCode value={getQrUrl(item)} size={220} level="M" />
      </div>
      {settings.showName && <h3>{item.name}</h3>}
      {settings.showIdentifier && (item.sku || item.item_code) && (
        <p>{item.sku || item.item_code}</p>
      )}
      {settings.showUrl && (
        <small>{getQrUrl(item).replace(/^https?:\/\//, "")}</small>
      )}
    </article>
  );

  return (
    <main className="operations-workspace operations-qr-center">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Operations"
          title="QR Center"
          description="Create clean QR label documents or open the existing inventory scanner."
          actions={
            <ActionButton icon="scan" onClick={openExistingScanner}>
              Start Scanner
            </ActionButton>
          }
        />

        {(error || notice) && (
          <DashboardNotice tone={error ? "danger" : "success"}>
            {error || notice}
          </DashboardNotice>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <DashboardCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-theme-primary">
                  Generate QR Codes
                </h2>
                <p className="mt-1 text-sm text-theme-muted">
                  Select one or more items with public item links.
                </p>
              </div>
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={visibleItems.length === 0}
                className="dashboard-action-button dashboard-action-button-secondary min-h-10 px-3 py-2.5 text-xs disabled:opacity-50"
              >
                Select visible
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-theme bg-theme-inset p-3">
              {selectedCount === 0 ? (
                <p className="text-sm text-theme-muted">
                  Select one or more items to create printable labels.
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-theme-primary">
                    {selectedCount}{" "}
                    {selectedCount === 1 ? "item selected" : "items selected"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary hover:bg-theme-hover"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="dashboard-action-button dashboard-action-button-primary min-h-10 px-4 py-2.5 text-xs"
                    >
                      Create Labels
                    </button>
                  </div>
                </div>
              )}
            </div>

            <label className="relative mt-4 block">
              <span className="sr-only">Search inventory</span>
              <UiIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item name, SKU, or item code"
                className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none transition focus:border-[#2563eb]/50 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              />
            </label>

            <div className="mt-4 grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {loading ? (
                <LoadingSkeletonGroup
                  count={4}
                  className="col-span-full grid-cols-1 sm:grid-cols-2"
                  itemClassName="min-h-20"
                />
              ) : visibleItems.length > 0 ? (
                visibleItems.map((item) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                        selected
                          ? "border-[#2563eb]/50 bg-[#2563eb]/10 ring-4 ring-[#2563eb]/15"
                          : "border-theme bg-theme-surface hover:bg-theme-hover"
                      } ${!item.public_id ? "opacity-55" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleItem(item.id)}
                        disabled={!item.public_id}
                        className="h-4 w-4 accent-[#2563eb]"
                      />
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-theme-inset ring-1 ring-black/5">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center">
                            <UiIcon
                              name="box"
                              className="h-4 w-4 text-theme-subtle"
                            />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setDetailsItemId(item.id)}
                          className="block max-w-full truncate text-left text-sm font-bold text-theme-primary hover:text-theme-accent"
                        >
                          {item.name}
                        </button>
                        <span className="mt-0.5 block truncate text-xs text-theme-subtle">
                          {item.sku || item.item_code || "No identifier"}
                          {!item.public_id ? " · QR unavailable" : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailsItemId(item.id)}
                        className="shrink-0 rounded-lg border border-theme bg-theme-surface p-2 text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
                        aria-label={`Open details for ${item.name}`}
                      >
                        <UiIcon name="chevron-right" className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <DashboardEmptyState
                  className="col-span-full"
                  icon="search"
                  title="No matching inventory items"
                  description="Adjust the search text to find label-ready items."
                />
              )}
            </div>
          </DashboardCard>

          <div className="grid gap-4">
            <DashboardCard>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-theme-primary">
                  Label Preview
                </h2>
                <span className="rounded-full border border-theme bg-theme-inset px-3 py-1 text-xs font-bold text-theme-secondary">
                  {layoutOptions.find((option) => option.value === settings.layout)
                    ?.label || "2 × 2"}
                </span>
              </div>
              {selectedItem ? (
                <div className="mt-4">
                  {renderLabel(selectedItem)}
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => downloadQr(selectedItem)}
                      className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary hover:bg-theme-hover"
                    >
                      Download QR
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadPdf()}
                      disabled={exportingPdf}
                      className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary hover:bg-theme-hover disabled:opacity-50"
                    >
                      {exportingPdf ? "Creating..." : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={printLabels}
                      className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary hover:bg-theme-hover"
                    >
                      {selectedCount === 1 ? "Print Label" : "Print Labels"}
                    </button>
                  </div>
                </div>
              ) : (
                <DashboardEmptyState
                  className="mt-4"
                  icon="qr"
                  title="No label selected"
                  description="Select an item to preview its label."
                />
              )}
            </DashboardCard>

            <DashboardCard>
              <h2 className="text-xl font-black text-theme-primary">
                Scan QR Code
              </h2>
              <p className="mt-2 text-sm leading-6 text-theme-muted">
                Open the existing SydIN ZXing scanner.
              </p>
              <button
                type="button"
                onClick={openExistingScanner}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary hover:bg-theme-hover"
              >
                <UiIcon name="scan" className="h-5 w-5" />
                Start Camera Scanner
              </button>
            </DashboardCard>
          </div>
        </div>
      </DashboardPageShell>

      <section
        className={`qr-print-root ${getLayoutGrid(settings.layout)}`}
        aria-hidden="true"
      >
        {printableItems.map((item) => renderLabel(item, true))}
      </section>

      {detailsItemId && (
        <ItemDetailsSlideOver
          itemId={detailsItemId}
          returnTo={currentContext}
          onClose={() => setDetailsItemId(null)}
          onItemUpdated={handleSlideOverItemUpdated}
        />
      )}

      <DialogShell
        open={settingsOpen}
        title="Create Labels"
        eyebrow="Label settings"
        description={`${selectedCount} ${
          selectedCount === 1 ? "item" : "items"
        } selected`}
        onClose={() => setSettingsOpen(false)}
        className="max-w-2xl"
      >
        <div className="grid gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-theme-secondary">
              Layout
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {layoutOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={settings.layout === option.value}
                  onClick={() => updateSettings({ layout: option.value })}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                    settings.layout === option.value
                      ? "border-[#2563eb]/50 bg-[#2563eb]/12 text-theme-accent ring-4 ring-[#2563eb]/15"
                      : "border-theme bg-theme-surface text-theme-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-theme-secondary">
              Branding
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["sydin", "SydIN logo"],
                  ["business", "Business logo"],
                  ["none", "No logo"],
                ] as [QrLabelBranding, string][]
              ).map(([value, label]) => {
                const businessDisabled =
                  value === "business" && !canUseBusinessLogo;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={businessDisabled}
                    aria-pressed={settings.branding === value}
                    onClick={() => updateSettings({ branding: value })}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                      settings.branding === value
                        ? "border-[#2563eb]/50 bg-[#2563eb]/12 text-theme-accent ring-4 ring-[#2563eb]/15"
                        : "border-theme bg-theme-surface text-theme-secondary"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!canUseBusinessLogo && (
              <p className="mt-2 text-xs leading-5 text-theme-muted">
                Business-logo labels require an active Standard or Pro plan and
                a logo in Settings. Current plan:{" "}
                <strong>{formatPlanName(subscription.plan)}</strong>.
              </p>
            )}
            {businessLogoError && (
              <p className="mt-2 text-xs text-theme-danger">
                The business logo could not be loaded. SydIN branding will be
                used instead.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-theme-secondary">
              Content
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["showName", "Show item name"],
                ["showIdentifier", "Show SKU or item code"],
                ["showUrl", "Show short public URL"],
              ].map(([field, label]) => (
                <label
                  key={field}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-3 text-sm font-semibold text-theme-primary"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      settings[field as keyof QrLabelSettings]
                    )}
                    onChange={(event) =>
                      updateSettings({
                        [field]: event.target.checked,
                      } as Partial<QrLabelSettings>)
                    }
                    className="h-4 w-4 accent-[#2563eb]"
                  />
                  {label}
                </label>
              ))}
              <Select
                label="QR size"
                value={settings.qrSize}
                onChange={(value) =>
                  updateSettings({
                    qrSize: value as QrLabelSize,
                  })
                }
                options={qrSizeOptions}
              />
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={exportingPdf}
              className="rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary hover:bg-theme-hover disabled:opacity-50"
            >
              {exportingPdf ? "Creating PDF..." : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={printLabels}
              className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
            >
              {selectedCount === 1 ? "Print Label" : "Print Labels"}
            </button>
          </div>
        </div>
      </DialogShell>
    </main>
  );
}
