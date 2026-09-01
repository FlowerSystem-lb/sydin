"use client";

import {
  createProductImagePath,
  getPhotoFileKey,
} from "@/app/lib/productImage";
import { Select } from "@/components/ui";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import BarcodeScannerView, {
  type ScannerViewStatus,
} from "@/components/scanner/BarcodeScannerView";
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
  ALLOWED_IMPORT_IMAGE_TYPES,
  downloadInventoryCsvTemplate,
  downloadInventoryExcelTemplate,
  matchImportPhotosToRows,
  MAX_IMPORT_FILE_SIZE,
  MAX_IMPORT_IMAGE_SIZE,
  MAX_IMPORT_ROWS,
  parseInventoryImportFile,
  validateInventoryImportRows,
  type InventoryImportValidation,
  type ParsedInventoryFile,
  type ParsedInventoryRow,
} from "@/app/lib/inventoryImport";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { logImportExport } from "@/app/lib/importExportHistory";
import { resolveScannedCode, type ScannableItem } from "@/app/lib/scannerResolve";
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

// backlog item 2, part 2: POS-style batch barcode add. Minimal shape for
// checking a scanned code against existing inventory before it's allowed
// to become a new batch row — same duplicate-prevention boundary as the
// Add Item scan feature (see the "same barcode = same item" decision log
// entry), reusing resolveScannedCode() rather than inventing new matching.
interface BatchScanCandidateItem extends ScannableItem {
  id: number;
  name: string;
}

interface BatchScanRow {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
}

interface BatchScanSkipped {
  barcode: string;
  name: string;
  count: number;
}

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
  // backlog item 2: batch photo upload, matched to rows by filename -> SKU
  // (never by list order — see matchImportPhotosToRows for why).
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  // Photos a phone named IMG_5383.jpg, pointed at a row by hand.
  const [photoRowAssignments, setPhotoRowAssignments] = useState<
    Map<string, number>
  >(new Map());
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [success, setSuccess] = useState<{
    importedCount: number;
    skippedEmptyRows: number;
    unmatchedCategoryRows: number;
    photosAttached: number;
    photosFailed: number;
  } | null>(null);

  // backlog item 2, part 2: POS-style batch barcode add.
  const [isBatchScanOpen, setIsBatchScanOpen] = useState(false);
  const [isBatchScanLoading, setIsBatchScanLoading] = useState(false);
  const [batchExistingItems, setBatchExistingItems] = useState<
    BatchScanCandidateItem[]
  >([]);
  const [batchRows, setBatchRows] = useState<BatchScanRow[]>([]);
  const [batchSkipped, setBatchSkipped] = useState<BatchScanSkipped[]>([]);
  const [batchScanStatus, setBatchScanStatus] = useState<ScannerViewStatus>({
    starting: false,
    status: "",
    error: "",
  });
  const [batchScanRetryNonce, setBatchScanRetryNonce] = useState(0);

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
  const photoMatch = useMemo(
    () =>
      validation
        ? matchImportPhotosToRows(
            photoFiles,
            validation.validRows,
            photoRowAssignments
          )
        : null,
    [photoFiles, photoRowAssignments, validation]
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
  const photoRowOptions = (validation?.validRows || []).map((row) => ({
    value: String(row.rowNumber),
    label: row.values.name || `Row ${row.rowNumber}`,
    description: row.values.sku || `Row ${row.rowNumber}`,
    keywords: row.values.sku,
  }));

  const clearPhotos = () => {
    setPhotoFiles([]);
    setPhotoRowAssignments(new Map());

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const addPhotoFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);

    // De-dupe by name+size so re-selecting the same folder twice (a natural
    // habit) doesn't double the file list or double-flag "duplicate SKU."
    setPhotoFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}`));
      const additions = incoming.filter(
        (file) => !known.has(`${file.name}:${file.size}`)
      );
      return [...current, ...additions];
    });
  };

  const removePhotoFile = (target: File) => {
    setPhotoFiles((current) =>
      current.filter((file) => file !== target)
    );
    setPhotoRowAssignments((current) => {
      const key = getPhotoFileKey(target);
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const assignPhotoToRow = (file: File, rowNumber: string) => {
    setPhotoRowAssignments((current) => {
      const next = new Map(current);
      if (rowNumber) {
        next.set(getPhotoFileKey(file), Number(rowNumber));
      } else {
        next.delete(getPhotoFileKey(file));
      }
      return next;
    });
  };

  // backlog item 2, part 2: POS-style batch barcode add. Opens the scan
  // panel; fetches a lean existing-items snapshot once, up front, so every
  // decode in the session can be checked against it without a query per
  // scan (a real POS scan burst can be many codes in a few seconds).
  const openBatchScan = async () => {
    if (isBatchScanLoading) return;

    try {
      setIsBatchScanLoading(true);
      setPageError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageError("Please sign in again before scanning items.");
        return;
      }

      const { data, error } = await supabase
        .from("inventory")
        .select("id, name, sku, barcode, public_id")
        .eq("user_id", user.id);

      if (error) {
        setPageError(
          "We could not check your existing inventory for duplicates. Please try again."
        );
        return;
      }

      setBatchExistingItems((data as BatchScanCandidateItem[]) || []);
      setBatchRows([]);
      setBatchSkipped([]);
      setBatchScanStatus({ starting: false, status: "", error: "" });
      setIsBatchScanOpen(true);
    } finally {
      setIsBatchScanLoading(false);
    }
  };

  const closeBatchScan = () => setIsBatchScanOpen(false);

  const retryBatchScan = () => {
    setBatchScanStatus({ starting: true, status: "Starting camera...", error: "" });
    setBatchScanRetryNonce((current) => current + 1);
  };

  // Same duplicate-prevention boundary as the Add Item scan feature: a code
  // that already belongs to an item is never added as a new row — it's
  // logged as skipped instead, so the person scanning sees why nothing new
  // appeared without the scan burst being interrupted by a dialog.
  const handleBatchDecode = (scannedValue: string) => {
    const scannedText = scannedValue.trim();
    if (!scannedText) return;

    const resolution = resolveScannedCode(scannedText, batchExistingItems);

    if (resolution.kind === "item" || resolution.kind === "ambiguous") {
      const existingName =
        resolution.kind === "item"
          ? resolution.item.name || "Existing item"
          : `${resolution.items.length} items share this code`;

      setBatchSkipped((current) => {
        const index = current.findIndex((row) => row.barcode === scannedText);
        if (index >= 0) {
          const next = [...current];
          next[index] = { ...next[index], count: next[index].count + 1 };
          return next;
        }
        return [...current, { barcode: scannedText, name: existingName, count: 1 }];
      });
      return;
    }

    setBatchRows((current) => {
      const index = current.findIndex((row) => row.barcode === scannedText);
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], quantity: next[index].quantity + 1 };
        return next;
      }
      return [
        ...current,
        { id: crypto.randomUUID(), barcode: scannedText, name: "", quantity: 1 },
      ];
    });
  };

  const updateBatchRowName = (id: string, name: string) => {
    setBatchRows((current) =>
      current.map((row) => (row.id === id ? { ...row, name } : row))
    );
  };

  const updateBatchRowQuantity = (id: string, quantity: number) => {
    setBatchRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, quantity: Number.isFinite(quantity) ? quantity : row.quantity }
          : row
      )
    );
  };

  const removeBatchRow = (id: string) => {
    setBatchRows((current) => current.filter((row) => row.id !== id));
  };

  const canContinueBatch =
    batchRows.length > 0 && batchRows.every((row) => row.name.trim().length > 0);

  // The hand-off: batch rows become the same ParsedInventoryFile shape the
  // CSV/Excel path produces, so everything downstream — validation, the
  // review table, plan-limit checks, the photo step, the confirm-import
  // logic — runs completely unchanged. This is the "compounded with the
  // Excel import" part of the spec, literally: one save path, two ways in.
  const continueBatchToReview = () => {
    if (!canContinueBatch) return;

    const rows: ParsedInventoryRow[] = batchRows.map((row, index) => ({
      rowNumber: index + 2,
      values: {
        name: row.name.trim(),
        sku: "",
        category: "",
        quantity: String(row.quantity),
        depot: "",
        notes: "",
        unit_type: "",
        custom_unit_label: "",
        cost_price: "",
        selling_price: "",
        min_stock_level: "",
        barcode: row.barcode,
      },
    }));

    setSelectedFile(null);
    setFileError("");
    setPageError("");
    setSuccess(null);
    clearPhotos();
    setParsedFile({
      fileName: "Scanned barcodes",
      format: "Scan",
      totalRows: rows.length,
      skippedEmptyRows: 0,
      rows,
      ignoredItemCodeColumn: false,
    });
    setIsBatchScanOpen(false);
  };

  const resetImport = () => {
    setSelectedFile(null);
    setParsedFile(null);
    setFileError("");
    setPageError("");
    setSuccess(null);
    clearPhotos();
    setBatchRows([]);
    setBatchSkipped([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File | null) => {
    if (!file || isParsing || isImporting) return;

    try {
      setIsParsing(true);
      setFileError("");
      clearPhotos();
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

      // backlog item 2: upload matched photos before the insert, so the row
      // it belongs to (found by SKU, never by position) already has a URL to
      // write. A failed upload does not block the batch — see the decision
      // log entry for why silently skipping a photo beats aborting an
      // otherwise-clean import over one bad file.
      const photoFileByRowNumber = new Map(
        (photoMatch?.matches || []).map(({ row, file }) => [
          row.rowNumber,
          file,
        ])
      );
      const imageUrlByRowNumber = new Map<number, string>();
      let photosAttached = 0;
      let photosFailed = 0;

      if (photoFileByRowNumber.size > 0) {
        const uploadOutcomes = await Promise.allSettled(
          [...photoFileByRowNumber.entries()].map(async ([rowNumber, file]) => {
            const fileName = createProductImagePath(user.id, file);
            const { error: uploadError } = await supabase.storage
              .from("products")
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
              .from("products")
              .getPublicUrl(fileName);

            return { rowNumber, url: data.publicUrl };
          })
        );

        for (const outcome of uploadOutcomes) {
          if (outcome.status === "fulfilled") {
            imageUrlByRowNumber.set(outcome.value.rowNumber, outcome.value.url);
            photosAttached += 1;
          } else {
            photosFailed += 1;
          }
        }
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
        image: imageUrlByRowNumber.get(row.rowNumber) || "",
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

      clearPhotos();
      setSuccess({
        importedCount: createdItems.length,
        skippedEmptyRows: parsedFile.skippedEmptyRows,
        unmatchedCategoryRows: freshValidation.unmatchedCategoryRows,
        photosAttached,
        photosFailed,
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
                {success.photosAttached > 0
                  ? ` ${success.photosAttached} product photo${
                      success.photosAttached === 1 ? "" : "s"
                    } attached.`
                  : ""}
                {success.photosFailed > 0
                  ? ` ${success.photosFailed} photo${
                      success.photosFailed === 1 ? "" : "s"
                    } could not be uploaded — those items saved without a photo; add it from the item page.`
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
                    Accepted formats: CSV and Excel (.xlsx). Product photos are added on the
                    next step, in this same import — name each one after its row. Private IDs
                    are never imported.
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

              {/* backlog item 2, part 2: POS-style batch barcode add — a
                  second way into the same review/import pipeline above,
                  for adding several new items by scanning rather than by
                  file. */}
              <section className="rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-500/15 text-theme-success">
                    <UiIcon name="scan" className="h-6 w-6" />
                  </span>
                  <h2 className="text-xl font-bold text-theme-primary">
                    Or add items by scanning barcodes
                  </h2>
                  <p className="max-w-lg text-sm leading-6 text-theme-muted">
                    Scan several new items in a row, POS-style. Each new code becomes a row here —
                    scanning the same code again just adds to its quantity. A code that already
                    belongs to an item in your inventory is skipped, never duplicated.
                  </p>
                  <button
                    type="button"
                    onClick={() => void openBatchScan()}
                    disabled={isBatchScanLoading}
                    className="mt-1 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-theme-success transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBatchScanLoading ? "Preparing scanner..." : "Start Scanning"}
                  </button>
                </div>
              </section>
            </>
          ) : validation ? (
            <>
              <section className="rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                      {parsedFile.format === "Scan"
                        ? "Scanned items ready for review"
                        : "File ready for review"}
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-bold text-theme-primary">
                      {parsedFile.fileName}
                    </h2>
                    <p className="mt-2 text-sm text-theme-muted">
                      {parsedFile.format === "Scan"
                        ? `Scanned batch | ${parsedFile.totalRows} item${
                            parsedFile.totalRows === 1 ? "" : "s"
                          }`
                        : `${parsedFile.format} file | ${parsedFile.totalRows} parsed row${
                            parsedFile.totalRows === 1 ? "" : "s"
                          } | ${parsedFile.skippedEmptyRows} empty skipped`}
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

              {/* backlog item 2: batch photo upload. Matched to rows by
                  filename === SKU only — never by list order, per the
                  founder's explicit anti-scramble rule (see
                  matchImportPhotosToRows). Optional: importing with zero
                  photos is unchanged from before this feature existed. */}
              <section className="rounded-[20px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                      Optional
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-theme-primary">
                      Add product photos
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-theme-muted">
                      Name each photo after the row&apos;s SKU — e.g.{" "}
                      <code className="rounded bg-theme-inset px-1.5 py-0.5 font-mono text-xs">
                        FP007.jpg
                      </code>{" "}
                      matches the row with SKU <code className="font-mono">FP007</code>. Matching
                      is by filename, never by upload order, so a mismatch never happens silently.
                      Photos straight off a phone match nothing — pick their row below instead of
                      renaming them.
                    </p>
                  </div>

                  {photoFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearPhotos}
                      className="shrink-0 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Clear photos
                    </button>
                  )}
                </div>

                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsPhotoDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (event.currentTarget === event.target) {
                      setIsPhotoDragging(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsPhotoDragging(false);
                    addPhotoFiles(event.dataTransfer.files);
                  }}
                  className={`mt-4 rounded-2xl border border-dashed p-4 transition ${
                    isPhotoDragging
                      ? "border-[#2563eb]/60 bg-[#2563eb]/15"
                      : "border-[#2563eb]/25 bg-theme-inset"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-4 text-center transition hover:bg-[var(--sydin-input-bg)]"
                  >
                    <UiIcon name="upload" className="h-5 w-5 text-theme-accent" />
                    <span className="text-sm font-bold text-theme-primary">
                      Drop photos here or choose from device
                    </span>
                    <span className="text-xs text-theme-subtle">
                      JPG, PNG, or WebP — {formatFileSize(MAX_IMPORT_IMAGE_SIZE)} max each
                    </span>
                  </button>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept={ALLOWED_IMPORT_IMAGE_TYPES.join(",")}
                    multiple
                    onChange={(event) => {
                      addPhotoFiles(event.target.files);
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />
                </div>

                {photoMatch && photoFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                        Matched
                      </p>
                      <p className="mt-1 text-xl font-black text-theme-primary">
                        {photoMatch.matches.length}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl border p-3 ${
                        photoMatch.unmatched.length > 0
                          ? "border-amber-300/25 bg-amber-500/10"
                          : "border-theme bg-theme-inset"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                        No SKU match
                      </p>
                      <p className="mt-1 text-xl font-black text-theme-primary">
                        {photoMatch.unmatched.length}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl border p-3 ${
                        photoMatch.duplicates.length > 0
                          ? "border-amber-300/25 bg-amber-500/10"
                          : "border-theme bg-theme-inset"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                        Duplicate SKU
                      </p>
                      <p className="mt-1 text-xl font-black text-theme-primary">
                        {photoMatch.duplicates.length}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl border p-3 ${
                        photoMatch.invalid.length > 0
                          ? "border-red-400/20 bg-red-500/10"
                          : "border-theme bg-theme-inset"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-muted">
                        Invalid file
                      </p>
                      <p className="mt-1 text-xl font-black text-theme-primary">
                        {photoMatch.invalid.length}
                      </p>
                    </div>
                  </div>
                )}

                {photoMatch && photoMatch.matches.length > 0 && (
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {photoMatch.matches.map(({ row, file }) => (
                      <li
                        key={`${row.rowNumber}-${file.name}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-xs text-theme-subtle">
                            {row.values.sku}
                          </span>{" "}
                          <span className="font-semibold text-theme-primary">
                            {row.values.name || `Row ${row.rowNumber}`}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhotoFile(file)}
                          className="shrink-0 text-xs font-bold text-theme-muted hover:text-theme-danger"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {photoMatch && photoMatch.unmatched.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-warning">
                      No row has this name — choose the row yourself
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {photoMatch.unmatched.map((file) => (
                        <li
                          key={getPhotoFileKey(file)}
                          className="flex flex-col gap-2 rounded-xl border border-amber-300/25 bg-theme-surface p-2 sm:flex-row sm:items-center"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-xs text-theme-secondary">
                            {file.name}
                          </span>
                          <div className="sm:w-64">
                            <Select
                              value=""
                              options={photoRowOptions}
                              onChange={(value) => assignPhotoToRow(file, value)}
                              ariaLabel={`Row for ${file.name}`}
                              placeholder="Pick a row"
                              searchable
                              searchPlaceholder="Search by name or SKU"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhotoFile(file)}
                            className="shrink-0 text-xs font-bold text-theme-muted hover:text-theme-danger"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {photoMatch && photoMatch.duplicates.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-warning">
                      Another file already claimed that SKU — not uploaded
                    </p>
                    <p className="mt-2 flex flex-wrap gap-2">
                      {photoMatch.duplicates.map((file) => (
                        <span
                          key={file.name}
                          className="rounded-lg border border-amber-300/25 bg-theme-surface px-2.5 py-1 font-mono text-xs text-theme-secondary"
                        >
                          {file.name}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {photoMatch && photoMatch.invalid.length > 0 && (
                  <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-danger">
                      Matched a row, but can&apos;t be uploaded
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {photoMatch.invalid.map(({ file, reason }) => (
                        <li
                          key={file.name}
                          className="font-mono text-xs text-theme-danger"
                        >
                          {file.name} — {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {photoMatch && photoMatch.rowsWithoutSku > 0 && (
                  <p className="mt-4 text-xs leading-5 text-theme-subtle">
                    {photoMatch.rowsWithoutSku === 1
                      ? "1 row has no SKU, so it can’t be matched to a photo automatically."
                      : `${photoMatch.rowsWithoutSku} rows have no SKU, so they can’t be matched to a photo automatically.`}{" "}
                    Add a SKU to the row, or add the photo from the item page after import.
                  </p>
                )}
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

      {isBatchScanOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-8 w-full max-w-3xl overflow-hidden rounded-[32px] border border-theme bg-[var(--sydin-surface-strong)] shadow-[0_30px_120px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-theme p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-success">
                  Batch add
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-theme-primary sm:text-3xl">
                  Scan items to add
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-theme-muted">
                  Keep scanning — each new code adds a row below. Close this when you&apos;re done.
                </p>
              </div>
              <button
                type="button"
                onClick={closeBatchScan}
                className="shrink-0 rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
                aria-label="Close scanner"
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <div>
                <BarcodeScannerView
                  key={batchScanRetryNonce}
                  active={isBatchScanOpen}
                  continuous
                  onDecode={handleBatchDecode}
                  onStatusChange={setBatchScanStatus}
                  readyStatus="Scan the next item."
                  className="overflow-hidden rounded-[24px] border border-[#2563eb]/20 bg-black"
                />
                <div
                  className="mt-3 rounded-2xl border border-theme bg-theme-surface px-4 py-3"
                  role="status"
                  aria-live="polite"
                >
                  {batchScanStatus.error ? (
                    <p className="text-sm font-semibold text-theme-danger">
                      {batchScanStatus.error}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-theme-secondary">
                      {batchScanStatus.starting
                        ? "Starting camera..."
                        : batchScanStatus.status || "Point the camera at a code."}
                    </p>
                  )}
                </div>
                {batchScanStatus.error && (
                  <button
                    type="button"
                    onClick={retryBatchScan}
                    className="mt-3 w-full rounded-2xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
                  >
                    Try Again
                  </button>
                )}

                {batchSkipped.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-warning">
                      Skipped — already in your inventory
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {batchSkipped.map((skip) => (
                        <li key={skip.barcode} className="text-xs text-theme-secondary">
                          {skip.name}
                          {skip.count > 1 ? ` (scanned ${skip.count}×)` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-theme-accent">
                    New items ({batchRows.length})
                  </p>
                </div>

                {batchRows.length === 0 ? (
                  <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-theme bg-theme-inset px-5 py-10 text-center">
                    <UiIcon name="scan" className="h-6 w-6 text-theme-subtle" />
                    <p className="mt-3 text-sm font-semibold text-theme-secondary">
                      Scanned items will appear here
                    </p>
                    <p className="mt-1 text-xs text-theme-subtle">
                      Each one needs a name before you can continue.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "22rem" }}>
                    {batchRows.map((row) => (
                      <div
                        key={row.id}
                        className={`rounded-2xl border p-3 ${
                          row.name.trim()
                            ? "border-theme bg-theme-inset"
                            : "border-amber-300/30 bg-amber-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs text-theme-subtle">
                            {row.barcode}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeBatchRow(row.id)}
                            className="shrink-0 text-xs font-bold text-theme-muted hover:text-theme-danger"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(event) =>
                              updateBatchRowName(row.id, event.target.value)
                            }
                            placeholder="Item name *"
                            className="min-h-10 rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50"
                          />
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.quantity}
                            onChange={(event) =>
                              updateBatchRowQuantity(row.id, Number(event.target.value))
                            }
                            className="min-h-10 rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={continueBatchToReview}
                  disabled={!canContinueBatch}
                  className="mt-4 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {batchRows.length === 0
                    ? "Scan an item to continue"
                    : canContinueBatch
                      ? `Continue to Review (${batchRows.length})`
                      : "Name every item to continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
