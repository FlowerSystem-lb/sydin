"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { Badge } from "@/components/ui";
import { UpgradeDialog } from "@/components/UpgradePrompt";
import BulkPhotoDialog from "@/components/inventory/BulkPhotoDialog";
import type { PhotoTargetItem } from "@/app/lib/bulkItemPhotos";
import { supabase } from "@/app/lib/supabase";
import {
  getImportExportHistory,
  logImportExport,
  type ImportExportRecord,
} from "@/app/lib/importExportHistory";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import {
  downloadInventoryCsvTemplate,
  downloadInventoryExcelTemplate,
} from "@/app/lib/inventoryImport";
import {
  buildInventoryCsv,
  downloadTextFile,
  formatDateForFilename,
  slugifyFilename,
} from "@/app/lib/inventoryCsvExport";
import { exportInventoryExcel } from "@/app/lib/inventoryExcelExport";
import { exportInventoryPdf } from "@/app/lib/inventoryPdfExport";
import { getCategoriesForUser, resolveCategoryDisplay } from "@/app/lib/categories";
import { formatDepotLabel, getDepotsForUser } from "@/app/lib/depots";
import { getSuppliersForUser } from "@/app/lib/suppliers";
import {
  calculateInventoryValue,
  getEffectiveItemLowStockThreshold,
  normalizeCurrencyCode,
  normalizeInventoryUnitType,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

/**
 * Import & Export: every way data comes into SydIN and goes out of it, on one
 * page (Sayed, 26 Sep: "full system, all ways, on that page"). Back in the
 * sidebar after three weeks as an inner page of Inventory.
 *
 * Built in the Help Center's language -- one title line, section labels,
 * tiles that say what they do and do it, a flush history list -- so the two
 * pages read as one product.
 *
 * The inventory exports here are the whole catalogue. Inventory's own export
 * menu still exports what is filtered on screen there; this page is where you
 * come when you want "everything", without setting filters first.
 */

type InventoryRow = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  category_id: number | null;
  quantity: number;
  notes: string | null;
  image: string | null;
  public_id: string | null;
  item_code: string | null;
  unit_type: InventoryUnitType | null;
  custom_unit_label: string | null;
  cost_price: number | null;
  selling_price: number | null;
  min_stock_level: number | null;
  barcode: string | null;
  depot_id: number | null;
  supplier_id: number | null;
};

type ExportKind = "csv" | "excel" | "pdf";
type HistoryFilter = "all" | "import" | "export";

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

const dateTime = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Tile({
  icon,
  tone = "blue",
  title,
  description,
  href,
  onClick,
  actionLabel,
  disabled,
  locked,
  compact,
  children,
}: {
  icon: UiIconName;
  tone?: "blue" | "green" | "amber";
  title: string;
  description?: string;
  /** Title and a one-line action only -- the export tiles (Figma Make, 26 Sep). */
  compact?: boolean;
  href?: string;
  onClick?: () => void;
  actionLabel?: string;
  disabled?: boolean;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className={`ie-tile-icon ie-tone-${tone}`}>
        <UiIcon name={icon} className="h-4 w-4" />
      </span>
      <span className="ie-tile-copy">
        <span className="ie-tile-title">
          {title}
          {locked && (
            <Badge tone="warning" className="ie-tile-lock">
              Standard
            </Badge>
          )}
        </span>
        {description && !compact && <span className="ie-tile-text">{description}</span>}
        {actionLabel &&
          (compact ? (
            <span className="ie-tile-sub">
              <UiIcon name={href ? "chevron-right" : "download"} className="h-3.5 w-3.5" />
              {actionLabel}
            </span>
          ) : (
            <span className="ie-tile-action">
              {actionLabel}
              <UiIcon name="chevron-right" className="h-3.5 w-3.5" />
            </span>
          ))}
        {children && <span className="ie-tile-buttons">{children}</span>}
      </span>
    </>
  );

  const tileClass = compact ? "ie-tile ie-tile-compact" : "ie-tile";

  if (children) {
    return <div className={tileClass}>{body}</div>;
  }

  if (href) {
    return (
      <Link href={href} className={`${tileClass} ie-tile-link`}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={`${tileClass} ie-tile-link`} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}

export default function ImportExportPage() {
  const [userId, setUserId] = useState("");
  const [history, setHistory] = useState<ImportExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<ExportKind | "template" | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [lockedFeature, setLockedFeature] = useState<{ feature: string; benefit: string } | null>(
    null
  );

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoItems, setPhotoItems] = useState<PhotoTargetItem[]>([]);
  const [photoItemsLoading, setPhotoItemsLoading] = useState(false);

  const capabilities = getSubscriptionCapabilities(usage.subscription);
  const canExportExcel = capabilities.excelExport;
  const canExportPdf = capabilities.pdfExport !== "none";
  const businessName = settings.business_name || DEFAULT_BUSINESS_SETTINGS.business_name;

  const refreshHistory = useCallback(async (id: string) => {
    setHistory(await getImportExportHistory(id, 100));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!active) return;
        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);
        const [records, loadedSettings, loadedUsage] = await Promise.all([
          getImportExportHistory(user.id, 100),
          getOrCreateBusinessSettings(user.id).catch(() => DEFAULT_BUSINESS_SETTINGS),
          getSubscriptionUsage(user.id).catch(() => DEFAULT_USAGE),
        ]);
        if (!active) return;
        setHistory(records);
        setSettings(loadedSettings);
        setUsage(loadedUsage);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* Photos: the item list is read only when the dialog is asked for. */
  const openPhotoDialog = useCallback(async () => {
    setPhotoDialogOpen(true);
    if (photoItems.length > 0 || photoItemsLoading || !userId) return;
    setPhotoItemsLoading(true);
    try {
      const { data } = await supabase
        .from("inventory")
        .select("id, name, sku, barcode, item_code, image")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      setPhotoItems((data as PhotoTargetItem[] | null) || []);
    } finally {
      setPhotoItemsLoading(false);
    }
  }, [photoItems.length, photoItemsLoading, userId]);

  /* Exports read the whole catalogue at the moment you ask, never a copy
     loaded minutes ago. */
  const loadCatalogue = async () => {
    const [{ data, error }, categories, depots, suppliers] = await Promise.all([
      supabase
        .from("inventory")
        .select(
          "id, name, sku, category, category_id, quantity, notes, image, public_id, item_code, unit_type, custom_unit_label, cost_price, selling_price, min_stock_level, barcode, depot_id, supplier_id"
        )
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      getCategoriesForUser(userId).catch(() => []),
      getDepotsForUser(userId).catch(() => []),
      getSuppliersForUser(userId).catch(() => []),
    ]);
    if (error) throw error;
    const items = (data || []) as InventoryRow[];
    const categoryLabel = (item: InventoryRow) =>
      resolveCategoryDisplay(
        item,
        categories.find((category) => category.id === item.category_id) ?? null
      );
    const depotLabel = (item: InventoryRow) =>
      formatDepotLabel(depots.find((depot) => depot.id === item.depot_id));
    const supplierLabel = (item: InventoryRow) =>
      suppliers.find((supplier) => supplier.id === item.supplier_id)?.name || "";
    return { items, categoryLabel, depotLabel, supplierLabel };
  };

  const recordExport = (fileName: string, count: number) => {
    if (!userId) return;
    void logImportExport({
      userId,
      operation_type: "export",
      file_name: fileName,
      item_count: count,
      status: "success",
    }).then(() => refreshHistory(userId));
  };

  const runExport = async (kind: ExportKind) => {
    if (busy || !userId) return;
    if (kind === "excel" && !canExportExcel) {
      setLockedFeature({
        feature: "Excel export",
        benefit: "A structured workbook of every item, with depots, prices and public links.",
      });
      return;
    }
    if (kind === "pdf" && !canExportPdf) {
      setLockedFeature({
        feature: "PDF inventory report",
        benefit: "A branded PDF of your whole catalogue, ready to print or send.",
      });
      return;
    }

    setBusy(kind);
    setNotice(null);
    try {
      const { items, categoryLabel, depotLabel, supplierLabel } = await loadCatalogue();
      if (items.length === 0) {
        setNotice({ tone: "danger", text: "There are no items to export yet." });
        return;
      }
      const lowStockThreshold = getEffectiveLowStockThreshold(
        usage.subscription,
        settings.low_stock_threshold
      );
      const currencyCode = normalizeCurrencyCode(settings.currency_code, "USD");
      const origin = window.location.origin;
      const slug = slugifyFilename(businessName);
      const stamp = formatDateForFilename(new Date());

      if (kind === "csv") {
        const rows = items.map((item) => [
          item.name,
          item.sku || "",
          categoryLabel(item),
          depotLabel(item),
          item.quantity,
          item.quantity <=
          getEffectiveItemLowStockThreshold(item.min_stock_level, lowStockThreshold)
            ? "Yes"
            : "No",
          item.notes || "",
          item.image || "",
          item.public_id ? `${origin}/item/${item.public_id}` : "",
          item.item_code || "",
          normalizeInventoryUnitType(item.unit_type),
          item.unit_type === "custom" ? item.custom_unit_label || "" : "",
          item.cost_price ?? "",
          item.selling_price ?? "",
          calculateInventoryValue(item.quantity, item.cost_price) ?? "",
          calculateInventoryValue(item.quantity, item.selling_price) ?? "",
          item.min_stock_level ?? "",
          item.barcode || "",
          supplierLabel(item),
        ]);
        const fileName = downloadTextFile(`${slug}-inventory-${stamp}.csv`, buildInventoryCsv(rows));
        recordExport(fileName, items.length);
      } else if (kind === "excel") {
        await exportInventoryExcel({
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku || undefined,
            category: categoryLabel(item),
            quantity: item.quantity,
            itemCode: item.item_code,
            unitType: normalizeInventoryUnitType(item.unit_type),
            customUnitLabel: item.custom_unit_label,
            costPrice: item.cost_price,
            sellingPrice: item.selling_price,
            minStockLevel: item.min_stock_level,
            barcode: item.barcode,
            notes: item.notes || undefined,
            image: item.image || undefined,
            publicItemUrl: item.public_id ? `${origin}/item/${item.public_id}` : "",
            depotLabel: depotLabel(item),
          })),
          branding: {
            businessName,
            businessLogoUrl: settings.business_logo_url,
            contactEmail: settings.contact_email,
            contactPhone: settings.contact_phone,
            contactWebsite: settings.contact_website,
          },
          lowStockThreshold,
          currencyCode,
        });
        recordExport(`${slug}-inventory-${stamp}.xlsx`, items.length);
      } else {
        const fileName = await exportInventoryPdf({
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku || undefined,
            category: categoryLabel(item),
            quantity: item.quantity,
            itemCode: item.item_code,
            unitType: normalizeInventoryUnitType(item.unit_type),
            customUnitLabel: item.custom_unit_label,
            costPrice: item.cost_price,
            sellingPrice: item.selling_price,
            minStockLevel: item.min_stock_level,
            barcode: item.barcode,
            notes: item.notes || undefined,
            image: item.image || undefined,
            depotLabel: depotLabel(item),
            supplierLabel: supplierLabel(item),
          })),
          branding: {
            businessName,
            businessLogoUrl: settings.business_logo_url,
          },
          lowStockThreshold,
          currencyCode,
          reportType: "summary",
          scope: "all",
          scopeLabel: `All ${items.length} item${items.length === 1 ? "" : "s"}`,
          allowBusinessLogo: capabilities.customBusinessLogo,
        });
        recordExport(fileName, items.length);
      }
      setNotice({
        tone: "success",
        text: `Exported ${items.length} item${items.length === 1 ? "" : "s"} as ${
          kind === "csv" ? "CSV" : kind === "excel" ? "Excel" : "PDF"
        }.`,
      });
    } catch {
      setNotice({ tone: "danger", text: "That export did not finish. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async (kind: "csv" | "excel") => {
    if (kind === "csv") {
      downloadInventoryCsvTemplate();
      return;
    }
    setBusy("template");
    try {
      await downloadInventoryExcelTemplate();
    } catch {
      setNotice({ tone: "danger", text: "We could not create the Excel template. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(
    () => ({
      all: history.length,
      import: history.filter((record) => record.operation_type === "import").length,
      export: history.filter((record) => record.operation_type === "export").length,
    }),
    [history]
  );
  const shownHistory =
    historyFilter === "all"
      ? history
      : history.filter((record) => record.operation_type === historyFilter);

  return (
    <main className="ie-page">
      <DashboardPageShell width="compact">
        <DashboardPageHeader
          eyebrow="Inventory"
          title="Import & Export"
          description="Bring products in from a spreadsheet or photos, take your catalogue out as CSV, Excel or PDF."
        />

        <DashboardCard className="help-hero">
          <div className="help-hero-titlebar">
            <h1 className="help-hero-title">Import &amp; Export</h1>
            <p className="help-hero-subtitle">
              Every way your products come into SydIN and go out of it, in one place.
            </p>
          </div>
        </DashboardCard>

        {notice && <DashboardNotice tone={notice.tone}>{notice.text}</DashboardNotice>}

        {/* ---- In ---------------------------------------------------- */}
        <section aria-labelledby="ie-in-title">
          <h2 id="ie-in-title" className="help-section-title">
            Bring data in
          </h2>
          <div className="ie-grid mt-2">
            <Tile
              icon="sheet"
              title="Import a spreadsheet"
              description="CSV or Excel, up to 1,000 rows. Every row is checked before anything is saved, and photos can come with it."
              href="/dashboard/inventory/import"
              actionLabel="Start an import"
            />
            <Tile
              icon="upload"
              tone="green"
              title="Add photos in bulk"
              description="Drop a folder of photos. They match items by SKU, barcode, code or name; the rest become new items."
              onClick={() => void openPhotoDialog()}
              actionLabel={photoItemsLoading ? "Loading items…" : "Add photos"}
              disabled={loading || !userId}
            />
            <Tile
              icon="download"
              tone="amber"
              title="Get a template"
              description="The exact columns the importer reads, ready to fill in."
            >
              <button type="button" className="ie-mini-button" onClick={() => void downloadTemplate("csv")}>
                <UiIcon name="download" className="h-3.5 w-3.5" />
                CSV
              </button>
              <button
                type="button"
                className="ie-mini-button"
                onClick={() => void downloadTemplate("excel")}
                disabled={busy === "template"}
              >
                <UiIcon name="download" className="h-3.5 w-3.5" />
                {busy === "template" ? "Creating…" : "Excel"}
              </button>
            </Tile>
          </div>
        </section>

        {/* ---- Out --------------------------------------------------- */}
        <section aria-labelledby="ie-out-title">
          <h2 id="ie-out-title" className="help-section-title">
            Take data out
          </h2>
          <div className="ie-grid ie-grid-2 mt-2">
            <Tile
              compact
              icon="file"
              title="Inventory as CSV"
              description="Every item, every column. Opens in Excel, Google Sheets or another system."
              onClick={() => void runExport("csv")}
              actionLabel={busy === "csv" ? "Exporting…" : "Export now"}
              disabled={loading || busy !== null}
            />
            <Tile
              compact
              icon="sheet"
              tone="green"
              title="Inventory as Excel"
              description="A formatted workbook with photos, depots, prices and public links."
              onClick={() => void runExport("excel")}
              actionLabel={busy === "excel" ? "Exporting…" : "Export now"}
              disabled={loading || busy !== null}
              locked={!loading && !canExportExcel}
            />
            <Tile
              compact
              icon="reports"
              tone="amber"
              title="Inventory as PDF"
              description="A branded summary of the whole catalogue, ready to print or send."
              onClick={() => void runExport("pdf")}
              actionLabel={busy === "pdf" ? "Building…" : "Export now"}
              disabled={loading || busy !== null}
              locked={!loading && !canExportPdf}
            />
            <Tile
              compact
              icon="receipt"
              title="Sales, purchases & movements"
              description="Money and stock reports with a date range, as PDF or CSV."
              href="/dashboard/reports"
              actionLabel="Open Reports"
            />
          </div>
          <p className="ie-footnote">
            Need only some items? Filter or select them on{" "}
            <Link href="/dashboard/inventory">Inventory</Link> and export from its ⋯ menu.
          </p>
        </section>

        {/* ---- History ----------------------------------------------- */}
        <section aria-labelledby="ie-history-title">
          <h2 id="ie-history-title" className="help-section-title">
            History
          </h2>
          <FilterBar label="History type" className="help-topics-bar mt-2">
            <FilterChip
              active={historyFilter === "all"}
              count={counts.all}
              onClick={() => setHistoryFilter("all")}
            >
              All
            </FilterChip>
            <FilterChip
              active={historyFilter === "import"}
              count={counts.import}
              onClick={() => setHistoryFilter("import")}
            >
              <UiIcon name="upload" className="h-3.5 w-3.5" />
              Imports
            </FilterChip>
            <FilterChip
              active={historyFilter === "export"}
              count={counts.export}
              onClick={() => setHistoryFilter("export")}
            >
              <UiIcon name="download" className="h-3.5 w-3.5" />
              Exports
            </FilterChip>
          </FilterBar>

          <div className="mt-3">
            {loading ? (
              <LoadingSkeletonGroup count={3} itemClassName="min-h-14" />
            ) : shownHistory.length === 0 ? (
              <DashboardEmptyState
                icon="file"
                title={
                  historyFilter === "all"
                    ? "Nothing imported or exported yet"
                    : `No ${historyFilter}s yet`
                }
                description="Every import and export you run is listed here with its file and how many items it covered."
              />
            ) : (
              <div className="help-article-list">
                {shownHistory.map((record) => {
                  const isImport = record.operation_type === "import";
                  return (
                    <div key={record.id} className="ie-history-row">
                      <span className={`ie-tile-icon ${isImport ? "ie-tone-blue" : "ie-tone-green"}`}>
                        <UiIcon name={isImport ? "upload" : "download"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="ie-history-name">{record.file_name}</span>
                        <span className="ie-history-meta">
                          {isImport ? "Import" : "Export"} · {record.item_count} item
                          {record.item_count === 1 ? "" : "s"} ·{" "}
                          {dateTime.format(new Date(record.created_at))}
                          {record.error_message ? ` · ${record.error_message}` : ""}
                        </span>
                      </span>
                      <Badge
                        tone={
                          record.status === "success"
                            ? "success"
                            : record.status === "error"
                              ? "danger"
                              : "info"
                        }
                      >
                        <span className="ie-status">
                          <UiIcon
                            name={
                              record.status === "success"
                                ? "check"
                                : record.status === "error"
                                  ? "close"
                                  : "clock"
                            }
                            className="h-3 w-3"
                          />
                          {record.status === "success"
                            ? "Done"
                            : record.status === "error"
                              ? "Failed"
                              : "Running"}
                        </span>
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </DashboardPageShell>

      <BulkPhotoDialog
        open={photoDialogOpen}
        items={photoItems}
        businessName={businessName}
        onClose={() => setPhotoDialogOpen(false)}
        onUploaded={() => {
          setPhotoItems([]);
          if (userId) void refreshHistory(userId);
        }}
      />

      <UpgradeDialog
        open={Boolean(lockedFeature)}
        onClose={() => setLockedFeature(null)}
        feature={lockedFeature?.feature || ""}
        benefit={lockedFeature?.benefit || ""}
        currentPlan={formatPlanName(usage.subscription.plan)}
        requiredPlan="Standard"
        source="import-export"
      />
    </main>
  );
}
