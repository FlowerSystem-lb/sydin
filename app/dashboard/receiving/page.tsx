"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import { buttonClassName, useToast } from "@/components/ui";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import { DashboardNotice, DashboardPageHeader, DashboardPageShell, LoadingSkeletonGroup } from "@/components/dashboard/Workspace";
import { useCanDelete } from "@/components/dashboard/BusinessContext";
import { getBusinessUser } from "@/app/lib/business";
import { supabase } from "@/app/lib/supabase";
import { DEFAULT_BUSINESS_SETTINGS, getOrCreateBusinessSettings, type BusinessSettings } from "@/app/lib/businessSettings";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import { getInventoryUnitLabel } from "@/app/lib/inventoryItemModel";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import { getPurchaseOrderReceivingProgress, getPurchaseOrdersForUser, type PurchaseOrder } from "@/app/lib/purchaseOrders";
import { getLegacyStockIns, getRecentReceipts, reasonLabel, voidStockReceipt, type StockReceipt } from "@/app/lib/stockReceipts";
import { exportStockReceiptPdf } from "@/app/lib/stockReceiptPdf";

/*
 * Stock in (redesign 9 Oct 2026, Sayed's spec): what just arrived? Pick the
 * order it belongs to, or receive without one / as a customer return. Every
 * way in leads to the same receiving screen (/dashboard/receiving/new) and the
 * same database transaction (confirm_stock_receipt). Recent receipts are
 * listed one per receipt, not one per item.
 */

interface FeedEntry {
  key: string;
  tag: "PO" | "D" | "SC" | "RT" | "IN";
  title: string;
  meta: string;
  badge: string;
  at: string;
  receipt?: StockReceipt;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StockInPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const canDelete = useCanDelete();
  const [userId, setUserId] = useState("");
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] = useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [legacy, setLegacy] = useState<Awaited<ReturnType<typeof getLegacyStockIns>>>([]);
  const [monthUnits, setMonthUnits] = useState(0);
  const [monthMoves, setMonthMoves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voiding, setVoiding] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (ownerId: string) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [loadedOrders, loadedReceipts, loadedLegacy, month] = await Promise.all([
      getPurchaseOrdersForUser(ownerId).catch(() => [] as PurchaseOrder[]),
      getRecentReceipts(ownerId, 30).catch(() => [] as StockReceipt[]),
      getLegacyStockIns(ownerId, 40),
      supabase.from("stock_movements").select("quantity_delta").eq("user_id", ownerId).eq("movement_type", "stock_in").gte("created_at", monthStart.toISOString()),
    ]);
    setOrders(loadedOrders);
    setReceipts(loadedReceipts);
    setLegacy(loadedLegacy);
    const rows = (month.data || []) as Array<{ quantity_delta: number }>;
    setMonthUnits(rows.reduce((sum, row) => sum + Number(row.quantity_delta || 0), 0));
    setMonthMoves(rows.length);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await getBusinessUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const [loadedSettings, loadedSubscription] = await Promise.all([getOrCreateBusinessSettings(user.id), getUserSubscription(user.id)]);
      if (!active) return;
      setUserId(user.id);
      setSettings(loadedSettings);
      setSubscription(loadedSubscription);
      await load(user.id);
    })()
      .catch(() => {
        if (active) setError("Stock in could not be loaded. Refresh and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const today = todayIso();
  const waiting = useMemo(
    () =>
      orders
        .filter((order) => order.status === "ordered" || order.status === "partially_received")
        .filter((order) => getPurchaseOrderReceivingProgress(order).remaining > 0)
        .sort((a, b) => {
          const overdueA = a.expected_delivery_date && a.expected_delivery_date < today ? 0 : 1;
          const overdueB = b.expected_delivery_date && b.expected_delivery_date < today ? 0 : 1;
          return overdueA - overdueB || (a.expected_delivery_date || "9999").localeCompare(b.expected_delivery_date || "9999");
        }),
    [orders, today]
  );
  const waitingUnits = waiting.reduce((sum, order) => sum + getPurchaseOrderReceivingProgress(order).remaining, 0);

  const feed = useMemo<FeedEntry[]>(() => {
    const fromReceipts: FeedEntry[] = receipts.map((receipt) => {
      const names = receipt.lines.map((line) => line.item?.name).filter(Boolean) as string[];
      const units = receipt.lines.reduce((sum, line) => sum + line.quantity - line.damaged_quantity, 0);
      const tag = receipt.source === "po" ? "PO" : receipt.source === "scanner" ? "SC" : receipt.source === "return" ? "RT" : "D";
      const sourceText =
        receipt.source === "po"
          ? receipt.po_reference || receipt.receipt_number
          : receipt.source === "return"
            ? "customer return"
            : receipt.source === "scanner"
              ? "Scanner"
              : `without order (${reasonLabel(receipt.reason).toLowerCase()})`;
      return {
        key: `r-${receipt.id}`,
        tag,
        title: names.slice(0, 5).join(", ") + (names.length > 5 ? ` +${names.length - 5}` : "") || "Receipt",
        meta: [shortDate(receipt.received_at), receipt.reference, sourceText, `${receipt.lines.length} ${receipt.lines.length === 1 ? "line" : "lines"}`, receipt.status === "voided" ? "voided" : ""].filter(Boolean).join(" · "),
        badge: receipt.status === "voided" ? "voided" : receipt.lines.length > 1 ? `${receipt.lines.length} lines` : `+${units}`,
        at: receipt.received_at,
        receipt,
      };
    });
    // Older stock-ins (before one receipt per delivery), grouped by note + minute.
    const groups = new Map<string, typeof legacy>();
    legacy.forEach((row) => {
      const groupKey = `${row.notes || ""}|${row.created_at.slice(0, 16)}`;
      groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
    });
    const fromLegacy: FeedEntry[] = [...groups.values()].map((rows) => {
      const note = rows[0].notes || "";
      const isScanner = /scanner/i.test(note);
      const units = rows.reduce((sum, row) => sum + Number(row.quantity_delta || 0), 0);
      const names = [...new Set(rows.map((row) => row.inventory?.name).filter(Boolean))] as string[];
      return {
        key: `m-${rows[0].id}`,
        tag: isScanner ? "SC" : "IN",
        title: names.slice(0, 5).join(", ") || "Stock in",
        meta: [shortDate(rows[0].created_at), note.replace(/\s+/g, " ").slice(0, 70)].filter(Boolean).join(" · "),
        badge: rows.length > 1 ? `${rows.length} lines` : `+${units}`,
        at: rows[0].created_at,
      };
    });
    return [...fromReceipts, ...fromLegacy].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
  }, [legacy, receipts]);

  const printReceipt = async (receipt: StockReceipt) => {
    const order = receipt.purchase_order_id ? orders.find((entry) => entry.id === receipt.purchase_order_id) : null;
    await exportStockReceiptPdf({
      details: {
        reference: receipt.reference || receipt.receipt_number,
        poReference: receipt.po_reference,
        poNumber: order?.po_number,
        sourceLabel: receipt.source === "po" ? "Purchase order" : receipt.source === "return" ? "Customer return" : receipt.source === "scanner" ? "Scanner" : `No order · ${reasonLabel(receipt.reason)}`,
        receivedAt: receipt.received_at,
        receivedBy: receipt.received_by,
        supplierName: receipt.supplier_name || order?.supplier_name_snapshot,
        depotName: order?.depot_name_snapshot,
        deliveryNoteNo: receipt.delivery_note_no,
        notes: receipt.notes,
        voided: receipt.status === "voided",
        qrUrl: `${window.location.origin}/dashboard/receiving`,
      },
      lines: receipt.lines.map((line) => ({
        name: line.item?.name || "Item",
        code: line.item?.item_code || line.item?.sku,
        unit: line.item ? getInventoryUnitLabel(line.item.unit_type, line.item.custom_unit_label) : null,
        imageUrl: line.item?.image,
        expected: line.expected_quantity,
        received: line.quantity,
        damaged: line.damaged_quantity,
        unitCost: line.unit_cost,
        batch: line.batch,
        expiryDate: line.expiry_date,
      })),
      branding: brandingFromSettings(settings),
    });
  };

  const voidReceipt = async (receipt: StockReceipt) => {
    if (busy) return;
    setBusy(true);
    try {
      await voidStockReceipt(receipt.id, "Voided from Stock in");
      setVoiding(null);
      await load(userId);
      showToast({ tone: "success", message: `${receipt.reference || receipt.receipt_number} voided; its stock was taken back out.` });
    } catch (voidError) {
      showToast({ tone: "danger", message: voidError instanceof Error ? voidError.message : "The receipt could not be voided." });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <DashboardPageHeader
      eyebrow="Buying"
      title="Stock in"
      description="What just arrived? Pick the order it belongs to — or receive without one."
      actions={
        <Link href="/dashboard/scanner?mode=receive" className={buttonClassName({ variant: "secondary" })}>
          <UiIcon name="scan" className="h-4 w-4" />
          Scan a delivery
        </Link>
      }
    />
  );

  if (!loading && !getSubscriptionCapabilities(subscription).receiving) {
    return (
      <DashboardPageShell as="main">
        {header}
        <LockedFeaturePanel
          feature="Stock In"
          benefit="Book arriving stock into a depot in one pass, with supplier, cost and quantity recorded against every item."
          currentPlan={formatPlanName(subscription.plan)}
          requiredPlan="Standard"
          source="receiving"
        />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell as="main" className="rcv-v2">
      {header}
      {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

      <section className="rcv-v2-sources">
        <a href="#waiting" className="rcv-v2-source is-recommended motion-enter">
          <span className="rcv-v2-source-icon is-blue" aria-hidden>
            <UiIcon name="cart" className="h-5 w-5" />
          </span>
          <strong>Against a purchase order</strong>
          <span>
            Expected items load automatically. Shortages become a backorder. <b>Recommended.</b>
          </span>
        </a>
        <Link href="/dashboard/receiving/new?source=no_order" className="rcv-v2-source motion-enter" style={{ animationDelay: "50ms" }}>
          <span className="rcv-v2-source-icon is-green" aria-hidden>
            <UiIcon name="download" className="h-5 w-5" />
          </span>
          <strong>Without an order</strong>
          <span>Walk-in supplier, gift, found stock or opening balance. Pick a reason.</span>
        </Link>
        <Link href="/dashboard/receiving/new?source=return" className="rcv-v2-source motion-enter" style={{ animationDelay: "100ms" }}>
          <span className="rcv-v2-source-icon is-amber" aria-hidden>
            <UiIcon name="movement" className="h-5 w-5" />
          </span>
          <strong>Customer return</strong>
          <span>Items coming back from a sale or event. Choose restock or damaged.</span>
        </Link>
      </section>

      <section id="waiting" className="po-v2-card rcv-v2-list motion-enter" style={{ animationDelay: "150ms" }}>
        <div className="po-v2-card-head">
          <h2>Waiting to be received</h2>
          <span className="rcv-v2-muted">
            {waiting.length} {waiting.length === 1 ? "order" : "orders"} · {waitingUnits} units
          </span>
        </div>
        {loading ? (
          <LoadingSkeletonGroup count={2} className="p-4" itemClassName="min-h-14" />
        ) : waiting.length === 0 ? (
          <p className="po-v2-empty">
            Nothing on order right now.{" "}
            <Link href="/dashboard/purchase-orders/new" className="po-v2-link">
              New purchase order
            </Link>
          </p>
        ) : (
          waiting.map((order) => {
            const progress = getPurchaseOrderReceivingProgress(order);
            const overdue = order.expected_delivery_date && order.expected_delivery_date < today;
            return (
              <div key={order.id} className="pol-v2-row rcv-v2-wait">
                <Link href={`/dashboard/purchase-orders/${order.id}`} className="pol-v2-row-link" aria-label={`Open ${order.po_number}`} />
                <span className="pon-v2-avatar rcv-v2-avatar">{(order.supplier_name_snapshot || "?").charAt(0).toUpperCase()}</span>
                <span className="pol-v2-main">
                  <span className="pol-v2-title">
                    <b className="is-mono">{order.po_number}</b>
                    <span>{order.supplier_name_snapshot || "No supplier"}</span>
                    {order.expected_delivery_date && (
                      <span className={`rcv-v2-expect ${overdue ? "is-overdue" : ""}`}>
                        {overdue ? "Overdue · " : "Expected "}
                        {shortDate(order.expected_delivery_date)}
                      </span>
                    )}
                  </span>
                  <small>
                    {[
                      `${order.lines.length} ${order.lines.length === 1 ? "line" : "lines"}`,
                      order.lines
                        .slice(0, 3)
                        .map((line) => `${line.name_snapshot} ${line.quantity - line.received_quantity}`)
                        .join(" · "),
                      order.depot_name_snapshot ? `to ${order.depot_name_snapshot}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="pol-v2-progress">
                  <span className="pol-v2-progress-top">
                    <span>
                      {progress.received} of {progress.ordered} received
                    </span>
                  </span>
                  <span className="pol-v2-bar" aria-hidden>
                    <i style={{ transform: `scaleX(${progress.ordered ? progress.received / progress.ordered : 0})` }} />
                  </span>
                </span>
                <span className="pol-v2-action">
                  <Link href={`/dashboard/receiving/new?po=${order.id}`} className={buttonClassName()}>
                    Receive
                  </Link>
                </span>
              </div>
            );
          })
        )}
      </section>

      <section className="po-v2-card rcv-v2-list motion-enter" style={{ animationDelay: "200ms" }}>
        <div className="po-v2-card-head">
          <h2>Recent receipts</h2>
          <span className="rcv-v2-muted rcv-v2-stats">
            <span>
              <b>{monthUnits}</b> units this month
            </span>
            <span>
              <b>{monthMoves}</b> movements
            </span>
            <Link href="/dashboard/stock-movements" className="po-v2-link">
              All movements →
            </Link>
          </span>
        </div>
        {loading ? (
          <LoadingSkeletonGroup count={3} className="p-4" itemClassName="min-h-12" />
        ) : feed.length === 0 ? (
          <p className="po-v2-empty">No stock has come in yet.</p>
        ) : (
          <ul className="rcv-v2-feed">
            {feed.map((entry) => (
              <li key={entry.key} className={entry.receipt?.status === "voided" ? "is-voided" : ""}>
                <span className={`rcv-v2-tag is-${entry.tag.toLowerCase()}`}>{entry.tag}</span>
                <span className="rcv-v2-feed-text">
                  <strong>{entry.title}</strong>
                  <small>{entry.meta}</small>
                </span>
                {entry.receipt && voiding === entry.receipt.id ? (
                  <span className="rcv-v2-feed-actions">
                    <span className="rcv-v2-muted">Take its stock back out?</span>
                    <button type="button" onClick={() => setVoiding(null)} className="po-v2-link">
                      Keep
                    </button>
                    <button type="button" disabled={busy} onClick={() => void voidReceipt(entry.receipt as StockReceipt)} className="po-v2-link is-danger">
                      Void receipt
                    </button>
                  </span>
                ) : (
                  <span className="rcv-v2-feed-actions">
                    {entry.receipt && (
                      <button type="button" onClick={() => void printReceipt(entry.receipt as StockReceipt)} className="po-v2-link">
                        GRN
                      </button>
                    )}
                    {entry.receipt && canDelete && entry.receipt.status === "confirmed" && (
                      <button type="button" onClick={() => setVoiding(entry.receipt?.id ?? null)} className="po-v2-link is-danger">
                        Void
                      </button>
                    )}
                    <span className={`rcv-v2-badge ${entry.badge === "voided" ? "is-voided" : ""}`}>{entry.badge}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardPageShell>
  );
}
