"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import {
  Badge,
  Button,
  DialogShell,
  HelpLink,
  ResultsAnnouncer,
  Select,
} from "@/components/ui";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  LoadingSkeletonGroup,
  MetricCard,
} from "@/components/dashboard/Workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  formatInventoryPrice,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";
import { exportPurchaseOrderExcel } from "@/app/lib/purchaseOrderExcelExport";
import { exportPurchaseOrderPdf } from "@/app/lib/purchaseOrderPdfExport";
import { exportPurchaseOrderDocx } from "@/app/lib/documentDocxExports";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_METHOD_LABELS,
  PURCHASE_ORDER_PAYMENT_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
  addPurchaseOrderPayment,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  deletePurchaseOrderPayment,
  getPurchaseOrderBalance,
  getPurchaseOrderLineTotal,
  getPurchaseOrderPayments,
  getPurchaseOrderReceipts,
  getPurchaseOrderReceivingProgress,
  formatPurchaseOrderAmount,
  getPurchaseOrderCurrency,
  getPurchaseOrderSplit,
  getPurchaseOrderTotal,
  getPurchaseOrderTotalInBase,
  toPurchaseOrderBase,
  getPurchaseOrdersForUser,
  isPaymentsSchemaMissing,
  isPurchaseOrderOpen,
  isPurchaseOrdersSchemaMissing,
  isReceivingSchemaMissing,
  markPurchaseOrderOrdered,
  receivePurchaseOrderLines,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderPayment,
  type PurchaseOrderPaymentMethod,
  type PurchaseOrderReceipt,
  type PurchaseOrderStatus,
} from "@/app/lib/purchaseOrders";
import { supabase } from "@/app/lib/supabase";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

type StatusFilter = "all" | PurchaseOrderStatus;

const STATUS_TONES: Record<
  PurchaseOrderStatus,
  "neutral" | "accent" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  ordered: "accent",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};

const SCHEMA_MISSING_MESSAGE =
  "Purchase order history needs a one-time database update. Open Supabase → SQL Editor, paste the file sql/phase-8-purchase-orders.sql from the project, and click Run. Then refresh this page.";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const RECEIVING_SCHEMA_MESSAGE =
  "Receiving deliveries needs a one-time database update. Open Supabase → SQL Editor, paste sql/phase-23-partial-receiving.sql from the project, and click Run. Then try again.";

function formatUnits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** "1 unit", "3 units", "2.50 units". */
function unitsLabel(value: number) {
  return `${formatUnits(value)} ${value === 1 ? "unit" : "units"}`;
}

/** What is still to come on a line. Never negative. */
function lineOutstanding(line: PurchaseOrderLine) {
  return Math.max(0, line.quantity - line.received_quantity);
}

function isInCurrentMonth(order: PurchaseOrder) {
  const source = order.purchase_date || order.created_at;
  if (!source) return false;
  const date = new Date(source.includes("T") ? source : `${source}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription>(
    FALLBACK_SUBSCRIPTION,
  );
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS,
  );
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [depotFilter, setDepotFilter] = useState("all");

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    new Set(),
  );
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  // "receive" = confirm receive + record payment together; "edit" = record payment only.
  const [paymentMode, setPaymentMode] = useState<"none" | "receive" | "edit">(
    "none",
  );
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payBy, setPayBy] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payNote, setPayNote] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<
    PurchaseOrderPayment[]
  >([]);
  // Deliveries recorded against the open order, and item photos for its lines
  // -- a name alone is not enough to know which carton is which.
  const [selectedReceipts, setSelectedReceipts] = useState<
    PurchaseOrderReceipt[]
  >([]);
  const [lineImages, setLineImages] = useState<Record<number, string | null>>(
    {},
  );
  // Receive mode: how much of each line is arriving now, keyed by line id.
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<number, string>
  >({});
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveClose, setReceiveClose] = useState(false);
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  // An order on which nothing has happened -- no delivery, no payment -- is
  // noise in the history and can go. Once stock or money has moved it is
  // cancelled or closed, never deleted, so the record survives.
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");
  const [successNoticeTone, setSuccessNoticeTone] = useState<
    "success" | "warning"
  >("success");

  const currencyCode = normalizeCurrencyCode(settings.currency_code, "USD");
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!active) return;
      setUserId(user.id);

      const [loadedSettings, loadedSubscription] = await Promise.all([
        getOrCreateBusinessSettings(user.id),
        getUserSubscription(user.id),
      ]);
      if (!active) return;
      setSettings(loadedSettings);
      setSubscription(loadedSubscription);

      try {
        const loadedOrders = await getPurchaseOrdersForUser(user.id);
        if (!active) return;
        setOrders(loadedOrders);
      } catch (error) {
        if (!active) return;
        if (isPurchaseOrdersSchemaMissing(error)) {
          setSchemaMissing(true);
        } else {
          setLoadError(
            "Purchase orders could not be loaded. Refresh and try again.",
          );
        }
      }
      setLoading(false);
    }

    loadData().catch(() => {
      if (!active) return;
      setLoadError(
        "Purchase orders could not be loaded. Refresh and try again.",
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  // Load the payment timeline, the delivery history and the line photos
  // whenever a different order's dialog opens.
  useEffect(() => {
    if (selectedOrderId === null) return;

    let active = true;
    getPurchaseOrderPayments(selectedOrderId)
      .then((payments) => {
        if (active) setSelectedPayments(payments);
      })
      .catch(() => {
        if (active) setSelectedPayments([]);
      });
    getPurchaseOrderReceipts(selectedOrderId)
      .then((receipts) => {
        if (active) setSelectedReceipts(receipts);
      })
      .catch(() => {
        if (active) setSelectedReceipts([]);
      });

    const order = orders.find((entry) => entry.id === selectedOrderId);
    const itemIds = Array.from(
      new Set(
        (order?.lines || [])
          .map((line) => line.inventory_item_id)
          .filter((id): id is number => id !== null),
      ),
    );
    // Photos for the lines. An order with no inventory lines simply keeps
    // whatever map is there; nothing reads it.
    const loadImages = async () => {
      if (itemIds.length === 0) return {};
      const { data } = await supabase
        .from("inventory")
        .select("id, image")
        .in("id", itemIds);
      const next: Record<number, string | null> = {};
      for (const row of (data || []) as {
        id: number;
        image: string | null;
      }[]) {
        next[row.id] = row.image;
      }
      return next;
    };
    loadImages()
      .then((next) => {
        if (active) setLineImages(next);
      })
      .catch(() => {
        if (active) setLineImages({});
      });

    return () => {
      active = false;
    };
    // `orders` is deliberately not a dependency: a refresh after a receipt
    // must not refetch photos for the same dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  /* Deep link from Stock In: /dashboard/purchase-orders?open=12&receive=1
     opens that order's dialog straight into receiving. Acted on once the
     orders have arrived; the router's params, not window.location, because
     on a client-side navigation the page renders before the URL bar moves. */
  const openParam = Number(searchParams.get("open"));
  const receiveParam = searchParams.get("receive") === "1";
  const handledOpenRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading || !Number.isFinite(openParam) || openParam <= 0) return;
    if (handledOpenRef.current === openParam) return;
    handledOpenRef.current = openParam;
    const order = orders.find((entry) => entry.id === openParam);
    if (!order) return;
    // Deferred a frame, like the `created` notice below: opening a dialog
    // from inside the effect that noticed the URL is a render inside a render.
    const frame = window.requestAnimationFrame(() => {
      setSelectedOrderId(order.id);
      if (receiveParam && isPurchaseOrderOpen(order)) {
        const seeded: Record<number, string> = {};
        for (const line of order.lines) {
          const outstanding = lineOutstanding(line);
          if (outstanding > 0) seeded[line.id] = formatUnits(outstanding);
        }
        setReceiveQuantities(seeded);
        setReceiveNotes("");
        setReceiveClose(false);
        setReceivePaymentOpen(false);
        setPayAmount("");
        setPayMethod(order.payment_method || "");
        setPayBy(order.paid_by || "");
        setPayDate(todayIsoDate());
        setPayNote("");
        setPaymentMode("receive");
      }
      window.history.replaceState(null, "", "/dashboard/purchase-orders");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openParam, receiveParam, loading, orders]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get("created");
    if (!created) return;
    const receiveFailed = params.get("receivefailed") === "1";

    const frame = window.requestAnimationFrame(() => {
      if (receiveFailed) {
        setSuccessNoticeTone("warning");
        setSuccessNotice(
          "Purchase order saved, but the stock update didn't run. Open it below and press Mark received to add the items to inventory.",
        );
      } else {
        setSuccessNoticeTone("success");
        setSuccessNotice("Purchase order saved to your history.");
      }
      window.history.replaceState(null, "", "/dashboard/purchase-orders");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const depotOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const order of orders) {
      if (order.depot_name_snapshot) {
        labels.set(order.depot_name_snapshot, order.depot_name_snapshot);
      }
    }

    return [
      { value: "all", label: "All depots" },
      ...Array.from(labels.values())
        .sort((a, b) => a.localeCompare(b))
        .map((label) => ({ value: label, label })),
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (
        depotFilter !== "all" &&
        (order.depot_name_snapshot || "") !== depotFilter
      ) {
        return false;
      }
      if (!normalizedSearch) return true;

      return [
        order.po_number,
        order.title,
        order.supplier_name_snapshot,
        order.depot_name_snapshot,
        order.paid_by,
        order.internal_reference,
        ...order.lines.map((line) => line.name_snapshot),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [orders, search, statusFilter, depotFilter]);

  // Group the (already newest-first) filtered orders into collapsible month sections.
  const monthGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string;
      orders: PurchaseOrder[];
    }> = [];
    const indexByKey = new Map<string, number>();

    for (const order of filteredOrders) {
      const source = order.purchase_date || order.created_at;
      const date = source
        ? new Date(source.includes("T") ? source : `${source}T00:00:00`)
        : null;
      const valid = date && !Number.isNaN(date.getTime());
      const key = valid
        ? `${date!.getFullYear()}-${date!.getMonth()}`
        : "undated";
      const label = valid
        ? new Intl.DateTimeFormat("en", {
            month: "long",
            year: "numeric",
          }).format(date!)
        : "No date";

      if (!indexByKey.has(key)) {
        indexByKey.set(key, groups.length);
        groups.push({ key, label, orders: [] });
      }
      groups[indexByKey.get(key)!].orders.push(order);
    }

    return groups;
  }, [filteredOrders]);

  const spending = useMemo(() => {
    const monthOrders = orders.filter(
      (order) => order.status !== "cancelled" && isInCurrentMonth(order),
    );
    let inventoryTotal = 0;
    let expenseTotal = 0;

    for (const order of monthOrders) {
      // Orders in different currencies add up in base.
      const split = getPurchaseOrderSplit(order);
      inventoryTotal += toPurchaseOrderBase(order, split.inventoryTotal);
      expenseTotal += toPurchaseOrderBase(order, split.expenseTotal);
    }

    return {
      monthTotal: inventoryTotal + expenseTotal,
      inventoryTotal,
      expenseTotal,
      monthCount: monthOrders.length,
    };
  }, [orders]);

  const refreshOrders = async () => {
    try {
      setOrders(await getPurchaseOrdersForUser(userId));
    } catch {
      // Keep the current list; the action already reported its own error.
    }
  };

  const refreshSelectedPayments = async (orderId: number) => {
    try {
      setSelectedPayments(await getPurchaseOrderPayments(orderId));
    } catch {
      setSelectedPayments([]);
    }
  };

  const openPaymentPanel = (mode: "receive" | "edit") => {
    if (!selectedOrder) return;
    setActionError("");
    if (mode === "receive") {
      // Default to "everything still outstanding": the common case is the
      // whole delivery arriving, and a partial one is a matter of lowering
      // one or two numbers.
      const seeded: Record<number, string> = {};
      for (const line of selectedOrder.lines) {
        const outstanding = lineOutstanding(line);
        if (outstanding > 0) seeded[line.id] = formatUnits(outstanding);
      }
      setReceiveQuantities(seeded);
      setReceiveNotes("");
      setReceiveClose(false);
      setReceivePaymentOpen(false);
    }
    // Default this payment to the outstanding balance for a one-tap "pay the rest".
    const remaining = getPurchaseOrderBalance(selectedOrder).remaining;
    setPayAmount(remaining > 0 ? String(remaining) : "");
    setPayMethod(selectedOrder.payment_method || "");
    setPayBy(selectedOrder.paid_by || "");
    setPayDate(todayIsoDate());
    setPayNote("");
    setPaymentMode(mode);
  };

  const parsePayAmount = () => {
    const parsed = Number(payAmount.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const recordPaymentEntry = async (orderId: number) => {
    const amount = parsePayAmount();
    if (amount === null) return false;
    await addPurchaseOrderPayment(orderId, {
      amount,
      method: (payMethod || null) as PurchaseOrderPaymentMethod | null,
      paid_by: payBy.trim() || null,
      note: payNote.trim() || null,
      paid_at: payDate || null,
    });
    return true;
  };

  /* Units being received now, and what would still be outstanding after. */
  const receivingSummary = useMemo(() => {
    if (!selectedOrder) return { now: 0, after: 0, invalid: false };
    let now = 0;
    let after = 0;
    let invalid = false;
    for (const line of selectedOrder.lines) {
      const outstanding = lineOutstanding(line);
      const raw = receiveQuantities[line.id];
      const value = raw === undefined || raw.trim() === "" ? 0 : Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > outstanding + 1e-9) {
        invalid = true;
        continue;
      }
      if (line.affects_stock && !Number.isInteger(value)) invalid = true;
      now += value;
      after += outstanding - value;
    }
    return { now, after: Math.max(0, after), invalid };
  }, [selectedOrder, receiveQuantities]);

  const handleReceive = async () => {
    if (!selectedOrder) return;
    if (receivingSummary.invalid) {
      setActionError(
        "Check the quantities: each must be a whole number no larger than what is still outstanding.",
      );
      return;
    }
    if (receivingSummary.now <= 0 && !receiveClose) {
      setActionError(
        "Enter what arrived for at least one line, or close the order short.",
      );
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      // A payment on delivery is optional — only log it when an amount was entered.
      if (receivePaymentOpen) await recordPaymentEntry(selectedOrder.id);
      const lines = selectedOrder.lines
        .map((line) => ({
          line_id: line.id,
          quantity: Number(receiveQuantities[line.id] || 0),
        }))
        .filter((line) => line.quantity > 0);
      await receivePurchaseOrderLines(selectedOrder.id, lines, {
        notes: receiveNotes,
        close: receiveClose,
      });
      await refreshOrders();
      setPaymentMode("none");
      setSuccessNoticeTone("success");
      const received = unitsLabel(receivingSummary.now);
      setSuccessNotice(
        receivingSummary.after > 0 && !receiveClose
          ? `${selectedOrder.po_number}: ${received} received and added to stock. ${formatUnits(
              receivingSummary.after,
            )} still to come — the order stays open.`
          : receiveClose && receivingSummary.after > 0
            ? `${selectedOrder.po_number} closed short: ${received} received, ${formatUnits(
                receivingSummary.after,
              )} never arrived.`
            : `${selectedOrder.po_number} fully received. Stock lines were added to inventory.`,
      );
      setSelectedOrderId(null);
    } catch (error) {
      setActionError(
        isReceivingSchemaMissing(error)
          ? RECEIVING_SCHEMA_MESSAGE
          : "The delivery could not be recorded. Refresh and try again — if a line's item was deleted, edit the order first.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedOrder) return;
    if (parsePayAmount() === null) {
      setActionError("Enter a payment amount greater than zero.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      await recordPaymentEntry(selectedOrder.id);
      await Promise.all([
        refreshOrders(),
        refreshSelectedPayments(selectedOrder.id),
      ]);
      setPaymentMode("none");
    } catch (error) {
      setActionError(
        isPaymentsSchemaMissing(error)
          ? "Payments need a one-time database update — run sql/phase-9-purchase-order-payments.sql in Supabase, then try again."
          : "The payment could not be recorded. Try again.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await deletePurchaseOrderPayment(paymentId);
      await Promise.all([
        refreshOrders(),
        refreshSelectedPayments(selectedOrder.id),
      ]);
    } catch {
      setActionError("The payment could not be removed. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const canDeleteOrder =
    selectedOrder !== null &&
    (selectedOrder.status === "draft" || selectedOrder.status === "ordered") &&
    selectedPayments.length === 0 &&
    selectedOrder.lines.every((line) => line.received_quantity <= 0);

  const handleDeleteDraft = async () => {
    if (!selectedOrder || !canDeleteOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await deletePurchaseOrder(userId, selectedOrder.id);
      await refreshOrders();
      setConfirmDeleteDraft(false);
      setSelectedOrderId(null);
      setSuccessNoticeTone("success");
      setSuccessNotice(`${selectedOrder.po_number} deleted.`);
    } catch {
      setConfirmDeleteDraft(false);
      setActionError("The order could not be deleted. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkOrdered = async () => {
    if (!selectedOrder || selectedOrder.status !== "draft") return;
    setActionBusy(true);
    setActionError("");
    try {
      await markPurchaseOrderOrdered(userId, selectedOrder.id);
      await refreshOrders();
    } catch {
      setActionError("The order could not be marked as ordered. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await cancelPurchaseOrder(userId, selectedOrder.id);
      await refreshOrders();
      setSelectedOrderId(null);
    } catch {
      setActionError("The order could not be cancelled. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const exportDetails = (order: PurchaseOrder) => ({
    poNumber: order.po_number,
    title: order.title || undefined,
    supplierName: order.supplier_name_snapshot || "Not set",
    supplierContact: order.supplier_contact_snapshot || undefined,
    depotName: order.depot_name_snapshot || undefined,
    purchaseDate: order.purchase_date || undefined,
    expectedDeliveryDate: order.expected_delivery_date || undefined,
    status: PURCHASE_ORDER_STATUS_LABELS[order.status],
    paymentMethod: order.payment_method
      ? PURCHASE_ORDER_PAYMENT_METHOD_LABELS[order.payment_method]
      : undefined,
    paidBy: order.paid_by || undefined,
    paymentStatus: PURCHASE_ORDER_PAYMENT_STATUS_LABELS[order.payment_status],
    amountPaid: order.amount_paid,
    notes: order.notes || undefined,
    internalReference: order.internal_reference || undefined,
  });

  const exportBranding = () => ({
    businessName: settings.business_name,
    businessLogoUrl: settings.business_logo_url || undefined,
    contactEmail: settings.contact_email || undefined,
    contactPhone: settings.contact_phone || undefined,
    contactWebsite: settings.contact_website || undefined,
  });

  /* One description of the document; PDF and Word both print it. */
  const buildOrderDocument = (order: PurchaseOrder) => ({
    details: exportDetails(order),
    lines: order.lines.map((line) => ({
      name: line.name_snapshot,
      category:
        line.line_type === "expense" && line.expense_category
          ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expense_category]
          : undefined,
      code: line.item_code_snapshot || undefined,
      sku: line.sku_snapshot || undefined,
      unit: line.unit_label_snapshot || "unit",
      imageUrl:
        line.inventory_item_id !== null
          ? (lineImages[line.inventory_item_id] ?? null)
          : null,
      orderQuantity: line.quantity,
      receivedQuantity: line.received_quantity,
      unitCost: line.unit_cost,
      lineTotal: getPurchaseOrderLineTotal(line),
      note: line.notes || undefined,
    })),
    branding: brandingFromSettings(settings),
    currencyCode: getPurchaseOrderCurrency(order),
  });

  const handleExportDocument = async (format: "pdf" | "docx") => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      const spec = buildOrderDocument(selectedOrder);
      if (format === "pdf") await exportPurchaseOrderPdf(spec);
      else await exportPurchaseOrderDocx(spec);
    } catch {
      setActionError(
        format === "pdf"
          ? "The PDF could not be generated. Try again."
          : "The Word file could not be generated. Try again.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await exportPurchaseOrderExcel({
        details: exportDetails(selectedOrder),
        lines: selectedOrder.lines.map((line) => ({
          type: line.line_type === "expense" ? "General purchase" : "Inventory",
          name: line.name_snapshot,
          category:
            line.line_type === "expense" && line.expense_category
              ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expense_category]
              : undefined,
          code: line.item_code_snapshot || undefined,
          sku: line.sku_snapshot || undefined,
          unit: line.unit_label_snapshot || "unit",
          quantity: line.quantity,
          unitCost: line.unit_cost,
          lineTotal: getPurchaseOrderLineTotal(line),
          affectsStock: line.affects_stock,
          note: line.notes || undefined,
        })),
        branding: exportBranding(),
        currencyCode: getPurchaseOrderCurrency(selectedOrder),
      });
    } catch {
      setActionError("The Excel file could not be generated. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  // Purchasing is where Free stops. The landing page promises "know what is in
  // your depot", and Free delivers exactly that; raising orders against
  // suppliers is the first thing a growing wholesaler pays for. Gated here
  // rather than only described on the pricing page, so the two agree.
  if (!getSubscriptionCapabilities(subscription).purchaseOrders) {
    return (
      <DashboardPageShell className="po-history-workspace" as="main">
        <DashboardPageHeader
          eyebrow="Operations"
          title="Purchase Orders"
          description="Record what you buy, what you paid, and what arrived."
        />
        <LockedFeaturePanel
          feature="Purchase orders"
          benefit="Record every purchase with its cost, payment status and invoice, then receive the stock straight into your depot."
          currentPlan={formatPlanName(subscription.plan)}
          requiredPlan="Standard"
          source="purchase-orders"
        />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell className="po-history-workspace" as="main">
      <DashboardPageHeader
        eyebrow="Operations"
        title="Purchase Orders"
        description="Every purchase in one place — stock restocks and general spending like equipment or supplies, saved permanently with proof attached."
        actions={
          <ActionButton href="/dashboard/purchase-orders/new" icon="plus">
            New purchase order
          </ActionButton>
        }
      />

      {successNotice && (
        <DashboardNotice tone={successNoticeTone}>
          {successNotice}
        </DashboardNotice>
      )}
      {loadError && (
        <DashboardNotice tone="danger">{loadError}</DashboardNotice>
      )}
      {schemaMissing && (
        <DashboardNotice tone="warning">
          {SCHEMA_MISSING_MESSAGE}
        </DashboardNotice>
      )}

      {!schemaMissing && (
        <div className="po-summary-grid">
          <MetricCard
            label="Spent this month"
            value={
              formatInventoryPrice(spending.monthTotal, currencyCode) || "—"
            }
            detail={`${spending.monthCount} purchase${
              spending.monthCount === 1 ? "" : "s"
            }`}
            icon="reports"
          />
          <MetricCard
            label="Stock purchases"
            value={
              formatInventoryPrice(spending.inventoryTotal, currencyCode) || "—"
            }
            detail="Inventory restocks this month"
            icon="box"
          />
          <MetricCard
            label="General purchases"
            value={
              formatInventoryPrice(spending.expenseTotal, currencyCode) || "—"
            }
            detail="Equipment, supplies, services"
            icon="file"
          />
        </div>
      )}

      {!schemaMissing && (
        <DashboardToolbar className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative">
            <UiIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search PO number, supplier, item…"
              className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/10"
            />
          </label>
          <Select
            ariaLabel="Status filter"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "all", label: "All statuses" },
              ...Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(
                ([value, label]) => ({ value, label }),
              ),
            ]}
          />
          <Select
            ariaLabel="Depot filter"
            value={depotFilter}
            onChange={setDepotFilter}
            options={depotOptions}
            searchable={depotOptions.length > 9}
          />
        </DashboardToolbar>
      )}

      <ResultsAnnouncer count={filteredOrders.length} noun="order" />

      {loading ? (
        <LoadingSkeletonGroup count={4} itemClassName="min-h-20" />
      ) : schemaMissing ? (
        <DashboardEmptyState
          icon="file"
          title="One quick database step left"
          description="Run sql/phase-8-purchase-orders.sql in the Supabase SQL Editor to switch on saved purchase orders, spending analytics and invoice attachments."
          action={
            <ActionButton href="/dashboard/purchase-orders/new" icon="plus">
              Try the new purchase form
            </ActionButton>
          }
        />
      ) : filteredOrders.length === 0 ? (
        <DashboardEmptyState
          icon="file"
          title={
            orders.length === 0 ? "No purchases yet" : "No matching purchases"
          }
          description={
            orders.length === 0
              ? "Record your first purchase — a stock restock or anything you buy for a depot."
              : "Try a different search or clear the filters."
          }
          action={
            orders.length === 0 ? (
              <ActionButton href="/dashboard/purchase-orders/new" icon="plus">
                New purchase order
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <div className="po-history-months">
          {monthGroups.map((group) => {
            const collapsed = collapsedMonths.has(group.key);
            const groupTotal = group.orders.reduce(
              (sum, order) => sum + getPurchaseOrderTotalInBase(order),
              0,
            );

            return (
              <section key={group.key} className="po-month-group">
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    setCollapsedMonths((current) => {
                      const next = new Set(current);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })
                  }
                  className="po-month-header"
                >
                  <UiIcon
                    name="chevron-down"
                    className={`po-month-chevron h-4 w-4 ${
                      collapsed ? "po-month-chevron-collapsed" : ""
                    }`}
                  />
                  <span className="po-month-label">{group.label}</span>
                  <span className="po-month-meta">
                    {group.orders.length} order
                    {group.orders.length === 1 ? "" : "s"} ·{" "}
                    {formatInventoryPrice(groupTotal, currencyCode) || "—"}
                  </span>
                </button>

                {!collapsed && (
                  <div className="po-history-list">
                    {group.orders.map((order) => {
                      const total = getPurchaseOrderTotal(order);
                      const remaining =
                        order.status === "cancelled"
                          ? 0
                          : getPurchaseOrderBalance(order).remaining;

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setPaymentMode("none");
                            setActionError("");
                          }}
                          className={`po-history-row po-history-row-${order.status}`}
                        >
                          <span
                            className="po-history-row-icon"
                            aria-hidden="true"
                          >
                            <UiIcon
                              name={
                                order.lines.some(
                                  (line) => line.line_type === "expense",
                                )
                                  ? "file"
                                  : "box"
                              }
                              className="h-4 w-4"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-theme-primary">
                              {order.po_number}
                              {order.title ? ` — ${order.title}` : ""}
                            </span>
                            <span className="mt-0.5 block truncate text-xs font-semibold text-theme-muted">
                              {[
                                formatDate(
                                  order.purchase_date || order.created_at,
                                ),
                                order.depot_name_snapshot,
                                order.supplier_name_snapshot,
                                `${order.lines.length} line${
                                  order.lines.length === 1 ? "" : "s"
                                }`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                            {(order.status === "ordered" ||
                              order.status === "partially_received") &&
                              (() => {
                                const progress =
                                  getPurchaseOrderReceivingProgress(order);
                                return progress.received > 0 ? (
                                  <span
                                    className="rounded-lg border border-amber-300/50 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                    title="Units received so far"
                                  >
                                    {formatUnits(progress.received)} /{" "}
                                    {formatUnits(progress.ordered)} received
                                  </span>
                                ) : null;
                              })()}
                            {/* The status badge beside this already says
                                Cancelled; a second grey "Cancelled" pill in
                                the payment slot said it twice. */}
                            {order.status === "cancelled" ? null : remaining >
                              0 ? (
                              <span
                                className="rounded-lg border border-amber-300/50 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                title="Balance still owed"
                              >
                                Owe{" "}
                                {formatPurchaseOrderAmount(order, remaining)}
                              </span>
                            ) : (
                              <span
                                className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                title="Fully paid"
                              >
                                Paid
                              </span>
                            )}
                            {order.attachment_url && (
                              <span
                                className="flex items-center gap-1.5 rounded-lg border border-blue-300/50 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                                title="Invoice attached"
                              >
                                <UiIcon name="file" className="h-3 w-3" />
                                Invoice
                              </span>
                            )}
                            <Badge tone={STATUS_TONES[order.status]}>
                              {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                            </Badge>
                          </div>
                          <span className="shrink-0 text-right text-sm font-black text-theme-primary">
                            {formatPurchaseOrderAmount(order, total) || "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <DialogShell
          title={selectedOrder.po_number}
          eyebrow={PURCHASE_ORDER_STATUS_LABELS[selectedOrder.status]}
          description={selectedOrder.title || undefined}
          onClose={() => {
            setSelectedOrderId(null);
            setPaymentMode("none");
            setSelectedPayments([]);
          }}
          closeDisabled={actionBusy}
          footer={
            paymentMode === "receive" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPaymentMode("none")}
                  disabled={actionBusy}
                >
                  Back
                </Button>
                <Button
                  onClick={handleReceive}
                  disabled={
                    actionBusy || (receivingSummary.now <= 0 && !receiveClose)
                  }
                  loading={actionBusy}
                  loadingLabel="Recording…"
                >
                  {receiveClose && receivingSummary.now <= 0
                    ? "Close order"
                    : `Receive ${unitsLabel(receivingSummary.now)}`}
                </Button>
              </div>
            ) : paymentMode === "edit" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPaymentMode("none")}
                  disabled={actionBusy}
                >
                  Back
                </Button>
                <Button onClick={handleRecordPayment} disabled={actionBusy}>
                  {actionBusy ? "Saving…" : "Save payment"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  leadingIcon={<UiIcon name="download" className="h-4 w-4" />}
                  onClick={() => handleExportDocument("pdf")}
                  disabled={actionBusy}
                >
                  PDF
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<UiIcon name="file" className="h-4 w-4" />}
                  onClick={() => handleExportDocument("docx")}
                  disabled={actionBusy}
                >
                  Word
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<UiIcon name="sheet" className="h-4 w-4" />}
                  onClick={handleExportExcel}
                  disabled={actionBusy}
                >
                  Excel
                </Button>
                {selectedOrder.status !== "cancelled" && (
                  <Button
                    variant="secondary"
                    leadingIcon={<UiIcon name="usage" className="h-4 w-4" />}
                    onClick={() => openPaymentPanel("edit")}
                    disabled={actionBusy}
                  >
                    Record payment
                  </Button>
                )}
                {/* Cancelling stops at the first delivery: stock has been
                    added, so a partially received order is finished by
                    receiving the rest or closing it short, never undone. */}
                {canDeleteOrder ? (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDeleteDraft(true)}
                    disabled={actionBusy}
                  >
                    {selectedOrder.status === "draft"
                      ? "Delete draft"
                      : "Delete"}
                  </Button>
                ) : (
                  selectedOrder.status === "ordered" && (
                    <Button
                      variant="danger"
                      onClick={handleCancelOrder}
                      disabled={actionBusy}
                    >
                      Cancel order
                    </Button>
                  )
                )}
                {selectedOrder.status === "draft" && (
                  <Button
                    variant="secondary"
                    onClick={handleMarkOrdered}
                    disabled={actionBusy}
                    leadingIcon={<UiIcon name="cart" className="h-4 w-4" />}
                  >
                    Mark as ordered
                  </Button>
                )}
                {isPurchaseOrderOpen(selectedOrder) && (
                  <Button
                    onClick={() => openPaymentPanel("receive")}
                    leadingIcon={<UiIcon name="stock-in" className="h-4 w-4" />}
                    disabled={actionBusy}
                  >
                    {selectedOrder.status === "partially_received"
                      ? "Receive more"
                      : "Receive stock"}
                  </Button>
                )}
              </div>
            )
          }
        >
          <div className="grid gap-4">
            {actionError && (
              <DashboardNotice tone="danger">{actionError}</DashboardNotice>
            )}

            {paymentMode === "receive" && (
              <div className="po-receive-panel">
                <p className="text-sm text-theme-muted">
                  Enter what arrived. Lines marked{" "}
                  <span className="po-stock-flag">→ stock</span> are added to
                  inventory now; anything left over stays open on the order
                  until the next delivery.{" "}
                  <HelpLink article="receive-against-order">
                    How receiving works
                  </HelpLink>
                </p>

                <div className="po-receive-lines">
                  <div className="po-receive-head" aria-hidden="true">
                    <span>Item</span>
                    <span>Ordered</span>
                    <span>Received</span>
                    <span>Arriving now</span>
                  </div>
                  {selectedOrder.lines.map((line) => {
                    const outstanding = lineOutstanding(line);
                    const done = outstanding <= 0;
                    return (
                      <div
                        key={line.id}
                        className={`po-receive-line${done ? " po-receive-line-done" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="po-line-thumb">
                            <ProductThumbnail
                              src={
                                line.inventory_item_id !== null
                                  ? lineImages[line.inventory_item_id]
                                  : null
                              }
                              alt=""
                              width={40}
                              height={40}
                              sizes="40px"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-theme-primary">
                              {line.name_snapshot}
                              {line.affects_stock && (
                                <span className="po-stock-flag">→ stock</span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-theme-muted">
                              {[
                                line.item_code_snapshot,
                                line.sku_snapshot,
                                line.unit_label_snapshot,
                              ]
                                .filter(Boolean)
                                .join(" · ") ||
                                (line.line_type === "expense"
                                  ? "General purchase"
                                  : "Inventory item")}
                            </span>
                          </span>
                        </div>
                        <span className="po-receive-num" data-label="Ordered">
                          {formatUnits(line.quantity)}
                        </span>
                        <span className="po-receive-num" data-label="Received">
                          {formatUnits(line.received_quantity)}
                        </span>
                        <span
                          className="po-receive-input"
                          data-label="Arriving now"
                        >
                          {done ? (
                            <span className="text-xs font-semibold text-theme-success">
                              Complete
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={outstanding}
                              step={line.affects_stock ? "1" : "any"}
                              inputMode={
                                line.affects_stock ? "numeric" : "decimal"
                              }
                              value={receiveQuantities[line.id] ?? ""}
                              onChange={(event) =>
                                setReceiveQuantities((current) => ({
                                  ...current,
                                  [line.id]: event.target.value,
                                }))
                              }
                              aria-label={`Quantity of ${line.name_snapshot} arriving now (${formatUnits(
                                outstanding,
                              )} outstanding)`}
                              className="sale-input"
                            />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-theme-muted">
                  <span>
                    {receivingSummary.after > 0
                      ? `${unitsLabel(receivingSummary.after)} will still be outstanding after this delivery.`
                      : "This delivery completes the order."}
                  </span>
                  <button
                    type="button"
                    className="text-theme-accent underline-offset-2 hover:underline"
                    onClick={() => openPaymentPanel("receive")}
                  >
                    Reset to everything outstanding
                  </button>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-theme-secondary">
                    Delivery note (optional)
                  </span>
                  <input
                    value={receiveNotes}
                    onChange={(event) => setReceiveNotes(event.target.value)}
                    placeholder="Driver, delivery note number, damaged cartons…"
                    className="sale-input"
                  />
                </label>

                {receivingSummary.after > 0 && (
                  <label className="po-receive-close">
                    <input
                      type="checkbox"
                      checked={receiveClose}
                      onChange={(event) =>
                        setReceiveClose(event.target.checked)
                      }
                    />
                    <span>
                      <strong>Close the order after this delivery</strong>
                      <small>
                        The supplier will not send the rest. The order is marked
                        received with {formatUnits(receivingSummary.after)}{" "}
                        units recorded as never arrived.
                      </small>
                    </span>
                  </label>
                )}

                {!receivePaymentOpen ? (
                  <button
                    type="button"
                    className="justify-self-start text-sm font-semibold text-theme-accent underline-offset-2 hover:underline"
                    onClick={() => setReceivePaymentOpen(true)}
                  >
                    + Paid something on delivery? Record it here
                  </button>
                ) : (
                  <div className="grid gap-2">
                    <p className="po-detail-label">
                      Payment on delivery (optional)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-theme-secondary">
                          Amount paid now ({selectedOrder.currency_code || currencyCode})
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={payAmount}
                          onChange={(event) => setPayAmount(event.target.value)}
                          placeholder="This payment"
                          className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-theme-secondary">
                          Payment date
                        </span>
                        <input
                          type="date"
                          value={payDate}
                          onChange={(event) => setPayDate(event.target.value)}
                          className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                        />
                      </label>
                      <Select
                        label="Payment method"
                        value={payMethod}
                        onChange={setPayMethod}
                        options={[
                          { value: "", label: "Not set" },
                          ...Object.entries(
                            PURCHASE_ORDER_PAYMENT_METHOD_LABELS,
                          ).map(([value, label]) => ({ value, label })),
                        ]}
                      />
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-theme-secondary">
                          Paid by (optional)
                        </span>
                        <input
                          value={payBy}
                          onChange={(event) => setPayBy(event.target.value)}
                          placeholder="Person or account"
                          className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                        />
                      </label>
                      <label className="grid gap-1.5 sm:col-span-2">
                        <span className="text-xs font-bold text-theme-secondary">
                          Note (optional)
                        </span>
                        <input
                          value={payNote}
                          onChange={(event) => setPayNote(event.target.value)}
                          placeholder="e.g. deposit, balance on delivery"
                          className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentMode === "edit" && (
              <div className="po-payment-panel">
                <p className="po-detail-label">Add a payment</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-theme-secondary">
                      Amount paid now ({selectedOrder.currency_code || currencyCode})
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder="This payment"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-theme-secondary">
                      Payment date
                    </span>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(event) => setPayDate(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                    />
                  </label>
                  <Select
                    label="Payment method"
                    value={payMethod}
                    onChange={setPayMethod}
                    options={[
                      { value: "", label: "Not set" },
                      ...Object.entries(
                        PURCHASE_ORDER_PAYMENT_METHOD_LABELS,
                      ).map(([value, label]) => ({ value, label })),
                    ]}
                  />
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-theme-secondary">
                      Paid by (optional)
                    </span>
                    <input
                      value={payBy}
                      onChange={(event) => setPayBy(event.target.value)}
                      placeholder="Person or account"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-xs font-bold text-theme-secondary">
                      Note (optional)
                    </span>
                    <input
                      value={payNote}
                      onChange={(event) => setPayNote(event.target.value)}
                      placeholder="e.g. deposit, balance on delivery"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-sydin-blue/50 focus:ring-4 focus:ring-sydin-blue/15"
                    />
                  </label>
                </div>
              </div>
            )}

            {(paymentMode !== "receive" || receivePaymentOpen) &&
              (() => {
                const balance = getPurchaseOrderBalance(selectedOrder);
                return (
                  <div className="po-balance-strip">
                    <div>
                      <small>Order total</small>
                      <strong>
                        {formatPurchaseOrderAmount(selectedOrder, balance.total) ||
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <small>Paid</small>
                      <strong>
                        {formatPurchaseOrderAmount(selectedOrder, balance.paid) ||
                          "—"}
                      </strong>
                    </div>
                    <div
                      className={
                        balance.remaining > 0
                          ? "po-balance-remaining-due"
                          : "po-balance-remaining-clear"
                      }
                    >
                      <small>
                        {balance.remaining > 0 ? "Still owe" : "Fully paid"}
                      </small>
                      <strong>
                        {balance.remaining > 0
                          ? formatPurchaseOrderAmount(selectedOrder, balance.remaining)
                          : "✓"}
                      </strong>
                    </div>
                  </div>
                );
              })()}

            {paymentMode === "none" &&
              selectedOrder.status !== "draft" &&
              selectedOrder.status !== "cancelled" &&
              (() => {
                const progress =
                  getPurchaseOrderReceivingProgress(selectedOrder);
                return (
                  <div className="po-receiving-progress">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="po-detail-label">Receiving</p>
                      <p className="text-xs font-semibold text-theme-muted">
                        {formatUnits(progress.received)} of{" "}
                        {formatUnits(progress.ordered)} units received
                        {progress.remaining > 0
                          ? ` · ${formatUnits(progress.remaining)} ${
                              selectedOrder.closed_short
                                ? "never arrived"
                                : "still to come"
                            }`
                          : ""}
                      </p>
                    </div>
                    <div
                      className="po-progress-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percent}
                      aria-label="Share of ordered units received"
                    >
                      <div
                        className={`po-progress-fill${
                          selectedOrder.closed_short
                            ? " po-progress-fill-short"
                            : ""
                        }`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    {selectedOrder.closed_short && (
                      <p className="text-xs font-semibold text-theme-warning">
                        Closed short — the supplier did not send everything
                        ordered.
                      </p>
                    )}
                  </div>
                );
              })()}

            {paymentMode === "none" && selectedReceipts.length > 0 && (
              <div className="grid gap-1.5">
                <p className="po-detail-label">Deliveries</p>
                {selectedReceipts.map((receipt) => {
                  const units = receipt.lines.reduce(
                    (sum, line) => sum + line.quantity,
                    0,
                  );
                  return (
                    <div key={receipt.id} className="po-payment-row">
                      <span className="po-payment-row-icon" aria-hidden="true">
                        <UiIcon name="stock-in" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-theme-primary">
                          {unitsLabel(units)} · {receipt.receipt_number}
                        </span>
                        <span className="block truncate text-xs font-semibold text-theme-muted">
                          {[formatDate(receipt.received_at), receipt.notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {paymentMode === "none" && selectedPayments.length > 0 && (
              <div className="grid gap-1.5">
                <p className="po-detail-label">Payment history</p>
                {selectedPayments.map((payment) => (
                  <div key={payment.id} className="po-payment-row">
                    <span className="po-payment-row-icon" aria-hidden="true">
                      <UiIcon name="usage" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-theme-primary">
                        {formatPurchaseOrderAmount(selectedOrder, payment.amount)}
                      </span>
                      <span className="block truncate text-xs font-semibold text-theme-muted">
                        {[
                          formatDate(payment.paid_at),
                          payment.method
                            ? PURCHASE_ORDER_PAYMENT_METHOD_LABELS[
                                payment.method
                              ]
                            : "",
                          payment.paid_by ? `by ${payment.paid_by}` : "",
                          payment.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={actionBusy}
                      className="po-line-remove"
                      aria-label="Remove this payment"
                      title="Remove payment"
                    >
                      <UiIcon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* While receiving, the dialog is the goods-received note and
                nothing else: the order's own details and line prices come
                back when the delivery is recorded. */}
            {paymentMode !== "receive" && (
              <>
                <div className="po-detail-grid">
                  <div>
                    <p className="po-detail-label">Purchase date</p>
                    <p className="po-detail-value">
                      {formatDate(selectedOrder.purchase_date)}
                    </p>
                  </div>
                  <div>
                    <p className="po-detail-label">Depot</p>
                    <p className="po-detail-value">
                      {selectedOrder.depot_name_snapshot || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="po-detail-label">Supplier</p>
                    <p className="po-detail-value">
                      {selectedOrder.supplier_name_snapshot || "Not set"}
                    </p>
                    {selectedOrder.supplier_contact_snapshot && (
                      <p className="po-detail-sub">
                        {selectedOrder.supplier_contact_snapshot}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="po-detail-label">Payment</p>
                    <p className="po-detail-value">
                      {
                        PURCHASE_ORDER_PAYMENT_STATUS_LABELS[
                          selectedOrder.payment_status
                        ]
                      }
                      {selectedOrder.payment_method
                        ? ` · ${
                            PURCHASE_ORDER_PAYMENT_METHOD_LABELS[
                              selectedOrder.payment_method
                            ]
                          }`
                        : ""}
                    </p>
                    {(selectedOrder.paid_by ||
                      selectedOrder.amount_paid !== null) && (
                      <p className="po-detail-sub">
                        {[
                          selectedOrder.paid_by
                            ? `Paid by ${selectedOrder.paid_by}`
                            : "",
                          selectedOrder.amount_paid !== null
                            ? formatPurchaseOrderAmount(selectedOrder, selectedOrder.amount_paid)
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <p className="po-detail-label">Lines</p>
                  {selectedOrder.lines.map((line) => {
                    const lineTotal = getPurchaseOrderLineTotal(line);
                    return (
                      <div key={line.id} className="po-detail-line">
                        <span className="po-line-thumb">
                          <ProductThumbnail
                            src={
                              line.inventory_item_id !== null
                                ? lineImages[line.inventory_item_id]
                                : null
                            }
                            alt=""
                            width={40}
                            height={40}
                            sizes="40px"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-theme-primary">
                            {line.name_snapshot}
                            {line.affects_stock && (
                              <span className="po-stock-flag">→ stock</span>
                            )}
                            {selectedOrder.status !== "draft" &&
                              selectedOrder.status !== "cancelled" &&
                              line.received_quantity < line.quantity && (
                                <span className="po-received-flag">
                                  {formatUnits(line.received_quantity)} /{" "}
                                  {formatUnits(line.quantity)} received
                                </span>
                              )}
                          </span>
                          <span className="block truncate text-xs font-semibold text-theme-muted">
                            {[
                              line.line_type === "expense"
                                ? line.expense_category
                                  ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[
                                      line.expense_category
                                    ]
                                  : "General purchase"
                                : [line.item_code_snapshot, line.sku_snapshot]
                                    .filter(Boolean)
                                    .join(" · ") || "Inventory item",
                              line.notes,
                            ]
                              .filter(Boolean)
                              .join(" — ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-semibold text-theme-muted">
                            {line.quantity} ×{" "}
                            {line.unit_cost === null
                              ? "—"
                              : formatPurchaseOrderAmount(selectedOrder, line.unit_cost)}
                          </span>
                          <span className="block text-sm font-black text-theme-primary">
                            {lineTotal === null
                              ? "—"
                              : formatPurchaseOrderAmount(selectedOrder, lineTotal)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  <div className="po-detail-total">
                    <span>Total</span>
                    <strong>
                      {formatPurchaseOrderAmount(selectedOrder, getPurchaseOrderTotal(selectedOrder)) || "—"}
                    </strong>
                  </div>
                </div>

                {selectedOrder.attachment_url && (
                  <div className="grid gap-1.5">
                    <p className="po-detail-label">
                      Attachment
                      {selectedOrder.attachment_label
                        ? ` — ${selectedOrder.attachment_label}`
                        : ""}
                    </p>
                    <a
                      href={selectedOrder.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="po-attachment-link"
                    >
                      <Image
                        src={selectedOrder.attachment_url}
                        alt={
                          selectedOrder.attachment_label ||
                          "Purchase attachment"
                        }
                        width={480}
                        height={280}
                        unoptimized
                        className="max-h-56 w-full rounded-xl border border-theme bg-white object-contain"
                      />
                    </a>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <p className="po-detail-label">Notes</p>
                    <p className="text-sm font-semibold text-theme-secondary">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogShell>
      )}

      {selectedOrder && confirmDeleteDraft && (
        <DialogShell
          title={`Delete ${selectedOrder.po_number}?`}
          eyebrow={
            selectedOrder.status === "draft" ? "Delete draft" : "Delete order"
          }
          description="Nothing has been received or paid on it, so nothing else changes. This cannot be undone."
          tone="danger"
          onClose={() => setConfirmDeleteDraft(false)}
          closeDisabled={actionBusy}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmDeleteDraft(false)}
                disabled={actionBusy}
              >
                Keep it
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteDraft}
                loading={actionBusy}
                loadingLabel="Deleting…"
              >
                Delete
              </Button>
            </>
          }
        />
      )}
    </DashboardPageShell>
  );
}
