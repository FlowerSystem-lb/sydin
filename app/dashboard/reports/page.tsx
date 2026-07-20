"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Button, DialogShell, Select } from "@/components/ui";
import {
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
  MetricCard,
} from "@/components/dashboard/Workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  exportInventoryPdf,
  type InventoryPdfBrandingMode,
  type InventoryPdfGroupBy,
  type InventoryPdfIncludeSettings,
  type InventoryPdfReportType,
} from "@/app/lib/inventoryPdfExport";
import {
  formatInventoryPrice,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  normalizeInventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  getInventoryValueTotals,
  getLowStockReport,
  getMovementTotals,
  getOutOfStockReport,
  type InventoryReportItem,
  type ReportStockMovement,
} from "@/app/lib/inventoryReports";
import {
  formatStockMovementNotes,
  STOCK_MOVEMENT_LABELS,
  type StockMovementType,
} from "@/app/lib/stockMovements";
import {
  FALLBACK_SUBSCRIPTION,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

type ReportCategory = "all" | "inventory" | "operations" | "valuation" | "activity";
type ReportAction = "inventory-pdf" | "movement-csv" | "route";
type MovementFilter = "all" | StockMovementType;

interface ReportInventoryItem extends InventoryReportItem {
  image?: string | null;
  sku?: string | null;
  notes?: string | null;
  public_id?: string | null;
  barcode?: string | null;
}

interface ReportCard {
  id: string;
  name: string;
  description: string;
  category: Exclude<ReportCategory, "all">;
  source: string;
  formats: string[];
  action: ReportAction;
  reportType?: InventoryPdfReportType;
  href?: string;
  hrefLabel?: string;
  icon: UiIconName;
  note?: string;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

const DEFAULT_INCLUDE: InventoryPdfIncludeSettings = {
  images: true,
  sku: true,
  barcode: false,
  category: true,
  depot: true,
  supplier: true,
  minStock: true,
  pricing: true,
  notes: true,
};

const INVENTORY_REPORTS: ReportCard[] = [
  {
    id: "inventory-summary",
    name: "Inventory Summary",
    description: "Overview of item count, quantities, low stock, and value.",
    category: "inventory",
    source: "Inventory",
    formats: ["PDF"],
    action: "inventory-pdf",
    reportType: "summary",
    icon: "box",
  },
  {
    id: "detailed-inventory",
    name: "Detailed Inventory",
    description: "Full item list with optional images, pricing, codes, depot, and supplier.",
    category: "inventory",
    source: "Inventory",
    formats: ["PDF", "CSV"],
    action: "inventory-pdf",
    reportType: "detailed",
    icon: "sheet",
  },
  {
    id: "low-stock",
    name: "Low Stock Report",
    description: "Items at or below their effective minimum stock threshold.",
    category: "inventory",
    source: "Inventory",
    formats: ["PDF"],
    action: "inventory-pdf",
    reportType: "low-stock",
    icon: "alert",
  },
  {
    id: "valuation",
    name: "Inventory Valuation",
    description: "Inventory value based on current cost and retail pricing.",
    category: "valuation",
    source: "Inventory",
    formats: ["PDF"],
    action: "inventory-pdf",
    reportType: "valuation",
    icon: "reports",
  },
];

const OPERATION_REPORTS: ReportCard[] = [
  {
    id: "stock-movements",
    name: "Stock Movements",
    description: "Audit trail of stock in, stock out, adjustments, receiving, and counts.",
    category: "activity",
    source: "Stock movements",
    formats: ["CSV"],
    action: "movement-csv",
    href: "/dashboard/stock-movements",
    hrefLabel: "Open movements",
    icon: "movement",
  },
  {
    id: "pick-lists",
    name: "Pick Lists",
    description: "Open saved pick lists and export pick sheets from the module.",
    category: "operations",
    source: "Pick Lists",
    formats: ["Module"],
    action: "route",
    href: "/dashboard/pick-lists",
    hrefLabel: "Open Pick Lists",
    icon: "picklists",
  },
  {
    id: "stock-counts",
    name: "Stock Counts",
    description: "Open a draft workflow to count and review inventory.",
    category: "operations",
    source: "Stock Counts",
    formats: ["Workflow"],
    action: "route",
    href: "/dashboard/stock-counts",
    hrefLabel: "Open Stock Counts",
    icon: "check",
    note: "Saved count history is planned later.",
  },
  {
    id: "purchase-orders",
    name: "Purchase Orders",
    description: "Create and export a purchase order draft.",
    category: "operations",
    source: "Purchase Orders",
    formats: ["Workflow"],
    action: "route",
    href: "/dashboard/purchase-orders",
    hrefLabel: "Open Purchase Orders",
    icon: "file",
    note: "Saved purchase order history is planned later.",
  },
  {
    id: "receiving",
    name: "Receiving",
    description: "Receive stock and create auditable stock-in movement records.",
    category: "operations",
    source: "Receiving",
    formats: ["Workflow"],
    action: "route",
    href: "/dashboard/receiving",
    hrefLabel: "Open Receiving",
    icon: "upload",
    note: "Receiving history is represented through Stock Movements in v1.",
  },
];

const REPORTS = [...INVENTORY_REPORTS, ...OPERATION_REPORTS];

function formatCurrency(value: number, currencyCode: string) {
  return (
    formatInventoryPrice(value, normalizeCurrencyCode(currencyCode, "USD")) ||
    `${normalizeCurrencyCode(currencyCode, "USD")} ${value.toFixed(2)}`
  );
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function FormatChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-theme bg-theme-inset px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-theme-secondary">
      {label}
    </span>
  );
}

export default function ReportsPage() {
  const [items, setItems] = useState<ReportInventoryItem[]>([]);
  const [movements, setMovements] = useState<ReportStockMovement[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("all");
  const [reportSearch, setReportSearch] = useState("");
  const [inventoryDialogReport, setInventoryDialogReport] =
    useState<ReportCard | null>(null);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [inventoryGroupBy, setInventoryGroupBy] =
    useState<InventoryPdfGroupBy>("none");
  const [inventoryBranding, setInventoryBranding] =
    useState<InventoryPdfBrandingMode>("sydin");
  const [inventoryInclude, setInventoryInclude] =
    useState<InventoryPdfIncludeSettings>(DEFAULT_INCLUDE);
  const [movementStartDate, setMovementStartDate] = useState("");
  const [movementEndDate, setMovementEndDate] = useState("");
  const [movementType, setMovementType] = useState<MovementFilter>("all");
  const [movementSearch, setMovementSearch] = useState("");

  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );
  const currencyCode = normalizeCurrencyCode(
    businessSettings.currency_code,
    "USD"
  );

  useEffect(() => {
    let active = true;

    async function loadReportsData() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in again to view reports.");
      }

      const [
        inventoryResult,
        movementResult,
        loadedDepots,
        loadedSuppliers,
        loadedCategories,
        settings,
        usage,
      ] = await Promise.all([
        supabase
          .from("inventory")
          .select(
            "id, name, item_code, category, category_id, quantity, image, sku, notes, public_id, unit_type, custom_unit_label, cost_price, selling_price, min_stock_level, depot_id, supplier_id, barcode"
          )
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("stock_movements")
          .select(
            "id, item_id, movement_type, quantity_delta, quantity_before, quantity_after, notes, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(250),
        getDepotsForUser(user.id).catch(() => []),
        getSuppliersForUser(user.id).catch(() => []),
        getCategoriesForUser(user.id).catch(() => []),
        getOrCreateBusinessSettings(user.id),
        getSubscriptionUsage(user.id),
      ]);

      if (inventoryResult.error) throw inventoryResult.error;
      if (movementResult.error) throw movementResult.error;
      if (!active) return;

      setItems((inventoryResult.data || []) as ReportInventoryItem[]);
      setMovements((movementResult.data || []) as ReportStockMovement[]);
      setDepots(loadedDepots);
      setSuppliers(loadedSuppliers);
      setCategories(loadedCategories);
      setBusinessSettings(settings);
      setSubscriptionUsage(usage);
      setLoading(false);
    }

    loadReportsData().catch((loadError) => {
      if (!active) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load the Reports Hub."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const lowStockItems = useMemo(
    () =>
      getLowStockReport(
        items,
        effectiveLowStockThreshold,
        planCapabilities.customLowStockThreshold
      ),
    [
      effectiveLowStockThreshold,
      items,
      planCapabilities.customLowStockThreshold,
    ]
  );
  const outOfStockItems = useMemo(() => getOutOfStockReport(items), [items]);
  const totals = useMemo(() => getInventoryValueTotals(items), [items]);
  const movementTotals = useMemo(() => getMovementTotals(movements), [movements]);

  const reportCategories: Array<{ id: ReportCategory; label: string }> = [
    { id: "all", label: "All" },
    { id: "inventory", label: "Inventory" },
    { id: "operations", label: "Operations" },
    { id: "valuation", label: "Inventory Value" },
    { id: "activity", label: "Activity" },
  ];

  const normalizedReportSearch = reportSearch.trim().toLowerCase();
  const visibleReports = REPORTS.filter((report) => {
    const matchesCategory =
      activeCategory === "all" || report.category === activeCategory;
    const matchesSearch =
      !normalizedReportSearch ||
      [report.name, report.description, report.source, report.formats.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedReportSearch);

    return matchesCategory && matchesSearch;
  });

  const getCategoryLabel = (item: ReportInventoryItem) =>
    resolveCategoryDisplay(item, item.category_id ? categoryById.get(item.category_id) : null);
  const getDepotLabel = (item: ReportInventoryItem) =>
    formatDepotLabel(item.depot_id ? depotById.get(item.depot_id) : null);
  const getSupplierLabel = (item: ReportInventoryItem) =>
    item.supplier_id ? supplierById.get(item.supplier_id)?.name || "" : "";

  const exportInventoryReport = async () => {
    if (!inventoryDialogReport?.reportType || exporting) return;

    if (items.length === 0) {
      setExportStatus("Add inventory items before exporting a report.");
      return;
    }

    try {
      setExporting(true);
      setExportStatus("Preparing PDF...");

      const filename = await exportInventoryPdf({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku || undefined,
          category: getCategoryLabel(item),
          quantity: Number(item.quantity || 0),
          notes: item.notes || undefined,
          image: item.image || undefined,
          depotLabel: getDepotLabel(item),
          supplierLabel: getSupplierLabel(item),
          itemCode: item.item_code,
          unitType: normalizeInventoryUnitType(item.unit_type),
          customUnitLabel: item.custom_unit_label,
          costPrice: item.cost_price,
          sellingPrice: item.selling_price,
          minStockLevel: item.min_stock_level,
          barcode: item.barcode,
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          businessLogoUrl: businessSettings.business_logo_url,
          contactEmail:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_email
              : "",
          contactPhone:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_phone
              : "",
          contactWebsite:
            planCapabilities.publicContactBranding &&
            businessSettings.show_contact_publicly
              ? businessSettings.contact_website
              : "",
        },
        lowStockThreshold: effectiveLowStockThreshold,
        currencyCode,
        reportType: inventoryDialogReport.reportType,
        scope: "all",
        scopeLabel: "All inventory",
        groupBy: inventoryGroupBy,
        include: inventoryInclude,
        brandingMode: inventoryBranding,
        allowBusinessLogo: planCapabilities.customBusinessLogo,
        onProgress: setExportStatus,
      });

      setNotice(`${filename} exported.`);
      setInventoryDialogReport(null);
      setExportStatus("");
    } catch {
      setExportStatus("We could not export this inventory report.");
    } finally {
      setExporting(false);
    }
  };

  const exportDetailedInventoryCsv = () => {
    if (items.length === 0) {
      setNotice("Add inventory items before exporting CSV.");
      return;
    }

    downloadCsv("sydin-detailed-inventory.csv", [
      [
        "Name",
        "Item Code",
        "SKU",
        "Barcode",
        "Category",
        "Depot",
        "Supplier",
        "Quantity",
        "Unit",
        "Cost Price",
        "Selling Price",
        "Minimum Stock",
        "Notes",
      ],
      ...items.map((item) => [
        item.name,
        item.item_code,
        item.sku,
        item.barcode,
        getCategoryLabel(item),
        getDepotLabel(item),
        getSupplierLabel(item),
        Number(item.quantity || 0),
        normalizeInventoryUnitType(item.unit_type),
        item.cost_price,
        item.selling_price,
        item.min_stock_level,
        item.notes,
      ]),
    ]);
    setNotice("Detailed inventory CSV exported.");
  };

  const movementRows = useMemo(() => {
    const start = movementStartDate
      ? new Date(`${movementStartDate}T00:00:00`)
      : null;
    const end = movementEndDate ? new Date(`${movementEndDate}T23:59:59`) : null;
    const normalizedSearch = movementSearch.trim().toLowerCase();

    return movements.filter((movement) => {
      const item = itemById.get(movement.item_id);
      const movementDate = new Date(movement.created_at);
      const matchesStart = !start || movementDate >= start;
      const matchesEnd = !end || movementDate <= end;
      const matchesType =
        movementType === "all" || movement.movement_type === movementType;
      const matchesSearch =
        !normalizedSearch ||
        [
          item?.name,
          item?.item_code,
          item?.sku,
          STOCK_MOVEMENT_LABELS[movement.movement_type],
          movement.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStart && matchesEnd && matchesType && matchesSearch;
    });
  }, [
    itemById,
    movementEndDate,
    movementSearch,
    movementStartDate,
    movementType,
    movements,
  ]);

  const exportStockMovementsCsv = () => {
    if (movements.length === 0) {
      setExportStatus("No stock movements are available to export.");
      return;
    }

    downloadCsv("sydin-stock-movements.csv", [
      [
        "Date",
        "Item",
        "Item Code",
        "SKU",
        "Movement Type",
        "Quantity Delta",
        "Quantity Before",
        "Quantity After",
        "Unit",
        "Reason / Note",
      ],
      ...movementRows.map((movement) => {
        const item = itemById.get(movement.item_id);
        return [
          movement.created_at,
          item?.name || "Inventory item",
          item?.item_code,
          item?.sku,
          STOCK_MOVEMENT_LABELS[movement.movement_type],
          movement.quantity_delta,
          movement.quantity_before,
          movement.quantity_after,
          item
            ? getInventoryQuantityLabel(
                1,
                item.unit_type,
                item.custom_unit_label
              ).replace(/^1\s*/, "")
            : "",
          formatStockMovementNotes(movement.notes),
        ];
      }),
    ]);
    setNotice(`Stock movements CSV exported with ${movementRows.length} row${movementRows.length === 1 ? "" : "s"}.`);
    setMovementDialogOpen(false);
    setExportStatus("");
  };

  const openReport = (report: ReportCard) => {
    setNotice("");
    setExportStatus("");
    if (report.action === "inventory-pdf") {
      setInventoryDialogReport(report);
    } else if (report.action === "movement-csv") {
      setMovementDialogOpen(true);
    }
  };

  return (
    <main className="reports-workspace operations-workspace">
      <DashboardPageShell width="wide">
        <DashboardPageHeader
          eyebrow="Insights"
          title="Reports"
          description="Generate inventory reports, stock activity exports, and workflow shortcuts."
          actions={
            <Button
              onClick={() => setInventoryDialogReport(INVENTORY_REPORTS[0])}
              leadingIcon={<UiIcon name="plus" className="h-4 w-4" />}
              disabled={loading}
            >
              New report
            </Button>
          }
        />

        {(notice || error) && (
          <DashboardNotice tone={error ? "danger" : "success"}>
            {error || notice}
          </DashboardNotice>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="box"
            label="Inventory items"
            value={items.length.toLocaleString()}
            detail="Current workspace items"
          />
          <MetricCard
            icon="alert"
            label="Low stock"
            value={lowStockItems.length.toLocaleString()}
            detail={`${outOfStockItems.length.toLocaleString()} out of stock`}
          />
          <MetricCard
            icon="usage"
            label="Cost value"
            value={formatCurrency(totals.totalCostValue, currencyCode)}
            detail="Current stock cost"
          />
          <MetricCard
            icon="movement"
            label="Movements"
            value={movementTotals.movementCount.toLocaleString()}
            detail="Latest 250 movement records"
          />
        </section>

        <DashboardToolbar>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterBar label="Report categories" className="flex-wrap overflow-visible">
              {reportCategories.map((category) => (
                <FilterChip
                  key={category.id}
                  active={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </FilterChip>
              ))}
            </FilterBar>
            <label className="relative w-full lg:max-w-sm">
              <span className="sr-only">Search reports</span>
              <UiIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
              />
              <input
                type="search"
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Search reports"
                className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
              />
            </label>
          </div>
        </DashboardToolbar>

        {loading ? (
          <LoadingSkeletonGroup
            count={6}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            itemClassName="min-h-44"
          />
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleReports.map((report) => {
              const isWorkflowShortcut = report.action === "route";

              return (
                <article
                  key={report.id}
                  className={`flex flex-col rounded-[18px] border border-theme bg-theme-surface shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${
                    isWorkflowShortcut ? "min-h-0 p-3" : "min-h-52 p-4"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`grid shrink-0 place-items-center rounded-xl border border-theme bg-theme-inset text-theme-accent ${
                        isWorkflowShortcut ? "h-9 w-9" : "h-11 w-11"
                      }`}
                    >
                      <UiIcon
                        name={report.icon}
                        className={isWorkflowShortcut ? "h-4 w-4" : "h-5 w-5"}
                      />
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {report.formats.map((format) => (
                        <FormatChip key={format} label={format} />
                      ))}
                    </div>
                  </div>

                  <div className={isWorkflowShortcut ? "mt-2" : "mt-4"}>
                    <h2
                      className={`font-black text-theme-primary ${
                        isWorkflowShortcut ? "text-base" : "text-lg"
                      }`}
                    >
                      {report.name}
                    </h2>
                    <p
                      className={`mt-1 text-sm text-theme-muted ${
                        isWorkflowShortcut ? "leading-5" : "leading-6"
                      }`}
                    >
                      {report.description}
                    </p>
                  </div>

                  <div
                    className={`flex flex-wrap items-center gap-2 text-xs ${
                      isWorkflowShortcut ? "mt-2" : "mt-3"
                    }`}
                  >
                    <span className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                      {isWorkflowShortcut ? report.source : `Source: ${report.source}`}
                    </span>
                    {report.note && (
                      <span className="inline-flex min-h-6 items-center rounded-full border border-theme bg-theme-inset px-2.5 text-[11px] font-bold text-theme-subtle">
                        v1 workflow
                      </span>
                    )}
                  </div>
                  {report.note && (
                    <p className="mt-1 text-xs leading-5 text-theme-subtle">
                      {report.note}
                    </p>
                  )}

                  <div
                    className={`flex flex-col gap-2 sm:flex-row ${
                      isWorkflowShortcut ? "mt-3" : "mt-auto pt-4"
                    }`}
                  >
                    {report.action === "route" && report.href ? (
                      <Link
                        href={report.href}
                        className="ui-button ui-button-primary ui-button-sm"
                      >
                        {report.hrefLabel || "Open"}
                      </Link>
                    ) : (
                      <Button onClick={() => openReport(report)}>Generate</Button>
                    )}
                    {report.href && report.action !== "route" && (
                      <Link
                        href={report.href}
                        className="ui-button ui-button-secondary ui-button-md"
                      >
                        {report.hrefLabel || "Open source page"}
                      </Link>
                    )}
                    {report.id === "detailed-inventory" && (
                      <Button
                        variant="secondary"
                        onClick={exportDetailedInventoryCsv}
                      >
                        Export CSV
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
            {visibleReports.length === 0 && (
              <DashboardEmptyState
                className="md:col-span-2 xl:col-span-3"
                icon="search"
                title="No reports match"
                description="Adjust the category or search text."
              />
            )}
          </section>
        )}

        <section className="rounded-[18px] border border-theme bg-theme-surface p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-theme bg-theme-inset px-3 py-2.5">
              <span className="mt-0.5 rounded-full border border-theme bg-theme-surface px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-theme-accent">
                Future
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-theme-primary">
                  Saved reports
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-theme-muted">
                  Saved report templates are planned later. Generate reports
                  from live data when needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-theme bg-theme-inset px-3 py-2.5">
              <span className="mt-0.5 rounded-full border border-theme bg-theme-surface px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-theme-accent">
                Future
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-theme-primary">
                  Scheduled email reports
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-theme-muted">
                  Scheduled delivery controls are planned for a later update.
                </p>
              </div>
            </div>
          </div>
        </section>
      </DashboardPageShell>

      {inventoryDialogReport && (
        <DialogShell
          title={inventoryDialogReport.name}
          eyebrow="Inventory report"
          description="Generate a PDF from current inventory data. Reports Hub v1 exports all inventory for this workspace."
          onClose={() => {
            if (!exporting) setInventoryDialogReport(null);
          }}
          closeDisabled={exporting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setInventoryDialogReport(null)}
                disabled={exporting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void exportInventoryReport()}
                loading={exporting}
                loadingLabel="Generating..."
              >
                Generate PDF
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            {exportStatus && (
              <p className="rounded-xl border border-[#2563eb]/25 bg-[#2563eb]/10 px-3 py-2 text-sm font-semibold text-theme-accent">
                {exportStatus}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Report type
                <Select
                  value={inventoryDialogReport.reportType || "summary"}
                  onChange={(value) =>
                    setInventoryDialogReport((current) =>
                      current
                        ? {
                            ...current,
                            reportType: value as InventoryPdfReportType,
                          }
                        : current
                    )
                  }
                  options={[
                    { value: "summary", label: "Inventory Summary" },
                    { value: "detailed", label: "Detailed Inventory" },
                    { value: "low-stock", label: "Low Stock Report" },
                    { value: "valuation", label: "Inventory Valuation" },
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Group by
                <Select
                  value={inventoryGroupBy}
                  onChange={(value) =>
                    setInventoryGroupBy(value as InventoryPdfGroupBy)
                  }
                  options={[
                    { value: "none", label: "None" },
                    { value: "category", label: "Category" },
                    { value: "depot", label: "Depot/location" },
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Branding
                <Select
                  value={inventoryBranding}
                  onChange={(value) =>
                    setInventoryBranding(value as InventoryPdfBrandingMode)
                  }
                  options={[
                    {
                      value: "business",
                      label: planCapabilities.customBusinessLogo
                        ? "Business logo"
                        : "Business logo (falls back to SydIN)",
                    },
                    { value: "sydin", label: "SydIN logo" },
                    { value: "none", label: "No logo" },
                  ]}
                />
              </label>
              <div className="rounded-xl border border-theme bg-theme-inset p-3 text-sm text-theme-muted">
                <p className="font-bold text-theme-primary">Scope</p>
                <p className="mt-1">
                  All inventory. Selected-items scope stays in Inventory where
                  selection context exists.
                </p>
              </div>
            </div>
            <fieldset className="grid gap-2 rounded-xl border border-theme bg-theme-inset p-3">
              <legend className="px-1 text-sm font-black text-theme-primary">
                Include
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["images", "Images"],
                    ["sku", "SKU/code"],
                    ["barcode", "Barcode"],
                    ["category", "Category"],
                    ["depot", "Depot/location"],
                    ["supplier", "Supplier"],
                    ["minStock", "Minimum stock"],
                    ["pricing", "Pricing"],
                    ["notes", "Notes"],
                  ] as Array<[keyof InventoryPdfIncludeSettings, string]>
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-theme bg-theme-surface px-3 text-sm font-bold text-theme-primary"
                  >
                    <input
                      type="checkbox"
                      checked={inventoryInclude[key]}
                      onChange={(event) =>
                        setInventoryInclude((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]/50"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </DialogShell>
      )}

      {movementDialogOpen && (
        <DialogShell
          title="Stock Movements Report"
          eyebrow="Activity report"
          description="Export a CSV audit trail from the latest stock movements loaded into the Reports Hub."
          onClose={() => setMovementDialogOpen(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setMovementDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={exportStockMovementsCsv}>Export CSV</Button>
            </>
          }
        >
          <div className="grid gap-4">
            {exportStatus && (
              <p className="rounded-xl border border-[#2563eb]/25 bg-[#2563eb]/10 px-3 py-2 text-sm font-semibold text-theme-accent">
                {exportStatus}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Start date
                <input
                  type="date"
                  value={movementStartDate}
                  onChange={(event) => setMovementStartDate(event.target.value)}
                  className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                End date
                <input
                  type="date"
                  value={movementEndDate}
                  onChange={(event) => setMovementEndDate(event.target.value)}
                  className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Movement type
                <Select
                  value={movementType}
                  onChange={(value) => setMovementType(value as MovementFilter)}
                  options={[
                    { value: "all", label: "All movement types" },
                    ...Object.entries(STOCK_MOVEMENT_LABELS).map(
                      ([value, label]) => ({ value, label })
                    ),
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                Item or reason
                <input
                  type="search"
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  placeholder="Search item, code, or note"
                  className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                />
              </label>
            </div>
            <p className="rounded-xl border border-theme bg-theme-inset px-3 py-2 text-sm font-semibold text-theme-secondary">
              {movementRows.length} row{movementRows.length === 1 ? "" : "s"} match
              these filters.
            </p>
          </div>
        </DialogShell>
      )}
    </main>
  );
}
