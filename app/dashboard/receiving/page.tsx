"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Button, DialogShell, Select } from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  formatInventoryPrice,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { recordStockMovement } from "@/app/lib/stockMovements";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

type WorkflowStep = "setup" | "receive" | "review" | "finalized";
type ReceivingSource =
  | "supplier_delivery"
  | "purchase_order_draft"
  | "manual_restock"
  | "customer_return"
  | "other";
type ReceiveFilter =
  | "all"
  | "not-received"
  | "received"
  | "over-received"
  | "missing-quantity";

interface ReceivingInventoryItem {
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
  depot_id?: number | null;
}

interface ReceivingDetails {
  title: string;
  source: ReceivingSource;
  supplierId: string;
  supplierName: string;
  receivedDate: string;
  depotId: string;
  notes: string;
}

interface ReceivingLine {
  id: string;
  itemId: number;
  source: "inventory" | "selected" | "po-draft" | "low-stock";
  orderedQuantity: number | null;
  receivedQuantity: string;
  unitCost: string;
  note: string;
}

interface PurchaseOrderDraftLine {
  id?: string;
  inventoryItemId?: number | null;
  orderQuantity?: string;
  unitCost?: string;
  note?: string;
}

interface PurchaseOrderDraft {
  details?: {
    title?: string;
    supplierId?: string;
    supplierName?: string;
    expectedDeliveryDate?: string;
    notes?: string;
  };
  lines?: PurchaseOrderDraftLine[];
}

interface FinalizeResult {
  recorded: number;
  skipped: number;
  failed: Array<{ itemId: number; name: string; message: string }>;
}

interface DraftPayload {
  step: WorkflowStep;
  details: ReceivingDetails;
  lines: ReceivingLine[];
  savedAt: string;
}

const DRAFT_STORAGE_KEY = "sydin:receiving-draft";
const PO_DRAFT_STORAGE_KEY = "sydin:purchase-order-draft";

const SOURCE_OPTIONS: Array<{ value: ReceivingSource; label: string }> = [
  { value: "supplier_delivery", label: "Supplier delivery" },
  { value: "purchase_order_draft", label: "Purchase order draft" },
  { value: "manual_restock", label: "Manual restock" },
  { value: "customer_return", label: "Return from customer" },
  { value: "other", label: "Other" },
];

const sourceLabels: Record<ReceivingSource, string> = {
  supplier_delivery: "Supplier delivery",
  purchase_order_draft: "Purchase order draft",
  manual_restock: "Manual restock",
  customer_return: "Return from customer",
  other: "Other",
};

const inputClassName =
  "min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15 disabled:opacity-60";
const textareaClassName = `${inputClassName} min-h-24 resize-y py-3`;

function makeLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generateReceivingTitle() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `RCV-${year}${month}${day}`;
}

function makeDefaultDetails(): ReceivingDetails {
  return {
    title: generateReceivingTitle(),
    source: "supplier_delivery",
    supplierId: "",
    supplierName: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    depotId: "",
    notes: "",
  };
}

function parseNonNegativeNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}

function makeLineFromItem(
  item: ReceivingInventoryItem,
  source: ReceivingLine["source"],
  orderedQuantity: number | null = null,
  unitCost: string | number | null | undefined = item.cost_price,
  note = ""
): ReceivingLine {
  return {
    id: makeLineId(),
    itemId: item.id,
    source,
    orderedQuantity,
    receivedQuantity: "",
    unitCost: unitCost === null || unitCost === undefined ? "" : String(unitCost),
    note,
  };
}

function readPurchaseOrderDraft(): PurchaseOrderDraft | null {
  try {
    const rawDraft = window.sessionStorage.getItem(PO_DRAFT_STORAGE_KEY);
    if (!rawDraft) return null;
    const parsed = JSON.parse(rawDraft) as PurchaseOrderDraft;
    if (!parsed.details && !parsed.lines?.length) return null;

    return parsed;
  } catch {
    return null;
  }
}

function getLineReceived(line: ReceivingLine) {
  return parseNonNegativeNumber(line.receivedQuantity);
}

function getLineUnitCost(line: ReceivingLine) {
  return parseNonNegativeNumber(line.unitCost);
}

export default function ReceivingPage() {
  const handoffAppliedRef = useRef(false);
  const [items, setItems] = useState<ReceivingInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<WorkflowStep>("setup");
  const [details, setDetails] = useState<ReceivingDetails>(makeDefaultDetails);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [receiveSearch, setReceiveSearch] = useState("");
  const [receiveFilter, setReceiveFilter] = useState<ReceiveFilter>("all");
  const [setupError, setSetupError] = useState("");
  const [lineError, setLineError] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmClearDraft, setConfirmClearDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [poDraft, setPoDraft] = useState<PurchaseOrderDraft | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(
    null
  );

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
  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const selectedIdSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds]
  );
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIdSet.has(item.id)),
    [items, selectedIdSet]
  );
  const lowStockItems = useMemo(
    () =>
      items.filter((item) => {
        const threshold = getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          0
        );
        return threshold > 0 && Number(item.quantity || 0) <= threshold;
      }),
    [items]
  );

  const poDraftLines = useMemo(() => {
    if (!poDraft?.lines?.length) return [];

    return poDraft.lines
      .map((line) => {
        const itemId = Number(line.inventoryItemId);
        const quantity = parseNonNegativeNumber(String(line.orderQuantity || ""));

        return {
          line,
          itemId,
          quantity,
          item: itemById.get(itemId),
        };
      })
      .filter(
        (detail) =>
          Number.isInteger(detail.itemId) &&
          detail.itemId > 0 &&
          detail.item &&
          detail.quantity !== null &&
          detail.quantity > 0
      );
  }, [itemById, poDraft]);

  const receivedDetails = useMemo(
    () =>
      lines
        .map((line) => {
          const item = itemById.get(line.itemId);
          const received = getLineReceived(line);
          const unitCost = getLineUnitCost(line);
          const overReceived =
            received !== null &&
            line.orderedQuantity !== null &&
            received > line.orderedQuantity;
          const hasInvalidQuantity =
            line.receivedQuantity.trim() !== "" && received === null;
          const hasInvalidCost = line.unitCost.trim() !== "" && unitCost === null;
          const hasReceived = received !== null && received > 0;

          return {
            line,
            item,
            received,
            unitCost,
            overReceived,
            hasInvalidQuantity,
            hasInvalidCost,
            hasReceived,
          };
        })
        .filter((detail) => detail.item),
    [itemById, lines]
  );

  const normalizedReceiveSearch = receiveSearch.trim().toLowerCase();
  const visibleDetails = receivedDetails.filter((detail) => {
    const item = detail.item;
    if (!item) return false;

    const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
    const depot = item.depot_id ? depotById.get(item.depot_id) : null;
    const searchText = [
      item.name,
      item.item_code,
      item.sku,
      item.category,
      supplier?.name,
      formatDepotLabel(depot),
      detail.line.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      !normalizedReceiveSearch || searchText.includes(normalizedReceiveSearch);
    const matchesFilter =
      receiveFilter === "all" ||
      (receiveFilter === "not-received" && !detail.hasReceived) ||
      (receiveFilter === "received" && detail.hasReceived) ||
      (receiveFilter === "over-received" && detail.overReceived) ||
      (receiveFilter === "missing-quantity" &&
        (!detail.hasReceived || detail.hasInvalidQuantity));

    return matchesSearch && matchesFilter;
  });

  const invalidQuantityCount = receivedDetails.filter(
    (detail) => detail.hasInvalidQuantity
  ).length;
  const invalidCostCount = receivedDetails.filter(
    (detail) => detail.hasInvalidCost
  ).length;
  const receivedLineDetails = receivedDetails.filter(
    (detail) => detail.hasReceived && detail.item && detail.received !== null
  );
  const skippedCount = Math.max(0, receivedDetails.length - receivedLineDetails.length);
  const overReceivedDetails = receivedLineDetails.filter(
    (detail) => detail.overReceived
  );
  const missingQuantityCount = receivedDetails.filter(
    (detail) => !detail.hasReceived
  ).length;
  const totalReceivedQuantity = receivedLineDetails.reduce(
    (total, detail) => total + Number(detail.received || 0),
    0
  );
  const estimatedReceivedValue = receivedLineDetails.reduce((total, detail) => {
    if (detail.unitCost === null || detail.received === null) return total;
    return total + detail.received * detail.unitCost;
  }, 0);
  const hasCostValue = receivedLineDetails.some(
    (detail) => detail.unitCost !== null
  );
  const hasCustomTitle = !/^RCV-\d{8}$/.test(details.title.trim());
  const hasDraft =
    step !== "setup" ||
    lines.length > 0 ||
    hasCustomTitle ||
    details.source !== "supplier_delivery" ||
    details.supplierId !== "" ||
    details.depotId !== "" ||
    details.supplierName.trim() !== "" ||
    details.notes.trim() !== "";

  const getSupplierLabel = (item: ReceivingInventoryItem) =>
    item.supplier_id ? supplierNameById.get(item.supplier_id) || "Supplier" : "";
  const getDepotLabel = (item: ReceivingInventoryItem) =>
    formatDepotLabel(item.depot_id ? depotById.get(item.depot_id) : null);

  const updateDetails = (field: keyof ReceivingDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = supplierId ? supplierById.get(Number(supplierId)) : null;

    setDetails((current) => ({
      ...current,
      supplierId,
      supplierName: supplier?.name || current.supplierName,
    }));
  };

  const addLinesForItems = useCallback(
    (
      additions: ReceivingLine[],
      successMessage: string,
      emptyMessage: string
    ) => {
      setLineError("");
      setLines((current) => {
        const existingIds = new Set(current.map((line) => line.itemId));
        const nextLines = additions.filter((line) => !existingIds.has(line.itemId));

        if (nextLines.length === 0) {
          setLineError(emptyMessage);
          return current;
        }

        setNotice(successMessage.replace("{count}", String(nextLines.length)));
        return [...current, ...nextLines];
      });
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again to use receiving.");

      const [
        { data: inventoryRows, error: inventoryError },
        loadedSuppliers,
        loadedDepots,
        settings,
      ] = await Promise.all([
        supabase
          .from("inventory")
          .select(
            "id, name, category, quantity, image, sku, item_code, unit_type, custom_unit_label, cost_price, min_stock_level, supplier_id, depot_id"
          )
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        getSuppliersForUser(user.id).catch(() => []),
        getDepotsForUser(user.id).catch(() => []),
        getOrCreateBusinessSettings(user.id).catch(
          () => DEFAULT_BUSINESS_SETTINGS
        ),
      ]);

      if (inventoryError) throw inventoryError;
      if (!active) return;

      setItems((inventoryRows || []) as ReceivingInventoryItem[]);
      setSuppliers(loadedSuppliers);
      setDepots(loadedDepots);
      setBusinessSettings(settings);
      setPoDraft(readPurchaseOrderDraft());
      setLoading(false);
    }

    loadData().catch((error) => {
      if (!active) return;
      setLoadError(
        error instanceof Error ? error.message : "We could not load receiving."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requestedIds = new URLSearchParams(window.location.search)
        .get("items")
        ?.split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (requestedIds?.length) {
        setSelectedItemIds(requestedIds);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (loading) return;
    let frame = 0;

    try {
      const rawDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft) as Partial<DraftPayload>;
      if (!parsed.details && !parsed.lines?.length) return;
      const validIds = new Set(items.map((item) => item.id));

      frame = window.requestAnimationFrame(() => {
        if (parsed.details) {
          setDetails({
            ...makeDefaultDetails(),
            ...parsed.details,
            source: SOURCE_OPTIONS.some(
              (option) => option.value === parsed.details?.source
            )
              ? parsed.details.source
              : "supplier_delivery",
          });
        }
        if (Array.isArray(parsed.lines)) {
          setLines(
            parsed.lines
              .filter((line) => validIds.has(line.itemId))
              .map((line) => ({
                ...line,
                id: line.id || makeLineId(),
                orderedQuantity:
                  typeof line.orderedQuantity === "number"
                    ? line.orderedQuantity
                    : null,
                receivedQuantity: String(line.receivedQuantity || ""),
                unitCost: String(line.unitCost || ""),
                note: line.note || "",
              }))
          );
        }
        setStep(
          parsed.step === "receive" || parsed.step === "review"
            ? parsed.step
            : "receive"
        );
        setDraftRestored(true);
        setNotice("Restored a receiving draft saved on this device.");
      });
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items, loading]);

  useEffect(() => {
    if (loading || handoffAppliedRef.current || selectedItemIds.length === 0) {
      return;
    }
    if (draftRestored || lines.length > 0) {
      handoffAppliedRef.current = true;
      return;
    }

    const handoffLines = selectedItems.map((item) =>
      makeLineFromItem(
        item,
        "selected",
        null,
        item.cost_price,
        "Added from Inventory selection."
      )
    );

    let frame = 0;
    if (handoffLines.length > 0) {
      frame = window.requestAnimationFrame(() => {
        setDetails((current) => ({
          ...current,
          source: "manual_restock",
        }));
        setLines(handoffLines);
        setStep("receive");
        setNotice(
          `Added ${handoffLines.length} selected Inventory item${
            handoffLines.length === 1 ? "" : "s"
          } to this receiving draft.`
        );
      });
    }

    handoffAppliedRef.current = true;

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [draftRestored, lines.length, loading, selectedItemIds.length, selectedItems]);

  useEffect(() => {
    if (loading || step === "finalized" || !hasDraft) return;

    try {
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          step,
          details,
          lines,
          savedAt: new Date().toISOString(),
        } satisfies DraftPayload)
      );
    } catch {
      // Browser draft recovery is best effort only.
    }
  }, [details, hasDraft, lines, loading, step]);

  useEffect(() => {
    if (!hasDraft || step === "finalized") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraft, step]);

  const refreshItems = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Please sign in again to refresh inventory.");

    const { data, error } = await supabase
      .from("inventory")
      .select(
        "id, name, category, quantity, image, sku, item_code, unit_type, custom_unit_label, cost_price, min_stock_level, supplier_id, depot_id"
      )
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) throw error;
    setItems((data || []) as ReceivingInventoryItem[]);
  };

  const startReceiving = () => {
    setSetupError("");
    setLineError("");
    const title = details.title.trim();

    if (!title) {
      setSetupError("Add a receiving title or reference before starting.");
      return;
    }

    if (items.length === 0) {
      setSetupError("Inventory is empty. Add items before receiving stock.");
      return;
    }

    if (details.source === "purchase_order_draft") {
      if (poDraftLines.length === 0) {
        setSetupError(
          "No purchase order draft lines are available to receive on this device."
        );
        return;
      }

      const draftSupplierId = poDraft?.details?.supplierId || "";
      const draftSupplierName = poDraft?.details?.supplierName || "";

      setDetails((current) => ({
        ...current,
        title: current.title || poDraft?.details?.title || title,
        supplierId: draftSupplierId || current.supplierId,
        supplierName: draftSupplierName || current.supplierName,
        notes: current.notes || poDraft?.details?.notes || "",
      }));
      setLines(
        poDraftLines.map((detail) =>
          makeLineFromItem(
            detail.item as ReceivingInventoryItem,
            "po-draft",
            detail.quantity,
            detail.line.unitCost,
            detail.line.note || "Loaded from purchase order draft."
          )
        )
      );
      setNotice(
        `Loaded ${poDraftLines.length} purchase order draft line${
          poDraftLines.length === 1 ? "" : "s"
        }. Review received quantities before finalizing.`
      );
    } else if (selectedItems.length > 0 && lines.length === 0) {
      setLines(
        selectedItems.map((item) =>
          makeLineFromItem(item, "selected", null, item.cost_price)
        )
      );
    }

    setReceiveSearch("");
    setReceiveFilter("all");
    setConfirmFinalize(false);
    setFinalizeResult(null);
    setStep("receive");
  };

  const addInventoryLine = () => {
    const item = itemById.get(Number(selectedInventoryItemId));

    if (!item) {
      setLineError("Choose an inventory item before adding it.");
      return;
    }

    addLinesForItems(
      [makeLineFromItem(item, "inventory")],
      "Added {count} item to this receiving draft.",
      "That item is already on this receiving draft."
    );
    setSelectedInventoryItemId("");
  };

  const addLowStockLines = () => {
    addLinesForItems(
      lowStockItems.map((item) => makeLineFromItem(item, "low-stock")),
      "Added {count} low-stock item(s) to this receiving draft.",
      "No new low-stock items are available to add."
    );
  };

  const addPurchaseOrderLines = () => {
    addLinesForItems(
      poDraftLines.map((detail) =>
        makeLineFromItem(
          detail.item as ReceivingInventoryItem,
          "po-draft",
          detail.quantity,
          detail.line.unitCost,
          detail.line.note || "Loaded from purchase order draft."
        )
      ),
      "Added {count} purchase order draft line(s).",
      "No new purchase order draft lines are available to add."
    );
  };

  const updateLine = (
    lineId: string,
    update: Partial<Pick<ReceivingLine, "receivedQuantity" | "unitCost" | "note">>
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

  const clearLine = (lineId: string) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              receivedQuantity: "",
              unitCost: "",
              note: "",
            }
          : line
      )
    );
  };

  const receiveOrderedLine = (lineId: string) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId && line.orderedQuantity !== null
          ? {
              ...line,
              receivedQuantity: String(line.orderedQuantity),
            }
          : line
      )
    );
  };

  const receiveOrderedQuantities = () => {
    setLines((current) =>
      current.map((line) =>
        line.orderedQuantity !== null
          ? {
              ...line,
              receivedQuantity: String(line.orderedQuantity),
            }
          : line
      )
    );
  };

  const clearDraft = () => {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setDetails(makeDefaultDetails());
    setLines([]);
    setStep("setup");
    setReceiveSearch("");
    setReceiveFilter("all");
    setSetupError("");
    setLineError("");
    setFinalizeError("");
    setConfirmFinalize(false);
    setConfirmClearDraft(false);
    setFinalizeResult(null);
    setDraftRestored(false);
    setNotice("Receiving draft cleared.");
  };

  const goToReview = () => {
    setFinalizeError("");
    setLineError("");

    if (invalidQuantityCount > 0 || invalidCostCount > 0) {
      setLineError("Fix invalid received quantities or costs before review.");
      return;
    }

    setConfirmFinalize(false);
    setStep("review");
  };

  const finalizeReceiving = async () => {
    if (finalizing || !confirmFinalize) return;
    if (invalidQuantityCount > 0 || invalidCostCount > 0) {
      setFinalizeError("Fix invalid received quantities or costs before finalizing.");
      return;
    }

    try {
      setFinalizing(true);
      setFinalizeError("");
      const failed: FinalizeResult["failed"] = [];
      let recorded = 0;

      for (const detail of receivedLineDetails) {
        const item = detail.item;
        if (!item || detail.received === null || detail.received <= 0) continue;

        try {
          await recordStockMovement({
            itemId: item.id,
            movementType: "stock_in",
            quantity: detail.received,
            notes: [
              "Receiving",
              details.title.trim(),
              sourceLabels[details.source],
              details.supplierName.trim(),
              detail.line.note.trim(),
            ]
              .filter(Boolean)
              .join(" - "),
          });
          recorded += 1;
        } catch (error) {
          failed.push({
            itemId: item.id,
            name: item.name,
            message:
              error instanceof Error
                ? error.message
                : "Stock-in movement could not be recorded.",
          });
        }
      }

      await refreshItems();
      const result = {
        recorded,
        skipped: skippedCount,
        failed,
      };
      setFinalizeResult(result);
      setStep("finalized");
      setNotice(
        failed.length
          ? `Receiving finalized with ${failed.length} failed stock-in movement${
              failed.length === 1 ? "" : "s"
            }.`
          : "Receiving finalized through stock-in movements."
      );
      if (failed.length === 0) {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      setFinalizeError("Something went wrong while finalizing receiving.");
    } finally {
      setFinalizing(false);
    }
  };

  const stepItems: Array<{ id: WorkflowStep; label: string }> = [
    { id: "setup", label: "Setup" },
    { id: "receive", label: "Items" },
    { id: "review", label: "Review" },
    { id: "finalized", label: "Finalize" },
  ];

  return (
    <main className="operations-workspace operations-receiving">
      <div
        className={`mx-auto flex w-full max-w-[1500px] flex-col gap-4 ${
          step === "receive" || step === "review" ? "pb-28 sm:pb-0" : ""
        }`}
      >
        <section className="rounded-[24px] border border-theme bg-theme-surface p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                Operations
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
                Receiving
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-theme-muted">
                Receive supplier deliveries, purchase order drafts, returns, and
                manual restocks. Inventory changes after receiving is finalized.
              </p>
            </div>
            <div className="operations-step-strip grid grid-cols-4 overflow-hidden rounded-2xl border border-theme bg-theme-inset text-center text-xs font-black text-theme-secondary">
              {stepItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`min-w-20 border-r border-theme px-3 py-2 last:border-r-0 ${
                    step === item.id ? "bg-cyan-500/10 text-theme-accent" : ""
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-[0.12em]">
                    Step {index + 1}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {(notice || loadError) && (
          <p
            role={loadError ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              loadError
                ? "border-red-400/30 bg-red-500/10 text-theme-danger"
                : "border-cyan-400/25 bg-cyan-500/10 text-theme-accent"
            }`}
          >
            {loadError || notice}
          </p>
        )}

        {loading ? (
          <section className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-20 animate-pulse rounded-xl bg-theme-inset"
              />
            ))}
          </section>
        ) : loadError ? null : step === "setup" ? (
          <section className="grid gap-4 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-theme-accent">
                Draft saved on this device. Finalizing records stock-in
                movements and updates inventory.
              </div>
              {draftRestored && (
                <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                  A receiving draft saved on this device was restored. Review it
                  before finalizing or clear it to restart.
                </p>
              )}
              {setupError && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                  {setupError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Receiving title/reference
                  <input
                    type="text"
                    value={details.title}
                    onChange={(event) => updateDetails("title", event.target.value)}
                    placeholder="RCV-20260622"
                    className={inputClassName}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Source
                  <Select
                    value={details.source}
                    onChange={(value) =>
                      updateDetails("source", value as ReceivingSource)
                    }
                    options={SOURCE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Supplier
                  {suppliers.length > 0 ? (
                    <Select
                      value={details.supplierId}
                      onChange={handleSupplierChange}
                      placeholder="No supplier selected"
                      clearable
                      searchable={suppliers.length > 8}
                      options={suppliers.map((supplier) => ({
                        value: String(supplier.id),
                        label: supplier.name,
                      }))}
                    />
                  ) : (
                    <input
                      type="text"
                      value={details.supplierName}
                      onChange={(event) =>
                        updateDetails("supplierName", event.target.value)
                      }
                      placeholder="Supplier or source name"
                      className={inputClassName}
                    />
                  )}
                </label>
                {suppliers.length > 0 && (
                  <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                    Supplier/source text
                    <input
                      type="text"
                      value={details.supplierName}
                      onChange={(event) =>
                        updateDetails("supplierName", event.target.value)
                      }
                      placeholder="Optional receiving source text"
                      className={inputClassName}
                    />
                  </label>
                )}
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Received date
                  <input
                    type="date"
                    value={details.receivedDate}
                    onChange={(event) =>
                      updateDetails("receivedDate", event.target.value)
                    }
                    className={inputClassName}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary">
                  Default depot/location
                  <Select
                    value={details.depotId}
                    onChange={(value) => updateDetails("depotId", value)}
                    placeholder="No default depot"
                    clearable
                    searchable={depots.length > 8}
                    options={depots.map((depot) => ({
                      value: String(depot.id),
                      label: formatDepotLabel(depot),
                    }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-theme-primary sm:col-span-2">
                  Notes
                  <textarea
                    value={details.notes}
                    onChange={(event) => updateDetails("notes", event.target.value)}
                    placeholder="Optional receiving notes"
                    className={textareaClassName}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={startReceiving} disabled={items.length === 0}>
                  Start Receiving
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmClearDraft(true)}
                  disabled={!hasDraft}
                >
                  Clear draft
                </Button>
              </div>
            </div>
            <aside className="grid content-start gap-3 rounded-2xl border border-theme bg-theme-inset p-4">
              <p className="text-sm font-black text-theme-primary">
                Setup status
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-theme bg-theme-surface p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Inventory
                  </p>
                  <p className="mt-1 text-2xl font-black text-theme-primary">
                    {items.length}
                  </p>
                </div>
                <div className="rounded-xl border border-theme bg-theme-surface p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Selected
                  </p>
                  <p className="mt-1 text-2xl font-black text-theme-primary">
                    {selectedItems.length}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-5 text-theme-muted">
                Receiving history is tracked through Stock Movements.
              </p>
              {details.source === "purchase_order_draft" &&
                (poDraftLines.length > 0 ? (
                  <p className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-theme-accent">
                    Current purchase order draft has{" "}
                    {poDraftLines.length} receivable line
                    {poDraftLines.length === 1 ? "" : "s"}.
                  </p>
                ) : (
                  <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                    No purchase order draft lines are available on this device.
                    You can add inventory items or manual receiving lines
                    instead.
                  </p>
                ))}
              {items.length === 0 && (
                <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                  Inventory is empty. Add items before receiving stock.
                </p>
              )}
            </aside>
          </section>
        ) : step === "receive" ? (
          <>
            <section className="rounded-[22px] border border-theme bg-theme-surface p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-black text-theme-primary">
                    {details.title || "Receiving draft"}
                  </h2>
                  <p className="mt-1 text-sm text-theme-muted">
                    {sourceLabels[details.source]}. {receivedLineDetails.length}{" "}
                    of {receivedDetails.length} lines have received quantity.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_12rem] xl:min-w-[35rem]">
                  <label className="relative">
                    <span className="sr-only">Search receiving items</span>
                    <UiIcon
                      name="search"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
                    />
                    <input
                      type="search"
                      value={receiveSearch}
                      onChange={(event) => setReceiveSearch(event.target.value)}
                      placeholder="Search receiving"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                    />
                  </label>
                  <Select
                    ariaLabel="Receiving filter"
                    value={receiveFilter}
                    onChange={(value) => setReceiveFilter(value as ReceiveFilter)}
                    options={[
                      { value: "all", label: "All rows" },
                      { value: "not-received", label: "Not received" },
                      { value: "received", label: "Received" },
                      { value: "over-received", label: "Over received" },
                      { value: "missing-quantity", label: "Missing quantity" },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto]">
                <Select
                  ariaLabel="Add inventory item"
                  value={selectedInventoryItemId}
                  onChange={setSelectedInventoryItemId}
                  placeholder="Add inventory item"
                  searchable={items.length > 8}
                  options={items.map((item) => ({
                    value: String(item.id),
                    label: item.name,
                    description: [item.item_code || item.sku, getDepotLabel(item)]
                      .filter(Boolean)
                      .join(" | "),
                  }))}
                />
                <Button variant="secondary" onClick={addInventoryLine}>
                  Add item
                </Button>
                <Button variant="secondary" onClick={addLowStockLines}>
                  Add low stock
                </Button>
                <Button
                  variant="secondary"
                  onClick={addPurchaseOrderLines}
                  disabled={poDraftLines.length === 0}
                >
                  Add PO draft
                </Button>
              </div>
              {lineError && (
                <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                  {lineError}
                </p>
              )}
              <p className="sr-only" aria-live="polite">
                {receivedLineDetails.length} received lines, {skippedCount} skipped
                lines, {overReceivedDetails.length} over received warnings.
              </p>
            </section>

            {invalidQuantityCount > 0 || invalidCostCount > 0 ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                Fix {invalidQuantityCount} invalid received quantity value
                {invalidQuantityCount === 1 ? "" : "s"} and {invalidCostCount}{" "}
                invalid cost value{invalidCostCount === 1 ? "" : "s"}.
              </p>
            ) : null}

            <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-[1180px] w-full table-fixed text-left text-sm">
                  <thead className="border-b border-theme bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                    <tr>
                      <th className="w-[23%] px-4 py-3">Item</th>
                      <th className="w-[10%] px-4 py-3 text-right">Current</th>
                      <th className="w-[10%] px-4 py-3">Unit</th>
                      <th className="w-[12%] px-4 py-3">Depot</th>
                      <th className="w-[12%] px-4 py-3">Supplier</th>
                      <th className="w-[9%] px-4 py-3 text-right">Ordered</th>
                      <th className="w-[10%] px-4 py-3">Received</th>
                      <th className="w-[9%] px-4 py-3">Unit cost</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="w-[10%] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {visibleDetails.map((detail) => {
                      const item = detail.item;
                      if (!item) return null;
                      const receivedInputId = `received-${detail.line.id}`;
                      const costInputId = `cost-${detail.line.id}`;

                      return (
                        <tr key={detail.line.id} className="align-middle">
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-theme bg-theme-inset">
                                {item.image ? (
                                  <Image
                                    src={item.image}
                                    alt=""
                                    fill
                                    sizes="40px"
                                    className="object-contain p-1"
                                  />
                                ) : (
                                  <span className="flex h-full items-center justify-center text-theme-subtle">
                                    <UiIcon name="box" className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-theme-primary">
                                  {item.name}
                                </p>
                                <p className="truncate text-xs text-theme-muted">
                                  {item.item_code || item.sku || "Inventory item"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-theme-primary">
                            {formatNumber(Number(item.quantity || 0))}
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getInventoryUnitLabel(
                              item.unit_type,
                              item.custom_unit_label
                            )}
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getDepotLabel(item)}
                          </td>
                          <td className="px-4 py-3 text-theme-secondary">
                            {getSupplierLabel(item) || details.supplierName || "Not set"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                            {detail.line.orderedQuantity === null
                              ? "Not set"
                              : formatNumber(detail.line.orderedQuantity)}
                          </td>
                          <td className="px-4 py-3">
                            <label htmlFor={receivedInputId} className="sr-only">
                              Received quantity for {item.name}
                            </label>
                            <input
                              id={receivedInputId}
                              inputMode="decimal"
                              type="number"
                              min="0"
                              step="any"
                              value={detail.line.receivedQuantity}
                              onChange={(event) =>
                                updateLine(detail.line.id, {
                                  receivedQuantity: event.target.value,
                                })
                              }
                              className={inputClassName}
                            />
                            {detail.overReceived && (
                              <p className="mt-1 text-xs font-bold text-theme-warning">
                                Over ordered quantity
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <label htmlFor={costInputId} className="sr-only">
                              Unit cost for {item.name}
                            </label>
                            <input
                              id={costInputId}
                              inputMode="decimal"
                              type="number"
                              min="0"
                              step="any"
                              value={detail.line.unitCost}
                              onChange={(event) =>
                                updateLine(detail.line.id, {
                                  unitCost: event.target.value,
                                })
                              }
                              className={inputClassName}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={detail.line.note}
                              onChange={(event) =>
                                updateLine(detail.line.id, {
                                  note: event.target.value,
                                })
                              }
                              aria-label={`Receiving note for ${item.name}`}
                              placeholder="Optional"
                              className={inputClassName}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="grid gap-2">
                              <button
                                type="button"
                                onClick={() => receiveOrderedLine(detail.line.id)}
                                disabled={detail.line.orderedQuantity === null}
                                className="min-h-10 rounded-xl border border-theme bg-theme-inset px-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                              >
                                Receive ordered
                              </button>
                              <button
                                type="button"
                                onClick={() => clearLine(detail.line.id)}
                                className="min-h-10 rounded-xl border border-theme bg-theme-inset px-2 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                              >
                                Clear row
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 p-3 xl:hidden">
                {visibleDetails.map((detail) => {
                  const item = detail.item;
                  if (!item) return null;

                  return (
                    <article
                      key={detail.line.id}
                      className="rounded-2xl border border-theme bg-theme-inset p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-theme bg-theme-surface">
                          {item.image ? (
                            <Image
                              src={item.image}
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
                          <p className="truncate font-black text-theme-primary">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-theme-muted">
                            {[item.item_code || item.sku, getDepotLabel(item)]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                            Current
                          </p>
                          <p className="mt-1 font-black text-theme-primary">
                            {getInventoryQuantityLabel(
                              item.quantity,
                              item.unit_type,
                              item.custom_unit_label
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                            Ordered
                          </p>
                          <p className="mt-1 font-black text-theme-primary">
                            {detail.line.orderedQuantity === null
                              ? "Not set"
                              : formatNumber(detail.line.orderedQuantity)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <label className="grid gap-1 text-sm font-bold text-theme-primary">
                          Received quantity
                          <input
                            inputMode="decimal"
                            type="number"
                            min="0"
                            step="any"
                            value={detail.line.receivedQuantity}
                            onChange={(event) =>
                              updateLine(detail.line.id, {
                                receivedQuantity: event.target.value,
                              })
                            }
                            className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                          />
                        </label>
                        {detail.overReceived && (
                          <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-theme-warning">
                            Over received versus ordered quantity.
                          </p>
                        )}
                        <label className="grid gap-1 text-sm font-bold text-theme-primary">
                          Unit cost
                          <input
                            inputMode="decimal"
                            type="number"
                            min="0"
                            step="any"
                            value={detail.line.unitCost}
                            onChange={(event) =>
                              updateLine(detail.line.id, {
                                unitCost: event.target.value,
                              })
                            }
                            className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-bold text-theme-primary">
                          Row note
                          <input
                            type="text"
                            value={detail.line.note}
                            onChange={(event) =>
                              updateLine(detail.line.id, {
                                note: event.target.value,
                              })
                            }
                            className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => receiveOrderedLine(detail.line.id)}
                            disabled={detail.line.orderedQuantity === null}
                          >
                            Receive ordered
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => clearLine(detail.line.id)}
                          >
                            Clear row
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {visibleDetails.length === 0 && (
                <div className="px-5 py-14 text-center">
                  <UiIcon
                    name="search"
                    className="mx-auto h-8 w-8 text-theme-accent"
                  />
                  <h2 className="mt-4 text-xl font-bold text-theme-primary">
                    No receiving rows match
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    Add items from inventory, a purchase order draft, or create a
                    manual receiving line.
                  </p>
                  <div className="mx-auto mt-5 flex max-w-md flex-col justify-center gap-2 sm:flex-row">
                    <Button variant="secondary" onClick={addInventoryLine}>
                      Add item
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={addPurchaseOrderLines}
                      disabled={poDraftLines.length === 0}
                    >
                      Add PO draft
                    </Button>
                    <Button variant="secondary" onClick={addLowStockLines}>
                      Add low stock
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-cyan-300/25 bg-theme-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:bottom-auto sm:top-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-theme-secondary sm:flex sm:text-left">
                  <span className="rounded-xl bg-cyan-500/10 px-3 py-2 text-theme-accent">
                    {receivedLineDetails.length}/{receivedDetails.length} received
                  </span>
                  <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    {skippedCount} skipped
                  </span>
                  <span className="rounded-xl border border-theme bg-theme-inset px-3 py-2">
                    {overReceivedDetails.length} over
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => setStep("setup")}>
                    Setup
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={receiveOrderedQuantities}
                    disabled={!lines.some((line) => line.orderedQuantity !== null)}
                  >
                    Receive ordered quantities
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmClearDraft(true)}>
                    Restart
                  </Button>
                  <Button onClick={goToReview}>Review Receiving</Button>
                </div>
              </div>
            </section>
          </>
        ) : step === "review" ? (
          <>
            <section className="grid gap-3 rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Total lines", receivedDetails.length],
                ["Received", receivedLineDetails.length],
                ["Skipped", skippedCount],
                ["Total quantity", formatNumber(totalReceivedQuantity)],
                [
                  "Est. value",
                  hasCostValue
                    ? formatInventoryPrice(estimatedReceivedValue, currencyCode) ||
                      formatNumber(estimatedReceivedValue)
                    : "Not set",
                ],
                ["Over received", overReceivedDetails.length],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-theme bg-theme-inset px-3 py-2"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-black text-theme-primary">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            {(overReceivedDetails.length > 0 || missingQuantityCount > 0) && (
              <div className="grid gap-2 md:grid-cols-2">
                {overReceivedDetails.length > 0 && (
                  <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                    {overReceivedDetails.length} line
                    {overReceivedDetails.length === 1 ? "" : "s"} exceed ordered
                    quantity. Over-receiving is allowed after confirmation.
                  </p>
                )}
                {missingQuantityCount > 0 && (
                  <p className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-theme-accent">
                    {missingQuantityCount} line
                    {missingQuantityCount === 1 ? "" : "s"} have no received
                    quantity and will create no stock movement.
                  </p>
                )}
              </div>
            )}

            {finalizeError && (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {finalizeError}
              </p>
            )}

            <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <div className="border-b border-theme p-4">
                <h2 className="text-xl font-black text-theme-primary">
                  Review received stock
                </h2>
                <p className="mt-1 text-sm text-theme-muted">
                  Only lines with received quantity greater than zero will create
                  stock-in movements.
                </p>
              </div>
              {receivedLineDetails.length > 0 ? (
                <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-[840px] w-full table-fixed text-left text-sm">
                    <thead className="border-b border-theme bg-theme-inset text-[11px] font-black uppercase tracking-[0.12em] text-theme-subtle">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right">Received</th>
                        <th className="px-4 py-3 text-right">Resulting</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Depot</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-divider)]">
                      {receivedLineDetails.map((detail) => {
                        const item = detail.item;
                        if (!item || detail.received === null) return null;
                        const currentQuantity = Number(item.quantity || 0);
                        const resultingQuantity = currentQuantity + detail.received;

                        return (
                          <tr key={detail.line.id}>
                            <td className="px-4 py-3">
                              <p className="font-black text-theme-primary">
                                {item.name}
                              </p>
                              <p className="text-xs text-theme-muted">
                                {item.item_code || item.sku || "Inventory item"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-theme-secondary">
                              {formatNumber(currentQuantity)}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-theme-success">
                              +{formatNumber(detail.received)}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-theme-primary">
                              {formatNumber(resultingQuantity)}
                            </td>
                            <td className="px-4 py-3 text-theme-secondary">
                              {getInventoryUnitLabel(
                                item.unit_type,
                                item.custom_unit_label
                              )}
                            </td>
                            <td className="px-4 py-3 text-theme-secondary">
                              {getDepotLabel(item)}
                            </td>
                            <td className="px-4 py-3 text-theme-muted">
                              {detail.line.note || "Receiving"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-2 p-3 md:hidden">
                  {receivedLineDetails.map((detail) => {
                    const item = detail.item;
                    if (!item || detail.received === null) return null;
                    const currentQuantity = Number(item.quantity || 0);
                    const resultingQuantity = currentQuantity + detail.received;

                    return (
                      <article
                        key={detail.line.id}
                        className="rounded-2xl border border-theme bg-theme-inset p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-black text-theme-primary">
                              {item.name}
                            </h3>
                            <p className="mt-1 truncate text-xs text-theme-muted">
                              {item.item_code || item.sku || "Inventory item"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-theme-success">
                            +{formatNumber(detail.received)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Current
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {formatNumber(currentQuantity)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Result
                            </p>
                            <p className="mt-1 font-black text-theme-primary">
                              {formatNumber(resultingQuantity)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Unit
                            </p>
                            <p className="mt-1 truncate font-black text-theme-primary">
                              {getInventoryUnitLabel(
                                item.unit_type,
                                item.custom_unit_label
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-theme-muted">
                          {getDepotLabel(item)} | {detail.line.note || "Receiving"}
                        </p>
                      </article>
                    );
                  })}
                </div>
                </>
              ) : (
                <div className="px-5 py-12 text-center">
                  <UiIcon
                    name="info"
                    className="mx-auto h-8 w-8 text-theme-accent"
                  />
                  <h2 className="mt-4 text-xl font-bold text-theme-primary">
                    No received quantities
                  </h2>
                  <p className="mt-2 text-sm text-theme-muted">
                    No stock-in movements will be recorded until received
                    quantities are entered.
                  </p>
                </div>
              )}
            </section>

            <section className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-cyan-300/25 bg-theme-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.22)] sm:sticky sm:bottom-auto sm:top-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-start gap-2 text-xs font-bold text-theme-primary">
                  <input
                    type="checkbox"
                    checked={confirmFinalize}
                    onChange={(event) => setConfirmFinalize(event.target.checked)}
                    disabled={finalizing}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                  />
                  Finalizing will record stock-in movements for received
                  quantities. Zero rows will be skipped.
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => setStep("receive")}
                    disabled={finalizing}
                  >
                    Back to Items
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmClearDraft(true)}
                    disabled={finalizing}
                  >
                    Restart
                  </Button>
                  <Button
                    onClick={() => void finalizeReceiving()}
                    disabled={!confirmFinalize || finalizing}
                    loading={finalizing}
                    loadingLabel="Finalizing..."
                  >
                    Finalize Receiving
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="grid gap-4 rounded-[22px] border border-theme bg-theme-surface p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                Finalized
              </p>
              <h2 className="mt-1 text-2xl font-black text-theme-primary">
                Receiving complete
              </h2>
              <p className="mt-1 text-sm text-theme-muted">
                Inventory was refreshed after finalization. Each received line
                was processed through the existing stock-in movement path.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Stock-in movements
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.recorded || 0}
                </p>
              </div>
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Skipped rows
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.skipped || 0}
                </p>
              </div>
              <div className="rounded-xl border border-theme bg-theme-inset p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                  Failed
                </p>
                <p className="mt-1 text-2xl font-black text-theme-primary">
                  {finalizeResult?.failed.length || 0}
                </p>
              </div>
            </div>
            {finalizeResult && finalizeResult.failed.length > 0 && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
                <p className="font-black text-theme-danger">
                  Failed stock-in movements
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-theme-danger">
                  {finalizeResult.failed.map((failure) => (
                    <li key={failure.itemId}>
                      {failure.name}: {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={clearDraft}>Start New Receiving</Button>
              <Button variant="secondary" onClick={() => setStep("receive")}>
                View Receiving Rows
              </Button>
            </div>
          </section>
        )}
      </div>

      {confirmClearDraft && (
        <DialogShell
          title="Clear receiving draft?"
          eyebrow="Device draft"
          description="This clears the receiving draft saved on this device. Finalized stock movements are not affected."
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
              <Button variant="danger" onClick={clearDraft}>
                Clear draft
              </Button>
            </>
          }
        />
      )}
    </main>
  );
}
