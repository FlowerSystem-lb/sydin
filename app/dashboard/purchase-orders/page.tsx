"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import { Badge, Button, DialogShell, Select } from "@/components/ui";
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
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_METHOD_LABELS,
  PURCHASE_ORDER_PAYMENT_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
  cancelPurchaseOrder,
  getPurchaseOrderBalance,
  getPurchaseOrderLineTotal,
  getPurchaseOrderSplit,
  getPurchaseOrderTotal,
  getPurchaseOrdersForUser,
  isPurchaseOrdersSchemaMissing,
  receivePurchaseOrder,
  updatePurchaseOrderPayment,
  type PurchaseOrder,
  type PurchaseOrderPaymentMethod,
  type PurchaseOrderPaymentStatus,
  type PurchaseOrderStatus,
} from "@/app/lib/purchaseOrders";
import { supabase } from "@/app/lib/supabase";

type StatusFilter = "all" | PurchaseOrderStatus;

const STATUS_TONES: Record<PurchaseOrderStatus, "neutral" | "accent" | "success" | "danger"> = {
  draft: "neutral",
  ordered: "accent",
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

function isInCurrentMonth(order: PurchaseOrder) {
  const source = order.purchase_date || order.created_at;
  if (!source) return false;
  const date = new Date(source.includes("T") ? source : `${source}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS
  );
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [depotFilter, setDepotFilter] = useState("all");

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  // "receive" = confirm receive + record payment together; "edit" = record payment only.
  const [paymentMode, setPaymentMode] = useState<"none" | "receive" | "edit">(
    "none"
  );
  const [payStatus, setPayStatus] =
    useState<PurchaseOrderPaymentStatus>("unpaid");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payBy, setPayBy] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [successNoticeTone, setSuccessNoticeTone] = useState<"success" | "warning">(
    "success"
  );

  const currencyCode = normalizeCurrencyCode(settings.currency_code, "USD");
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
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

      const loadedSettings = await getOrCreateBusinessSettings(user.id);
      if (!active) return;
      setSettings(loadedSettings);

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
            "Purchase orders could not be loaded. Refresh and try again."
          );
        }
      }
      setLoading(false);
    }

    loadData().catch(() => {
      if (!active) return;
      setLoadError("Purchase orders could not be loaded. Refresh and try again.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get("created");
    if (!created) return;
    const receiveFailed = params.get("receivefailed") === "1";

    const frame = window.requestAnimationFrame(() => {
      if (receiveFailed) {
        setSuccessNoticeTone("warning");
        setSuccessNotice(
          "Purchase order saved, but the stock update didn't run. Open it below and press Mark received to add the items to inventory."
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
    const groups: Array<{ key: string; label: string; orders: PurchaseOrder[] }> = [];
    const indexByKey = new Map<string, number>();

    for (const order of filteredOrders) {
      const source = order.purchase_date || order.created_at;
      const date = source
        ? new Date(source.includes("T") ? source : `${source}T00:00:00`)
        : null;
      const valid = date && !Number.isNaN(date.getTime());
      const key = valid ? `${date!.getFullYear()}-${date!.getMonth()}` : "undated";
      const label = valid
        ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date!)
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
      (order) => order.status !== "cancelled" && isInCurrentMonth(order)
    );
    let inventoryTotal = 0;
    let expenseTotal = 0;

    for (const order of monthOrders) {
      const split = getPurchaseOrderSplit(order);
      inventoryTotal += split.inventoryTotal;
      expenseTotal += split.expenseTotal;
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

  const openPaymentPanel = (mode: "receive" | "edit") => {
    if (!selectedOrder) return;
    setActionError("");
    setPayStatus(selectedOrder.payment_status);
    setPayAmount(
      selectedOrder.amount_paid !== null ? String(selectedOrder.amount_paid) : ""
    );
    setPayMethod(selectedOrder.payment_method || "");
    setPayBy(selectedOrder.paid_by || "");
    setPaymentMode(mode);
  };

  const buildPaymentUpdate = () => {
    const trimmedAmount = payAmount.trim();
    const parsedAmount = trimmedAmount === "" ? null : Number(trimmedAmount);
    return {
      payment_status: payStatus,
      amount_paid:
        parsedAmount !== null && Number.isFinite(parsedAmount) && parsedAmount >= 0
          ? parsedAmount
          : null,
      payment_method: (payMethod || null) as PurchaseOrderPaymentMethod | null,
      paid_by: payBy.trim() || null,
    };
  };

  const handleReceive = async () => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await updatePurchaseOrderPayment(
        userId,
        selectedOrder.id,
        buildPaymentUpdate()
      );
      await receivePurchaseOrder(selectedOrder.id);
      await refreshOrders();
      setPaymentMode("none");
      setSuccessNoticeTone("success");
      setSuccessNotice(
        `${selectedOrder.po_number} marked as received. Stock-affecting lines were added to inventory.`
      );
      setSelectedOrderId(null);
    } catch {
      setActionError(
        "The order could not be received. Refresh and try again — if a line's item was deleted, edit the order first."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await updatePurchaseOrderPayment(
        userId,
        selectedOrder.id,
        buildPaymentUpdate()
      );
      await refreshOrders();
      setPaymentMode("none");
    } catch {
      setActionError("The payment could not be updated. Try again.");
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

  const handleExportPdf = async () => {
    if (!selectedOrder) return;
    setActionBusy(true);
    setActionError("");
    try {
      await exportPurchaseOrderPdf({
        details: exportDetails(selectedOrder),
        lines: selectedOrder.lines.map((line) => ({
          name: line.name_snapshot,
          category:
            line.line_type === "expense" && line.expense_category
              ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expense_category]
              : undefined,
          code: line.item_code_snapshot || undefined,
          sku: line.sku_snapshot || undefined,
          unit: line.unit_label_snapshot || "unit",
          orderQuantity: line.quantity,
          unitCost: line.unit_cost,
          lineTotal: getPurchaseOrderLineTotal(line),
          note: line.notes || undefined,
        })),
        branding: exportBranding(),
        currencyCode,
      });
    } catch {
      setActionError("The PDF could not be generated. Try again.");
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
        currencyCode,
      });
    } catch {
      setActionError("The Excel file could not be generated. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <DashboardPageShell className="po-history-workspace">
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
        <DashboardNotice tone={successNoticeTone}>{successNotice}</DashboardNotice>
      )}
      {loadError && <DashboardNotice tone="danger">{loadError}</DashboardNotice>}
      {schemaMissing && (
        <DashboardNotice tone="warning">{SCHEMA_MISSING_MESSAGE}</DashboardNotice>
      )}

      {!schemaMissing && (
        <div className="po-summary-grid">
          <MetricCard
            label="Spent this month"
            value={formatInventoryPrice(spending.monthTotal, currencyCode) || "—"}
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
              className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-400/10"
            />
          </label>
          <Select
            ariaLabel="Status filter"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "all", label: "All statuses" },
              ...Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(
                ([value, label]) => ({ value, label })
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
          title={orders.length === 0 ? "No purchases yet" : "No matching purchases"}
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
              (sum, order) => sum + getPurchaseOrderTotal(order),
              0
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
                          <span className="po-history-row-icon" aria-hidden="true">
                            <UiIcon
                              name={
                                order.lines.some(
                                  (line) => line.line_type === "expense"
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
                                formatDate(order.purchase_date || order.created_at),
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
                          {remaining > 0 && (
                            <span
                              className="po-history-owe-chip"
                              title="Balance still owed"
                            >
                              Owe {formatInventoryPrice(remaining, currencyCode)}
                            </span>
                          )}
                          {order.attachment_url && (
                            <span
                              className="po-history-attachment-chip"
                              title="Invoice attached"
                            >
                              <UiIcon name="file" className="h-3.5 w-3.5" />
                              Invoice
                            </span>
                          )}
                          <span className="shrink-0 text-sm font-black text-theme-primary">
                            {formatInventoryPrice(total, currencyCode) || "—"}
                          </span>
                          <Badge tone={STATUS_TONES[order.status]}>
                            {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                          </Badge>
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
                <Button onClick={handleReceive} disabled={actionBusy}>
                  {actionBusy ? "Receiving…" : "Confirm receive"}
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
                  onClick={handleExportPdf}
                  disabled={actionBusy}
                >
                  Export PDF
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<UiIcon name="sheet" className="h-4 w-4" />}
                  onClick={handleExportExcel}
                  disabled={actionBusy}
                >
                  Export Excel
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
                {(selectedOrder.status === "draft" ||
                  selectedOrder.status === "ordered") && (
                  <>
                    <Button
                      variant="danger"
                      onClick={handleCancelOrder}
                      disabled={actionBusy}
                    >
                      Cancel order
                    </Button>
                    <Button
                      onClick={() => openPaymentPanel("receive")}
                      leadingIcon={<UiIcon name="check" className="h-4 w-4" />}
                      disabled={actionBusy}
                    >
                      Mark received
                    </Button>
                  </>
                )}
              </div>
            )
          }
        >
          <div className="grid gap-4">
            {actionError && (
              <DashboardNotice tone="danger">{actionError}</DashboardNotice>
            )}

            {paymentMode !== "none" && (
              <div className="po-payment-panel">
                {paymentMode === "receive" && (
                  <p className="po-payment-panel-note">
                    Receiving adds the &ldquo;add to stock&rdquo; lines to
                    inventory (final). Update the payment below if you paid the
                    balance on delivery, then confirm.
                  </p>
                )}
                <p className="po-detail-label">
                  {paymentMode === "receive"
                    ? "Payment on delivery"
                    : "Record payment"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Payment status"
                    value={payStatus}
                    onChange={(value) =>
                      setPayStatus(value as PurchaseOrderPaymentStatus)
                    }
                    options={Object.entries(
                      PURCHASE_ORDER_PAYMENT_STATUS_LABELS
                    ).map(([value, label]) => ({ value, label }))}
                  />
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-theme-secondary">
                      Amount paid ({currencyCode})
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder="Total paid so far"
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                    />
                  </label>
                  <Select
                    label="Payment method"
                    value={payMethod}
                    onChange={setPayMethod}
                    options={[
                      { value: "", label: "Not set" },
                      ...Object.entries(
                        PURCHASE_ORDER_PAYMENT_METHOD_LABELS
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
                      className="min-h-11 w-full rounded-xl border border-theme bg-theme-inset px-3 text-sm text-theme-primary outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/15"
                    />
                  </label>
                </div>
              </div>
            )}

            {(() => {
              const balance = getPurchaseOrderBalance(selectedOrder);
              return (
                <div className="po-balance-strip">
                  <div>
                    <small>Order total</small>
                    <strong>
                      {formatInventoryPrice(balance.total, currencyCode) || "—"}
                    </strong>
                  </div>
                  <div>
                    <small>Paid</small>
                    <strong>
                      {formatInventoryPrice(balance.paid, currencyCode) || "—"}
                    </strong>
                  </div>
                  <div
                    className={
                      balance.remaining > 0
                        ? "po-balance-remaining-due"
                        : "po-balance-remaining-clear"
                    }
                  >
                    <small>{balance.remaining > 0 ? "Still owe" : "Fully paid"}</small>
                    <strong>
                      {balance.remaining > 0
                        ? formatInventoryPrice(balance.remaining, currencyCode)
                        : "✓"}
                    </strong>
                  </div>
                </div>
              );
            })()}

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
                {(selectedOrder.paid_by || selectedOrder.amount_paid !== null) && (
                  <p className="po-detail-sub">
                    {[
                      selectedOrder.paid_by
                        ? `Paid by ${selectedOrder.paid_by}`
                        : "",
                      selectedOrder.amount_paid !== null
                        ? formatInventoryPrice(
                            selectedOrder.amount_paid,
                            currencyCode
                          )
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-theme-primary">
                        {line.name_snapshot}
                        {line.affects_stock && (
                          <span className="po-stock-flag">→ stock</span>
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
                          : formatInventoryPrice(line.unit_cost, currencyCode)}
                      </span>
                      <span className="block text-sm font-black text-theme-primary">
                        {lineTotal === null
                          ? "—"
                          : formatInventoryPrice(lineTotal, currencyCode)}
                      </span>
                    </span>
                  </div>
                );
              })}
              <div className="po-detail-total">
                <span>Total</span>
                <strong>
                  {formatInventoryPrice(
                    getPurchaseOrderTotal(selectedOrder),
                    currencyCode
                  ) || "—"}
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
                    alt={selectedOrder.attachment_label || "Purchase attachment"}
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
          </div>
        </DialogShell>
      )}
    </DashboardPageShell>
  );
}
