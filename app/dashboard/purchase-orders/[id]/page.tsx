"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { buttonClassName, useToast } from "@/components/ui";
import Select from "@/components/ui/Select";
import UiIcon from "@/components/UiIcon";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import { DashboardNotice, DashboardPageShell, LoadingSkeletonGroup } from "@/components/dashboard/Workspace";
import { useBusinessPeople } from "@/components/dashboard/DoneBy";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { getBusinessUser } from "@/app/lib/business";
import { supabase } from "@/app/lib/supabase";
import { formatDocumentDate, brandingFromSettings } from "@/app/lib/documentPdf";
import { paymentMethodLabel, paymentMethodOptions } from "@/app/lib/paymentMethods";
import { exportPurchaseOrderPdf } from "@/app/lib/purchaseOrderPdfExport";
import { exportPurchaseOrderExcel } from "@/app/lib/purchaseOrderExcelExport";
import { exportPurchaseOrderDocx } from "@/app/lib/documentDocxExports";
import { exportPaymentReceiptPdf } from "@/app/lib/paymentReceiptPdf";
import { exportStockReceiptPdf } from "@/app/lib/stockReceiptPdf";
import { getReceiptsForOrder, voidStockReceipt, type StockReceipt } from "@/app/lib/stockReceipts";
import { useCanDelete } from "@/components/dashboard/BusinessContext";
import { getInventoryUnitLabel } from "@/app/lib/inventoryItemModel";
import {
  buildPurchaseOrderDocument,
  getPurchaseOrderPublicUrl,
  loadPurchaseOrderParties,
} from "@/app/lib/purchaseOrderDocuments";
import type { Depot } from "@/app/lib/depots";
import type { Supplier } from "@/app/lib/suppliers";
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_TERMS_LABELS,
  addPurchaseOrderPayment,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  deletePurchaseOrderPayment,
  formatPurchaseOrderAmount,
  getPurchaseOrder,
  getPurchaseOrderActivity,
  getPurchaseOrderAttachmentUrl,
  getPurchaseOrderCurrency,
  getPurchaseOrderLineTotal,
  getPurchaseOrderPayments,
  getPurchaseOrderReceivingProgress,
  getPurchaseOrderSubtotal,
  getPurchaseOrderTotal,
  logPurchaseOrderActivity,
  markPurchaseOrderOrdered,
  updatePurchaseOrderFields,
  type PurchaseOrder,
  type PurchaseOrderActivity,
  type PurchaseOrderPayment,
} from "@/app/lib/purchaseOrders";

/*
 * One purchase order, as its own page (9 Oct 2026, Sayed's PO spec): linkable,
 * works with the back button. Stepper Created → Ordered → Received → Paid,
 * four figures, the lines with receiving done right in the table (no modal),
 * payments, the supplier with Call / WhatsApp, the dates and an activity
 * timeline. Saving goes through the same functions and database rules as
 * before: receiving is the phase-23 RPC, payments the phase-9 table.
 */

type Stage = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

function stageLabel(status: Stage) {
  return status === "draft"
    ? "Draft"
    : status === "ordered"
      ? "Ordered"
      : status === "partially_received"
        ? "Partly received"
        : status === "received"
          ? "Received"
          : "Cancelled";
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Lebanese numbers typed locally ("03 123 456", "76075247") → wa.me digits. */
function whatsappDigits(phone?: string | null) {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("961")) return digits;
  digits = digits.replace(/^0+/, "");
  return digits.length <= 8 ? `961${digits}` : digits;
}

interface TimelineEntry {
  key: string;
  text: string;
  at: string;
  by?: string | null;
}

export default function PurchaseOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const people = useBusinessPeople();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const orderId = Number(rawId);

  const [userId, setUserId] = useState("");
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [payments, setPayments] = useState<PurchaseOrderPayment[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const canDelete = useCanDelete();
  const [activity, setActivity] = useState<PurchaseOrderActivity[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [depot, setDepot] = useState<Depot | null>(null);
  const [lineImages, setLineImages] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payBy, setPayBy] = useState("");
  const [payDate, setPayDate] = useState(() => (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })());
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [deliveryInput, setDeliveryInput] = useState("");
  const moreRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(
    async (ownerId: string) => {
      const loaded = await getPurchaseOrder(ownerId, orderId);
      if (!loaded) throw new Error("This purchase order was not found.");
      const [loadedPayments, loadedReceipts, loadedActivity, parties] = await Promise.all([
        getPurchaseOrderPayments(orderId).catch(() => [] as PurchaseOrderPayment[]),
        getReceiptsForOrder(ownerId, orderId).catch(() => [] as StockReceipt[]),
        getPurchaseOrderActivity(orderId),
        loadPurchaseOrderParties(loaded),
      ]);
      setOrder(loaded);
      setPayments(loadedPayments);
      setReceipts(loadedReceipts);
      setActivity(loadedActivity);
      setSupplier(parties.supplier);
      setDepot(parties.depot);
      setAttachmentUrl(await getPurchaseOrderAttachmentUrl(loaded.attachment_url).catch(() => null));
      const itemIds = loaded.lines.map((line) => line.inventory_item_id).filter((id): id is number => id !== null);
      if (itemIds.length) {
        const { data } = await supabase.from("inventory").select("id, image").eq("user_id", ownerId).in("id", itemIds);
        setLineImages(
          Object.fromEntries(((data || []) as { id: number; image: string | null }[]).map((row) => [row.id, row.image]))
        );
      }
      return loaded;
    },
    [orderId]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await getBusinessUser();
      if (!user) throw new Error("Please sign in again.");
      const loadedSettings = await getOrCreateBusinessSettings(user.id);
      if (!active) return;
      setUserId(user.id);
      setSettings(loadedSettings);
      await reload(user.id);
    })()
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "This purchase order could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [moreOpen]);

  const nameOf = useCallback(
    (actorId?: string | null) => (actorId ? people?.get(actorId) || null : null),
    [people]
  );

  /* ---------------- derived ---------------- */

  const total = order ? getPurchaseOrderTotal(order) : 0;
  const subtotal = order ? getPurchaseOrderSubtotal(order) : 0;
  const paid = payments.length ? payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : Number(order?.amount_paid || 0);
  const balance = Math.max(0, total - paid);
  const progress = order ? getPurchaseOrderReceivingProgress(order) : { ordered: 0, received: 0, remaining: 0, percent: 0 };
  const status = (order?.status || "draft") as Stage;
  const canReceive = status === "ordered" || status === "partially_received";
  const money = (value: number | null | undefined) => (order ? formatPurchaseOrderAmount(order, value ?? 0) || "—" : "—");
  const supplierPhone = supplier?.whatsapp || supplier?.phone || "";
  const contactName = supplier?.contact_name || order?.supplier_contact_snapshot?.split("|")[0]?.trim() || "";
  const depotName = depot?.name || order?.depot_name_snapshot || "";
  const lastPayment = [...payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at))[0];

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!order) return [];
    const entries: TimelineEntry[] = [
      { key: "created", text: activity.some((entry) => entry.type === "created") ? "" : "Order created", at: order.created_at, by: nameOf(order.actor_id) },
      ...activity.map((entry) => ({ key: `a-${entry.id}`, text: entry.text, at: entry.created_at, by: nameOf(entry.actor_id) })),
      // Receipts made since phase 41 write their own activity line.
      ...receipts
        .filter((receipt) => !receipt.reference)
        .map((receipt) => {
          const unitsIn = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
          return {
            key: `r-${receipt.id}`,
            text: `Received ${unitsIn} ${unitsIn === 1 ? "unit" : "units"}${depotName ? ` into ${depotName}` : ""}`,
            at: receipt.received_at,
            by: nameOf(receipt.actor_id),
          };
        }),
      ...payments.map((payment) => ({
        key: `p-${payment.id}`,
        text: `Paid ${money(Number(payment.amount))}${payment.method ? ` · ${paymentMethodLabel(payment.method)}` : ""}`,
        at: payment.paid_at.length <= 10 ? `${payment.paid_at}T12:00:00` : payment.paid_at,
        by: nameOf(payment.actor_id),
      })),
    ];
    if (order.status === "cancelled" && order.cancelled_at && !activity.some((entry) => entry.type === "cancelled")) {
      entries.push({ key: "cancelled", text: "Order cancelled", at: order.cancelled_at });
    }
    return entries.filter((entry) => entry.text).sort((a, b) => b.at.localeCompare(a.at));
    // money depends on order only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, depotName, nameOf, order, payments, receipts]);

  /* ---------------- actions ---------------- */

  const run = async (work: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (actionError: unknown) {
      showToast({ tone: "danger", message: actionError instanceof Error ? actionError.message : failure });
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = () =>
    run(async () => {
      if (!order) return;
      await markPurchaseOrderOrdered(userId, order.id);
      await logPurchaseOrderActivity(userId, order.id, "placed", "Order placed");
      await reload(userId);
      showToast({ tone: "success", message: "Order placed" });
    }, "The order could not be placed.");

  /* Receiving is one screen for the whole app (phase 41): Stock in. */
  const startReceiving = () => router.push(`/dashboard/receiving/new?po=${orderId}`);

  const openPayment = () => {
    setPayAmount(balance > 0 ? String(Math.round(balance * 100) / 100) : "");
    setPayMethod(settings.payment_methods?.[0] || "cash");
    setPayBy(nameOf(userId) || "");
    setPayDate((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })());
    setPaymentOpen(true);
  };

  const savePayment = () =>
    run(async () => {
      if (!order) return;
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast({ tone: "danger", message: "Enter an amount above 0." });
        return;
      }
      await addPurchaseOrderPayment(order.id, { amount, method: payMethod, paid_by: payBy, paid_at: payDate });
      setPaymentOpen(false);
      await reload(userId);
      showToast({ tone: "success", message: `Payment of ${money(amount)} recorded` });
    }, "The payment could not be saved.");

  const removePayment = (payment: PurchaseOrderPayment) =>
    run(async () => {
      await deletePurchaseOrderPayment(payment.id);
      setDeletingPaymentId(null);
      if (order) await logPurchaseOrderActivity(userId, order.id, "edited", `Payment of ${money(Number(payment.amount))} removed`);
      await reload(userId);
      showToast({ tone: "success", message: "Payment removed" });
    }, "The payment could not be removed.");

  const saveCharges = () =>
    run(async () => {
      if (!order) return;
      const discount = discountInput.trim() === "" ? 0 : Number(discountInput);
      const delivery = deliveryInput.trim() === "" ? 0 : Number(deliveryInput);
      if (!Number.isFinite(discount) || discount < 0 || !Number.isFinite(delivery) || delivery < 0) {
        showToast({ tone: "danger", message: "Discount and delivery must be 0 or more." });
        return;
      }
      await updatePurchaseOrderFields(userId, order.id, { discount, delivery_fee: delivery });
      await logPurchaseOrderActivity(userId, order.id, "edited", `Discount ${money(discount)} · delivery ${money(delivery)}`);
      setChargesOpen(false);
      await reload(userId);
      showToast({ tone: "success", message: "Totals updated" });
    }, "The totals could not be saved.");

  const cancelOrder = () =>
    run(async () => {
      if (!order) return;
      await cancelPurchaseOrder(userId, order.id);
      await logPurchaseOrderActivity(userId, order.id, "cancelled", "Order cancelled");
      setConfirm(null);
      await reload(userId);
      showToast({ tone: "success", message: "Order cancelled" });
    }, "The order could not be cancelled.");

  const deleteDraft = () =>
    run(async () => {
      if (!order) return;
      await deletePurchaseOrder(userId, order.id);
      showToast({ tone: "success", message: `${order.po_number} deleted` });
      router.push("/dashboard/purchase-orders");
    }, "The draft could not be deleted.");

  const documentSpec = () =>
    order
      ? buildPurchaseOrderDocument({
          order,
          settings,
          supplier,
          depot,
          payments,
          lineImages,
          preparedBy: nameOf(order.actor_id || userId),
          origin: window.location.origin,
        })
      : null;

  const downloadPdf = () =>
    run(async () => {
      const spec = documentSpec();
      if (spec) await exportPurchaseOrderPdf(spec);
    }, "The PDF could not be made. Try again.");

  const downloadWord = () =>
    run(async () => {
      const spec = documentSpec();
      if (spec) await exportPurchaseOrderDocx(spec);
    }, "The Word file could not be made. Try again.");

  const downloadExcel = () =>
    run(async () => {
      const spec = documentSpec();
      if (!spec || !order) return;
      await exportPurchaseOrderExcel({
        details: spec.details,
        lines: order.lines.map((line) => ({
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
        branding: {
          businessName: settings.business_name,
          businessLogoUrl: settings.business_logo_url || undefined,
          contactEmail: settings.contact_email || undefined,
          contactPhone: settings.contact_phone || undefined,
          contactWebsite: settings.contact_website || undefined,
        },
        currencyCode: getPurchaseOrderCurrency(order),
      });
    }, "The Excel file could not be made. Try again.");

  const downloadReceipt = (payment: PurchaseOrderPayment) =>
    run(async () => {
      if (!order) return;
      const chronological = [...payments].sort((a, b) => (a.paid_at === b.paid_at ? a.id - b.id : a.paid_at.localeCompare(b.paid_at)));
      let paidSoFar = 0;
      let balanceAfter = total;
      for (const entry of chronological) {
        paidSoFar += Number(entry.amount);
        if (entry.id === payment.id) {
          balanceAfter = Math.max(0, total - paidSoFar);
          break;
        }
      }
      await exportPaymentReceiptPdf({
        details: {
          receiptNumber: `RCT-${order.po_number}-${payment.id}`,
          documentKind: "Purchase order",
          documentNumber: order.po_number,
          partyLabel: "Supplier",
          partyName: supplier?.name || order.supplier_name_snapshot || "Not set",
          partyContact: order.supplier_contact_snapshot || undefined,
          paidAt: payment.paid_at,
          amount: Number(payment.amount),
          currency: getPurchaseOrderCurrency(order),
          method: payment.method ? paymentMethodLabel(payment.method) : null,
          note: [payment.paid_by ? `Paid by ${payment.paid_by}` : "", payment.note || ""].filter(Boolean).join(" · "),
          documentTotal: total,
          balanceAfter,
        },
        branding: brandingFromSettings(settings),
      });
    }, "The receipt could not be made. Try again.");

  const downloadDeliveryNote = (receipt: StockReceipt) =>
    run(async () => {
      if (!order) return;
      await exportStockReceiptPdf({
        details: {
          reference: receipt.reference || receipt.receipt_number,
          poReference: receipt.po_reference || receipt.receipt_number,
          poNumber: order.po_number,
          sourceLabel: "Purchase order",
          receivedAt: receipt.received_at,
          receivedBy: receipt.received_by || nameOf(receipt.actor_id),
          supplierName: supplier?.name || order.supplier_name_snapshot,
          supplierPhone: supplierPhone || null,
          depotName: depotName || null,
          depotAddress: depot?.address || null,
          deliveryNoteNo: receipt.delivery_note_no,
          notes: receipt.notes,
          voided: receipt.status === "voided",
          qrUrl: getPurchaseOrderPublicUrl(order, window.location.origin),
        },
        lines: receipt.lines.map((line) => ({
          name: line.item?.name || order.lines.find((entry) => entry.id === line.purchase_order_line_id)?.name_snapshot || "Item",
          code: line.item?.item_code || line.item?.sku,
          unit: line.item ? getInventoryUnitLabel(line.item.unit_type, line.item.custom_unit_label) : null,
          imageUrl: line.item?.image || (line.inventory_item_id ? lineImages[line.inventory_item_id] : null),
          expected: line.expected_quantity,
          received: line.quantity,
          damaged: line.damaged_quantity,
          unitCost: line.unit_cost ?? order.lines.find((entry) => entry.id === line.purchase_order_line_id)?.unit_cost ?? null,
          batch: line.batch,
          expiryDate: line.expiry_date,
        })),
        branding: brandingFromSettings(settings),
        currencyCode: getPurchaseOrderCurrency(order),
      });
    }, "The delivery note could not be made. Try again.");

  const voidReceipt = (receipt: StockReceipt) =>
    run(async () => {
      await voidStockReceipt(receipt.id, "Voided from the purchase order");
      setVoidingId(null);
      await reload(userId);
      showToast({ tone: "success", message: `${receipt.reference || receipt.receipt_number} voided; its stock was taken back out.` });
    }, "The receipt could not be voided.");

  const sendWhatsApp = () => {
    if (!order) return;
    const digits = whatsappDigits(supplierPhone);
    const units = order.lines.length;
    const message = `Hello ${contactName || supplier?.name || ""}, please find our purchase order ${order.po_number} (${units} ${units === 1 ? "item" : "items"}, total ${money(total)}): ${getPurchaseOrderPublicUrl(order, window.location.origin)}`.replace("Hello ,", "Hello,");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    void logPurchaseOrderActivity(userId, order.id, "sent", `Sent to ${supplier?.name || order.supplier_name_snapshot || "the supplier"} on WhatsApp`).then(() =>
      getPurchaseOrderActivity(order.id).then(setActivity)
    );
  };

  // The list's "Receive" / "Pay" buttons land here with ?receive=1 / ?pay=1.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!order || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const canTakeDelivery = order.status === "ordered" || order.status === "partially_received";
    const frame = window.requestAnimationFrame(() => {
      if (params.get("receive") === "1" && canTakeDelivery) startReceiving();
      else if (params.get("pay") === "1" && order.status !== "cancelled") openPayment();
      if (params.has("receive") || params.has("pay")) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the order first arrives
  }, [order]);

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <DashboardPageShell as="main">
        <LoadingSkeletonGroup count={4} itemClassName="min-h-28" />
      </DashboardPageShell>
    );
  }

  if (error || !order) {
    return (
      <DashboardPageShell as="main">
        <Link href="/dashboard/purchase-orders" className="po-v2-back">
          ← Purchase orders
        </Link>
        <DashboardNotice tone="danger">{error || "This purchase order was not found."}</DashboardNotice>
      </DashboardPageShell>
    );
  }

  const steps = [
    { label: "Created", date: shortDate(order.created_at), done: true },
    {
      label: "Ordered",
      date: status === "draft" ? "Not yet" : shortDate(order.ordered_at || order.created_at),
      done: status !== "draft" && status !== "cancelled",
    },
    {
      label: status === "partially_received" ? "Partly received" : "Received",
      date:
        status === "received"
          ? shortDate(order.received_at || receipts[0]?.received_at)
          : status === "partially_received"
            ? shortDate(receipts[0]?.received_at)
            : order.expected_delivery_date
              ? `Expected ${shortDate(order.expected_delivery_date)}`
              : "Not yet",
      done: status === "received" || status === "partially_received",
    },
    {
      label: "Paid",
      date:
        order.payment_status === "paid"
          ? shortDate(lastPayment?.paid_at)
          : order.payment_terms
            ? PURCHASE_ORDER_PAYMENT_TERMS_LABELS[order.payment_terms].replace("Pay on delivery", "On delivery")
            : "Not yet",
      done: order.payment_status === "paid",
    },
  ];
  const currentStep = status === "cancelled" ? -1 : steps.findIndex((step) => !step.done);

  return (
    <DashboardPageShell as="main" className="po-v2">
      <Link href="/dashboard/purchase-orders" className="po-v2-back">
        ← Purchase orders
      </Link>

      <header className="po-v2-head motion-enter">
        <div className="po-v2-head-text">
          <div className="po-v2-title-row">
            <h1 className="is-mono">{order.po_number}</h1>
            <span className={`po-v2-pill is-${status}`}>{stageLabel(status)}</span>
            {status !== "draft" && status !== "cancelled" && total > 0 && (
              <span className={`po-v2-pill is-pay-${order.payment_status}`}>
                {order.payment_status === "paid" ? "Paid" : order.payment_status === "partial" ? "Partly paid" : "Unpaid"}
              </span>
            )}
          </div>
          <p>
            {[order.title, supplier?.name || order.supplier_name_snapshot, depotName ? `deliver to ${depotName}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="po-v2-head-actions">
          {status === "draft" ? (
            <button type="button" disabled={busy} onClick={() => void placeOrder()} className={buttonClassName()}>
              Place order
            </button>
          ) : (
            <button
              type="button"
              disabled={!whatsappDigits(supplierPhone) || status === "cancelled"}
              title={whatsappDigits(supplierPhone) ? "Open WhatsApp with the order link" : "Add the supplier's phone first"}
              onClick={sendWhatsApp}
              className={`${buttonClassName({ variant: "secondary" })} po-v2-whatsapp`}
            >
              Send on WhatsApp
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void downloadPdf()} className={buttonClassName({ variant: "secondary" })}>
            PDF
          </button>
          <div className="po-v2-more" ref={moreRef}>
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={buttonClassName({ variant: "secondary" })}>
              More <UiIcon name="chevron-down" className="h-4 w-4" />
            </button>
            {moreOpen && (
              <div className="po-v2-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void downloadWord(); }}>
                  Word file
                </button>
                <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void downloadExcel(); }}>
                  Excel file
                </button>
                <button type="button" role="menuitem" onClick={() => router.push(`/dashboard/purchase-orders/new?from=${order.id}`)}>
                  Duplicate
                </button>
                {status === "draft" && (
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { setMoreOpen(false); setConfirm("delete"); }}>
                    Delete draft
                  </button>
                )}
                {status === "ordered" && (
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { setMoreOpen(false); setConfirm("cancel"); }}>
                    Cancel order
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {confirm && (
        <div className="po-v2-confirm" role="alertdialog" aria-label="Confirm">
          <span>
            {confirm === "delete"
              ? `Delete draft ${order.po_number}? This cannot be undone.`
              : `Cancel ${order.po_number}? Nothing has been received, so stock does not change.`}
          </span>
          <button type="button" onClick={() => setConfirm(null)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
            Keep it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void (confirm === "delete" ? deleteDraft() : cancelOrder())}
            className={buttonClassName({ variant: "danger", size: "sm" })}
          >
            {confirm === "delete" ? "Delete draft" : "Cancel order"}
          </button>
        </div>
      )}

      {/* Stepper + figures */}
      <section className="po-v2-card po-v2-overview motion-enter" style={{ animationDelay: "60ms" }}>
        {status === "cancelled" ? (
          <p className="po-v2-cancelled">
            Cancelled {order.cancelled_at ? `on ${formatDocumentDate(order.cancelled_at)}` : ""}. Nothing was received.
          </p>
        ) : (
          <ol className="po-v2-steps">
            {steps.map((step, index) => (
              <li key={step.label} className={`${step.done ? "is-done" : ""} ${index === currentStep ? "is-current" : ""}`}>
                <span className="po-v2-step-dot" aria-hidden>
                  {step.done ? <UiIcon name="check" className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <strong>{step.label}</strong>
                <small>{step.date}</small>
              </li>
            ))}
          </ol>
        )}
        <div className="po-v2-tiles">
          <div className="po-v2-tile">
            <span>Order total</span>
            <strong className="is-mono">{money(total)}</strong>
          </div>
          <div className="po-v2-tile">
            <span>Paid</span>
            <strong className="is-mono">{money(paid)}</strong>
          </div>
          <div className={`po-v2-tile ${status === "cancelled" ? "" : balance > 0 ? "is-due" : "is-settled"}`}>
            <span>Balance due</span>
            <strong className="is-mono">{money(balance)}</strong>
          </div>
          <div className="po-v2-tile">
            <span>Received</span>
            <strong className="is-mono">
              {progress.received} / {progress.ordered}
            </strong>
            <span className="po-v2-bar" aria-hidden>
              <i style={{ transform: `scaleX(${progress.ordered ? progress.received / progress.ordered : 0})` }} />
            </span>
          </div>
        </div>
      </section>

      <div className="po-v2-grid">
        <div className="po-v2-main">
          {/* Items */}
          <section className="po-v2-card motion-enter" style={{ animationDelay: "120ms" }}>
            <div className="po-v2-card-head">
              <h2>Items</h2>
              {canReceive && (
                <button type="button" onClick={startReceiving} className={buttonClassName()}>
                  {status === "partially_received" ? "Receive the rest" : "Receive items"}
                </button>
              )}
              {status === "draft" && (
                <Link href={`/dashboard/purchase-orders/new?edit=${order.id}`} className={buttonClassName({ variant: "secondary" })}>
                  Edit draft
                </Link>
              )}
            </div>

            <div className="po-v2-table-wrap">
              <table className="po-v2-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="is-num">Ordered</th>
                    <th className="is-num">Received</th>
                    <th>Status</th>
                    <th className="is-num">Unit cost</th>
                    <th className="is-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const remaining = Math.max(0, line.quantity - line.received_quantity);
                    const image = line.inventory_item_id ? lineImages[line.inventory_item_id] : null;
                    return (
                      <tr key={line.id}>
                        <td>
                          <span className="po-v2-item">
                            <span className="po-v2-thumb">
                              {image ? (
                                <ProductThumbnail src={image} alt="" sizes="40px" imgClassName="object-cover" iconClassName="h-4 w-4" fallbackClassName="flex h-full w-full items-center justify-center" />
                              ) : (
                                line.name_snapshot.charAt(0).toUpperCase()
                              )}
                            </span>
                            <span>
                              {line.inventory_item_id ? (
                                <Link href={`/dashboard/inventory/${line.inventory_item_id}`} className="po-v2-item-name">
                                  {line.name_snapshot}
                                </Link>
                              ) : (
                                <span className="po-v2-item-name">{line.name_snapshot}</span>
                              )}
                              <small className={line.line_type === "expense" ? "" : "is-mono"}>
                                {line.line_type === "expense"
                                  ? `General purchase${line.expense_category ? ` · ${PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expense_category]}` : ""}`
                                  : line.item_code_snapshot || line.sku_snapshot || ""}
                              </small>
                            </span>
                          </span>
                        </td>
                        <td className="is-num is-mono">{line.quantity}</td>
                        <td className="is-num is-mono">{line.received_quantity}</td>
                        <td>
                          {status === "cancelled" ? (
                            <span className="po-v2-chip">Cancelled</span>
                          ) : remaining === 0 ? (
                            <span className="po-v2-chip is-done">Complete</span>
                          ) : line.received_quantity > 0 ? (
                            <span className="po-v2-chip is-partial">{remaining} still to come</span>
                          ) : (
                            <span className="po-v2-chip">{status === "draft" ? "Draft" : "Waiting"}</span>
                          )}
                        </td>
                        <td className="is-num is-mono">{line.unit_cost === null ? "—" : money(line.unit_cost)}</td>
                        <td className="is-num is-mono is-strong">{money(getPurchaseOrderLineTotal(line) || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="po-v2-sums">
              <div>
                <span>Subtotal</span>
                <b className="is-mono">{money(subtotal)}</b>
              </div>
              {chargesOpen ? (
                <div className="po-v2-charges">
                  <label>
                    Discount
                    <input value={discountInput} onChange={(event) => setDiscountInput(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="ui-input" />
                  </label>
                  <label>
                    Delivery fee
                    <input value={deliveryInput} onChange={(event) => setDeliveryInput(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="ui-input" />
                  </label>
                  <button type="button" onClick={() => setChargesOpen(false)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                    Cancel
                  </button>
                  <button type="button" disabled={busy} onClick={() => void saveCharges()} className={buttonClassName({ size: "sm" })}>
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <span>Discount</span>
                    <b className="is-mono">{order.discount > 0 ? `−${money(order.discount)}` : money(0)}</b>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <b className="is-mono">{money(order.delivery_fee)}</b>
                  </div>
                  {status !== "cancelled" && (
                    <button
                      type="button"
                      className="po-v2-link"
                      onClick={() => {
                        setDiscountInput(order.discount ? String(order.discount) : "");
                        setDeliveryInput(order.delivery_fee ? String(order.delivery_fee) : "");
                        setChargesOpen(true);
                      }}
                    >
                      Edit discount / delivery
                    </button>
                  )}
                </>
              )}
              <div className="is-total">
                <span>Total</span>
                <b className="is-mono">{money(total)}</b>
              </div>
            </div>
          </section>

          {/* Payments */}
          <section className="po-v2-card motion-enter" style={{ animationDelay: "180ms" }}>
            <div className="po-v2-card-head">
              <h2>Payments</h2>
              {status !== "cancelled" && !paymentOpen && (
                <button type="button" onClick={openPayment} className={buttonClassName({ variant: "secondary" })}>
                  Record payment
                </button>
              )}
            </div>
            {paymentOpen && (
              <div className="po-v2-pay-form">
                <label>
                  Amount
                  <input value={payAmount} onChange={(event) => setPayAmount(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="ui-input" autoFocus />
                </label>
                <label>
                  Method
                  <Select ariaLabel="Payment method" value={payMethod} onChange={setPayMethod} options={paymentMethodOptions(settings.payment_methods, payMethod)} />
                </label>
                <label>
                  Paid by
                  <input value={payBy} onChange={(event) => setPayBy(event.target.value)} className="ui-input" />
                </label>
                <label>
                  Date
                  <input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} className="ui-input" />
                </label>
                <div className="po-v2-pay-actions">
                  <button type="button" onClick={() => setPaymentOpen(false)} className={buttonClassName({ variant: "secondary" })}>
                    Cancel
                  </button>
                  <button type="button" disabled={busy} onClick={() => void savePayment()} className={buttonClassName()}>
                    Save payment
                  </button>
                </div>
              </div>
            )}
            {payments.length === 0 ? (
              <p className="po-v2-empty">
                No payments yet.
                {order.payment_terms ? ` Terms: ${PURCHASE_ORDER_PAYMENT_TERMS_LABELS[order.payment_terms].toLowerCase()}.` : ""}
              </p>
            ) : (
              <ul className="po-v2-payments">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    <span className="po-v2-pay-icon" aria-hidden>
                      <UiIcon name="check" className="h-3.5 w-3.5" />
                    </span>
                    <span className="po-v2-pay-text">
                      <strong className="is-mono">{money(Number(payment.amount))}</strong>
                      <small>
                        {[formatDocumentDate(payment.paid_at), payment.method ? paymentMethodLabel(payment.method) : "", payment.paid_by ? `by ${payment.paid_by}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    {deletingPaymentId === payment.id ? (
                      <>
                        <button type="button" onClick={() => setDeletingPaymentId(null)} className="po-v2-link">
                          Keep
                        </button>
                        <button type="button" disabled={busy} onClick={() => void removePayment(payment)} className="po-v2-link is-danger">
                          Delete payment
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => void downloadReceipt(payment)} className="po-v2-link">
                          Receipt
                        </button>
                        <button type="button" onClick={() => setDeletingPaymentId(payment.id)} className="po-v2-link is-danger" aria-label="Delete payment">
                          <UiIcon name="trash" className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {receipts.length > 0 && (
            <section className="po-v2-card motion-enter" style={{ animationDelay: "220ms" }}>
              <div className="po-v2-card-head">
                <h2>Deliveries</h2>
              </div>
              <ul className="po-v2-payments">
                {receipts.map((receipt) => {
                  const unitsIn = receipt.lines.reduce((sum, line) => sum + line.quantity - line.damaged_quantity, 0);
                  const damaged = receipt.lines.reduce((sum, line) => sum + line.damaged_quantity, 0);
                  return (
                    <li key={receipt.id} className={receipt.status === "voided" ? "is-voided" : ""}>
                      <span className="po-v2-pay-icon is-blue" aria-hidden>
                        <UiIcon name="download" className="h-3.5 w-3.5" />
                      </span>
                      <span className="po-v2-pay-text">
                        <strong className="is-mono">
                          {receipt.reference ? `${receipt.reference} · ${receipt.po_reference || receipt.receipt_number}` : receipt.receipt_number}
                          {receipt.status === "voided" ? " · voided" : ""}
                        </strong>
                        <small>
                          {[dateTime(receipt.received_at), `${unitsIn} into stock`, damaged ? `${damaged} damaged` : "", receipt.received_by || (nameOf(receipt.actor_id) ? `by ${nameOf(receipt.actor_id)}` : ""), receipt.delivery_note_no ? `note ${receipt.delivery_note_no}` : "", receipt.notes || ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      {voidingId === receipt.id ? (
                        <>
                          <button type="button" onClick={() => setVoidingId(null)} className="po-v2-link">
                            Keep
                          </button>
                          <button type="button" disabled={busy} onClick={() => void voidReceipt(receipt)} className="po-v2-link is-danger">
                            Void receipt
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => void downloadDeliveryNote(receipt)} className="po-v2-link">
                            GRN
                          </button>
                          {canDelete && receipt.status === "confirmed" && (
                            <button type="button" onClick={() => setVoidingId(receipt.id)} className="po-v2-link is-danger">
                              Void
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="po-v2-side">
          <section className="po-v2-card po-v2-supplier motion-enter" style={{ animationDelay: "120ms" }}>
            <span className="po-v2-label">Supplier</span>
            <h3>{supplier?.name || order.supplier_name_snapshot || "No supplier"}</h3>
            {(contactName || supplierPhone) && (
              <p>
                {contactName ? `Contact: ${contactName}` : ""}
                {contactName && supplierPhone ? " · " : ""}
                {supplierPhone && <span className="is-mono">{supplierPhone}</span>}
              </p>
            )}
            {supplierPhone && (
              <div className="po-v2-supplier-actions">
                <a href={`tel:${supplierPhone.replace(/[^\d+]/g, "")}`} className={buttonClassName({ variant: "secondary" })}>
                  Call
                </a>
                <a href={`https://wa.me/${whatsappDigits(supplierPhone)}`} target="_blank" rel="noopener noreferrer" className={`${buttonClassName({ variant: "secondary" })} po-v2-whatsapp`}>
                  WhatsApp
                </a>
              </div>
            )}
          </section>

          <section className="po-v2-card po-v2-dates motion-enter" style={{ animationDelay: "160ms" }}>
            <div>
              <span>Ordered</span>
              <strong>{status === "draft" ? "Not yet" : formatDocumentDate(order.ordered_at || order.purchase_date || order.created_at)}</strong>
            </div>
            <div>
              <span>Expected</span>
              <strong>{order.expected_delivery_date ? formatDocumentDate(order.expected_delivery_date) : "Not set"}</strong>
            </div>
            <div>
              <span>Deliver to</span>
              <strong>{depotName ? `${depotName}${depot?.code ? ` (${depot.code})` : ""}` : "Not set"}</strong>
            </div>
            <div>
              <span>Created by</span>
              <strong>{nameOf(order.actor_id || userId) || "You"}</strong>
            </div>
          </section>

          {attachmentUrl && (
            <section className="po-v2-card po-v2-supplier">
              <span className="po-v2-label">Supplier invoice</span>
              <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="po-v2-link">
                {order.attachment_label || "Open the attached file"} →
              </a>
            </section>
          )}

          <section className="po-v2-card po-v2-activity motion-enter" style={{ animationDelay: "200ms" }}>
            <h2>Activity</h2>
            <ul>
              {timeline.map((entry) => (
                <li key={entry.key}>
                  <span aria-hidden />
                  <strong>{entry.text}</strong>
                  <small>
                    {dateTime(entry.at)}
                    {entry.by ? ` · by ${entry.by}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </DashboardPageShell>
  );
}
