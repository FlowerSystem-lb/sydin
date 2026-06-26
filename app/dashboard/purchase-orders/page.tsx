"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import UiIcon from "@/components/UiIcon";
import { Button, DialogShell, Select } from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  formatInventoryPrice,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { exportPurchaseOrderPdf } from "@/app/lib/purchaseOrderPdfExport";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

type WorkflowStep = "details" | "lines" | "review" | "output";
type PurchaseOrderStatus = "draft" | "ready" | "sent";

interface PurchaseOrderInventoryItem {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  min_stock_level?: number | null;
  supplier_id?: number | null;
}

interface PurchaseOrderDetails {
  title: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  notes: string;
  internalReference: string;
}

interface PurchaseOrderLine {
  id: string;
  source: "inventory" | "low-stock" | "selected" | "custom";
  inventoryItemId: number | null;
  name: string;
  image: string;
  sku: string;
  itemCode: string;
  supplierId: number | null;
  supplierName: string;
  availableQuantity: number | null;
  minStockLevel: number | null;
  suggestedQuantity: number | null;
  unitLabel: string;
  orderQuantity: string;
  unitCost: string;
  note: string;
}

interface DraftPayload {
  step: WorkflowStep;
  details: PurchaseOrderDetails;
  lines: PurchaseOrderLine[];
  savedAt: string;
}

const DRAFT_STORAGE_KEY = "sydin:purchase-order-draft";
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  {
    value: "ready",
    label: "Ready to send",
    disabled: true,
  },
  {
    value: "sent",
    label: "Sent",
    disabled: true,
  },
];
const inputClassName =
  "min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15 disabled:opacity-60";
const textareaClassName = `${inputClassName} min-h-24 resize-y py-3`;

function generatePoTitle() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `PO-${year}${month}${day}`;
}

function makeDefaultDetails(title = generatePoTitle()): PurchaseOrderDetails {
  return {
    title,
    supplierId: "",
    supplierName: "",
    supplierEmail: "",
    expectedDeliveryDate: "",
    status: "draft",
    notes: "",
    internalReference: "",
  };
}

function makeLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseNonNegativeNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseWholeQuantity(value: string) {
  const parsed = parseNonNegativeNumber(value);
  if (parsed === null) return null;

  return Number.isInteger(parsed) ? parsed : null;
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

function formatMoney(value: number | null, currencyCode: string) {
  return value === null
    ? "Not set"
    : formatInventoryPrice(value, currencyCode) || "Not set";
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getLineNumbers(line: PurchaseOrderLine) {
  const quantity = parseWholeQuantity(line.orderQuantity);
  const unitCost = parseNonNegativeNumber(line.unitCost);
  const lineTotal =
    quantity !== null && unitCost !== null
      ? Math.round(quantity * unitCost * 100) / 100
      : null;

  return { quantity, unitCost, lineTotal };
}

function makeLineFromItem(
  item: PurchaseOrderInventoryItem,
  source: PurchaseOrderLine["source"],
  supplierName: string
): PurchaseOrderLine {
  const unitLabel = getInventoryUnitLabel(item.unit_type, item.custom_unit_label);
  const minStock =
    typeof item.min_stock_level === "number" && item.min_stock_level >= 0
      ? item.min_stock_level
      : null;
  const suggestedQuantity =
    minStock !== null ? Math.max(0, minStock - Number(item.quantity || 0)) : null;

  return {
    id: makeLineId(),
    source,
    inventoryItemId: item.id,
    name: item.name,
    image: item.image || "",
    sku: item.sku || "",
    itemCode: item.item_code || "",
    supplierId: item.supplier_id ?? null,
    supplierName,
    availableQuantity: Number(item.quantity || 0),
    minStockLevel: minStock,
    suggestedQuantity,
    unitLabel,
    orderQuantity:
      source === "low-stock" && suggestedQuantity !== null
        ? String(suggestedQuantity)
        : "1",
    unitCost: item.cost_price === null || item.cost_price === undefined ? "" : String(item.cost_price),
    note:
      source === "selected"
        ? "Added from Inventory selection. Review quantity and cost."
        : "",
  };
}

export default function PurchaseOrdersPage() {
  const [initialTitle, setInitialTitle] = useState(generatePoTitle);
  const [step, setStep] = useState<WorkflowStep>("details");
  const [details, setDetails] = useState<PurchaseOrderDetails>(() =>
    makeDefaultDetails(initialTitle)
  );
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [inventoryItems, setInventoryItems] = useState<PurchaseOrderInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [lineError, setLineError] = useState("");
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [confirmClearDraft, setConfirmClearDraft] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const handoffAppliedRef = useRef(false);

  const currencyCode = normalizeCurrencyCode(
    businessSettings.currency_code,
    "USD"
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );
  const supplierNameById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers]
  );
  const inventoryItemById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems]
  );
  const orderedLines = useMemo(
    () =>
      lines.filter((line) => {
        const { quantity } = getLineNumbers(line);
        return quantity !== null && quantity > 0;
      }),
    [lines]
  );
  const lineDetails = useMemo(
    () =>
      lines.map((line) => ({
        line,
        ...getLineNumbers(line),
      })),
    [lines]
  );
  const orderedLineDetails = lineDetails.filter(
    ({ quantity }) => quantity !== null && quantity > 0
  );
  const invalidQuantityCount = lineDetails.filter(
    ({ line, quantity }) => line.orderQuantity.trim() !== "" && quantity === null
  ).length;
  const invalidCostCount = lineDetails.filter(
    ({ line, unitCost }) => line.unitCost.trim() !== "" && unitCost === null
  ).length;
  const zeroQuantityCount = lineDetails.filter(
    ({ line, quantity }) => line.orderQuantity.trim() !== "" && quantity === 0
  ).length;
  const missingPriceCount = orderedLineDetails.filter(
    ({ unitCost }) => unitCost === null
  ).length;
  const blankNameCount = orderedLineDetails.filter(
    ({ line }) => !line.name.trim()
  ).length;
  const subtotal = orderedLineDetails.reduce(
    (total, detail) => total + Number(detail.lineTotal || 0),
    0
  );
  const orderedQuantityTotal = orderedLineDetails.reduce(
    (total, detail) => total + Number(detail.quantity || 0),
    0
  );
  const lowStockCandidates = inventoryItems.filter(
    (item) =>
      typeof item.min_stock_level === "number" &&
      item.min_stock_level >= 0 &&
      Number(item.quantity || 0) <= item.min_stock_level
  );
  const hasDraft =
    lines.length > 0 ||
    details.title !== initialTitle ||
    details.supplierName.trim() !== "" ||
    details.supplierEmail.trim() !== "" ||
    details.expectedDeliveryDate !== "" ||
    details.notes.trim() !== "" ||
    details.internalReference.trim() !== "";
  const canOutput =
    orderedLines.length > 0 &&
    invalidQuantityCount === 0 &&
    invalidCostCount === 0 &&
    blankNameCount === 0;

  useEffect(() => {
    let active = true;

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again to create purchase orders.");

      const [
        { data: inventoryRows, error: inventoryError },
        loadedSuppliers,
        settings,
      ] = await Promise.all([
        supabase
          .from("inventory")
          .select(
            "id, name, category, quantity, image, sku, item_code, unit_type, custom_unit_label, cost_price, min_stock_level, supplier_id"
          )
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        getSuppliersForUser(user.id).catch(() => []),
        getOrCreateBusinessSettings(user.id),
      ]);

      if (inventoryError) throw inventoryError;
      if (!active) return;

      setInventoryItems((inventoryRows || []) as PurchaseOrderInventoryItem[]);
      setSuppliers(loadedSuppliers);
      setBusinessSettings(settings);
      setLoading(false);
    }

    loadData().catch((error) => {
      if (!active) return;
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load purchase order data."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let frame = 0;

    try {
      const rawDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft) as Partial<DraftPayload>;
      if (!parsed.details && !parsed.lines?.length) return;

      frame = window.requestAnimationFrame(() => {
        if (parsed.details) {
          setDetails({
            ...makeDefaultDetails(initialTitle),
            ...parsed.details,
            status: "draft",
          });
        }
        if (Array.isArray(parsed.lines)) {
          setLines(
            parsed.lines.map((line) => ({
              ...line,
              id: line.id || makeLineId(),
            }))
          );
        }
        if (
          parsed.step === "details" ||
          parsed.step === "lines" ||
          parsed.step === "review" ||
          parsed.step === "output"
        ) {
          setStep(parsed.step);
        }
        setDraftRestored(true);
        setNotice("Restored a purchase order draft saved on this device.");
      });
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [initialTitle, loading]);

  useEffect(() => {
    if (loading || handoffAppliedRef.current || inventoryItems.length === 0) {
      return;
    }

    const requestedIds = new URLSearchParams(window.location.search)
      .get("items")
      ?.split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!requestedIds?.length) {
      handoffAppliedRef.current = true;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setLines((current) => {
        const existingIds = new Set(
          current
            .map((line) => line.inventoryItemId)
            .filter((id): id is number => typeof id === "number")
        );
        const handoffLines = requestedIds
          .filter((id) => !existingIds.has(id))
          .map((id) => inventoryItemById.get(id))
          .filter((item): item is PurchaseOrderInventoryItem => Boolean(item))
          .map((item) =>
            makeLineFromItem(
              item,
              "selected",
              item.supplier_id
                ? supplierNameById.get(item.supplier_id) || ""
                : ""
            )
          );

        if (handoffLines.length === 0) return current;
        setStep("lines");
        setNotice(
          `Added ${handoffLines.length} selected Inventory item${
            handoffLines.length === 1 ? "" : "s"
          } to this purchase order draft.`
        );
        return [...current, ...handoffLines];
      });
    });
    handoffAppliedRef.current = true;

    return () => window.cancelAnimationFrame(frame);
  }, [
    inventoryItemById,
    inventoryItems.length,
    loading,
    supplierNameById,
  ]);

  useEffect(() => {
    if (loading || !hasDraft) return;

    try {
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          step,
          details: { ...details, status: "draft" },
          lines,
          savedAt: new Date().toISOString(),
        } satisfies DraftPayload)
      );
    } catch {
      // Browser draft recovery is best effort only.
    }
  }, [details, hasDraft, lines, loading, step]);

  useEffect(() => {
    if (!hasDraft) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraft]);

  const updateDetails = (field: keyof PurchaseOrderDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [field]: field === "status" ? "draft" : value,
    }));
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = supplierId ? supplierById.get(Number(supplierId)) : null;

    setDetails((current) => ({
      ...current,
      supplierId,
      supplierName: supplier?.name || current.supplierName,
      supplierEmail: supplier?.email || current.supplierEmail,
    }));
  };

  const addInventoryLine = () => {
    setLineError("");
    const itemId = Number(selectedInventoryItemId);
    const item = inventoryItemById.get(itemId);

    if (!item) {
      setLineError("Choose an inventory item before adding a line.");
      return;
    }

    setLines((current) => {
      if (current.some((line) => line.inventoryItemId === item.id)) {
        setLineError("That inventory item is already on this purchase order.");
        return current;
      }

      return [
        ...current,
        makeLineFromItem(
          item,
          "inventory",
          item.supplier_id ? supplierNameById.get(item.supplier_id) || "" : ""
        ),
      ];
    });
    setSelectedInventoryItemId("");
  };

  const addLowStockItems = () => {
    setLineError("");

    setLines((current) => {
      const existingIds = new Set(
        current
          .map((line) => line.inventoryItemId)
          .filter((id): id is number => typeof id === "number")
      );
      const additions = lowStockCandidates
        .filter((item) => !existingIds.has(item.id))
        .map((item) =>
          makeLineFromItem(
            item,
            "low-stock",
            item.supplier_id ? supplierNameById.get(item.supplier_id) || "" : ""
          )
        );

      if (additions.length === 0) {
        setLineError("No new low-stock items with minimum stock levels to add.");
        return current;
      }

      setNotice(
        `Added ${additions.length} low-stock item${
          additions.length === 1 ? "" : "s"
        } with minimum stock suggestions.`
      );
      return [...current, ...additions];
    });
  };

  const addCustomLine = () => {
    setLineError("");
    setLines((current) => [
      ...current,
      {
        id: makeLineId(),
        source: "custom",
        inventoryItemId: null,
        name: "",
        image: "",
        sku: "",
        itemCode: "",
        supplierId: null,
        supplierName: details.supplierName,
        availableQuantity: null,
        minStockLevel: null,
        suggestedQuantity: null,
        unitLabel: "Unit",
        orderQuantity: "1",
        unitCost: "",
        note: "",
      },
    ]);
  };

  const updateLine = (
    lineId: string,
    update: Partial<PurchaseOrderLine>
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...update,
            }
          : line
      )
    );
  };

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((line) => line.id !== lineId));
  };

  const restartDraft = () => {
    const nextTitle = generatePoTitle();
    setInitialTitle(nextTitle);
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setDetails(makeDefaultDetails(nextTitle));
    setLines([]);
    setStep("details");
    setLineError("");
    setNotice("Purchase order draft cleared.");
    setDraftRestored(false);
    setConfirmClearDraft(false);
  };

  const goToReview = () => {
    if (invalidQuantityCount > 0 || invalidCostCount > 0 || blankNameCount > 0) {
      setLineError("Fix invalid quantities, costs, or blank line names before review.");
      setStep("lines");
      return;
    }

    setLineError("");
    setStep("review");
  };

  const exportCsv = () => {
    if (!canOutput) return;

    const headers = [
      "Item",
      "Code",
      "SKU",
      "Unit",
      "Order Quantity",
      "Estimated Unit Cost",
      "Line Total",
      "Notes",
    ];
    const rows = orderedLineDetails.map(({ line, quantity, unitCost, lineTotal }) => [
      line.name || "Custom line",
      line.itemCode,
      line.sku,
      line.unitLabel,
      quantity ?? "",
      unitCost ?? "",
      lineTotal ?? "",
      line.note,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileTitle = details.title.trim() || "purchase-order";

    link.href = downloadUrl;
    link.download = `${fileTitle.replace(/[^a-z0-9]+/gi, "-")}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setNotice("Purchase order CSV exported.");
  };

  const exportPdf = async () => {
    if (!canOutput || exportingPdf) return;

    try {
      setExportingPdf(true);
      const filename = await exportPurchaseOrderPdf({
        details: {
          title: details.title,
          supplierName: details.supplierName,
          supplierEmail: details.supplierEmail,
          expectedDeliveryDate: details.expectedDeliveryDate,
          status: "Draft",
          notes: details.notes,
          internalReference: details.internalReference,
        },
        lines: orderedLineDetails.map(({ line, quantity, unitCost, lineTotal }) => ({
          name: line.name || "Custom line",
          code: line.itemCode,
          sku: line.sku,
          unit: line.unitLabel,
          orderQuantity: quantity || 0,
          unitCost,
          lineTotal,
          note: line.note,
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          contactEmail: businessSettings.show_contact_publicly
            ? businessSettings.contact_email
            : "",
          contactPhone: businessSettings.show_contact_publicly
            ? businessSettings.contact_phone
            : "",
          contactWebsite: businessSettings.show_contact_publicly
            ? businessSettings.contact_website
            : "",
        },
        currencyCode,
      });

      setNotice(`${filename} exported.`);
    } catch {
      setNotice("");
      setLineError("We could not export the purchase order PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const printPurchaseOrder = () => {
    if (!canOutput) return;
    window.print();
  };

  const stepItems: Array<{ id: WorkflowStep; label: string }> = [
    { id: "details", label: "Details" },
    { id: "lines", label: "Lines" },
    { id: "review", label: "Review" },
    { id: "output", label: "Output" },
  ];

  const warnings = [
    !details.supplierName.trim() ? "Missing supplier name." : "",
    details.supplierName.trim() && !details.supplierEmail.trim()
      ? "Missing supplier email/contact."
      : "",
    lines.length === 0 ? "No order lines added." : "",
    zeroQuantityCount > 0
      ? `${zeroQuantityCount} zero-quantity line${
          zeroQuantityCount === 1 ? " is" : "s are"
        } excluded from output.`
      : "",
    missingPriceCount > 0
      ? `${missingPriceCount} ordered line${
          missingPriceCount === 1 ? " is" : "s are"
        } missing estimated unit cost.`
      : "",
    invalidQuantityCount > 0
      ? `${invalidQuantityCount} line${
          invalidQuantityCount === 1 ? " has" : "s have"
        } invalid quantity.`
      : "",
    invalidCostCount > 0
      ? `${invalidCostCount} line${
          invalidCostCount === 1 ? " has" : "s have"
        } invalid cost.`
      : "",
    blankNameCount > 0
      ? `${blankNameCount} ordered custom line${
          blankNameCount === 1 ? " needs" : "s need"
        } a name.`
      : "",
  ].filter(Boolean);

  return (
    <main className="operations-workspace operations-purchase-orders">
      <div className="po-screen-only mx-auto flex w-full max-w-[1500px] flex-col gap-4 pb-28 sm:pb-0">
        <section className="rounded-[24px] border border-theme bg-theme-surface p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                Operations
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
                Purchase Orders
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-theme-muted">
                Create supplier order drafts from inventory items or custom
                lines, then print or export them. Purchase orders do not change
                stock.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setConfirmClearDraft(true)}>
                Restart
              </Button>
              <Button onClick={() => setStep("output")} disabled={!canOutput}>
                Output
              </Button>
            </div>
          </div>
        </section>

        {(notice || loadError) && (
          <p
            role={loadError ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              loadError
                ? "border-red-400/30 bg-red-500/10 text-theme-danger"
                : "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
            }`}
          >
            {loadError || notice}
          </p>
        )}

        <section className="rounded-[20px] border border-theme bg-theme-surface p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="operations-step-strip grid gap-2 sm:grid-cols-4" aria-label="Purchase order steps">
            {stepItems.map((item, index) => {
              const active = step === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-sm font-black transition ${
                    active
                      ? "border-cyan-300/35 bg-cyan-400/15 text-theme-accent"
                      : "border-theme bg-theme-inset text-theme-secondary hover:bg-theme-hover"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-current text-xs">
                    {index + 1}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold leading-6 text-theme-accent">
          Draft saved on this device. Export before closing. Stock changes only
          through Receiving or Stock Movements.
        </section>

        {draftRestored && (
          <section className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-theme-accent">
            Device draft restored. Export it, clear it, or restart when you are
            finished.
          </section>
        )}

        {loading ? (
          <section className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4">
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-16 animate-pulse rounded-xl bg-theme-inset" />
            ))}
          </section>
        ) : step === "details" ? (
          <section className="grid gap-4 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:grid-cols-[1.3fr_0.7fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold text-theme-primary sm:col-span-2">
                PO number or title
                <input
                  value={details.title}
                  onChange={(event) => updateDetails("title", event.target.value)}
                  className={inputClassName}
                  placeholder="PO-20260622"
                />
              </label>
              <Select
                label="Saved supplier"
                value={details.supplierId}
                onChange={handleSupplierChange}
                searchable={suppliers.length > 8}
                clearable
                clearLabel="Use free text supplier"
                options={[
                  { value: "", label: "Free text supplier" },
                  ...suppliers.map((supplier) => ({
                    value: String(supplier.id),
                    label: supplier.name,
                    description: [supplier.contact_name, supplier.email]
                      .filter(Boolean)
                      .join(" | "),
                  })),
                ]}
              />
              <label className="grid gap-1 text-sm font-bold text-theme-primary">
                Supplier name
                <input
                  value={details.supplierName}
                  onChange={(event) =>
                    updateDetails("supplierName", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Supplier or vendor"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-theme-primary">
                Supplier email or contact
                <input
                  value={details.supplierEmail}
                  onChange={(event) =>
                    updateDetails("supplierEmail", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Optional"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-theme-primary">
                Expected delivery date
                <input
                  type="date"
                  value={details.expectedDeliveryDate}
                  onChange={(event) =>
                    updateDetails("expectedDeliveryDate", event.target.value)
                  }
                  className={inputClassName}
                />
              </label>
              <Select
                label="Status"
                value={details.status}
                onChange={(value) => updateDetails("status", value)}
                options={STATUS_OPTIONS}
                description="Ready and sent are draft labels for this order."
              />
              <label className="grid gap-1 text-sm font-bold text-theme-primary">
                Internal reference
                <input
                  value={details.internalReference}
                  onChange={(event) =>
                    updateDetails("internalReference", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Optional"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-theme-primary sm:col-span-2">
                Notes
                <textarea
                  value={details.notes}
                  onChange={(event) => updateDetails("notes", event.target.value)}
                  className={textareaClassName}
                  placeholder="Optional supplier instructions"
                />
              </label>
            </div>

            <aside className="rounded-2xl border border-theme bg-theme-inset p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-subtle">
                Supplier data
              </p>
              {suppliers.length > 0 ? (
                <div className="mt-3 grid gap-2 text-sm text-theme-secondary">
                  <p>
                    {suppliers.length} saved supplier
                    {suppliers.length === 1 ? "" : "s"} available.
                  </p>
                  <p>
                    Item supplier names are copied into lines when inventory
                    items have a supplier assignment.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-theme-muted">
                  No saved suppliers yet. Enter supplier details manually.
                </p>
              )}
              <div className="mt-4 rounded-xl border border-theme bg-theme-surface p-3 text-xs font-semibold leading-5 text-theme-secondary">
                Create and export this purchase order draft when it is ready.
              </div>
            </aside>
          </section>
        ) : step === "lines" ? (
          <>
            <section className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
              <Select
                label="Inventory item"
                value={selectedInventoryItemId}
                onChange={setSelectedInventoryItemId}
                searchable
                searchPlaceholder="Search inventory items"
                options={inventoryItems.map((item) => ({
                  value: String(item.id),
                  label: item.name,
                  description: [item.item_code || item.sku, item.category]
                    .filter(Boolean)
                    .join(" | "),
                }))}
                placeholder={
                  inventoryItems.length ? "Choose item" : "No inventory items"
                }
                disabled={inventoryItems.length === 0}
              />
              <Button onClick={addInventoryLine} disabled={!selectedInventoryItemId}>
                Add Item
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                <Button
                  variant="secondary"
                  onClick={addLowStockItems}
                  disabled={lowStockCandidates.length === 0}
                >
                  Add Low Stock
                </Button>
                <Button variant="secondary" onClick={addCustomLine}>
                  Custom Line
                </Button>
              </div>
            </section>

            {lineError && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger"
              >
                {lineError}
              </p>
            )}

            <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <div className="border-b border-theme p-4">
                <h2 className="text-xl font-black text-theme-primary">
                  Order Lines
                </h2>
                <p className="mt-1 text-sm text-theme-muted">
                  Zero quantity rows stay in the draft and are excluded from
                  print, PDF, and CSV output.
                </p>
              </div>

              {lines.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                      <thead className="border-b border-theme bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                        <tr>
                          <th className="w-[260px] px-4 py-3">Item</th>
                          <th className="w-[160px] px-4 py-3">Supplier</th>
                          <th className="w-[110px] px-4 py-3 text-right">Available</th>
                          <th className="w-[110px] px-4 py-3 text-right">Minimum</th>
                          <th className="w-[120px] px-4 py-3 text-right">Suggested</th>
                          <th className="w-[130px] px-4 py-3 text-right">Order qty</th>
                          <th className="w-[130px] px-4 py-3 text-right">Unit cost</th>
                          <th className="w-[120px] px-4 py-3 text-right">Total</th>
                          <th className="w-[210px] px-4 py-3">Note</th>
                          <th className="w-[72px] px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-divider)]">
                        {lineDetails.map(({ line, quantity, unitCost, lineTotal }) => (
                          <tr key={line.id} className="align-top">
                            <td className="px-4 py-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-theme bg-theme-inset">
                                  {line.image ? (
                                    <Image
                                      src={line.image}
                                      alt=""
                                      fill
                                      sizes="48px"
                                      className="object-contain p-1"
                                    />
                                  ) : (
                                    <span className="flex h-full items-center justify-center text-theme-subtle">
                                      <UiIcon name="box" className="h-5 w-5" />
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  {line.source === "custom" ? (
                                    <input
                                      value={line.name}
                                      onChange={(event) =>
                                        updateLine(line.id, {
                                          name: event.target.value,
                                        })
                                      }
                                      aria-label="Custom line name"
                                      className={inputClassName}
                                      placeholder="Custom line name"
                                    />
                                  ) : (
                                    <p className="font-black text-theme-primary">
                                      {line.name}
                                    </p>
                                  )}
                                  <p className="mt-1 text-xs text-theme-muted">
                                    {[line.itemCode, line.sku ? `SKU ${line.sku}` : "", line.unitLabel]
                                      .filter(Boolean)
                                      .join(" | ")}
                                  </p>
                                  {line.source === "custom" && (
                                    <input
                                      value={line.unitLabel}
                                      onChange={(event) =>
                                        updateLine(line.id, {
                                          unitLabel: event.target.value,
                                        })
                                      }
                                      aria-label="Custom line unit"
                                      className={`${inputClassName} mt-2`}
                                      placeholder="Unit"
                                    />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-theme-secondary">
                              {line.supplierName || "Not assigned"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {line.availableQuantity ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {line.minStockLevel ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {line.suggestedQuantity ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={line.orderQuantity}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  updateLine(line.id, {
                                    orderQuantity: event.target.value,
                                  })
                                }
                                aria-label={`Order quantity for ${line.name || "custom line"}`}
                                className={`${inputClassName} text-right ${
                                  line.orderQuantity.trim() !== "" &&
                                  quantity === null
                                    ? "border-red-400/50 bg-red-500/10"
                                    : ""
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={line.unitCost}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  updateLine(line.id, {
                                    unitCost: event.target.value,
                                  })
                                }
                                aria-label={`Estimated unit cost for ${line.name || "custom line"}`}
                                className={`${inputClassName} text-right ${
                                  line.unitCost.trim() !== "" && unitCost === null
                                    ? "border-red-400/50 bg-red-500/10"
                                    : ""
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-black text-theme-primary">
                              {formatMoney(lineTotal, currencyCode)}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={line.note}
                                onChange={(event) =>
                                  updateLine(line.id, { note: event.target.value })
                                }
                                aria-label={`Line note for ${line.name || "custom line"}`}
                                className={inputClassName}
                                placeholder="Optional"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                aria-label={`Remove ${line.name || "custom line"}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10 text-theme-danger transition hover:bg-red-500/20"
                              >
                                <UiIcon name="trash" className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 p-3 md:hidden">
                    {lineDetails.map(({ line, quantity, unitCost, lineTotal }) => (
                      <article
                        key={line.id}
                        className="rounded-2xl border border-theme bg-theme-inset p-3"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-theme bg-theme-surface">
                            {line.image ? (
                              <Image
                                src={line.image}
                                alt=""
                                fill
                                sizes="56px"
                                className="object-contain p-1"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center text-theme-subtle">
                                <UiIcon name="box" className="h-5 w-5" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            {line.source === "custom" ? (
                              <input
                                value={line.name}
                                onChange={(event) =>
                                  updateLine(line.id, { name: event.target.value })
                                }
                                aria-label="Custom line name"
                                className={inputClassName}
                                placeholder="Custom line name"
                              />
                            ) : (
                              <p className="font-black text-theme-primary">
                                {line.name}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-theme-muted">
                              {[line.itemCode, line.sku ? `SKU ${line.sku}` : "", line.unitLabel]
                                .filter(Boolean)
                                .join(" | ")}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Available
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {line.availableQuantity ?? "-"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Min
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {line.minStockLevel ?? "-"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Suggest
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {line.suggestedQuantity ?? "-"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {line.source === "custom" && (
                            <label className="grid gap-1 text-sm font-bold text-theme-primary">
                              Unit
                              <input
                                value={line.unitLabel}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    unitLabel: event.target.value,
                                  })
                                }
                                className={inputClassName}
                              />
                            </label>
                          )}
                          <label className="grid gap-1 text-sm font-bold text-theme-primary">
                            Order quantity
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={line.orderQuantity}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  orderQuantity: event.target.value,
                                })
                              }
                              className={`${inputClassName} ${
                                line.orderQuantity.trim() !== "" &&
                                quantity === null
                                  ? "border-red-400/50 bg-red-500/10"
                                  : ""
                              }`}
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-bold text-theme-primary">
                            Estimated unit cost
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={line.unitCost}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  unitCost: event.target.value,
                                })
                              }
                              className={`${inputClassName} ${
                                line.unitCost.trim() !== "" && unitCost === null
                                  ? "border-red-400/50 bg-red-500/10"
                                  : ""
                              }`}
                            />
                          </label>
                          <label className="grid gap-1 text-sm font-bold text-theme-primary sm:col-span-2">
                            Line note
                            <input
                              value={line.note}
                              onChange={(event) =>
                                updateLine(line.id, { note: event.target.value })
                              }
                              className={inputClassName}
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-theme-primary">
                            Total {formatMoney(lineTotal, currencyCode)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 text-sm font-bold text-theme-danger"
                          >
                            <UiIcon name="trash" className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-5 py-12 text-center">
                  <UiIcon
                    name="file"
                    className="mx-auto h-8 w-8 text-theme-accent"
                  />
                  <h2 className="mt-4 text-xl font-bold text-theme-primary">
                    No purchase order lines
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    Start by adding inventory items or a custom line.
                  </p>
                  <div className="mx-auto mt-5 flex max-w-md flex-col justify-center gap-2 sm:flex-row">
                    <Button onClick={addInventoryLine} disabled={!selectedInventoryItemId}>
                      Add Item
                    </Button>
                    <Button variant="secondary" onClick={addCustomLine}>
                      Add Custom Line
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={addLowStockItems}
                      disabled={lowStockCandidates.length === 0}
                    >
                      Add Low Stock
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : step === "review" ? (
          <section className="grid gap-4">
            <div className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Supplier", details.supplierName || "Missing"],
                ["PO", details.title || "Untitled"],
                ["Ordered lines", orderedLines.length],
                ["Ordered quantity", orderedQuantityTotal],
                ["Subtotal", formatMoney(subtotal, currencyCode)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-theme bg-theme-inset px-3 py-2"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-lg font-black text-theme-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="sr-only" aria-live="polite">
              Purchase order review: {orderedLines.length} ordered lines,
              quantity {orderedQuantityTotal}, subtotal{" "}
              {formatMoney(subtotal, currencyCode)}.
            </div>

            {warnings.length > 0 ? (
              <section className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-theme-warning">
                <p className="font-black">Review warnings</p>
                <ul className="mt-2 grid gap-1">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            ) : (
              <section className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-semibold text-theme-success">
                Purchase order is ready to print or export.
              </section>
            )}

            <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                  <thead className="border-b border-theme bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Unit cost</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {lineDetails.map(({ line, quantity, unitCost, lineTotal }) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3">
                          <p className="font-black text-theme-primary">
                            {line.name || "Unnamed custom line"}
                          </p>
                          <p className="text-xs text-theme-muted">
                            {[line.itemCode, line.sku ? `SKU ${line.sku}` : ""]
                              .filter(Boolean)
                              .join(" | ") || "Custom"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                          {quantity ?? "Invalid"}
                        </td>
                        <td className="px-4 py-3 text-theme-secondary">
                          {line.unitLabel}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                          {formatMoney(unitCost, currencyCode)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-theme-primary">
                          {formatMoney(lineTotal, currencyCode)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-black ${
                              quantity && quantity > 0
                                ? "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
                                : "border-amber-300/30 bg-amber-500/10 text-theme-warning"
                            }`}
                          >
                            {quantity && quantity > 0 ? "Included" : "Draft only"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 p-3 md:hidden">
                {lineDetails.map(({ line, quantity, unitCost, lineTotal }) => (
                  <article
                    key={line.id}
                    className="rounded-2xl border border-theme bg-theme-inset p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-theme-primary">
                          {line.name || "Unnamed custom line"}
                        </h3>
                        <p className="mt-1 truncate text-xs text-theme-muted">
                          {[line.itemCode, line.sku ? `SKU ${line.sku}` : ""]
                            .filter(Boolean)
                            .join(" | ") || "Custom"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${
                          quantity && quantity > 0
                            ? "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
                            : "border-amber-300/30 bg-amber-500/10 text-theme-warning"
                        }`}
                      >
                        {quantity && quantity > 0 ? "Included" : "Draft only"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                          Qty
                        </p>
                        <p className="mt-1 font-black text-theme-primary">
                          {quantity ?? "Invalid"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                          Unit
                        </p>
                        <p className="mt-1 truncate font-black text-theme-primary">
                          {line.unitLabel}
                        </p>
                      </div>
                      <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                        <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                          Total
                        </p>
                        <p className="mt-1 truncate font-black text-theme-primary">
                          {formatMoney(lineTotal, currencyCode)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-theme-muted">
                      Unit cost {formatMoney(unitCost, currencyCode)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-theme-primary">
                    Output Purchase Order
                  </h2>
                  <p className="mt-1 text-sm text-theme-muted">
                    Print, PDF, and CSV include only positive-quantity lines.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-theme-accent">
                  Draft
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Button onClick={printPurchaseOrder} disabled={!canOutput}>
                  Print PO
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void exportPdf()}
                  disabled={!canOutput || exportingPdf}
                  loading={exportingPdf}
                  loadingLabel="Exporting..."
                >
                  Export PDF
                </Button>
                <Button variant="secondary" onClick={exportCsv} disabled={!canOutput}>
                  Export CSV
                </Button>
              </div>

              {!canOutput && (
                <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                  Add at least one positive-quantity line and fix invalid rows
                  before output.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-theme bg-theme-inset p-4 text-sm font-semibold leading-6 text-theme-secondary">
                This draft stays on this device. Export before closing. Receive
                stock separately when it arrives.
              </div>
            </div>

            <aside className="rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-theme-subtle">
                Output summary
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-theme-muted">Supplier</span>
                  <span className="font-black text-theme-primary">
                    {details.supplierName || "Missing"}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-theme-muted">Expected</span>
                  <span className="font-black text-theme-primary">
                    {formatDate(details.expectedDeliveryDate)}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-theme-muted">Lines</span>
                  <span className="font-black text-theme-primary">
                    {orderedLines.length}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-theme-muted">Subtotal</span>
                  <span className="font-black text-theme-primary">
                    {formatMoney(subtotal, currencyCode)}
                  </span>
                </p>
              </div>
            </aside>
          </section>
        )}

        <section className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-cyan-300/25 bg-theme-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:bottom-auto sm:top-2 sm:shadow-[0_14px_36px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-theme-secondary sm:flex sm:text-left">
              <span className="rounded-xl bg-cyan-500/10 px-3 py-2 text-theme-accent">
                {orderedLines.length} ordered
              </span>
              <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                Qty {orderedQuantityTotal}
              </span>
              <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                {formatMoney(subtotal, currencyCode)}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {step !== "details" && (
                <Button variant="secondary" onClick={() => setStep("details")}>
                  Details
                </Button>
              )}
              {step !== "lines" && (
                <Button variant="secondary" onClick={() => setStep("lines")}>
                  Lines
                </Button>
              )}
              {step === "lines" ? (
                <Button onClick={goToReview}>Review</Button>
              ) : step === "review" ? (
                <Button onClick={() => setStep("output")} disabled={!canOutput}>
                  Output
                </Button>
              ) : step === "output" ? (
                <Button onClick={printPurchaseOrder} disabled={!canOutput}>
                  Print
                </Button>
              ) : (
                <Button onClick={() => setStep("lines")}>Continue</Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <section id="po-print-area" className="po-print-area">
        <header className="po-print-header">
          <div>
            <p>{businessSettings.business_name || "SydIN Account"}</p>
            <h1>Purchase Order</h1>
          </div>
          <div>
            <p>{details.title || "Untitled purchase order"}</p>
            <p>Generated {new Date().toLocaleString()}</p>
            <p>Status Draft</p>
          </div>
        </header>
        <section className="po-print-summary">
          <div>
            <h2>Supplier</h2>
            <p>{details.supplierName || "Supplier not set"}</p>
            {details.supplierEmail && <p>{details.supplierEmail}</p>}
          </div>
          <div>
            <h2>Details</h2>
            <p>Expected delivery: {formatDate(details.expectedDeliveryDate)}</p>
            <p>Reference: {details.internalReference || "Not set"}</p>
          </div>
          <div>
            <h2>Summary</h2>
            <p>Lines: {orderedLines.length}</p>
            <p>Total quantity: {orderedQuantityTotal}</p>
            <p>Estimated subtotal: {formatMoney(subtotal, currencyCode)}</p>
          </div>
        </section>
        <table className="po-print-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Code/SKU</th>
              <th>Unit</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Line total</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {orderedLineDetails.map(({ line, quantity, unitCost, lineTotal }) => (
              <tr key={line.id}>
                <td>{line.name || "Custom line"}</td>
                <td>{[line.itemCode, line.sku].filter(Boolean).join(" / ")}</td>
                <td>{line.unitLabel}</td>
                <td>{quantity}</td>
                <td>{formatMoney(unitCost, currencyCode)}</td>
                <td>{formatMoney(lineTotal, currencyCode)}</td>
                <td>{line.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {details.notes && (
          <section className="po-print-notes">
            <h2>Notes</h2>
            <p>{details.notes}</p>
          </section>
        )}
        <footer className="po-print-footer">
          Generated by SydIN
        </footer>
      </section>

      {confirmClearDraft && (
        <DialogShell
          title="Clear purchase order draft?"
          eyebrow="Device draft"
          description="This clears the draft saved on this device. Inventory quantities and stock movements are not affected."
          tone="danger"
          onClose={() => setConfirmClearDraft(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmClearDraft(false)}
              >
                Keep draft
              </Button>
              <Button variant="danger" onClick={restartDraft}>
                Clear draft
              </Button>
            </>
          }
        />
      )}

      <style jsx global>{`
        .po-print-area {
          display: none;
        }

        @media print {
          body * {
            visibility: hidden;
          }

          .po-screen-only {
            display: none !important;
          }

          .po-print-area,
          .po-print-area * {
            visibility: visible;
          }

          .po-print-area {
            display: block;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            padding: 22mm 16mm;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 11px;
          }

          .po-print-header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
          }

          .po-print-header h1 {
            margin: 4px 0 0;
            font-size: 28px;
          }

          .po-print-header p,
          .po-print-summary p,
          .po-print-footer {
            margin: 0;
          }

          .po-print-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-top: 18px;
          }

          .po-print-summary h2,
          .po-print-notes h2 {
            margin: 0 0 6px;
            font-size: 12px;
            text-transform: uppercase;
          }

          .po-print-table {
            width: 100%;
            margin-top: 18px;
            border-collapse: collapse;
          }

          .po-print-table th,
          .po-print-table td {
            border: 1px solid #cbd5e1;
            padding: 6px;
            text-align: left;
            vertical-align: top;
          }

          .po-print-table th {
            background: #0f172a;
            color: #ffffff;
          }

          .po-print-notes {
            margin-top: 16px;
            border: 1px solid #cbd5e1;
            padding: 10px;
          }

          .po-print-footer {
            margin-top: 18px;
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
            color: #475569;
          }
        }
      `}</style>
    </main>
  );
}
