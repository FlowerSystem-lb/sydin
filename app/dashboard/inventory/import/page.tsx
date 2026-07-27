"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  ActionButton,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
} from "@/components/dashboard/Workspace";
import {
  getCategoriesForUser,
  type Category,
} from "@/app/lib/categories";
import {
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  downloadInventoryCsvTemplate,
  downloadInventoryExcelTemplate,
  MAX_IMPORT_FILE_SIZE,
  MAX_IMPORT_ROWS,
  parseInventoryImportFile,
  validateInventoryImportRows,
  type InventoryImportValidation,
  type ParsedInventoryFile,
} from "@/app/lib/inventoryImport";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { logImportExport } from "@/app/lib/importExportHistory";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getPlanLimitMessage,
  getSubscriptionUsage,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  hasSubscriptionCapability,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFieldErrorClass(
  validation: InventoryImportValidation,
  rowNumber: number,
  field: string
) {
  const row = validation.rows.find((item) => item.rowNumber === rowNumber);

  return row?.errors.some((error) => error.field === field)
    ? "border-red-400/35 bg-red-500/10 text-theme-danger"
    : "border-theme bg-theme-surface text-theme-secondary";
}

function getPhaseFieldErrorClass(
  validation: InventoryImportValidation,
  rowNumber: number
) {
  const phaseFields = new Set([
    "unit_type",
    "custom_unit_label",
    "cost_price",
    "selling_price",
    "min_stock_level",
    "barcode",
  ]);
  const row = validation.rows.find((item) => item.rowNumber === rowNumber);

  return row?.errors.some((error) => phaseFields.has(error.field))
    ? "border-red-400/35 bg-red-500/10 text-theme-danger"
    : "border-[#2563eb]/15 bg-[#2563eb]/[0.06] text-theme-secondary";
}

export default function InventoryImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage>(
    DEFAULT_SUBSCRIPTION_USAGE
  );
  const [depots, setDepots] = useState<Depot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedInventoryFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [pageError, setPageError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [success, setSuccess] = useState<{
    importedCount: number;
    skippedEmptyRows: number;
    unmatchedCategoryRows: number;
  } | null>(null);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again before importing inventory.");
          setInitialLoading(false);
          return;
        }

        const [
          loadedUsage,
          loadedDepots,
          loadedCategories,
          { data: skuRows, error: skuError },
        ] =
          await Promise.all([
            getSubscriptionUsage(user.id),
            getDepotsForUser(user.id).catch(() => []),
            getCategoriesForUser(user.id).catch(() => []),
            supabase
              .from("inventory")
              .select("sku")
              .eq("user_id", user.id),
          ]);

        if (!isActive) return;

        if (skuError) {
          setPageError(
            "We could not load inventory details for duplicate checks. Refresh and try again."
          );
          setInitialLoading(false);
          return;
        }

        setUsage(loadedUsage);
        setDepots(loadedDepots);
        setCategories(loadedCategories);
        setExistingSkus(
          (skuRows || [])
            .map((row) => String(row.sku || ""))
            .filter(Boolean)
        );
        setInitialLoading(false);
      })
      .catch(() => {
        if (!isActive) return;

        setPageError("We could not prepare the import workspace. Refresh and try again.");
        setInitialLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const validation = useMemo(
    () =>
      parsedFile
        ? validateInventoryImportRows({
            rows: parsedFile.rows,
            depots,
            categories,
            existingSkus,
          })
        : null,
    [categories, depots, existingSkus, parsedFile]
  );
  const projectedItemCount =
    usage.usedItems + (validation?.validRows.length || 0);
  const exceedsPlanLimit =
    projectedItemCount > usage.subscription.item_limit;
  const currentPlanName = formatPlanName(usage.subscription.plan);
  const canImport = hasSubscriptionCapability(
    usage.subscription,
    "csvExcelImport"
  );
  const previewRows = validation
    ? [...validation.invalidRows, ...validation.validRows].slice(0, 100)
    : [];

  const resetImport = () => {
    setSelectedFile(null);
    setParsedFile(null);
    setFileError("");
    setPageError("");
    setSuccess(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File | null) => {
    if (!file || isParsing || isImporting) return;

    try {
      setIsParsing(true);
      setFileError("");
      setPageError("");
      setSuccess(null);
      setSelectedFile(file);

      const parsed = await parseInventoryImportFile(file);

      setParsedFile(parsed);
    } catch (error) {
      setParsedFile(null);
      setFileError(
        error instanceof Error
          ? error.message
          : "We could not read this import file. Try another file."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleExcelTemplateDownload = async () => {
    if (isDownloadingExcel) return;

    try {
      setIsDownloadingExcel(true);
      setPageError("");
      await downloadInventoryExcelTemplate();
    } catch {
      setPageError("We could not create the Excel template. Please try again.");
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleImport = async () => {
    if (
      !parsedFile ||
      !validation ||
      validation.invalidRows.length > 0 ||
      validation.validRows.length === 0 ||
      exceedsPlanLimit ||
      isImporting
    ) {
      return;
    }

    try {
      setIsImporting(true);
      setPageError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageError("Please sign in again before importing inventory.");
        return;
      }

      const [
        freshUsage,
        freshDepots,
        freshCategories,
        { data: freshSkuRows, error: skuError },
      ] = await Promise.all([
        getSubscriptionUsage(user.id, {
          strictCount: true,
        }),
        getDepotsForUser(user.id),
        getCategoriesForUser(user.id),
        supabase
          .from("inventory")
          .select("sku")
          .eq("user_id", user.id),
      ]);

      if (skuError) {
        setPageError(
          "We could not re-check duplicate SKUs. No items were imported."
        );
        return;
      }

      const freshExistingSkus = (freshSkuRows || [])
        .map((row) => String(row.sku || ""))
        .filter(Boolean);
      const freshValidation = validateInventoryImportRows({
        rows: parsedFile.rows,
        depots: freshDepots,
        categories: freshCategories,
        existingSkus: freshExistingSkus,
      });

      setUsage(freshUsage);
      setDepots(freshDepots);
      setCategories(freshCategories);
      setExistingSkus(freshExistingSkus);

      if (
        !hasSubscriptionCapability(
          freshUsage.subscription,
          "csvExcelImport"
        )
      ) {
        setPageError(
          "Import requires an active Standard or Pro plan. No items were imported."
        );
        return;
      }

      if (freshValidation.invalidRows.length > 0) {
        setPageError(
          "Inventory or depot data changed after preview. Review the updated row errors before importing."
        );
        return;
      }

      if (
        freshUsage.usedItems + freshValidation.validRows.length >
        freshUsage.subscription.item_limit
      ) {
        setPageError(getPlanLimitMessage(freshUsage.subscription.plan));
        return;
      }

      const newItems = freshValidation.validRows.map((row) => ({
        name: row.values.name,
        sku: row.values.sku,
        category:
          freshCategories.find(
            (category) => category.id === row.categoryId
          )?.name || row.values.category,
        category_id: row.categoryId,
        quantity: row.values.quantity,
        unit_type: row.values.unit_type,
        custom_unit_label:
          row.values.unit_type === "custom"
            ? row.values.custom_unit_label
            : null,
        cost_price: row.values.cost_price,
        selling_price: row.values.selling_price,
        min_stock_level: row.values.min_stock_level,
        barcode: row.values.barcode || null,
        notes: row.values.notes,
        depot_id: row.depotId,
        image: "",
        user_id: user.id,
      }));
      const { data: createdItems, error: insertError } = await supabase
        .from("inventory")
        .insert(newItems)
        .select("*");

      if (insertError || !createdItems) {
        // Record the failure too — a history that only shows successes hides
        // exactly the runs the user needs to investigate.
        void logImportExport({
          userId: user.id,
          operation_type: "import",
          file_name: parsedFile.fileName,
          item_count: 0,
          status: "error",
          error_message: insertError?.message || "Import failed",
        });
        setPageError(
          "We could not import these items. No success was recorded. Please try again."
        );
        return;
      }

      await Promise.all(
        createdItems.map((item) =>
          logInventoryHistory({
            itemId: item.id,
            userId: user.id,
            action: "created",
            newQuantity: item.quantity,
            newValues: item,
          })
        )
      );

      setUsage({
        ...freshUsage,
        usedItems: freshUsage.usedItems + createdItems.length,
      });
      void logImportExport({
        userId: user.id,
        operation_type: "import",
        file_name: parsedFile.fileName,
        item_count: createdItems.length,
        status: "success",
      });

      setSuccess({
        importedCount: createdItems.length,
        skippedEmptyRows: parsedFile.skippedEmptyRows,
        unmatchedCategoryRows: freshValidation.unmatchedCategoryRows,
      });
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Something went wrong while importing inventory."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="contents">
      <main className="operations-workspace operations-inventory-import">
        <DashboardPageShell>
          <DashboardPageHeader
            eyebrow="Bulk import"
            title="Import Inventory"
            description="Upload a CSV or Excel file, review each row, then create inventory records in one controlled import."
            actions={
              <ActionButton href="/dashboard/inventory" variant="secondary">
                Back to Inventory
              </ActionButton>
            }
          />

          {!initialLoading && !canImport ? (
            <LockedFeaturePanel
              feature="Import inventory in bulk with Standard or Pro."
              benefit="Upload CSV or Excel files, review every row, and create inventory records in one controlled workflow."
              currentPlan={currentPlanName}
              requiredPlan="Standard"
              source="import"
            />
          ) : (
            <>
              <DashboardToolbar className="operations-step-strip grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["1", "Upload", !parsedFile && !success],
              ["2", "Review", Boolean(parsedFile && !success)],
              ["3", "Complete", Boolean(success)],
            ].map(([number, label, active]) => (
              <div
                key={String(number)}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center text-xs font-bold transition sm:text-sm ${
                  active
                    ? "bg-cyan-500/10 text-theme-accent ring-1 ring-cyan-300/30"
                    : "bg-theme-inset text-theme-secondary"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black ${
                    active ? "bg-white text-theme-accent" : "bg-theme-surface"
                  }`}
                >
                  {String(number)}
                </span>
                {String(label)}
              </div>
            ))}
              </DashboardToolbar>

          {initialLoading ? (
            <section className="rounded-[20px] border border-theme bg-theme-surface p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-[#2563eb]/20" />
              <h2 className="mt-5 text-xl font-bold text-theme-primary">
                Preparing import checks
              </h2>
              <p className="mt-2 text-sm text-theme-muted">
                Loading plan usage, depots, and existing SKUs.
              </p>
            </section>
          ) : success ? (
            <section className="rounded-[20px] border border-emerald-400/20 bg-emerald-500/[0.07] p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/25 bg-emerald-500/15 text-2xl font-black text-theme-success">
                {success.importedCount}
              </div>

              <h2 className="mt-6 text-3xl font-bold tracking-tight text-theme-primary">
                Import complete
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-theme-secondary">
                Added {success.importedCount} inventory item
                {success.importedCount === 1 ? "" : "s"} successfully.
                {success.skippedEmptyRows > 0
                  ? ` ${success.skippedEmptyRows} empty row${
                      success.skippedEmptyRows === 1 ? " was" : "s were"
                    } ignored.`
                  : ""}
                {success.unmatchedCategoryRows > 0
                  ? ` ${success.unmatchedCategoryRows} category name${
                      success.unmatchedCategoryRows === 1 ? " was" : "s were"
                    } kept as legacy text because no managed category matched.`
                  : ""}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
                >
                  Back to Inventory
                </Link>

                <button
                  type="button"
                  onClick={resetImport}
                  className="rounded-2xl border border-theme bg-theme-surface px-6 py-4 text-base font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Import Another File
                </button>
              </div>
            </section>
          ) : !parsedFile ? (
            <>
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.75fr]">
                <div className="rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                      Templates
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-theme-primary">
                      Start with the correct columns
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-theme-muted">
                      Name and Quantity are required. SKU, Category, Depot, and Notes are optional.
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={downloadInventoryCsvTemplate}
                      className="rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Download CSV Template
                    </button>

                    <button
                      type="button"
                      onClick={handleExcelTemplateDownload}
                      disabled={isDownloadingExcel}
                      className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-5 py-4 text-sm font-bold text-theme-success transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDownloadingExcel
                        ? "Creating Template..."
                        : "Download Excel Template"}
                    </button>
                  </div>
                </div>

                <div className="rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-subtle">
                    Import limits
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-theme bg-theme-inset p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-theme-subtle">
                        File size
                      </p>
                      <p className="mt-2 text-xl font-black text-theme-primary">
                        {formatFileSize(MAX_IMPORT_FILE_SIZE)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-theme bg-theme-inset p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-theme-subtle">
                        Rows
                      </p>
                      <p className="mt-2 text-xl font-black text-theme-primary">
                        {MAX_IMPORT_ROWS}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-theme-muted">
                    Accepted formats: CSV and Excel (.xlsx). Images and private IDs are never imported.
                  </p>
                </div>
              </section>

              <section
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();

                  if (event.currentTarget === event.target) {
                    setIsDragging(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void processFile(event.dataTransfer.files?.[0] || null);
                }}
                className={`rounded-[20px] border border-dashed p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition sm:p-6 ${
                  isDragging
                    ? "border-[#2563eb]/60 bg-[#2563eb]/15"
                    : "border-[#2563eb]/25 bg-theme-surface"
                }`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing || Boolean(pageError)}
                  className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-[28px] border border-theme bg-theme-inset px-5 py-10 text-center transition hover:border-[#2563eb]/35 hover:bg-[var(--sydin-input-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#2563eb]/25 bg-[#2563eb]/15 text-xl font-black text-theme-accent">
                    CSV
                  </span>

                  <span className="mt-5 text-2xl font-bold text-theme-primary">
                    {isParsing ? "Reading file..." : "Drop a file or choose from device"}
                  </span>

                  <span className="mt-3 max-w-lg text-sm leading-6 text-theme-muted">
                    Your file is reviewed locally first. Nothing is imported until every row passes validation and you confirm.
                  </span>

                  <span className="mt-5 rounded-xl bg-cyan-500/10 px-5 py-3 text-sm font-black text-theme-accent">
                    Choose CSV or Excel
                  </span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) =>
                    void processFile(event.target.files?.[0] || null)
                  }
                  className="sr-only"
                />

                {selectedFile && isParsing && (
                  <p className="mt-4 text-center text-sm font-semibold text-theme-accent">
                    Checking {selectedFile.name}
                  </p>
                )}
              </section>
            </>
          ) : validation ? (
            <>
              <section className="rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                      File ready for review
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-bold text-theme-primary">
                      {parsedFile.fileName}
                    </h2>
                    <p className="mt-2 text-sm text-theme-muted">
                      {parsedFile.format} file | {parsedFile.totalRows} parsed row
                      {parsedFile.totalRows === 1 ? "" : "s"} | {parsedFile.skippedEmptyRows} empty skipped
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetImport}
                    className="rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Choose Another File
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    ["Valid rows", validation.validRows.length, "emerald"],
                    ["Invalid rows", validation.invalidRows.length, "red"],
                    ["Duplicate SKUs", validation.duplicateSkuRows, "amber"],
                    ["Depot errors", validation.depotErrorRows, "indigo"],
                    [
                      "Legacy categories",
                      validation.unmatchedCategoryRows,
                      "amber",
                    ],
                  ].map(([label, value, tone]) => (
                    <div
                      key={String(label)}
                      className={`rounded-2xl border p-4 ${
                        tone === "emerald"
                          ? "border-emerald-400/20 bg-emerald-500/10"
                          : tone === "red"
                            ? "border-red-400/20 bg-red-500/10"
                            : tone === "amber"
                              ? "border-amber-300/20 bg-amber-500/10"
                              : "border-indigo-300/20 bg-indigo-500/10"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-muted">
                        {String(label)}
                      </p>
                      <p className="mt-2 text-2xl font-black text-theme-primary">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {parsedFile.ignoredItemCodeColumn && (
                <section className="rounded-[24px] border border-amber-300/25 bg-amber-500/10 px-5 py-4 text-sm font-semibold leading-6 text-theme-warning">
                  The uploaded item code column was ignored. SydIN generates
                  item codes automatically when records are created.
                </section>
              )}

              {validation.invalidRows.length > 0 && (
                <section className="rounded-[28px] border border-red-400/25 bg-red-500/10 p-5 text-theme-danger shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
                  <h2 className="text-lg font-bold">
                    Fix all row errors before importing
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-theme-danger/75">
                    No partial import will occur. Correct the source file, then upload it again.
                  </p>
                </section>
              )}

              <section className="rounded-[20px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                      Row preview
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-theme-primary">
                      Validation details
                    </h2>
                  </div>

                  {validation.rows.length > previewRows.length && (
                    <p className="text-sm text-theme-muted">
                      Showing first {previewRows.length} rows, with errors first
                    </p>
                  )}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-theme md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
                      <thead className="border-b border-theme bg-theme-inset text-xs uppercase tracking-[0.12em] text-theme-subtle">
                        <tr>
                          {["Row", "Name", "SKU", "Category", "Quantity", "Depot", "Item details", "Notes", "Status"].map(
                            (header) => (
                              <th key={header} className="px-4 py-4 font-bold">
                                {header}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className="border-t border-theme bg-theme-inset align-top"
                          >
                            <td className="px-4 py-4 font-black text-theme-muted">
                              {row.rowNumber}
                            </td>
                            {[
                              ["name", row.values.name || "Missing"],
                              ["sku", row.values.sku || "Optional"],
                              ["category", row.values.category || "Not provided"],
                              [
                                "quantity",
                                row.values.quantity === null
                                  ? "Missing"
                                  : String(row.values.quantity),
                              ],
                              ["depot", row.values.depot || "Unassigned"],
                            ].map(([field, value]) => (
                              <td key={field} className="px-3 py-3">
                                <div
                                  className={`max-w-[230px] break-words rounded-xl border px-3 py-2 ${getFieldErrorClass(
                                    validation,
                                    row.rowNumber,
                                    field
                                  )}`}
                                >
                                  {value}
                                </div>
                              </td>
                            ))}
                            <td className="px-3 py-3">
                              <div
                                className={`max-w-[260px] rounded-xl border px-3 py-2 ${getPhaseFieldErrorClass(
                                  validation,
                                  row.rowNumber
                                )}`}
                              >
                                <p className="font-semibold">
                                  Unit: {row.values.unit_type}
                                  {row.values.custom_unit_label
                                    ? ` (${row.values.custom_unit_label})`
                                    : ""}
                                </p>
                                <p className="mt-1 text-xs text-theme-muted">
                                  Cost:{" "}
                                  {row.values.cost_price === null
                                    ? "Optional"
                                    : row.values.cost_price}
                                  {" | "}Price:{" "}
                                  {row.values.selling_price === null
                                    ? "Optional"
                                    : row.values.selling_price}
                                </p>
                                <p className="mt-1 break-all text-xs text-theme-muted">
                                  Min:{" "}
                                  {row.values.min_stock_level === null
                                    ? "Default"
                                    : row.values.min_stock_level}
                                  {" | "}Barcode:{" "}
                                  {row.values.barcode || "Optional"}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div
                                className={`max-w-[230px] break-words rounded-xl border px-3 py-2 ${getFieldErrorClass(
                                  validation,
                                  row.rowNumber,
                                  "notes"
                                )}`}
                              >
                                {row.values.notes || "Not provided"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {row.isValid ? (
                                <span className="inline-flex rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-theme-success">
                                  Ready
                                </span>
                              ) : (
                                <div className="flex max-w-[280px] flex-col gap-2">
                                  {row.errors.map((error) => (
                                    <span
                                      key={`${error.field}-${error.message}`}
                                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-5 text-theme-danger"
                                    >
                                      {error.message}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {previewRows.map((row) => (
                    <article
                      key={row.rowNumber}
                      className={`rounded-[24px] border p-4 ${
                        row.isValid
                          ? "border-theme bg-theme-inset"
                          : "border-red-400/25 bg-red-500/[0.07]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-theme-primary">
                          Row {row.rowNumber}
                        </p>
                        <span
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                            row.isValid
                              ? "border-emerald-400/20 bg-emerald-500/10 text-theme-success"
                              : "border-red-400/20 bg-red-500/10 text-theme-danger"
                          }`}
                        >
                          {row.isValid ? "Ready" : "Needs attention"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          ["Name", "name", row.values.name || "Missing"],
                          ["SKU", "sku", row.values.sku || "Optional"],
                          ["Category", "category", row.values.category || "Not provided"],
                          [
                            "Quantity",
                            "quantity",
                            row.values.quantity === null
                              ? "Missing"
                              : String(row.values.quantity),
                          ],
                          ["Depot", "depot", row.values.depot || "Unassigned"],
                          ["Notes", "notes", row.values.notes || "Not provided"],
                        ].map(([label, field, value]) => (
                          <div
                            key={field}
                            className={`rounded-2xl border p-3 ${getFieldErrorClass(
                              validation,
                              row.rowNumber,
                              field
                            )}`}
                          >
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              {label}
                            </p>
                            <p className="mt-1 break-words text-sm font-semibold">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div
                        className={`mt-3 rounded-2xl border p-3 ${getPhaseFieldErrorClass(
                          validation,
                          row.rowNumber
                        )}`}
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-accent">
                          Item details
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                          <p>
                            Unit:{" "}
                            <span className="font-semibold">
                              {row.values.unit_type}
                              {row.values.custom_unit_label
                                ? ` (${row.values.custom_unit_label})`
                                : ""}
                            </span>
                          </p>
                          <p>
                            Min stock:{" "}
                            <span className="font-semibold">
                              {row.values.min_stock_level ?? "Default"}
                            </span>
                          </p>
                          <p>
                            Cost:{" "}
                            <span className="font-semibold">
                              {row.values.cost_price ?? "Optional"}
                            </span>
                          </p>
                          <p>
                            Selling:{" "}
                            <span className="font-semibold">
                              {row.values.selling_price ?? "Optional"}
                            </span>
                          </p>
                          <p className="break-all sm:col-span-2">
                            Barcode:{" "}
                            <span className="font-mono font-semibold">
                              {row.values.barcode || "Optional"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {row.errors.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2">
                          {row.errors.map((error) => (
                            <p
                              key={`${error.field}-${error.message}`}
                              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-5 text-theme-danger"
                            >
                              {error.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[20px] border border-[#2563eb]/20 bg-[#2563eb]/[0.08] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                      Plan review
                    </p>
                    <p className="mt-2 text-2xl font-black text-theme-primary">
                      Current {usage.usedItems} + Import {validation.validRows.length} = {projectedItemCount} / {usage.subscription.item_limit}
                    </p>
                    <p className="mt-2 text-sm text-theme-muted">
                      {currentPlanName} plan | The limit is checked again immediately before import.
                    </p>
                  </div>

                  {exceedsPlanLimit && (
                    <Link
                      href={getUpgradeRequestHref(
                        usage.subscription.plan,
                        "import-item-limit"
                      )}
                      className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-center text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
                    >
                      {getUpgradeActionLabel(usage.subscription.plan)}
                    </Link>
                  )}
                </div>

                {exceedsPlanLimit && (
                  <p className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                    {getPlanLimitMessage(usage.subscription.plan)}
                  </p>
                )}
              </section>

              {pageError && (
                <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-theme-danger">
                  {pageError}
                </section>
              )}

              <section className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse gap-3 border-t border-theme bg-theme-surface/95 px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:mx-0 sm:flex-row sm:justify-end sm:rounded-[20px] sm:border sm:px-5">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl border border-theme bg-theme-surface px-6 py-4 text-center text-base font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={
                    isImporting ||
                    validation.invalidRows.length > 0 ||
                    validation.validRows.length === 0 ||
                    exceedsPlanLimit
                  }
                  className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-7 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting
                    ? `Importing ${validation.validRows.length} items...`
                    : `Confirm Import (${validation.validRows.length})`}
                </button>
              </section>
            </>
          ) : null}

          {(fileError || (pageError && !parsedFile)) && (
            <section className="rounded-[24px] border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-theme-danger shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
              {fileError || pageError}
            </section>
          )}
            </>
          )}
        </DashboardPageShell>
      </main>

      {isImporting && validation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center theme-overlay p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[30px] border border-theme bg-[var(--sydin-surface-strong)] p-7 text-center shadow-[0_14px_42px_rgba(15,23,42,0.12)]">
            <div className="mx-auto h-14 w-14 animate-pulse rounded-3xl border border-[#2563eb]/25 bg-[#2563eb]/15" />
            <h2 className="mt-5 text-2xl font-bold text-theme-primary">
              Importing {validation.validRows.length} items...
            </h2>
            <p className="mt-3 text-sm leading-6 text-theme-muted">
              Keep this page open while SydIN safely creates the inventory records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
