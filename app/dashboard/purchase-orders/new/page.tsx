"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import {
  Button,
  DialogShell,
  FieldGroup,
  FieldRow,
  Select,
  UnsavedChangesGuard,
} from "@/components/ui";
import {
  ActionButton,
  DashboardCard,
  DashboardFormSection,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  createDepot,
  formatDepotLabel,
  getActiveDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import {
  getInventoryUnitLabel,
  normalizeCurrencyCode,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  convertAmount,
  currencyChoicesIncluding,
  formatExactPrice,
  getCurrencyContext,
  getExchangeRate,
} from "@/app/lib/currency";
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_METHOD_LABELS,
  PURCHASE_ORDER_PAYMENT_STATUS_LABELS,
  createPurchaseOrder,
  getNextPoNumber,
  isPurchaseOrdersSchemaMissing,
  receivePurchaseOrder,
  uploadPurchaseOrderAttachment,
  type PurchaseOrderExpenseCategory,
  type PurchaseOrderLineInput,
  type PurchaseOrderPaymentMethod,
  type PurchaseOrderPaymentStatus,
} from "@/app/lib/purchaseOrders";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

interface PickerItem {
  id: number;
  name: string;
  image?: string | null;
  quantity: number;
  sku: string | null;
  item_code: string | null;
  unit_type: InventoryUnitType | string | null;
  custom_unit_label: string | null;
  cost_price: number | string | null;
}

/** LBP is quoted in whole pounds; everything else to the cent. */
function roundForCurrency(value: number, currencyCode: string) {
  const digits = ["LBP", "JPY", "KRW", "IQD", "SYP"].includes(currencyCode.toUpperCase()) ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

interface LineDraft {
  key: string;
  lineType: "inventory" | "expense";
  inventoryItemId: number | null;
  image?: string | null;
  name: string;
  sku: string | null;
  itemCode: string | null;
  unitLabel: string | null;
  quantity: string;
  unitCost: string;
  affectsStock: boolean;
  expenseCategory: PurchaseOrderExpenseCategory;
  note: string;
}

const inputClassName =
  "min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15 disabled:opacity-60";
const SCHEMA_MISSING_MESSAGE =
  "The purchase orders database update has not been run yet. Open Supabase → SQL Editor and run the file sql/phase-8-purchase-orders.sql, then try again.";

function makeLineKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePositiveNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pickerRequestRef = useRef(0);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [poNumber, setPoNumber] = useState("");
  const [poNumberEdited, setPoNumberEdited] = useState(false);
  const [title, setTitle] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIsoDate());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [internalReference, setInternalReference] = useState("");
  const [receiveNow, setReceiveNow] = useState(false);
  const [notes, setNotes] = useState("");

  const [depotId, setDepotId] = useState("");
  const [newDepotOpen, setNewDepotOpen] = useState(false);
  const [newDepotName, setNewDepotName] = useState("");
  const [newDepotCode, setNewDepotCode] = useState("");
  const [creatingDepot, setCreatingDepot] = useState(false);
  const [newDepotError, setNewDepotError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<PurchaseOrderPaymentStatus>("unpaid");
  const [amountPaid, setAmountPaid] = useState("");

  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<PickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Deliberately does NOT count `poNumber` or `purchaseDate`: the form fills
     both in on its own, and a guard that fires on an untouched page is a
     guard people learn to click through. `saving` turns it off so the
     redirect after a successful save is not itself challenged. */
  const hasUnsavedWork =
    !saving &&
    (lines.length > 0 ||
      Boolean(attachmentFile) ||
      Boolean(title.trim()) ||
      Boolean(notes.trim()) ||
      Boolean(internalReference.trim()) ||
      Boolean(supplierName.trim()) ||
      Boolean(supplierContact.trim()) ||
      Boolean(paidBy.trim()) ||
      Boolean(amountPaid.trim()) ||
      Boolean(expectedDeliveryDate) ||
      Boolean(depotId) ||
      Boolean(supplierId) ||
      Boolean(paymentMethod) ||
      poNumberEdited);

  /* The order's own currency: what the supplier quotes in. Starts as the
     currency the app shows, can be changed per order. Item costs are stored
     in base and converted into it when a line is added; the day's rate is
     saved with the order so spending can be added up across currencies. */
  const [orderCurrency, setOrderCurrency] = useState<string | null>(null);
  const currencyCode = normalizeCurrencyCode(
    orderCurrency ?? settings.currency_code,
    "USD"
  );
  const baseCurrency = getCurrencyContext().base;
  const exchangeRate = getExchangeRate(baseCurrency, currencyCode);
  const costInOrderCurrency = (cost: number | string | null | undefined) =>
    cost === null || cost === undefined || cost === ""
      ? ""
      : String(
          roundForCurrency(convertAmount(Number(cost), baseCurrency, currencyCode), currencyCode)
        );
  const selectedDepot = useMemo(
    () => depots.find((depot) => String(depot.id) === depotId) || null,
    [depots, depotId]
  );

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!active) return;
      setUserId(user.id);

      const [loadedSettings, loadedDepots, loadedSuppliers] = await Promise.all([
        getOrCreateBusinessSettings(user.id),
        getActiveDepotsForUser(user.id).catch(() => [] as Depot[]),
        getSuppliersForUser(user.id).catch(() => [] as Supplier[]),
      ]);

      if (!active) return;
      setSettings(loadedSettings);
      setDepots(loadedDepots);
      setSuppliers(loadedSuppliers);

      // "New purchase order" from a supplier's account page names the
      // supplier (?supplier=12), the same way the select would.
      const supplierParam = new URLSearchParams(window.location.search).get("supplier");
      const preselected = loadedSuppliers.find(
        (entry) => String(entry.id) === supplierParam
      );
      if (preselected) {
        setSupplierId(String(preselected.id));
        setSupplierName(preselected.name);
        setSupplierContact(
          [preselected.contact_name, preselected.email, preselected.phone]
            .filter(Boolean)
            .join(" | ")
        );
      }

      // Prefill lines when arriving from inventory "Create purchase order" (?items=1,2,3).
      const itemsParam = new URLSearchParams(window.location.search).get("items");
      const prefillIds = (itemsParam || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      if (prefillIds.length > 0) {
        const { data: prefillItems } = await supabase
          .from("inventory")
          .select(
            "id, name, image, quantity, sku, item_code, unit_type, custom_unit_label, cost_price"
          )
          .eq("user_id", user.id)
          .in("id", prefillIds);

        if (active && prefillItems && prefillItems.length > 0) {
          const byId = new Map(
            (prefillItems as PickerItem[]).map((item) => [item.id, item])
          );
          // Preserve the order the user selected them in.
          const ordered = prefillIds
            .map((id) => byId.get(id))
            .filter((item): item is PickerItem => Boolean(item));
          setLines(
            ordered.map((item) => ({
              key: makeLineKey(),
              lineType: "inventory" as const,
              inventoryItemId: item.id,
              image: item.image ?? null,
              name: item.name,
              sku: item.sku,
              itemCode: item.item_code,
              unitLabel: getInventoryUnitLabel(
                item.unit_type,
                item.custom_unit_label
              ),
              quantity: "1",
              // Converted with the settings just loaded: the closure above
              // still holds the defaults at this point.
              unitCost:
                item.cost_price === null || item.cost_price === undefined
                  ? ""
                  : String(
                      roundForCurrency(
                        convertAmount(
                          Number(item.cost_price),
                          loadedSettings.base_currency,
                          normalizeCurrencyCode(loadedSettings.currency_code, "USD")
                        ),
                        normalizeCurrencyCode(loadedSettings.currency_code, "USD")
                      )
                    ),
              affectsStock: true,
              expenseCategory: "other" as const,
              note: "",
            }))
          );
        }
      }

      setLoading(false);
    }

    loadInitialData().catch(() => {
      if (!active) return;
      setError("Something went wrong while loading. Refresh and try again.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  const refreshPoNumber = useCallback(
    async (depot: Depot | null, businessName: string, ownerId: string) => {
      try {
        const nextNumber = await getNextPoNumber(ownerId, {
          depotCode: depot?.code,
          depotName: depot?.name,
          businessName,
        });
        setPoNumber(nextNumber);
      } catch {
        // Table missing (phase-8 SQL not run) or offline — still give a usable number.
        const fallbackPrefix = (depot?.code || depot?.name || businessName || "SYDIN")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8);
        setPoNumber(`${fallbackPrefix || "SYDIN"}-PO-0001`);
      }
    },
    []
  );

  useEffect(() => {
    if (loading || !userId || poNumberEdited) return;

    const frame = window.requestAnimationFrame(() => {
      refreshPoNumber(selectedDepot, settings.business_name, userId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    loading,
    userId,
    poNumberEdited,
    refreshPoNumber,
    selectedDepot,
    settings.business_name,
  ]);

  useEffect(() => {
    if (!pickerOpen || !userId) return;

    const term = pickerQuery.trim().replace(/[%,()]/g, " ").slice(0, 60);
    const requestId = pickerRequestRef.current + 1;
    pickerRequestRef.current = requestId;

    const frame = window.requestAnimationFrame(() => {
      setPickerLoading(true);
    });

    const timeout = window.setTimeout(async () => {
      let query = supabase
        .from("inventory")
        .select(
          "id, name, image, quantity, sku, item_code, unit_type, custom_unit_label, cost_price"
        )
        .eq("user_id", userId)
        .order("name", { ascending: true })
        .limit(12);

      if (term.length > 0) {
        query = query.or(
          `name.ilike.%${term}%,sku.ilike.%${term}%,item_code.ilike.%${term}%,barcode.ilike.%${term}%`
        );
      }

      const { data, error: pickerError } = await query;
      if (pickerRequestRef.current !== requestId) return;
      setPickerResults(pickerError ? [] : ((data || []) as PickerItem[]));
      setPickerLoading(false);
    }, 180);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pickerOpen, pickerQuery, userId]);

  useEffect(() => {
    const url = attachmentFile ? URL.createObjectURL(attachmentFile) : "";
    const frame = window.requestAnimationFrame(() => {
      setAttachmentPreview(url);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentFile]);

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Free text supplier" },
      ...suppliers.map((supplier) => ({
        value: String(supplier.id),
        label: supplier.name,
      })),
    ],
    [suppliers]
  );

  const depotOptions = useMemo(
    () => [
      { value: "", label: "No depot / general" },
      ...depots.map((depot) => ({
        value: String(depot.id),
        label: formatDepotLabel(depot),
      })),
    ],
    [depots]
  );

  const lineTotals = useMemo(() => {
    let total = 0;
    let inventoryTotal = 0;
    let expenseTotal = 0;

    for (const line of lines) {
      const quantity = parsePositiveNumber(line.quantity) || 0;
      const unitCost = parseNonNegativeNumber(line.unitCost);
      const lineTotal = unitCost === null ? 0 : quantity * unitCost;
      total += lineTotal;
      if (line.lineType === "expense") {
        expenseTotal += lineTotal;
      } else {
        inventoryTotal += lineTotal;
      }
    }

    return { total, inventoryTotal, expenseTotal };
  }, [lines]);

  const handleSelectSupplier = (value: string) => {
    setSupplierId(value);
    const supplier = suppliers.find((entry) => String(entry.id) === value);
    if (supplier) {
      setSupplierName(supplier.name);
      setSupplierContact(
        [supplier.contact_name, supplier.email, supplier.phone]
          .filter(Boolean)
          .join(" | ")
      );
    }
  };

  const handleCreateDepot = async () => {
    if (!newDepotName.trim()) {
      setNewDepotError("Give the depot a name first.");
      return;
    }

    setCreatingDepot(true);
    setNewDepotError("");
    try {
      const depot = await createDepot(userId, {
        name: newDepotName,
        code: newDepotCode,
      });
      setDepots((current) =>
        [...current, depot].sort((a, b) => a.name.localeCompare(b.name))
      );
      setDepotId(String(depot.id));
      setNewDepotOpen(false);
      setNewDepotName("");
      setNewDepotCode("");
    } catch {
      setNewDepotError("Could not create the depot. Try again.");
    } finally {
      setCreatingDepot(false);
    }
  };

  const addInventoryLine = (item: PickerItem) => {
    setLines((current) => {
      if (
        current.some(
          (line) =>
            line.lineType === "inventory" && line.inventoryItemId === item.id
        )
      ) {
        return current;
      }

      return [
        ...current,
        {
          key: makeLineKey(),
          lineType: "inventory",
          inventoryItemId: item.id,
          image: item.image ?? null,
          name: item.name,
          sku: item.sku,
          itemCode: item.item_code,
          unitLabel: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
          quantity: "1",
          unitCost: costInOrderCurrency(item.cost_price),
          affectsStock: true,
          expenseCategory: "other",
          note: "",
        },
      ];
    });
    setPickerOpen(false);
    setPickerQuery("");
  };

  const addExpenseLine = () => {
    setLines((current) => [
      ...current,
      {
        key: makeLineKey(),
        lineType: "expense",
        inventoryItemId: null,
        name: "",
        sku: null,
        itemCode: null,
        unitLabel: null,
        quantity: "1",
        unitCost: "",
        affectsStock: false,
        expenseCategory: "supplies",
        note: "",
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  /* "Save purchase order" means the order has been placed: it is saved as
     ordered and shows up under Deliveries expected on Stock In. "Save as
     draft" keeps it out of that list until it is actually sent. Before this
     every order was a draft until the day it was received, so the two words
     meant the same thing. */
  const handleSave = async (mode: "ordered" | "draft" = "ordered") => {
    setError("");

    if (!poNumber.trim()) {
      setError("The purchase order needs a PO number.");
      return;
    }

    if (lines.length === 0) {
      setError("Add at least one line — an inventory item or a general purchase.");
      return;
    }

    for (const line of lines) {
      if (!line.name.trim()) {
        setError("Every line needs a name. Fill in or remove the empty line.");
        return;
      }
      if (parsePositiveNumber(line.quantity) === null) {
        setError(`"${line.name}" needs a quantity greater than zero.`);
        return;
      }
      if (
        line.affectsStock &&
        !Number.isInteger(Number(line.quantity))
      ) {
        setError(
          `"${line.name}" adds to stock when received, so its quantity must be a whole number.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentLabel: string | null = null;

      if (attachmentFile) {
        try {
          const uploaded = await uploadPurchaseOrderAttachment(
            userId,
            attachmentFile
          );
          attachmentUrl = uploaded.url;
          attachmentLabel = uploaded.label;
        } catch {
          setError(
            "The invoice image could not be uploaded. If this keeps happening, make sure sql/phase-8-purchase-orders.sql was run in Supabase (it creates the po-attachments storage bucket)."
          );
          setSaving(false);
          return;
        }
      }

      const orderLines: PurchaseOrderLineInput[] = lines.map((line) => ({
        line_type: line.lineType,
        inventory_item_id:
          line.lineType === "inventory" ? line.inventoryItemId : null,
        affects_stock: line.lineType === "inventory" ? line.affectsStock : false,
        expense_category:
          line.lineType === "expense" ? line.expenseCategory : null,
        name_snapshot: line.name.trim(),
        sku_snapshot: line.sku,
        item_code_snapshot: line.itemCode,
        unit_label_snapshot: line.unitLabel,
        quantity: parsePositiveNumber(line.quantity) || 1,
        unit_cost: parseNonNegativeNumber(line.unitCost),
        notes: line.note.trim() || null,
      }));

      const orderId = await createPurchaseOrder(
        userId,
        {
          po_number: poNumber.trim(),
          title: title.trim() || null,
          supplier_id: supplierId ? Number(supplierId) : null,
          supplier_name_snapshot: supplierName.trim() || null,
          supplier_contact_snapshot: supplierContact.trim() || null,
          depot_id: depotId ? Number(depotId) : null,
          depot_name_snapshot: selectedDepot
            ? formatDepotLabel(selectedDepot)
            : null,
          purchase_date: purchaseDate || null,
          expected_delivery_date: expectedDeliveryDate || null,
          status: receiveNow ? "draft" : mode,
          payment_method: (paymentMethod ||
            null) as PurchaseOrderPaymentMethod | null,
          paid_by: paidBy.trim() || null,
          payment_status: paymentStatus,
          amount_paid: parseNonNegativeNumber(amountPaid),
          currency_code: currencyCode,
          exchange_rate: exchangeRate ?? 1,
          notes: notes.trim() || null,
          attachment_url: attachmentUrl,
          attachment_label: attachmentLabel,
        },
        orderLines
      );

      // "Already received" → immediately add stock-affecting lines to inventory.
      // The order is already saved as a draft, so a receive failure is non-fatal:
      // the user can still open it from history and press Mark received.
      if (receiveNow) {
        try {
          await receivePurchaseOrder(orderId);
        } catch {
          router.push(
            `/dashboard/purchase-orders?created=${orderId}&receivefailed=1`
          );
          return;
        }
      }

      router.push(`/dashboard/purchase-orders?created=${orderId}`);
    } catch (saveError) {
      setError(
        isPurchaseOrdersSchemaMissing(saveError)
          ? SCHEMA_MISSING_MESSAGE
          : "The purchase order could not be saved. Check the fields and try again."
      );
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardPageShell as="main">
        <LoadingSkeletonGroup count={4} itemClassName="min-h-28" />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell className="po-create-workspace" as="main">
      <DashboardPageHeader
        eyebrow="Operations"
        title="New Purchase Order"
        description="Record anything you buy — stock for inventory, or general purchases like equipment and supplies for a depot."
        actions={
          <ContextBackButton
            fallbackHref="/dashboard/purchase-orders"
            label="Back"
          />
        }
      />

      {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

      {/* Three blocks, stacked: the fields, then Lines, then the invoice
          dropzone. The two-column pairing Sayed asked for is still here, but
          it happens INSIDE the field card now -- `.item-form-groups` is a
          container query, so the same groups reflow at whatever width they
          are given, and the old `.po-new-grid` order/nth-child juggling is
          gone with the sections it was counting. */}
      <div className="po-new-grid">
      {/* One card, four groups of label-left rows -- the same shape as the
          new invoice (app/dashboard/sales/new/page.tsx) and Add Item. This
          was four boxed cards with every caption stacked above its own
          outlined input: a different shape for the same job, on the last
          form still doing it that way.

          Lines and the invoice dropzone stay exactly as they are below.
          Neither is a label/value form -- one is a list editor, the other a
          dropzone -- and the invoice page draws the same distinction. */}
      <section className="dashboard-card item-form p-0">
        <div className="item-form-groups">
          <FieldGroup
            label="Order details"
            description="The number is generated from the depot or business name — edit it any time."
          >
            <FieldRow label="Number" htmlFor="po-number">
              <input
                id="po-number"
                value={poNumber}
                onChange={(event) => {
                  setPoNumberEdited(true);
                  setPoNumber(event.target.value);
                }}
                placeholder="SYDIN-PO-0001"
              />
            </FieldRow>

            <FieldRow label="Title" htmlFor="po-title">
              <input
                id="po-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. March restock"
              />
            </FieldRow>

            <FieldRow label="Date" htmlFor="po-date">
              <input
                id="po-date"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </FieldRow>

            <FieldRow label="Expected" htmlFor="po-expected">
              <input
                id="po-expected"
                type="date"
                value={expectedDeliveryDate}
                onChange={(event) =>
                  setExpectedDeliveryDate(event.target.value)
                }
              />
            </FieldRow>

            <FieldRow label="Reference" htmlFor="po-reference">
              <input
                id="po-reference"
                value={internalReference}
                onChange={(event) => setInternalReference(event.target.value)}
                placeholder="Budget code, project, request…"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            label="Depot &amp; supplier"
            action={
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<UiIcon name="plus" className="h-4 w-4" />}
                onClick={() => setNewDepotOpen(true)}
              >
                New depot
              </Button>
            }
          >
            {/* `ariaLabel`, not `label`: FieldRow already renders the visible
                caption, and Select's own label would print a second one. */}
            <FieldRow label="Depot">
              <Select
                ariaLabel="Depot"
                value={depotId}
                onChange={setDepotId}
                options={depotOptions}
                searchable={depots.length > 8}
              />
            </FieldRow>

            <FieldRow label="Supplier">
              <Select
                ariaLabel="Saved supplier"
                value={supplierId}
                onChange={handleSelectSupplier}
                options={supplierOptions}
                searchable={suppliers.length > 8}
              />
            </FieldRow>

            <FieldRow label="Name" htmlFor="po-supplier-name">
              <input
                id="po-supplier-name"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Supplier or vendor"
              />
            </FieldRow>

            <FieldRow label="Contact" htmlFor="po-supplier-contact">
              <input
                id="po-supplier-contact"
                value={supplierContact}
                onChange={(event) => setSupplierContact(event.target.value)}
                placeholder="Person, email or phone"
              />
            </FieldRow>
          </FieldGroup>

          <FieldGroup
            label="Payment"
            description="Shown on the PDF and counted in spending analytics."
          >
            <FieldRow label="Currency">
              <Select
                ariaLabel="Order currency"
                value={currencyCode}
                onChange={(next) => {
                  const from = currencyCode;
                  setOrderCurrency(next);
                  // Lines already priced follow, so they keep their value.
                  setLines((current) =>
                    current.map((line) =>
                      line.unitCost === ""
                        ? line
                        : {
                            ...line,
                            unitCost: String(
                              roundForCurrency(convertAmount(Number(line.unitCost), from, next), next)
                            ),
                          }
                    )
                  );
                }}
                options={currencyChoicesIncluding(currencyCode, baseCurrency)}
              />
              {currencyCode !== baseCurrency && (
                <p className="mt-1 text-xs text-theme-muted">
                  {exchangeRate === null
                    ? `No rate for ${currencyCode} yet — set one in Settings › Company.`
                    : `1 ${baseCurrency} = ${formatExactPrice(exchangeRate, currencyCode)} today. Saved with the order.`}
                </p>
              )}
            </FieldRow>
            <FieldRow label="Method">
              <Select
                ariaLabel="Payment method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: "", label: "Not set" },
                  ...Object.entries(PURCHASE_ORDER_PAYMENT_METHOD_LABELS).map(
                    ([value, label]) => ({ value, label })
                  ),
                ]}
              />
            </FieldRow>

            <FieldRow label="Status">
              <Select
                ariaLabel="Payment status"
                value={paymentStatus}
                onChange={(value) =>
                  setPaymentStatus(value as PurchaseOrderPaymentStatus)
                }
                options={Object.entries(
                  PURCHASE_ORDER_PAYMENT_STATUS_LABELS
                ).map(([value, label]) => ({ value, label }))}
              />
            </FieldRow>

            <FieldRow label="Paid by" htmlFor="po-paid-by">
              <input
                id="po-paid-by"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                placeholder="Person or account"
              />
            </FieldRow>

            {/* The currency moves out of the caption and in front of the
                field, the way Add Item shows a price -- the label column is
                6.5rem and "Amount paid (USD)" does not fit in it. */}
            <FieldRow label="Amount" htmlFor="po-amount-paid">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-theme-accent">
                  {currencyCode}
                </span>
                <input
                  id="po-amount-paid"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </FieldRow>
          </FieldGroup>

          <FieldGroup label="Notes">
            {/* `.item-panel-textarea`, not a bare FieldRow child: a textarea
                inside `.item-field-row-control` is handed `resize: vertical`
                back, and Sayed asked for no drag handle. */}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything worth remembering about this purchase"
              className="item-panel-textarea"
            />
          </FieldGroup>
        </div>
      </section>

      <DashboardFormSection
        title="Lines"
        description="Mix inventory items and general purchases in the same order. Inventory lines can add to stock when the order is received."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<UiIcon name="box" className="h-4 w-4" />}
              onClick={() => setPickerOpen(true)}
            >
              Add inventory item
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<UiIcon name="file" className="h-4 w-4" />}
              onClick={addExpenseLine}
            >
              Add general purchase
            </Button>
          </div>
        }
      >
        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-theme px-4 py-6 text-center text-sm text-theme-muted">
            No lines yet. Add an inventory item, or a general purchase like
            &ldquo;New AC unit&rdquo; or &ldquo;Cleaning supplies&rdquo;.
          </p>
        ) : (
          /* Same shape as the invoice's "What was sold": a line is a row, not
             a card. Name, quantity, unit cost and either the category (a
             general purchase) or the line total (an inventory item) sit on
             one row; the stock toggle and the note fold under it. The old
             card also squeezed the general-purchase name into ~110px because
             its wrapper had no room to grow. */
          <ul className="border-t border-theme">
            {lines.map((line) => {
              const quantity = parsePositiveNumber(line.quantity) || 0;
              const unitCost = parseNonNegativeNumber(line.unitCost);
              const lineTotal = unitCost === null ? null : quantity * unitCost;

              return (
                <li
                  key={line.key}
                  className="border-b border-theme px-1 py-3 last:border-b-0"
                >
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_9rem_auto] sm:items-end">
                    <div className="flex min-w-0 items-center gap-2">
                      {line.lineType === "inventory" ? (
                        <span className="po-line-thumb">
                          <ProductThumbnail
                            src={line.image}
                            alt=""
                            width={40}
                            height={40}
                            sizes="40px"
                          />
                        </span>
                      ) : (
                        <span className="po-line-type-chip" aria-hidden="true">
                          <UiIcon name="file" className="h-4 w-4" />
                        </span>
                      )}
                      {line.lineType === "inventory" ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-theme-primary">
                            {line.name}
                          </p>
                          <p className="truncate text-xs text-theme-muted">
                            {[line.itemCode, line.sku, line.unitLabel]
                              .filter(Boolean)
                              .join(" · ") || "Inventory item"}
                          </p>
                        </div>
                      ) : (
                        <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-theme-secondary">
                          <span className="sr-only">What did you buy</span>
                          <input
                            value={line.name}
                            onChange={(event) =>
                              updateLine(line.key, { name: event.target.value })
                            }
                            placeholder="What did you buy? e.g. New AC unit"
                            className="sale-input"
                          />
                        </label>
                      )}
                    </div>

                    <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                      <span>
                        Qty{line.unitLabel ? ` (${line.unitLabel})` : ""}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step={line.affectsStock ? "1" : "any"}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, { quantity: event.target.value })
                        }
                        className="sale-input"
                      />
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                      <span>Unit cost ({currencyCode})</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(line.key, { unitCost: event.target.value })
                        }
                        placeholder="Optional"
                        className="sale-input"
                      />
                    </label>

                    {line.lineType === "expense" ? (
                      <Select
                        label="Category"
                        value={line.expenseCategory}
                        onChange={(value) =>
                          updateLine(line.key, {
                            expenseCategory: value as PurchaseOrderExpenseCategory,
                          })
                        }
                        options={Object.entries(
                          PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS
                        ).map(([value, label]) => ({ value, label }))}
                      />
                    ) : (
                      <div className="grid gap-1 text-xs font-semibold text-theme-secondary">
                        <span>Line total</span>
                        <p className="flex min-h-11 items-center text-sm font-semibold text-theme-primary tabular-nums">
                          {lineTotal === null
                            ? "—"
                            : formatExactPrice(lineTotal, currencyCode)}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="po-line-remove mb-1.5 justify-self-start sm:justify-self-end"
                      aria-label={`Remove ${line.name || "line"}`}
                      title="Remove line"
                    >
                      <UiIcon name="trash" className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                    {line.lineType === "inventory" ? (
                      <label className="flex items-center gap-2 text-xs text-theme-secondary">
                        <input
                          type="checkbox"
                          checked={line.affectsStock}
                          onChange={(event) =>
                            updateLine(line.key, {
                              affectsStock: event.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-sydin-blue focus:ring-sydin-blue/50"
                        />
                        <span>
                          Add to stock when received
                          <span className="text-theme-subtle">
                            {" "}
                            — the change shows in {line.name}&rsquo;s history
                            as this PO
                          </span>
                        </span>
                      </label>
                    ) : (
                      <span aria-hidden="true" className="hidden sm:block" />
                    )}
                    <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                      <span className="sr-only">Line note</span>
                      <input
                        value={line.note}
                        onChange={(event) =>
                          updateLine(line.key, { note: event.target.value })
                        }
                        placeholder="Note — brand, model, reason (optional)"
                        className="sale-input"
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="po-totals-bar">
            <span>
              Stock purchases:{" "}
              <strong>
                {formatExactPrice(lineTotals.inventoryTotal, currencyCode) ||
                  "—"}
              </strong>
            </span>
            <span>
              General purchases:{" "}
              <strong>
                {formatExactPrice(lineTotals.expenseTotal, currencyCode) || "—"}
              </strong>
            </span>
            <span className="po-totals-grand">
              Total:{" "}
              <strong>
                {formatExactPrice(lineTotals.total, currencyCode) || "—"}
              </strong>
            </span>
          </div>
        )}
      </DashboardFormSection>

      <DashboardFormSection
        title="Invoice or proof (optional)"
        description="Attach a photo of the supplier invoice or the purchase sheet. On a phone, the camera opens directly."
      >
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setAttachmentFile(file);
            event.target.value = "";
          }}
        />
        {attachmentFile ? (
          <div className="po-attachment-preview">
            {attachmentPreview && (
              <Image
                src={attachmentPreview}
                alt="Invoice preview"
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-xl border border-theme bg-white object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-theme-primary">
                {attachmentFile.name}
              </p>
              <p className="text-xs font-semibold text-theme-muted">
                Uploaded when you save the purchase order.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                leadingIcon={<UiIcon name="trash" className="h-4 w-4" />}
                onClick={() => setAttachmentFile(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            leadingIcon={<UiIcon name="upload" className="h-4 w-4" />}
            onClick={() => attachmentInputRef.current?.click()}
          >
            Add invoice image
          </Button>
        )}
      </DashboardFormSection>
      </div>

      <UnsavedChangesGuard
        when={hasUnsavedWork}
        what="this purchase order"
      />

      <DashboardCard className="po-receive-now-card">
        <label className="po-receive-now-toggle">
          <input
            type="checkbox"
            checked={receiveNow}
            onChange={(event) => setReceiveNow(event.target.checked)}
          />
          <span>
            <strong>We already received these items — add to stock now</strong>
            <small>
              Leave this off to save the order and receive it later, when the goods
              arrive. When on, saving immediately adds every &ldquo;add to
              stock&rdquo; line to its item&rsquo;s quantity.
            </small>
          </span>
        </label>
      </DashboardCard>

      <DashboardCard className="po-save-bar">
        <div className="min-w-0">
          <p className="text-sm font-black text-theme-primary">
            {poNumber || "Purchase order"}
          </p>
          <p className="text-xs font-semibold text-theme-muted">
            {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
            {formatExactPrice(lineTotals.total, currencyCode) || "No total yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton href="/dashboard/purchase-orders" variant="ghost">
            Cancel
          </ActionButton>
          {!receiveNow && (
            <Button
              variant="secondary"
              onClick={() => handleSave("draft")}
              disabled={saving}
            >
              Save as draft
            </Button>
          )}
          <Button
            onClick={() => handleSave("ordered")}
            disabled={saving}
            leadingIcon={<UiIcon name="check" className="h-4 w-4" />}
          >
            {saving
              ? "Saving…"
              : receiveNow
                ? "Save & receive now"
                : "Save purchase order"}
          </Button>
        </div>
      </DashboardCard>

      {newDepotOpen && (
        <DialogShell
          title="New depot"
          description="Create a depot for this purchase without leaving the page."
          onClose={() => setNewDepotOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNewDepotOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDepot} disabled={creatingDepot}>
                {creatingDepot ? "Creating…" : "Create depot"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-3">
            {newDepotError && (
              <DashboardNotice tone="danger">{newDepotError}</DashboardNotice>
            )}
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-theme-secondary">
                Depot name
              </span>
              <input
                value={newDepotName}
                onChange={(event) => setNewDepotName(event.target.value)}
                placeholder="e.g. Main warehouse"
                className={inputClassName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-theme-secondary">
                Code (optional, used in PO numbers)
              </span>
              <input
                value={newDepotCode}
                onChange={(event) => setNewDepotCode(event.target.value)}
                placeholder="e.g. MAIN"
                className={inputClassName}
              />
            </label>
          </div>
        </DialogShell>
      )}

      {pickerOpen && (
        <DialogShell
          title="Add inventory item"
          description="Search your inventory by name, SKU, code or barcode."
          onClose={() => {
            setPickerOpen(false);
            setPickerQuery("");
          }}
        >
          <div className="grid gap-3">
            <label className="relative">
              <UiIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
              />
              <input
                autoFocus
                type="search"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search items…"
                className={`${inputClassName} pl-10`}
              />
            </label>
            {pickerLoading ? (
              <LoadingSkeletonGroup count={3} itemClassName="min-h-12" />
            ) : pickerResults.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm font-semibold text-theme-muted">
                No items found. Try a different name or code.
              </p>
            ) : (
              <div className="grid max-h-80 gap-1 overflow-y-auto">
                {pickerResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addInventoryLine(item)}
                    className="po-picker-row"
                  >
                    {/* A name is not enough to tell two similar cartons apart;
                        the photo is what a depot recognises. */}
                    <span className="po-line-thumb">
                      <ProductThumbnail
                        src={item.image}
                        alt=""
                        width={40}
                        height={40}
                        sizes="40px"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-theme-primary">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs font-semibold text-theme-muted">
                        {[item.item_code, item.sku].filter(Boolean).join(" · ") ||
                          "No code"}{" "}
                        · {item.quantity} in stock
                      </span>
                    </span>
                    <UiIcon name="plus" className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogShell>
      )}
    </DashboardPageShell>
  );
}
